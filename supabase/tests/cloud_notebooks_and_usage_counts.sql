-- Run as postgres on a disposable/local or staging database after the migration.
-- Every fixture, role switch, and data mutation is inside this rolled-back transaction.
-- Use psql -v ON_ERROR_STOP=1; a failed assertion aborts without committing anything.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function pg_temp.assert_true(p_ok boolean, p_message text)
returns void language plpgsql security invoker as $$
begin
  if p_ok is distinct from true then raise exception 'Assertion failed: %', p_message; end if;
end;
$$;

create function pg_temp.expect_error(p_sql text, p_state text, p_detail text default null)
returns void language plpgsql security invoker as $$
declare v_state text; v_detail text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_detail = pg_exception_detail;
    if v_state <> p_state or (p_detail is not null and v_detail <> p_detail) then
      raise exception 'Expected SQLSTATE % / detail %, got % / %', p_state, p_detail, v_state, v_detail;
    end if;
    return;
  end;
  raise exception 'Expected SQLSTATE %, but statement succeeded: %', p_state, p_sql;
end;
$$;
do $$
begin
  execute format('grant usage on schema %I to anon, authenticated',
    (select nspname from pg_namespace where oid = pg_my_temp_schema()));
end;
$$;
grant execute on function pg_temp.assert_true(boolean, text), pg_temp.expect_error(text, text, text) to anon, authenticated;

-- Fixed fixture IDs intentionally fail if they already exist, rather than touching a real account.
insert into auth.users (id, email) values
  ('6f3f6558-b5df-4b01-a001-000000000001', 'opstriage-sql-a@example.invalid'),
  ('6f3f6558-b5df-4b01-a001-000000000002', 'opstriage-sql-b@example.invalid');

select pg_temp.assert_true(to_regclass('public.notebooks') is not null, 'notebooks table exists');
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.notebooks'::regclass), 'notebooks RLS enabled');
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'opstriage_private.practice_events'::regclass), 'events RLS enabled');

set local role authenticated;
select set_config('request.jwt.claim.sub', '6f3f6558-b5df-4b01-a001-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"6f3f6558-b5df-4b01-a001-000000000001","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 0 from public.notebooks), 'A initially sees no notebook');
select pg_temp.assert_true(
  (select revision = 1 and updated_at <= clock_timestamp() from public.save_notebook('{"version":2,"attempts":[]}', 0)),
  'A creates revision 1 with server timestamp');
select pg_temp.assert_true((select count(*) = 1 from public.notebooks), 'A sees own notebook');
select pg_temp.assert_true(
  (select revision = 2 from public.save_notebook('{"version":2,"attempts":[{"id":"draft-a"}]}', 1)),
  'matching revision updates to 2');
select pg_temp.expect_error($sql$select * from public.save_notebook('{"version":2,"attempts":[]}', 1)$sql$, 'P0001', 'revision_conflict');
select pg_temp.expect_error($sql$select * from public.save_notebook('{"version":2,"attempts":[]}', 0)$sql$, 'P0001', 'revision_conflict');
select pg_temp.assert_true((select revision = 2 and notebook->'attempts'->0->>'id' = 'draft-a' from public.notebooks), 'conflicts leave data unchanged');

-- Direct writes cannot bypass the revision check, even for the owner.
select pg_temp.expect_error($sql$update public.notebooks set notebook = '{"version":2,"attempts":[]}', revision = 99$sql$, '42501');
select pg_temp.expect_error($sql$delete from public.notebooks$sql$, '42501');
select pg_temp.expect_error($sql$insert into public.notebooks(user_id, notebook, revision) values ('6f3f6558-b5df-4b01-a001-000000000002','{"version":2,"attempts":[]}',1)$sql$, '42501');

select pg_temp.expect_error($sql$select * from public.save_notebook(null, 2)$sql$, '22023');
select pg_temp.expect_error($sql$select * from public.save_notebook('{}', 2)$sql$, '22023');
select pg_temp.expect_error($sql$select * from public.save_notebook('[]', 2)$sql$, '22023');
select pg_temp.expect_error($sql$select * from public.save_notebook('{"version":1,"attempts":[]}', 2)$sql$, '22023');
select pg_temp.expect_error($sql$select * from public.save_notebook('{"version":2,"attempts":null}', 2)$sql$, '22023');
select pg_temp.expect_error($sql$select * from public.save_notebook('{"version":2,"attempts":{}}', 2)$sql$, '22023');
select pg_temp.expect_error($sql$select * from public.save_notebook('{"version":2,"attempts":[]}', null)$sql$, '22023');
select pg_temp.expect_error($sql$select * from public.save_notebook('{"version":2,"attempts":[]}', -1)$sql$, '22023');
select pg_temp.expect_error($sql$select * from public.save_notebook(jsonb_build_object('version',2,'attempts',(select jsonb_agg('{}'::jsonb) from generate_series(1,201))),2)$sql$, '22023');
select pg_temp.expect_error($sql$select * from public.save_notebook(jsonb_build_object('version',2,'attempts',jsonb_build_array(jsonb_build_object('notes',repeat('x',2097152)))),2)$sql$, '22023');
select pg_temp.expect_error($sql$select * from public.save_notebook(jsonb_build_object('version',2,'attempts',jsonb_build_array(jsonb_build_object('notes',repeat(chr(233),1100000)))),2)$sql$, '22023');
savepoint max_attempts_boundary;
select pg_temp.assert_true((select revision = 3 from public.save_notebook(jsonb_build_object('version',2,'attempts',(select jsonb_agg('{}'::jsonb) from generate_series(1,200))),2)), '200 attempts accepted at envelope boundary');
rollback to savepoint max_attempts_boundary;
select pg_temp.expect_error($sql$select * from opstriage_private.practice_events$sql$, '42501');

-- The private writer has the same ownership/revision contract when called directly.
select pg_temp.expect_error($sql$select * from opstriage_private.save_notebook('{"version":2,"attempts":[]}', 1)$sql$, 'P0001', 'revision_conflict');
select set_config('request.jwt.claim.sub', '6f3f6558-b5df-4b01-a001-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"6f3f6558-b5df-4b01-a001-000000000002","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 0 from public.notebooks), 'B cannot read A notebook');
select pg_temp.expect_error($sql$select * from public.save_notebook('{"version":2,"attempts":[]}', 2)$sql$, 'P0001', 'revision_conflict');
select pg_temp.assert_true((select revision = 1 from public.save_notebook('{"version":2,"attempts":[]}',0)), 'B creates independent notebook');
select pg_temp.assert_true((select count(*) = 1 and min(user_id::text) = '6f3f6558-b5df-4b01-a001-000000000002' from public.notebooks), 'B sees only B notebook');
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.expect_error($sql$select * from public.save_notebook('{"version":2,"attempts":[]}',0)$sql$, '42501');

reset role;
select pg_temp.assert_true((select revision = 2 from public.notebooks where user_id = '6f3f6558-b5df-4b01-a001-000000000001'), 'B did not change A');
delete from auth.users where id = '6f3f6558-b5df-4b01-a001-000000000002';
select pg_temp.assert_true(not exists(select from public.notebooks where user_id = '6f3f6558-b5df-4b01-a001-000000000002'), 'account deletion cascades to notebook');

set local role anon;
select pg_temp.expect_error($sql$select * from public.notebooks$sql$, '42501');
select pg_temp.expect_error($sql$insert into public.notebooks(user_id, notebook, revision) values ('6f3f6558-b5df-4b01-a001-000000000001','{"version":2,"attempts":[]}',1)$sql$, '42501');
select pg_temp.expect_error($sql$select * from public.save_notebook('{"version":2,"attempts":[]}',0)$sql$, '42501');
select pg_temp.expect_error($sql$select * from opstriage_private.save_notebook('{"version":2,"attempts":[]}',0)$sql$, '42501');
select pg_temp.expect_error($sql$select * from opstriage_private.practice_events$sql$, '42501');
select pg_temp.expect_error($sql$insert into opstriage_private.practice_events(event_id,event_type,case_id) values(gen_random_uuid(),'case_started','oomkilled')$sql$, '42501');
select pg_temp.expect_error($sql$select public.record_practice_event(null,'case_started','oomkilled')$sql$, '22023');
select pg_temp.expect_error($sql$select public.record_practice_event(gen_random_uuid(),null,'oomkilled')$sql$, '22023');
select pg_temp.expect_error($sql$select public.record_practice_event(gen_random_uuid(),'unknown','oomkilled')$sql$, '22023');
select pg_temp.expect_error($sql$select public.record_practice_event(gen_random_uuid(),'case_started','invented-case')$sql$, '22023');
select pg_temp.expect_error($sql$select public.record_practice_event(gen_random_uuid(),'case_completed',null)$sql$, '22023');
select pg_temp.expect_error($sql$select public.record_practice_event(gen_random_uuid(),'return_visit','oomkilled')$sql$, '22023');
reset role;

-- Cap/retention assertions use a transaction-wide lock and rollback all temporary deletions.
-- Run only on a disposable/staging database: this can briefly delay metric writes there.
select pg_advisory_xact_lock(207741893, 1);
delete from opstriage_private.practice_events;
insert into opstriage_private.practice_events(event_id,event_type,case_id,occurred_at)
values ('6f3f6558-b5df-4b01-b001-000000000001','return_visit',null,clock_timestamp()-interval '91 days');
set local role anon;
select public.record_practice_event('6f3f6558-b5df-4b01-b001-000000000002','case_started','oomkilled');
select public.record_practice_event('6f3f6558-b5df-4b01-b001-000000000002','case_started','oomkilled');
select public.record_practice_event('6f3f6558-b5df-4b01-b001-000000000003','return_visit',null);
reset role;
select pg_temp.assert_true((select count(*) = 2 from opstriage_private.practice_events), 'event dedupe and old-row cleanup');
insert into opstriage_private.practice_events(event_id,event_type,case_id)
select gen_random_uuid(),'case_completed','oomkilled' from generate_series(1,9998);
set local role anon;
-- Cap drops new events without failing the app; duplicate retries remain harmless.
select public.record_practice_event('6f3f6558-b5df-4b01-b001-000000000004','case_completed','oomkilled');
select public.record_practice_event('6f3f6558-b5df-4b01-b001-000000000002','case_started','oomkilled');
reset role;
select pg_temp.assert_true((select count(*) = 10000 from opstriage_private.practice_events), 'global UTC-day cap cannot be exceeded');

select 'All SQL boundary assertions passed; rolling back every fixture.' as result;
rollback;

do $$
begin
  if exists(select from auth.users where id in ('6f3f6558-b5df-4b01-a001-000000000001','6f3f6558-b5df-4b01-a001-000000000002')) then
    raise exception 'Rollback failed: auth fixtures still exist.';
  end if;
end;
$$;
