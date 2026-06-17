create table if not exists profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  first_name  text,
  updated_at  timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_own_all" on profiles
  for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

grant select, insert, update, delete on table profiles to authenticated;
