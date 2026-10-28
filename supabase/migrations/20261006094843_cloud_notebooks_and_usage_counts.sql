-- Optional cloud notebook and anonymous, consent-gated client usage counts.
-- Apply with the Supabase migration owner (postgres). Keep opstriage_private
-- outside the Data API exposed schemas. No service-role key belongs in the app.
begin;

create schema opstriage_private;
revoke all on schema opstriage_private from public, anon, authenticated;
grant usage on schema opstriage_private to anon, authenticated;
alter default privileges in schema opstriage_private revoke execute on functions from public;

-- The database validates a bounded envelope. The application validates each
-- attempt against its authored scenario version before importing or uploading.
create function opstriage_private.valid_notebook(p_notebook jsonb)
returns boolean
language sql immutable security invoker
set search_path = ''
as $$
  select coalesce(case
    when jsonb_typeof(p_notebook) <> 'object' then false
    when p_notebook->'version' is distinct from '2'::jsonb then false
    when jsonb_typeof(p_notebook->'attempts') is distinct from 'array' then false
    else jsonb_array_length(p_notebook->'attempts') <= 200
      and octet_length(convert_to(p_notebook::text, 'UTF8')) <= 2097152
  end, false);
$$;
revoke all on function opstriage_private.valid_notebook(jsonb) from public, anon, authenticated;

create table public.notebooks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notebook jsonb not null check (opstriage_private.valid_notebook(notebook)),
  revision bigint not null check (revision between 1 and 9007199254740991),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.notebooks enable row level security;
revoke all on table public.notebooks from public, anon, authenticated;
grant select on table public.notebooks to authenticated;
create policy notebooks_owner_read on public.notebooks
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- This is deliberately the only client write path. The private definer is
-- necessary because direct table write grants would bypass expected revision.
-- It accepts no owner or timestamp argument, derives owner from the verified
-- JWT, and never uses user_metadata. Calling it directly has the same checks.
create function opstriage_private.save_notebook(p_notebook jsonb, p_expected_revision bigint)
returns table(revision bigint, updated_at timestamptz)
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
     or p_expected_revision >= 9007199254740991 then
    raise exception using errcode = '22023', message = 'Expected revision is invalid.';
  end if;
  if not opstriage_private.valid_notebook(p_notebook) then
    raise exception using errcode = '22023', message = 'Notebook must be version 2, contain at most 200 attempts, and fit within 2 MiB of database-normalized JSON.';
  end if;

  if p_expected_revision = 0 then
    -- Concurrent first saves serialize on the PK. Only one may create revision 1.
    return query
      insert into public.notebooks as n(user_id, notebook, revision, updated_at)
      values(v_user_id, p_notebook, 1, clock_timestamp())
      on conflict(user_id) do nothing
      returning n.revision, n.updated_at;
  else
    -- PostgreSQL rechecks the predicate after a concurrent row lock releases.
    return query
      update public.notebooks as n
      set notebook = p_notebook, revision = n.revision + 1, updated_at = clock_timestamp()
      where n.user_id = v_user_id and n.revision = p_expected_revision
      returning n.revision, n.updated_at;
  end if;
  if not found then
    raise exception using errcode = 'P0001', message = 'Cloud notebook changed. Check and merge again.', detail = 'revision_conflict';
  end if;
end;
$$;
revoke all on function opstriage_private.save_notebook(jsonb, bigint) from public, anon, authenticated;
grant execute on function opstriage_private.save_notebook(jsonb, bigint) to authenticated;

create function public.save_notebook(p_notebook jsonb, p_expected_revision bigint)
returns table(revision bigint, updated_at timestamptz)
language sql volatile security invoker
set search_path = ''
as $$
  select saved.revision, saved.updated_at
  from opstriage_private.save_notebook(p_notebook, p_expected_revision) as saved;
$$;
revoke all on function public.save_notebook(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.save_notebook(jsonb, bigint) to authenticated;

-- Keep this exact allowlist aligned with PRACTICE_SCENARIOS via the static test.
create function opstriage_private.valid_practice_event(p_event_type text, p_case_id text)
returns boolean
language sql immutable security invoker
set search_path = ''
as $$
  select coalesce(case
    when p_event_type = 'return_visit' then p_case_id is null
    when p_event_type in ('case_started', 'case_completed') then p_case_id = any(array[
      'oomkilled', 'service-selector', 'image-pull-auth',
      'startup-arguments', 'pending-capacity', 'readiness-port', 'dns-config',
      'missing-configmap', 'pvc-storageclass', 'rollout-quota',
      'restart-probe-variant', 'service-port-variant', 'image-tag-variant',
      'startup-permissions-variant', 'pending-taint-variant', 'readiness-dependency-variant',
      'dns-name-variant', 'configmap-key-variant', 'pvc-consumer-variant', 'rollout-paused-variant'
    ]::text[])
    else false
  end, false);
$$;
revoke all on function opstriage_private.valid_practice_event(text, text) from public, anon, authenticated;

create table opstriage_private.practice_events (
  event_id uuid primary key,
  event_type text not null,
  case_id text,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint practice_event_allowed check (opstriage_private.valid_practice_event(event_type, case_id))
);
create index practice_events_occurred_at_idx on opstriage_private.practice_events(occurred_at);
alter table opstriage_private.practice_events enable row level security;
revoke all on table opstriage_private.practice_events from public, anon, authenticated;
-- There are no client SELECT/write policies or table grants for events.

create function opstriage_private.record_practice_event(p_event_id uuid, p_event_type text, p_case_id text)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_day_start timestamptz;
begin
  if p_event_id is null or not opstriage_private.valid_practice_event(p_event_type, p_case_id) then
    raise exception using errcode = '22023', message = 'Invalid practice event.';
  end if;

  -- Shared transaction lock bounds growth across concurrent anonymous requests.
  -- No caller identity is inspected or stored: this endpoint also permits anon.
  perform pg_advisory_xact_lock(207741893, 1);
  v_now := clock_timestamp();
  v_day_start := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  delete from opstriage_private.practice_events where occurred_at < v_now - interval '90 days';

  if exists(select from opstriage_private.practice_events where event_id = p_event_id) then return; end if;
  if (select count(*) from opstriage_private.practice_events
      where occurred_at >= v_day_start and occurred_at < v_day_start + interval '24 hours') >= 10000 then
    -- A full daily budget drops counts; metrics never block guest practice.
    return;
  end if;
  insert into opstriage_private.practice_events(event_id, event_type, case_id, occurred_at)
  values(p_event_id, p_event_type, p_case_id, v_now)
  on conflict(event_id) do nothing;
end;
$$;
revoke all on function opstriage_private.record_practice_event(uuid, text, text) from public, anon, authenticated;
grant execute on function opstriage_private.record_practice_event(uuid, text, text) to anon, authenticated;

create function public.record_practice_event(p_event_id uuid, p_event_type text, p_case_id text)
returns void
language sql volatile security invoker
set search_path = ''
as $$
  select opstriage_private.record_practice_event(p_event_id, p_event_type, p_case_id);
$$;
revoke all on function public.record_practice_event(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_practice_event(uuid, text, text) to anon, authenticated;

comment on table public.notebooks is 'One optional account notebook; only owner reads and revision-checked RPC writes are granted to clients.';
comment on table opstriage_private.practice_events is 'Untrusted approximate counts. No user/account/IP/text columns. 10,000/day global cap and opportunistic 90-day cleanup; not proof of unique people or learning.';
notify pgrst, 'reload schema';
commit;
