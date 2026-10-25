-- Acesso privado restrito a uma única conta; agendamento público permanece disponível.
-- Configure private.admin_access no SQL Editor e ADMIN_USER_ID no servidor com o mesmo UUID.
-- Sem configuração, o acesso privado é negado.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.admin_access (
  singleton boolean primary key default true check (singleton),
  admin_user_id uuid not null references auth.users(id)
);
alter table private.admin_access enable row level security;
revoke all on private.admin_access from public, anon, authenticated;

create or replace function public.is_admin_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.admin_access where singleton and admin_user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;

create or replace function public.is_studio_owner(studio uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin_user() and exists(select 1 from public.businesses where id = studio and owner_id = (select auth.uid()));
$$;
drop policy if exists own_business on public.businesses;
create policy own_business on public.businesses for all to authenticated
  using (public.is_admin_user() and owner_id = (select auth.uid()))
  with check (public.is_admin_user() and owner_id = (select auth.uid()));

create or replace function public.bootstrap_studio() returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; new_slug text := 'alongamentoscaratinga'; begin
  if not public.is_admin_user() then raise exception 'Acesso exclusivo da conta administrativa.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select id into result from public.businesses where owner_id = auth.uid();
  if result is not null then return result; end if;
  if exists(select 1 from public.businesses where slug = new_slug) then new_slug := new_slug || '-' || substr(gen_random_uuid()::text,1,8); end if;
  insert into public.businesses(owner_id,slug) values(auth.uid(),new_slug) returning id into result;
  insert into public.professionals(business_id,name,role) values(result,'Minha agenda','Nail designer');
  return result;
end $$;
notify pgrst, 'reload schema';
commit;
