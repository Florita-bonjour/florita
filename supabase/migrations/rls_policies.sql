-- Snapshot des policies RLS actives en production
-- Exporté le 2026-07-01 depuis le projet ipflegbroqefhbucbnrv
-- Source : pg_policies WHERE tablename IN ('generated_crs', 'drafts')

-- ============================================================
-- TABLE : generated_crs
-- ============================================================

alter table generated_crs enable row level security;

create policy "Users can view own CRs"
  on generated_crs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own CRs"
  on generated_crs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own CRs"
  on generated_crs
  for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own CRs"
  on generated_crs
  for delete
  using (auth.uid() = user_id);

-- ============================================================
-- TABLE : drafts
-- ============================================================

alter table drafts enable row level security;

create policy "drafts_own_all"
  on drafts
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
