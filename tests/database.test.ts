import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { addDays, today } from '../src/lib/utils';
const db = new PGlite({ extensions: { btree_gist } });
const owner = '10000000-0000-4000-8000-000000000001',
  other = '10000000-0000-4000-8000-000000000002';
let studio: string,
  pro: string,
  service: string,
  client: string,
  pack: string,
  clientPack: string,
  booking: string;
const date = addDays(today(), 4);
async function scalar<T = string>(sql: string, params: unknown[] = []) {
  const result = await db.query<Record<string, T>>(sql, params);
  return Object.values(result.rows[0])[0];
}
async function asOwner(id = owner) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
before(async () => {
  await db.exec(`create schema auth;create schema storage;create schema extensions;create role anon;create role authenticated;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    insert into auth.users values('${owner}'),('${other}');`);
  await db.exec(
    await readFile(path.join(process.cwd(), 'supabase/migrations/001_initial.sql'), 'utf8'),
  );
  const photosMigration = await readFile(
    path.join(process.cwd(), 'supabase/migrations/002_service_photos.sql'),
    'utf8',
  );
  await db.exec(photosMigration);
  await db.exec(photosMigration);
  await asOwner();
  studio = await scalar('select public.bootstrap_studio()');
  pro = await scalar('select id from public.professionals limit 1');
  await db.query('update public.businesses set hours=$1::jsonb where id=$2', [
    JSON.stringify(
      Object.fromEntries(
        Array.from({ length: 7 }, (_, i) => [
          String(i),
          { enabled: true, start: '09:00', end: '19:00', break_start: '12:00', break_end: '13:00' },
        ]),
      ),
    ),
    studio,
  ]);
  service = await scalar(
    "insert into public.services(business_id,name,duration,price) values($1,'Esmaltação',60,70) returning id",
    [studio],
  );
  client = await scalar(
    "insert into public.clients(business_id,name,phone,email,notes) values($1,'Cliente Privada','33911111111','privado@exemplo.com','Anotação privada') returning id",
    [studio],
  );
  pack = await scalar(
    "insert into public.packages(business_id,name,service_id,sessions,price,validity_days) values($1,'Pacote', $2,2,120,60) returning id",
    [studio, service],
  );
  clientPack = await scalar(
    'insert into public.customer_packages(business_id,client_id,package_id,sessions_total,price,expires_at) values($1,$2,$3,2,120,$4) returning id',
    [studio, client, pack, addDays(date, 30)],
  );
});
after(async () => {
  await db.close();
});

test('migration completa executa com RLS em todas as tabelas privadas', async () => {
  const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
    "select relname,relrowsecurity from pg_class join pg_namespace n on relnamespace=n.oid where n.nspname='public' and relkind='r'",
  );
  assert.equal(rows.length, 9);
  assert(rows.every((r) => r.relrowsecurity));
  assert.equal(await scalar('select public.bootstrap_studio()'), studio);
});
test('uma segunda proprietária não lê nem referencia dados da primeira', async () => {
  await asOwner(other);
  const second = await scalar('select public.bootstrap_studio()');
  assert.equal(Number(await scalar('select count(*) from public.clients')), 0);
  assert.equal(
    Number(await scalar('select count(*) from public.businesses where id=$1', [studio])),
    0,
  );
  await assert.rejects(
    db.query('insert into public.services(business_id,name,duration,price) values($1,$2,60,70)', [
      studio,
      'Intruso',
    ]),
    { code: '42501' },
  );
  await assert.rejects(
    db.query(
      'insert into public.appointments(business_id,professional_id,client_id,service_id,starts_at,ends_at) values($1,$2,$3,$4,$5,$6)',
      [second, pro, client, service, `${date}T09:00-03:00`, `${date}T10:00-03:00`],
    ),
    { code: '23503' },
  );
  await asOwner();
});
test('anônimo vê apenas a fachada pública e reserva sem consultar clientes', async () => {
  await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role anon;");
  await assert.rejects(db.query('select * from public.clients'), { code: '42501' });
  await assert.rejects(db.query('select * from public.appointments'), { code: '42501' });
  const publicData = await scalar<Record<string, unknown>>(
    "select public.get_public_studio('alongamentoscaratinga')",
  );
  const serialized = JSON.stringify(publicData);
  assert(!serialized.includes(owner));
  assert(!serialized.includes('Anotação privada'));
  assert(!serialized.includes('privado@'));
  booking = await scalar(
    "select public.book_appointment('alongamentoscaratinga',$1,$2,$3,'09:00','Cliente do Link','33922222222','reserva@exemplo.com')",
    [service, pro, date],
  );
  assert(booking);
  const slots = await db.query<{ slot: string }>(
    "select * from public.get_available_slots('alongamentoscaratinga',$1,$2,$3)",
    [service, pro, date],
  );
  assert(!slots.rows.some((s) => s.slot === '09:00'));
  assert(slots.rows.some((s) => s.slot === '10:00'));
  assert(!slots.rows.some((s) => s.slot === '12:00'));
  await assert.rejects(
    db.query(
      "select public.book_appointment('alongamentoscaratinga',$1,$2,$3,'09:00','Outra Cliente','33933333333','')",
      [service, pro, date],
    ),
    /não está mais disponível/,
  );
  await asOwner();
  assert.equal(
    await scalar('select source from public.appointments where id=$1', [booking]),
    'link',
  );
});

test('foto do serviço persiste e chega ao menu público com validação e isolamento', async () => {
  await asOwner();
  const url = 'https://example.com/servico.jpg';
  await db.query('update public.services set photo_url=$1 where id=$2', [url, service]);
  await assert.rejects(
    db.query('update public.services set photo_url=$1 where id=$2', [
      'javascript:alert(1)',
      service,
    ]),
    { code: '23514' },
  );
  await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role anon;");
  const menu = await scalar<{ services: { id: string; photo_url: string }[] }>(
    "select public.get_public_studio('alongamentoscaratinga')",
  );
  assert.equal(menu.services.find((s) => s.id === service)?.photo_url, url);
  await assert.rejects(
    db.query('update public.services set photo_url=$1 where id=$2', ['', service]),
    { code: '42501' },
  );
  await asOwner(other);
  assert.equal(
    Number(await scalar('select count(*) from public.services where id=$1', [service])),
    0,
  );
  await asOwner();
  await db.query('update public.services set photo_url=$1 where id=$2', ['', service]);
});
test('restrição de exclusão protege conflitos inclusive com bloqueios', async () => {
  await assert.rejects(
    db.query(
      "insert into public.appointments(business_id,professional_id,kind,starts_at,ends_at) values($1,$2,'block',$3,$4)",
      [studio, pro, `${date}T09:30-03:00`, `${date}T10:30-03:00`],
    ),
    { code: '23P01' },
  );
  const block = await scalar(
    "insert into public.appointments(business_id,professional_id,kind,starts_at,ends_at) values($1,$2,'block',$3,$4) returning id",
    [studio, pro, `${date}T10:00-03:00`, `${date}T11:00-03:00`],
  );
  assert(block);
  await db.query("update public.appointments set status='cancelled' where id=$1", [booking]);
  const slots = await db.query<{ slot: string }>(
    "select * from public.get_available_slots('alongamentoscaratinga',$1,$2,$3)",
    [service, pro, date],
  );
  assert(slots.rows.some((s) => s.slot === '09:00'));
  assert(!slots.rows.some((s) => s.slot === '10:00'));
});
test('conclusão usa uma sessão, edição não duplica, cancelamento devolve', async () => {
  const id = await scalar(
    "insert into public.appointments(business_id,professional_id,client_id,service_id,customer_package_id,starts_at,ends_at,status,price) values($1,$2,$3,$4,$5,$6,$7,'completed',70) returning id",
    [studio, pro, client, service, clientPack, `${date}T13:00-03:00`, `${date}T14:00-03:00`],
  );
  assert.equal(
    Number(
      await scalar('select sessions_used from public.customer_packages where id=$1', [clientPack]),
    ),
    1,
  );
  assert.equal(Number(await scalar('select price from public.appointments where id=$1', [id])), 0);
  await db.query(
    "update public.appointments set payment_status='paid',notes='Nova observação' where id=$1",
    [id],
  );
  assert.equal(
    Number(
      await scalar('select sessions_used from public.customer_packages where id=$1', [clientPack]),
    ),
    1,
  );
  await db.query("update public.appointments set status='cancelled' where id=$1", [id]);
  assert.equal(
    Number(
      await scalar('select sessions_used from public.customer_packages where id=$1', [clientPack]),
    ),
    0,
  );
  await db.query('update public.customer_packages set sessions_used=sessions_total where id=$1', [
    clientPack,
  ]);
  await assert.rejects(
    db.query("update public.appointments set status='confirmed' where id=$1", [id]),
    /sem sessões/,
  );
  await db.query(
    "update public.appointments set notes='Cancelado com pacote esgotado' where id=$1",
    [id],
  );
});

test('remarcar reinicia o controle de envio do lembrete', async () => {
  await db.query('update public.appointments set reminder_sent_at=now() where id=$1', [booking]);
  assert(await scalar('select reminder_sent_at from public.appointments where id=$1', [booking]));
  await db.query('update public.appointments set starts_at=$1,ends_at=$2 where id=$3', [
    `${date}T16:00-03:00`,
    `${date}T17:00-03:00`,
    booking,
  ]);
  assert.equal(
    await scalar('select reminder_sent_at from public.appointments where id=$1', [booking]),
    null,
  );
});

test('conta única bloqueia outros usuários no banco e no bootstrap sem impedir agendamento público', async () => {
  await db.exec('reset role');
  const migration = await readFile(
    path.join(process.cwd(), 'supabase/migrations/003_single_admin.sql'),
    'utf8',
  );
  await db.exec(migration);
  await asOwner();
  assert.equal(await scalar('select public.is_admin_user()'), false);
  assert.equal(Number(await scalar('select count(*) from public.businesses')), 0);
  await assert.rejects(db.query('select public.bootstrap_studio()'), { code: '42501' });
  await db.exec('reset role');
  await db.query('insert into private.admin_access(singleton,admin_user_id) values(true,$1)', [
    owner,
  ]);
  await db.exec(migration);
  await db.exec(
    'grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated',
  );
  await asOwner(other);
  assert.equal(await scalar('select public.is_admin_user()'), false);
  assert.equal(Number(await scalar('select count(*) from public.businesses')), 0);
  assert.equal(Number(await scalar('select count(*) from public.services')), 0);
  await assert.rejects(db.query('select public.bootstrap_studio()'), { code: '42501' });
  await assert.rejects(db.query('select * from private.admin_access'), { code: '42501' });
  await assert.rejects(
    db.query("insert into storage.objects(bucket_id,name) values('studio-gallery',$1)", [
      `${studio}/intruso.png`,
    ]),
    { code: '42501' },
  );
  await asOwner();
  assert.equal(await scalar('select public.is_admin_user()'), true);
  assert.equal(await scalar('select public.bootstrap_studio()'), studio);
  assert(Number(await scalar('select count(*) from public.services')) > 0);
  await db.query("insert into storage.objects(bucket_id,name) values('studio-gallery',$1)", [
    `${studio}/admin.png`,
  ]);
  await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role anon;");
  await assert.rejects(db.query('select * from public.clients'), { code: '42501' });
  assert(await scalar("select public.get_public_studio('alongamentoscaratinga')"));
  const publicBooking = await scalar(
    "select public.book_appointment('alongamentoscaratinga',$1,$2,$3,'18:00','Cliente Pública','33980000000','')",
    [service, pro, date],
  );
  assert(publicBooking);
  await asOwner();
});
