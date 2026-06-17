create table if not exists drafts (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  destination text,
  trame_key   text,
  sexe        text,
  date_vad    date,
  ville       text,
  notes       text,
  measures    jsonb       default '{}',
  status      text        not null default 'drafting',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table drafts enable row level security;

create policy "drafts_own_all" on drafts
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger drafts_updated_at
  before update on drafts
  for each row execute function set_updated_at();

alter table generated_crs
  add column if not exists draft_id uuid references drafts(id) on delete set null;
