-- Execute uma vez no SQL Editor do Supabase. Não contém dados de demonstração.
begin;
set local search_path = public, extensions;
create extension if not exists btree_gist with schema extensions;

create table public.businesses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'AlongamentosCaratinga', slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  description text not null default 'Seu momento de autocuidado, com carinho em cada detalhe.', phone text not null default '',
  address text not null default 'Caratinga, MG', instagram text not null default '',
  hours jsonb not null default '{"0":{"enabled":false,"start":"09:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"1":{"enabled":true,"start":"09:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"2":{"enabled":true,"start":"09:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"3":{"enabled":true,"start":"09:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"4":{"enabled":true,"start":"09:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"5":{"enabled":true,"start":"09:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"6":{"enabled":true,"start":"09:00","end":"19:00","break_start":"12:00","break_end":"13:00"}}',
  payment_methods text[] not null default array['Pix','Dinheiro','Cartão de crédito','Cartão de débito'],
  booking_enabled boolean not null default true, notice_hours integer not null default 2 check (notice_hours between 0 and 168),
  reminder_hours integer not null default 24 check (reminder_hours between 1 and 168),
  cancellation_hours integer not null default 12 check (cancellation_hours between 0 and 168),
  email_reminders boolean not null default false, created_at timestamptz not null default now()
);
create table public.professionals (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(name) between 1 and 120), role text not null default 'Nail designer', color text not null default '#799780',
  commission numeric(5,2) not null default 0 check (commission between 0 and 100), active boolean not null default true, unique(business_id,id)
);
create table public.services (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(name) between 1 and 120), category text not null default 'Cuidados', description text not null default '',
  duration integer not null check (duration between 15 and 480), price numeric(10,2) not null check (price >= 0),
  color text not null default '#dbe9d8', active boolean not null default true, unique(business_id,id)
);
create table public.clients (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(name) between 2 and 120), phone text not null default '', email text not null default '',
  birthday date, notes text not null default '', created_at timestamptz not null default now(), unique(business_id,id)
);
create unique index clients_phone_unique on public.clients(business_id,phone) where phone <> '';
create table public.packages (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, service_id uuid not null, sessions integer not null check (sessions between 1 and 100),
  price numeric(10,2) not null check (price >= 0), validity_days integer not null check (validity_days between 1 and 730), active boolean not null default true,
  foreign key (business_id,service_id) references public.services(business_id,id), unique(business_id,id)
);
create table public.customer_packages (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null, package_id uuid not null, sessions_used integer not null default 0,
  sessions_total integer not null check (sessions_total between 1 and 100), price numeric(10,2) not null check (price >= 0),
  purchased_at date not null default current_date, expires_at date not null, paid boolean not null default true,
  check (sessions_used between 0 and sessions_total), check (expires_at >= purchased_at),
  foreign key (business_id,client_id) references public.clients(business_id,id),
  foreign key (business_id,package_id) references public.packages(business_id,id), unique(business_id,id)
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null, client_id uuid, service_id uuid,
  starts_at timestamptz not null, ends_at timestamptz not null, price numeric(10,2) not null default 0 check (price >= 0),
  status text not null default 'confirmed' check (status in ('pending','confirmed','completed','cancelled','no_show')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid')), payment_method text not null default '', notes text not null default '',
  kind text not null default 'booking' check (kind in ('booking','block')), source text not null default 'panel' check (source in ('panel','link')),
  customer_package_id uuid, reminder_sent_at timestamptz, created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours'),
  check (kind = 'block' or (client_id is not null and service_id is not null)),
  foreign key (business_id,professional_id) references public.professionals(business_id,id),
  foreign key (business_id,client_id) references public.clients(business_id,id),
  foreign key (business_id,service_id) references public.services(business_id,id),
  foreign key (business_id,customer_package_id) references public.customer_packages(business_id,id),
  exclude using gist (professional_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where (status not in ('cancelled','no_show'))
);
create index appointments_business_time on public.appointments(business_id, starts_at);
create index appointments_client on public.appointments(client_id);
create index appointments_reminders on public.appointments(starts_at) where reminder_sent_at is null and kind = 'booking' and status in ('pending','confirmed');
create table public.transactions (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null check (type in ('income','expense')), description text not null, category text not null default 'Outros',
  amount numeric(10,2) not null check (amount > 0), date date not null, payment_method text not null default 'Pix'
);
create table public.gallery (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  url text not null check (url ~ '^https://'), caption text not null default ''
);

create function public.is_studio_owner(studio uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.businesses where id = studio and owner_id = (select auth.uid()));
$$;
revoke all on function public.is_studio_owner(uuid) from public;
grant execute on function public.is_studio_owner(uuid) to authenticated;
alter table public.businesses enable row level security;
create policy own_business on public.businesses for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
do $$ declare t text; begin
  foreach t in array array['professionals','services','clients','appointments','transactions','packages','customer_packages','gallery'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy own_studio on public.%I for all to authenticated using (public.is_studio_owner(business_id)) with check (public.is_studio_owner(business_id))', t);
  end loop;
end $$;
grant usage on schema public to anon,authenticated;
grant select,insert,update,delete on public.businesses,public.professionals,public.services,public.clients,public.appointments,public.transactions,public.packages,public.customer_packages,public.gallery to authenticated;
revoke all on public.businesses,public.professionals,public.services,public.clients,public.appointments,public.transactions,public.packages,public.customer_packages,public.gallery from anon;

create function public.bootstrap_studio() returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; new_slug text := 'alongamentoscaratinga'; begin
  if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select id into result from public.businesses where owner_id=auth.uid();
  if result is not null then return result; end if;
  if exists(select 1 from public.businesses where slug=new_slug) then new_slug := new_slug || '-' || substr(gen_random_uuid()::text,1,8); end if;
  insert into public.businesses(owner_id,slug) values(auth.uid(),new_slug) returning id into result;
  insert into public.professionals(business_id,name,role) values(result,'Minha agenda','Nail designer');
  return result;
end $$;
revoke all on function public.bootstrap_studio() from public;
grant execute on function public.bootstrap_studio() to authenticated;

-- Serializa alterações de agenda e conta sessões apenas ao concluir o atendimento.
create function public.manage_package_session() returns trigger language plpgsql security definer set search_path = '' as $$
declare pack public.customer_packages; definition public.packages; begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.business_id,old.business_id)::text,0));
  if tg_op='UPDATE' and new.starts_at is distinct from old.starts_at then new.reminder_sent_at := null; end if;
  if tg_op <> 'INSERT' and old.customer_package_id is not null and old.status='completed' then
    update public.customer_packages set sessions_used=greatest(0,sessions_used-1) where id=old.customer_package_id;
  end if;
  if tg_op <> 'DELETE' and new.customer_package_id is not null and new.status not in ('cancelled','no_show') then
    select * into pack from public.customer_packages where id=new.customer_package_id and business_id=new.business_id for update;
    select * into definition from public.packages where id=pack.package_id;
    if pack.id is null or pack.client_id <> new.client_id or definition.service_id <> new.service_id or pack.expires_at < (new.starts_at at time zone 'America/Sao_Paulo')::date or pack.sessions_used >= pack.sessions_total then
      raise exception 'Pacote incompatível, vencido ou sem sessões disponíveis.';
    end if;
    new.price := 0;
    if new.status='completed' then update public.customer_packages set sessions_used=sessions_used+1 where id=pack.id; end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger appointment_package before insert or update or delete on public.appointments for each row execute function public.manage_package_session();
revoke all on function public.manage_package_session() from public;

-- Somente a fachada pública: não retorna clientes, finanças, auth ou anotações.
create function public.get_public_studio(p_slug text) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'business', jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'description',b.description,'phone',b.phone,'address',b.address,'instagram',b.instagram,'hours',b.hours,'payment_methods',b.payment_methods,'booking_enabled',b.booking_enabled,'notice_hours',b.notice_hours,'reminder_hours',b.reminder_hours,'cancellation_hours',b.cancellation_hours),
    'services', coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from public.services s where s.business_id=b.id and s.active),'[]'::jsonb),
    'professionals', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'business_id',p.business_id,'name',p.name,'role',p.role,'color',p.color,'active',p.active) order by p.name) from public.professionals p where p.business_id=b.id and p.active),'[]'::jsonb),
    'gallery', coalesce((select jsonb_agg(to_jsonb(g)) from public.gallery g where g.business_id=b.id),'[]'::jsonb)
  ) from public.businesses b where b.slug=p_slug;
$$;

create function public.get_available_slots(p_slug text,p_service uuid,p_professional uuid,p_date date) returns table(slot text) language plpgsql stable security definer set search_path = '' as $$
declare b public.businesses; s public.services; h jsonb; candidate timestamptz; closing timestamptz; finish timestamptz; bs timestamptz; be timestamptz; begin
  select * into b from public.businesses where slug=p_slug and booking_enabled;
  select * into s from public.services where id=p_service and business_id=b.id and active;
  if b.id is null or s.id is null or not exists(select 1 from public.professionals where id=p_professional and business_id=b.id and active) then return; end if;
  if p_date < (now() at time zone 'America/Sao_Paulo')::date or p_date > (now() at time zone 'America/Sao_Paulo')::date+90 then return; end if;
  h := b.hours -> extract(dow from p_date)::integer::text;
  if h is null or not coalesce((h->>'enabled')::boolean,false) then return; end if;
  candidate := (p_date + (h->>'start')::time) at time zone 'America/Sao_Paulo';
  closing := (p_date + (h->>'end')::time) at time zone 'America/Sao_Paulo';
  if coalesce(h->>'break_start','') <> '' and coalesce(h->>'break_end','') <> '' then
    bs := (p_date + (h->>'break_start')::time) at time zone 'America/Sao_Paulo'; be := (p_date + (h->>'break_end')::time) at time zone 'America/Sao_Paulo';
  end if;
  while candidate + make_interval(mins=>s.duration) <= closing loop
    finish := candidate + make_interval(mins=>s.duration);
    if candidate >= now()+make_interval(hours=>b.notice_hours)
      and (bs is null or not (candidate < be and finish > bs))
      and not exists(select 1 from public.appointments a where a.professional_id=p_professional and a.status not in ('cancelled','no_show') and a.starts_at < finish and a.ends_at > candidate) then
      slot := to_char(candidate at time zone 'America/Sao_Paulo','HH24:MI'); return next;
    end if;
    candidate := candidate+interval '30 minutes';
  end loop;
end $$;

create function public.book_appointment(p_slug text,p_service uuid,p_professional uuid,p_date date,p_time text,p_name text,p_phone text,p_email text default '') returns uuid language plpgsql security definer set search_path = '' as $$
declare b public.businesses; s public.services; customer uuid; result uuid; normalized text; begins timestamptz; begin
  if length(trim(p_name)) not between 2 and 120 or length(p_phone) > 30 or length(p_email) > 254 or (p_email <> '' and p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'Confira seu nome, telefone e e-mail.'; end if;
  normalized := regexp_replace(p_phone,'[^0-9]','','g');
  if length(normalized) in (12,13) and left(normalized,2)='55' then normalized:=substr(normalized,3); end if;
  if length(normalized) not in (10,11) or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Informe um telefone e horário válidos.'; end if;
  select * into b from public.businesses where slug=p_slug and booking_enabled;
  if b.id is null then raise exception 'Agendamento indisponível.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(b.id::text,0));
  if not exists(select 1 from public.get_available_slots(p_slug,p_service,p_professional,p_date) x where x.slot=p_time) then raise exception 'Esse horário não está mais disponível. Escolha outro.'; end if;
  select * into s from public.services where id=p_service and business_id=b.id and active;
  select id into customer from public.clients where business_id=b.id and phone=normalized;
  if customer is not null and (select count(*) from public.appointments where client_id=customer and status in ('pending','confirmed') and starts_at>now()) >= 3 then raise exception 'Você já tem três reservas futuras. Fale com o studio para agendar mais.'; end if;
  if (select count(*) from public.appointments where business_id=b.id and source='link' and created_at>now()-interval '1 hour') >= 30 then raise exception 'Muitas reservas recentes. Entre em contato com o studio.'; end if;
  -- Não altera nome, e-mail ou observações de uma cliente já cadastrada por uma chamada pública.
  if customer is null then insert into public.clients(business_id,name,phone,email) values(b.id,trim(p_name),normalized,trim(p_email)) returning id into customer; end if;
  begins := (p_date+p_time::time) at time zone 'America/Sao_Paulo';
  insert into public.appointments(business_id,professional_id,client_id,service_id,starts_at,ends_at,price,source,status)
    values(b.id,p_professional,customer,p_service,begins,begins+make_interval(mins=>s.duration),s.price,'link','pending') returning id into result;
  return result;
end $$;
revoke all on function public.get_public_studio(text),public.get_available_slots(text,uuid,uuid,date),public.book_appointment(text,uuid,uuid,date,text,text,text,text) from public;
grant execute on function public.get_public_studio(text),public.get_available_slots(text,uuid,uuid,date),public.book_appointment(text,uuid,uuid,date,text,text,text,text) to anon,authenticated;

-- Apenas fotos de divulgação. Objetos são gravados em <business_id>/<uuid>.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('studio-gallery','studio-gallery',true,5000000,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy studio_gallery_insert on storage.objects for insert to authenticated
with check (bucket_id='studio-gallery' and (storage.foldername(name))[1] in (select id::text from public.businesses where owner_id=(select auth.uid())));
create policy studio_gallery_select on storage.objects for select to authenticated
using (bucket_id='studio-gallery' and (storage.foldername(name))[1] in (select id::text from public.businesses where owner_id=(select auth.uid())));
create policy studio_gallery_delete on storage.objects for delete to authenticated
using (bucket_id='studio-gallery' and (storage.foldername(name))[1] in (select id::text from public.businesses where owner_id=(select auth.uid())));

-- Supabase Realtime (sincronização do painel quando chegam reservas).
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='appointments' and schemaname='public') then alter publication supabase_realtime add table public.appointments; end if;
end $$;
commit;
