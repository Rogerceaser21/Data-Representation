-- otp-v0.12 Teacher Tracker: one read-only aggregate over existing OTP data.
-- Implements PLAN-A.md section 5 (Phase 1) + section 8 (risks) + section 10 (owner's answers).
-- Additive only: one new function, nothing altered, dropped or replaced elsewhere.
-- No new table, no new column. Apply: the foreman applies this file (builders never touch the database).
begin;

create or replace function public.get_otp_tracker()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_school           uuid;
  v_now              timestamptz := now();
  v_now_dubai        timestamp;
  v_year_start       date;
  v_year_end         date;
  v_school_year      text;
  v_round            text;
  v_stamp_since_text text;
  v_stamp_since      timestamptz;
  v_teachers         jsonb;
begin
  select id into v_school from schools where slug = 'ais-sharjah';
  if v_school is null then
    return jsonb_build_object('success', false, 'error', 'school not found');
  end if;

  -- AIS school year: 1 August to 31 July, anchored on today (Igor's ruling, PLAN-A.md
  -- section 10: observation_count/history cover the WHOLE current school year, not only
  -- the current round).
  v_now_dubai := (v_now at time zone 'Asia/Dubai');
  if extract(month from v_now_dubai)::int >= 8 then
    v_year_start := make_date(extract(year from v_now_dubai)::int, 8, 1);
  else
    v_year_start := make_date(extract(year from v_now_dubai)::int - 1, 8, 1);
  end if;
  v_year_end := make_date(extract(year from v_year_start)::int + 1, 7, 31);
  v_school_year := to_char(v_year_start, 'YYYY') || '/' || to_char(v_year_end, 'YYYY');

  select value into v_round from app_config where key = 'current_round_otp';
  select value into v_stamp_since_text from app_config where key = 'otp_email_stamps_since';
  begin
    v_stamp_since := nullif(btrim(coalesce(v_stamp_since_text, '')), '')::timestamptz;
  exception when others then
    v_stamp_since := null;
  end;

  -- open / open_count / last_closed below reuse the EXACT rule get_teacher_lap_state (migrate_22)
  -- uses to pick them: current-round scoped, not year scoped. Only observation_count and history
  -- are scoped to the whole school year (v_year_start/v_year_end). This is a deliberate mismatch
  -- Igor has already accepted (PLAN-A.md section 10): today there is one round, so they agree;
  -- once a second round opens the two will diverge and that is flagged there, not fixed here.
  with recs as (
    select
      a.id,
      lower(btrim(coalesce(a.content->>'teacher', ''))) as teacher_key,
      coalesce(a.content->>'status', 'observed') as status,
      case when coalesce(a.content->>'lap', '') ~ '^\d+$' then (a.content->>'lap')::int end as lap,
      a.content->>'observation_date' as observation_date,
      a.content->>'observer' as observer,
      a.content->>'closed_at' as closed_at,
      a.content->>'submitted_at' as submitted_at_text,
      case when a.content->>'submitted_at' ~ '^\d{4}-\d{2}-\d{2}T'
           then (a.content->>'submitted_at')::timestamptz end as submitted_at_ts,
      coalesce(a.content->>'round', '') as otp_round,
      a.coach_emailed_at,
      a.teacher_emailed_at,
      a.created_at
    from assessments a
    where a.school_id = v_school and a.type = 'otp'
  ),
  recs2 as (
    select r.*,
      (coalesce(r.otp_round, '') = '' or v_round is null or v_round = '' or r.otp_round = v_round) as in_current_round,
      -- emails_legacy: exactly migrate_22's formula, generalised per record (it only ever
      -- depended on that record's own submitted_at plus the one global cutoff).
      (v_stamp_since is null or (r.submitted_at_ts is not null and r.submitted_at_ts < v_stamp_since)) as emails_legacy,
      -- effective_date for the school-year window: observation_date, else submitted_at,
      -- else created_at (all read in Asia/Dubai local time, matching how AIS-OTP record
      -- ids and observation dates are already stamped).
      coalesce(
        case when r.observation_date ~ '^\d{4}-\d{2}-\d{2}$' then r.observation_date::date end,
        case when r.submitted_at_ts is not null then (r.submitted_at_ts at time zone 'Asia/Dubai')::date end,
        (r.created_at at time zone 'Asia/Dubai')::date
      ) as effective_date
    from recs r
    where r.teacher_key <> ''
  ),
  year_recs as (
    select * from recs2 where effective_date between v_year_start and v_year_end
  ),
  -- active roster, PLUS the test teacher as an extra off-roster entry ONLY if it has an
  -- OTP record and is not itself on the active roster (PLAN-A.md section 10, ANSWERED:
  -- show the test teacher).
  roster as (
    select t.full_name, t.section, true as on_roster
      from teachers t
     where t.school_id = v_school and t.status = 'active'
    union all
    select 'OTP Test Teacher (delete me)', null::text, false
     where not exists (
       select 1 from teachers t2
        where t2.school_id = v_school and t2.status = 'active'
          and lower(btrim(t2.full_name)) = 'otp test teacher (delete me)')
       and exists (
         select 1 from recs2 s where s.teacher_key = 'otp test teacher (delete me)')
  ),
  roster_k as (
    select r.*, lower(btrim(r.full_name)) as tkey from roster r
  ),
  obs_counts as (
    select rk.tkey, count(yr.id) as observation_count
    from roster_k rk
    left join year_recs yr on yr.teacher_key = rk.tkey
    group by rk.tkey
  ),
  open_counts as (
    select rk.tkey, count(rc.id) as open_count
    from roster_k rk
    left join recs2 rc on rc.teacher_key = rk.tkey and rc.in_current_round and rc.status <> 'closed'
    group by rk.tkey
  ),
  open_pick as (
    select distinct on (r.teacher_key)
      r.teacher_key as tkey, r.lap, r.observation_date, r.observer, r.emails_legacy,
      r.coach_emailed_at, r.teacher_emailed_at
    from recs2 r
    where r.in_current_round and r.status <> 'closed'
    order by r.teacher_key, r.lap desc nulls last, r.submitted_at_text desc nulls last
  ),
  closed_pick as (
    select distinct on (r.teacher_key)
      r.teacher_key as tkey, r.lap, r.observation_date, r.observer, r.closed_at
    from recs2 r
    where r.in_current_round and r.status = 'closed'
    order by r.teacher_key, r.observation_date desc nulls last, r.submitted_at_text desc nulls last
  ),
  history as (
    select yr.teacher_key as tkey,
      jsonb_agg(
        jsonb_build_object(
          'lap', yr.lap,
          'state', case when yr.status = 'closed' then 'closed' else 'open' end,
          'observation_date', coalesce(yr.observation_date, ''),
          'observer', coalesce(yr.observer, ''),
          'closed_at', coalesce(yr.closed_at, ''),
          'emails_done', (yr.emails_legacy or (yr.coach_emailed_at is not null and yr.teacher_emailed_at is not null))
        )
        order by yr.effective_date asc, coalesce(yr.submitted_at_text, '') asc
      ) as hist
    from year_recs yr
    group by yr.teacher_key
  )
  select jsonb_agg(
    jsonb_build_object(
      'name', rk.full_name,
      'section', rk.section,
      'on_roster', rk.on_roster,
      'observation_count', coalesce(oc.observation_count, 0),
      'open', case when op.tkey is null then null else jsonb_build_object(
        'lap', op.lap,
        'observation_date', coalesce(op.observation_date, ''),
        'observer', coalesce(op.observer, ''),
        'emails_done', (op.emails_legacy or (op.coach_emailed_at is not null and op.teacher_emailed_at is not null))
      ) end,
      'open_count', coalesce(ocnt.open_count, 0),
      'last_closed', case when cp.tkey is null then null else jsonb_build_object(
        'lap', cp.lap,
        'observation_date', coalesce(cp.observation_date, ''),
        'observer', coalesce(cp.observer, ''),
        'closed_at', coalesce(cp.closed_at, '')
      ) end,
      -- SEAM (do not build yet, PLAN-A.md section 10): a later version may add what the
      -- teacher wrote per step, once the Teacher Reflection Form and Teacher Plan Form
      -- exist. Add new keys inside 'open' / each history entry then; never repurpose an
      -- existing key, so this shape stays a stable contract for callers already reading it.
      'history', coalesce(h.hist, '[]'::jsonb)
    )
    order by rk.full_name
  ) into v_teachers
  from roster_k rk
  left join obs_counts   oc    on oc.tkey    = rk.tkey
  left join open_counts  ocnt  on ocnt.tkey  = rk.tkey
  left join open_pick    op    on op.tkey    = rk.tkey
  left join closed_pick  cp    on cp.tkey    = rk.tkey
  left join history      h     on h.tkey     = rk.tkey;

  return jsonb_build_object(
    'success', true,
    'school_year', v_school_year,
    'generated_at', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'teachers', coalesce(v_teachers, '[]'::jsonb)
  );
end $$;
revoke all on function public.get_otp_tracker() from public;
grant execute on function public.get_otp_tracker() to anon, authenticated;

commit;
