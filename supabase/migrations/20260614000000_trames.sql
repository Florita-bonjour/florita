create table if not exists trames (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table trames enable row level security;

create policy "trames_own_all" on trames
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
