-- Car records: one owner per row, enforced by row level security.

create table cars (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  plate text not null default '',
  make text, model text, year int, color text, fuel text, tyres text,
  image_url text,                       -- https URL (model photo) or sb:<path> (own cutout)
  created_at timestamptz not null default now()
);

create table readings (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  car_id uuid not null references cars on delete cascade,
  km int not null check (km >= 0),
  date date not null default current_date,
  source text not null check (source in ('start', 'manual', 'confirm', 'photo', 'service'))
);

create table items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  car_id uuid not null references cars on delete cascade,
  kind text not null,
  label text not null,
  every_km int, every_months int,       -- the rule
  due_km int, due_date date             -- the next point
);

create table services (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  car_id uuid not null references cars on delete cascade,
  type text not null,
  title text not null,
  date date not null,
  km int not null,
  price numeric(10, 2), garage text, notes text,
  receipt text
);

create table documents (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  car_id uuid not null references cars on delete cascade,
  kind text not null check (kind in ('licence', 'insurance', 'driver', 'other')),
  title text not null,
  provider text, number text,
  expiry date,
  files text[] not null default '{}'
);

create index on readings (car_id, date);
create index on items (car_id);
create index on services (car_id, date);
create index on documents (car_id);

do $$
declare t text;
begin
  foreach t in array array['cars', 'readings', 'items', 'services', 'documents'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_rows on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Private bucket for car cutouts, receipts and document photos: <user id>/<file>
insert into storage.buckets (id, name, public) values ('files', 'files', false)
on conflict (id) do nothing;

create policy own_files on storage.objects for all to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
