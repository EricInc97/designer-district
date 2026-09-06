-- ============================================================
-- DESIGNER DISTRICT, API surface hardening
-- Run after 03_seed.sql. Clears the Supabase database linter warnings.
-- ============================================================

-- PostgREST exposes every function in `public` at /rest/v1/rpc/<name>, and
-- Postgres grants EXECUTE to PUBLIC on every new function, which anon and
-- authenticated both inherit. Revoking from those two roles alone does nothing
-- while the PUBLIC grant stands, so revoke from PUBLIC first, then hand back
-- exactly what each role needs.

-- ---------------- 1. Trigger functions are not endpoints ----------------
-- These five are trigger bodies. Calling one outside a trigger errors anyway,
-- but there is no reason for them to be reachable from the API at all.
revoke all on function public.handle_new_user()                         from public, anon, authenticated;
revoke all on function public.touch_ticket()                            from public, anon, authenticated;
revoke all on function public.apply_credit_delta()                      from public, anon, authenticated;
revoke all on function public.guard_profile_update()                    from public, anon, authenticated;
revoke all on function public.guard_ticket_update()                     from public, anon, authenticated;

-- ---------------- 2. Write paths: signed-in callers only ----------------
revoke all on function public.place_order(jsonb, boolean)               from public, anon;
revoke all on function public.issue_store_credit(uuid, numeric, text)   from public, anon;
revoke all on function public.set_staff_access(uuid, user_role, text[]) from public, anon;
revoke all on function public.admin_analytics(int)                      from public, anon;
revoke all on function public.my_scopes()                               from public, anon;

grant execute on function public.place_order(jsonb, boolean)               to authenticated;
grant execute on function public.issue_store_credit(uuid, numeric, text)   to authenticated;
grant execute on function public.set_staff_access(uuid, user_role, text[]) to authenticated;
grant execute on function public.admin_analytics(int)                      to authenticated;
grant execute on function public.my_scopes()                               to authenticated;

-- ---------------- 3. RLS helpers stay callable, deliberately ----------------
-- A role must hold EXECUTE on any function its RLS policies evaluate, and
-- `brands_read` / `products_read` call is_staff() and has_scope() for anon. So
-- these have to stay reachable or the storefront returns nothing to a
-- signed-out visitor. They reveal only whether the caller themselves is staff.
-- The linter will keep flagging them; this is the accepted answer.
revoke all on function public.current_user_role()                 from public;
revoke all on function public.is_staff()                          from public;
revoke all on function public.is_master()                         from public;
revoke all on function public.has_scope(text)                     from public;
revoke all on function public.recommend_products(text, uuid, int) from public;

grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_staff()          to anon, authenticated;
grant execute on function public.is_master()         to anon, authenticated;
grant execute on function public.has_scope(text)     to anon, authenticated;

-- Signed-out visitors get recommendations from their session id alone.
grant execute on function public.recommend_products(text, uuid, int) to anon, authenticated;

-- ---------------- 4. Extensions out of the exposed schema ----------------
-- The existing products_name_trgm_idx binds gin_trgm_ops by OID, so it
-- survives the move without a rebuild.
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

do $$ begin
  alter extension pg_trgm set schema extensions;
exception when others then null; end $$;
