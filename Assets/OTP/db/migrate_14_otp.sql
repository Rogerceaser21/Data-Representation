-- migrate_14: "Progress in Lessons OTP" form -> Supabase mirror (otp-v0.1).
--
-- Adds:
--   * criteria row otp_sp1        the single SP1 rubric aspect, 1-5 scale (registered now, scored later)
--   * app_config current_round_otp   the OTP wave stamped onto every new OTP record
--   * get_current_round_otp()     anon read of the OTP round (not secret) for the form Settings panel
--   * admin_set_setting           REPLACED: whitelist = migrate_06's four keys + current_round_otp
--   * ingest_otp(jsonb)           SECURITY DEFINER, service_role only. Clone of ingest_r3:
--                                 upserts one assessment (idempotent on record_token). NO scores in
--                                 v0.1 (the rubric selections live in content as sp1_*).
--   * teachers.roster / inspectors.roster   existing rows are the 2025-26 roster; 26-27 loads later
--   * get_raw_snapshot            REPLACED: assessments + scores restricted to type='r3' so OTP
--                                 records can never reach the dashboard
--
-- The R3 Apps Script handleOtpPost calls ingest_otp after the OTP Sheet append (Sheet stays source
-- of truth, failure swallowed; hard rule 14). Payload = the 26 getOtpColumns() fields, stored verbatim.
-- Re-runnable: seeds ON CONFLICT DO NOTHING, functions CREATE OR REPLACE, columns IF NOT EXISTS.
--
-- Apply: node db/apply.mjs db/migrate_14_otp.sql

begin;

-- ---------- 1) criteria: the SP1 rubric aspect ----------
-- criteria already carries unique (school_id, code) (schema.sql; live index criteria_school_id_code_key),
-- and 'otp_sp1' is unique school-wide, so ON CONFLICT targets that. No new index is needed.
insert into criteria (school_id, code, label, source_form, scale_min, scale_max, sort_order)
select s.id, 'otp_sp1',
       'SP1 Student Progress · Facilitating better than expected progress',
       'otp', 1, 5, 1
  from schools s
 where s.slug = 'ais-sharjah'
on conflict (school_id, code) do nothing;

-- ---------- 2) the OTP round + its anon read ----------
insert into app_config (key, value) values ('current_round_otp', 'OTP Term 1 26-27')
  on conflict (key) do nothing;

-- mirror of get_current_round: anon, the round is not secret (the form's admin cog reads it
-- with the publishable key).
create or replace function public.get_current_round_otp()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select value from app_config where key = 'current_round_otp'
$$;
revoke all on function public.get_current_round_otp() from public;
grant execute on function public.get_current_round_otp() to anon, authenticated;

-- ---------- admin_set_setting: same function, whitelist widened to the OTP round ----------
-- Byte-identical to migrate_06 (the LAST live definition; migrate_06 added the dashboard
-- keys snap_autoplay / stars / star_cfg on 2026-06-23) except the p_key whitelist, which
-- keeps all four of those keys and adds current_round_otp. Dropping them broke the
-- dashboard Settings panel in a rolled-back skeptic run on 2026-09-03; never rebase
-- this function on migrate_04.
create or replace function public.admin_set_setting(p_password text, p_key text, p_value text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.verify_admin_password(p_password) then
    return jsonb_build_object('success', false, 'error', 'bad password');
  end if;
  -- whitelist: never let this path overwrite admin_password_hash
  if p_key not in ('current_round', 'snap_autoplay', 'stars', 'star_cfg', 'current_round_otp') then
    return jsonb_build_object('success', false, 'error', 'key not allowed');
  end if;
  insert into app_config (key, value, updated_at) values (p_key, p_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('success', true, 'key', p_key, 'value', p_value);
end $$;
revoke all on function public.admin_set_setting(text, text, text) from public;
grant execute on function public.admin_set_setting(text, text, text) to anon, authenticated;

-- ---------- 3) ingest_otp (service_role only; the OTP dual-write target) ----------
-- payload = the flat OTP submission object (every getOtpColumns() field). Stored verbatim as content.
-- Idempotent on record_token (assessments unique(school_id,type,source_ref)); content is immutable
-- so a re-submit refreshes the denormalised links only. teacher_id null when name not in registry.
-- No scores rows in v0.1: the rubric selections are the sp1_* paragraph lists inside content, not a
-- 1-6 judgement. The otp_sp1 criterion exists so a later version can score without a schema change.
create or replace function public.ingest_otp(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school   uuid;
  v_teacher  uuid;
  v_assessor uuid;
  v_round    text;
  v_aid      uuid;
  v_token    text;
  v_recid    text;
  v_occurred date;
begin
  select id into v_school from schools where slug = 'ais-sharjah';
  if v_school is null then
    return jsonb_build_object('success', false, 'error', 'school not found');
  end if;

  v_recid := nullif(payload->>'record_id', '');
  v_token := coalesce(nullif(payload->>'record_token', ''), v_recid);
  if v_token is null then
    return jsonb_build_object('success', false, 'error', 'no record_token');
  end if;

  select id into v_teacher from teachers
    where school_id = v_school and lower(full_name) = lower(nullif(payload->>'teacher', ''));
  select id into v_assessor from inspectors
    where school_id = v_school and lower(name) = lower(nullif(payload->>'observer', ''));
  select value into v_round from app_config where key = 'current_round_otp';

  begin
    v_occurred := (nullif(payload->>'observation_date', ''))::date;
  exception when others then
    v_occurred := null;
  end;

  insert into assessments
    (school_id, teacher_id, type, record_id, source_ref, occurred_on, subject,
     assessor_name, assessor_id, round, source, content)
  values
    (v_school, v_teacher, 'otp', v_recid, v_token, v_occurred, nullif(payload->>'subject', ''),
     nullif(payload->>'observer', ''), v_assessor, v_round, 'otp_sheet', payload)
  on conflict (school_id, type, source_ref) do update
    set teacher_id    = excluded.teacher_id,
        occurred_on   = excluded.occurred_on,
        subject       = excluded.subject,
        assessor_name = excluded.assessor_name,
        assessor_id   = excluded.assessor_id,
        round         = excluded.round,
        source        = excluded.source
  returning id into v_aid;

  return jsonb_build_object(
    'success', true, 'assessment_id', v_aid,
    'teacher_linked', v_teacher is not null, 'round', v_round);
end $$;
revoke all on function public.ingest_otp(jsonb) from public;
grant execute on function public.ingest_otp(jsonb) to service_role;

-- ---------- 4) roster stamp on the two registries ----------
-- Everything already in these tables came from the 2025-26 staff lists; the 26-27 roster is
-- loaded later and will carry its own value.
alter table teachers   add column if not exists roster text not null default '2025-26';
alter table inspectors add column if not exists roster text not null default '2025-26';

-- ---------- 5) snapshot guard: the dashboard sees R3 only ----------
-- The live definition is the one from migrate_10_photos.sql (the last CREATE OR REPLACE of this
-- function in db/*.sql) and it does NOT restrict type, so an OTP assessment would have flowed
-- straight into window.__AIS_DATA. Replaced here with the identical body plus a type='r3' filter on
-- the assessments block and on the scores block (via its assessment). Nothing else changes.
-- The criteria block is deliberately left unfiltered: the dashboard only turns it into a code->label
-- map (CRIT_LABEL) and an unused by_criterion tally, so the extra otp_sp1 entry renders nothing.
create or replace function public.get_raw_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'criteria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', code, 'label', label, 'sef_strand', sef_strand, 'sort_order', sort_order)
        order by sort_order, code)
      from criteria), '[]'::jsonb),

    'inspectors', coalesce((
      select jsonb_agg(name order by name) from inspectors), '[]'::jsonb),

    'teachers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'full_name', t.full_name, 'section', t.section, 'subject', t.subject,
        'dept', d.name, 'dept_role', dm.role, 'photo_url', t.photo_url) order by t.full_name)
      from teachers t
      left join department_members dm on dm.teacher_id = t.id
      left join departments d on d.id = dm.department_id), '[]'::jsonb),

    'assessments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'teacher_id', a.teacher_id, 'record_id', a.record_id,
        'occurred_on', a.occurred_on, 'round', a.round, 'type', a.type,
        'source', a.source, 'source_ref', a.source_ref,
        'assessor', coalesce(i.name, a.assessor_name),
        'subject', coalesce(a.content->>'subject', a.subject),
        'notes', a.content->>'observer_notes',
        'strengths', a.content->>'summary_strengths',
        'weakness', a.content->>'summary_weakness'))
      from assessments a
      left join inspectors i on i.id = a.assessor_id
      where a.type = 'r3'), '[]'::jsonb),

    'scores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assessment_id', s.assessment_id, 'code', c.code, 'score', s.score::int))
      from scores s
      join criteria c on c.id = s.criterion_id
      join assessments a on a.id = s.assessment_id
      where a.type = 'r3'), '[]'::jsonb)
  );
$$;
revoke all on function public.get_raw_snapshot() from public;
grant execute on function public.get_raw_snapshot() to anon, authenticated;

commit;
