-- TEST ONLY: minimal Supabase role/auth fixture for a disposable plain PostgreSQL container.
-- Never apply this to a Supabase project. It is not a replacement for hosted Auth/API tests.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
