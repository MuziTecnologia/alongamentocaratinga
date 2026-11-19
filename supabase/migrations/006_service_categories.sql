-- Categorias escolhidas no cadastro (Aplicação, Manutenção ou Nail Art) passam a valer
-- na reserva pública: serviços marcados como Nail Art não podem ser reservados sozinhos,
-- e serviços marcados como Aplicação/Manutenção nunca são bloqueados pelo nome.
-- Serviços com categoria antiga (ex.: "Cuidados") seguem a regra pelo nome, como na 004.
-- Não altera nenhum serviço cadastrado. Execute depois da 004. Pode ser executada novamente.
begin;
create or replace function public.book_appointment(p_slug text,p_service uuid,p_professional uuid,p_date date,p_time text,p_name text,p_phone text,p_email text default '',p_nail_art boolean default false) returns uuid language plpgsql security definer set search_path = '' as $$
declare b public.businesses; s public.services; customer uuid; result uuid; normalized text; begins timestamptz; begin
  if length(trim(p_name)) not between 2 and 120 or length(p_phone) > 30 or length(p_email) > 254 or (p_email <> '' and p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'Confira seu nome, telefone e e-mail.'; end if;
  normalized := regexp_replace(p_phone,'[^0-9]','','g');
  if length(normalized) in (12,13) and left(normalized,2)='55' then normalized:=substr(normalized,3); end if;
  if length(normalized) not in (10,11) or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Informe um telefone e horário válidos.'; end if;
  select * into b from public.businesses where slug=p_slug and booking_enabled;
  if b.id is null then raise exception 'Agendamento indisponível.'; end if;
  select * into s from public.services where id=p_service and business_id=b.id and active;
  if lower(trim(s.category))='nail art'
    or (lower(trim(s.category)) not in ('aplicação','aplicacao','manutenção','manutencao') and s.name ~* '(nail ?art|decora[cç][aã]o)') then
    raise exception 'A nail art é uma cortesia incluída junto a outro serviço. Escolha o serviço principal.';
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
      case when coalesce(p_nail_art,false) then 'Nail art: Sim (cortesia)' else 'Nail art: Não solicitada' end) returning id into result;
  return result;
end $$;
revoke all on function public.book_appointment(text,uuid,uuid,date,text,text,text,text,boolean) from public;
grant execute on function public.book_appointment(text,uuid,uuid,date,text,text,text,text,boolean) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
