-- Foto opcional por serviço. Usa o bucket público studio-gallery já existente.
-- Pode ser executada novamente; não altera serviços ou fotos já cadastrados.
begin;
alter table public.services add column if not exists photo_url text not null default '';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='services_photo_url_check' and conrelid='public.services'::regclass) then
    alter table public.services add constraint services_photo_url_check
      check (photo_url = '' or photo_url ~ '^https://[^[:space:]]+$');
  end if;
end $$;
-- get_public_studio usa to_jsonb(services), portanto inclui photo_url automaticamente.
notify pgrst, 'reload schema';
commit;
