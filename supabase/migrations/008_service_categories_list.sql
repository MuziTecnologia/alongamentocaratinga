-- Categorias de serviço gerenciadas pelo studio (renomear, adicionar, remover).
-- Cada item: {"name": "...", "nail_art": true|false}. Categorias marcadas como nail art
-- são cortesia: não aparecem como serviço principal e não podem ser reservadas sozinhas.
-- Execute depois da 007. Não altera serviços nem pacotes. Pode ser executada novamente.
begin;

alter table public.businesses add column if not exists service_categories jsonb not null
  default '[{"name":"Aplicação"},{"name":"Manutenção"},{"name":"Nail Art","nail_art":true}]'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='businesses_service_categories_check' and conrelid='public.businesses'::regclass) then
    alter table public.businesses add constraint businesses_service_categories_check
      check (jsonb_typeof(service_categories)='array' and jsonb_array_length(service_categories) <= 30 and length(service_categories::text) <= 4000);
  end if;
end $$;

-- Fachada pública: inclui a lista de categorias (mantém pacotes e etapa de nail art).
create or replace function public.get_public_studio(p_slug text) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'business', jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'description',b.description,'phone',b.phone,'address',b.address,'instagram',b.instagram,'hours',b.hours,'payment_methods',b.payment_methods,'booking_enabled',b.booking_enabled,'notice_hours',b.notice_hours,'reminder_hours',b.reminder_hours,'cancellation_hours',b.cancellation_hours,'nail_art_step',b.nail_art_step,'service_categories',b.service_categories),
    'services', coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from public.services s where s.business_id=b.id and s.active),'[]'::jsonb),
    'packages', coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'name',k.name,'service_id',k.service_id,'sessions',k.sessions,'price',k.price,'validity_days',k.validity_days) order by k.name)
      from public.packages k join public.services s on s.id=k.service_id and s.business_id=k.business_id
      where k.business_id=b.id and k.active and s.active),'[]'::jsonb),
    'professionals', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'business_id',p.business_id,'name',p.name,'role',p.role,'color',p.color,'active',p.active) order by p.name) from public.professionals p where p.business_id=b.id and p.active),'[]'::jsonb),
    'gallery', coalesce((select jsonb_agg(to_jsonb(g)) from public.gallery g where g.business_id=b.id),'[]'::jsonb)
  ) from public.businesses b where b.slug=p_slug;
$$;
revoke all on function public.get_public_studio(text) from public;
grant execute on function public.get_public_studio(text) to anon,authenticated;

-- Reserva: a regra de nail art passa a usar as categorias do studio.
drop function if exists public.book_appointment(text,uuid,uuid,date,text,text,text,text,boolean);
create or replace function public.book_appointment(p_slug text,p_service uuid,p_professional uuid,p_date date,p_time text,p_name text,p_phone text,p_email text default '',p_nail_art boolean default false,p_package uuid default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare b public.businesses; s public.services; pk public.packages; customer uuid; result uuid; normalized text; begins timestamptz; listed boolean; art boolean; begin
  if length(trim(p_name)) not between 2 and 120 or length(p_phone) > 30 or length(p_email) > 254 or (p_email <> '' and p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'Confira seu nome, telefone e e-mail.'; end if;
  normalized := regexp_replace(p_phone,'[^0-9]','','g');
  if length(normalized) in (12,13) and left(normalized,2)='55' then normalized:=substr(normalized,3); end if;
  if length(normalized) not in (10,11) or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Informe um telefone e horário válidos.'; end if;
  select * into b from public.businesses where slug=p_slug and booking_enabled;
  if b.id is null then raise exception 'Agendamento indisponível.'; end if;
  select * into s from public.services where id=p_service and business_id=b.id and active;
  -- Categoria cadastrada na lista do studio decide; categoria antiga (fora da lista) usa o nome.
  select count(*)>0, coalesce(bool_or(coalesce((c->>'nail_art')::boolean,false)),false) into listed, art
    from jsonb_array_elements(coalesce(b.service_categories,'[]'::jsonb)) c
    where lower(trim(c->>'name'))=lower(trim(s.category));
  if art or (not listed and s.name ~* '(nail ?art|decora[cç][aã]o)') then
    raise exception 'A nail art é uma cortesia incluída junto a outro serviço. Escolha o serviço principal.';
  end if;
  if p_package is not null then
    select * into pk from public.packages where id=p_package and business_id=b.id and active and service_id=p_service;
    if pk.id is null then raise exception 'Esse pacote não está disponível. Escolha outro.'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(b.id::text,0));
  if not exists(select 1 from public.get_available_slots(p_slug,p_service,p_professional,p_date) x where x.slot=p_time) then raise exception 'Esse horário não está mais disponível. Escolha outro.'; end if;
  select id into customer from public.clients where business_id=b.id and phone=normalized;
  if customer is not null and (select count(*) from public.appointments where client_id=customer and status in ('pending','confirmed') and starts_at>now()) >= 3 then raise exception 'Você já tem três reservas futuras. Fale com o studio para agendar mais.'; end if;
  if (select count(*) from public.appointments where business_id=b.id and source='link' and created_at>now()-interval '1 hour') >= 30 then raise exception 'Muitas reservas recentes. Entre em contato com o studio.'; end if;
  -- Não altera nome, e-mail ou observações de uma cliente já cadastrada por uma chamada pública.
  if customer is null then insert into public.clients(business_id,name,phone,email) values(b.id,trim(p_name),normalized,trim(p_email)) returning id into customer; end if;
  begins := (p_date+p_time::time) at time zone 'America/Sao_Paulo';
  insert into public.appointments(business_id,professional_id,client_id,service_id,starts_at,ends_at,price,source,status,notes)
    values(b.id,p_professional,customer,p_service,begins,begins+make_interval(mins=>s.duration),s.price,'link','pending',
      case when coalesce(p_nail_art,false) then 'Nail art: Sim (cortesia)' else 'Nail art: Não solicitada' end
      || case when pk.id is not null then ' · Pacote: '||pk.name||' ('||pk.sessions||' sessões · R$ '||replace(to_char(pk.price,'FM999999990.00'),'.',',')||')' else '' end)
    returning id into result;
  return result;
end $$;
revoke all on function public.book_appointment(text,uuid,uuid,date,text,text,text,text,boolean,uuid) from public;
grant execute on function public.book_appointment(text,uuid,uuid,date,text,text,text,text,boolean,uuid) to anon,authenticated;

notify pgrst, 'reload schema';
commit;
