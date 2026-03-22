-- ============================================================================
-- KLEEN — Migration 027: Allow authenticated users to insert their own profile row
-- Fixes account/profile pages when handle_new_user did not create a row (update
-- affected 0 rows with no error). Insert is restricted to id = auth.uid().
-- ============================================================================

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());
