-- Jalankan seluruh isi file ini sekali di Supabase SQL Editor

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text,
  created_at timestamptz default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  kategori text not null check (kategori in ('stasiun', 'mal', 'kantor_pemerintah', 'taman', 'kesehatan', 'lainnya')),
  lat float8 not null,
  lng float8 not null,
  skor int default 0,
  status text not null default 'belum_terverifikasi' check (status in ('belum_terverifikasi', 'terverifikasi')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table accessibility_checklist (
  location_id uuid primary key references locations(id) on delete cascade,
  ramp_tersedia bool default false,
  lebar_pintu_cukup bool default false,
  toilet_difabel bool default false,
  parkir_difabel bool default false,
  lift_tersedia_berfungsi bool default false,
  guiding_block_tersambung bool default false,
  tempat_duduk_tersedia bool default false,
  permukaan_jalan_rata bool default false,
  catatan text
);

create table location_photos (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz default now()
);

create table confirmations (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  user_id uuid not null references profiles(id),
  is_accurate bool not null,
  created_at timestamptz default now(),
  unique (location_id, user_id)
);

-- Fungsi dan trigger biar profil otomatis dibuat begitu ada user baru daftar
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nama)
  values (new.id, new.raw_user_meta_data->>'nama');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Fungsi hitung skor otomatis tiap checklist berubah
create function public.hitung_skor_lokasi()
returns trigger
language plpgsql
as $$
declare
  total int;
begin
  total := (
    (new.ramp_tersedia)::int +
    (new.lebar_pintu_cukup)::int +
    (new.toilet_difabel)::int +
    (new.parkir_difabel)::int +
    (new.lift_tersedia_berfungsi)::int +
    (new.guiding_block_tersambung)::int +
    (new.tempat_duduk_tersedia)::int +
    (new.permukaan_jalan_rata)::int
  );
  update locations set skor = round((total::float / 8) * 100) where id = new.location_id;
  return new;
end;
$$;

create trigger on_checklist_upsert
  after insert or update on accessibility_checklist
  for each row execute procedure public.hitung_skor_lokasi();

-- Row Level Security
alter table profiles enable row level security;
alter table locations enable row level security;
alter table accessibility_checklist enable row level security;
alter table location_photos enable row level security;
alter table confirmations enable row level security;

create policy "profiles bisa dibaca siapa saja" on profiles for select using (true);
create policy "user cuma bisa update profil sendiri" on profiles for update using (auth.uid() = id);

create policy "locations bisa dibaca siapa saja" on locations for select using (true);
create policy "user login bisa tambah lokasi" on locations for insert with check (auth.uid() = created_by);
create policy "user cuma bisa update lokasi sendiri" on locations for update using (auth.uid() = created_by);

create policy "checklist bisa dibaca siapa saja" on accessibility_checklist for select using (true);
create policy "user login bisa insert checklist" on accessibility_checklist for insert with check (auth.uid() is not null);
create policy "user login bisa update checklist" on accessibility_checklist for update using (auth.uid() is not null);

create policy "foto bisa dibaca siapa saja" on location_photos for select using (true);
create policy "user login bisa upload foto" on location_photos for insert with check (auth.uid() is not null);

create policy "konfirmasi bisa dibaca siapa saja" on confirmations for select using (true);
create policy "user login bisa konfirmasi" on confirmations for insert with check (auth.uid() = user_id);