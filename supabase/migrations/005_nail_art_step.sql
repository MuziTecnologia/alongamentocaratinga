-- Etapa "Deseja incluir nail art?" editável pelo painel: textos e foto de exemplo.
-- Execute depois da 004. Pode ser executada novamente.
begin;

-- Campos vazios ou ausentes usam os textos padrão do site.
alter table public.businesses add column if not exists nail_art_step jsonb not null default '{}'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='businesses_nail_art_step_check' and conrelid='public.businesses'::regclass) then
    alter table public.businesses add constraint businesses_nail_art_step_check
      check (
        jsonb_typeof(nail_art_step)='object'
        and length(nail_art_step::text) <= 4000
        and coalesce(nail_art_step->>'photo_url','') ~ '^(https://[^[:space:]]+)?$'
      );
  end if;
end $$;

-- Fachada pública passa a incluir a etapa de nail art (foto no bucket público studio-gallery).
create or replace function public.get_public_studio(p_slug text) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'business', jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'description',b.description,'phone',b.phone,'address',b.address,'instagram',b.instagram,'hours',b.hours,'payment_methods',b.payment_methods,'booking_enabled',b.booking_enabled,'notice_hours',b.notice_hours,'reminder_hours',b.reminder_hours,'cancellation_hours',b.cancellation_hours,'nail_art_step',b.nail_art_step),
    'services', coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from public.services s where s.business_id=b.id and s.active),'[]'::jsonb),
    'professionals', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'business_id',p.business_id,'name',p.name,'role',p.role,'color',p.color,'active',p.active) order by p.name) from public.professionals p where p.business_id=b.id and p.active),'[]'::jsonb),
    'gallery', coalesce((select jsonb_agg(to_jsonb(g)) from public.gallery g where g.business_id=b.id),'[]'::jsonb)
  ) from public.businesses b where b.slug=p_slug;
$$;
revoke all on function public.get_public_studio(text) from public;
grant execute on function public.get_public_studio(text) to anon,authenticated;

notify pgrst, 'reload schema';
commit;
