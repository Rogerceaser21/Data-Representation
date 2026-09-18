-- otp-v0.11 lap tracker state: stamp columns and teacher lap-state reader.
-- Implements PLAN.md section 3.2.
-- Apply: the foreman applies this file (builders never touch the database).
begin;

alter table public.assessments
  add column if not exists coach_emailed_at timestamptz,
  add column if not exists teacher_emailed_at timestamptz;

create or replace function public.get_teacher_lap_state(p_teacher text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_round text;
  v_stamp_since_text text;
  v_stamp_since timestamptz;
  v_school uuid;
  v_open_content jsonb;
  v_open_coach_emailed_at timestamptz;
  v_open_teacher_emailed_at timestamptz;
  v_predecessor jsonb;
  v_last_closed jsonb;
  v_observation_count int := 0;
  v_next_lap int := 1;
  v_open_count int := 0;
  v_open_lap int;
  v_open_submitted_at timestamptz;
  v_emails_legacy boolean := false;
begin
  if nullif(trim(p_teacher), '') is null then
    return jsonb_build_object(
      'success', true, 'observation_count', 0, 'next_lap', 1, 'open_count', 0,
      'open', null, 'predecessor', null, 'last_closed', null);
  end if;

  select value into v_round from app_config where key = 'current_round_otp';
  select value into v_stamp_since_text from app_config where key = 'otp_email_stamps_since';
  select id into v_school from schools where slug = 'ais-sharjah';

  begin
    v_stamp_since := nullif(btrim(coalesce(v_stamp_since_text, '')), '')::timestamptz;
  exception when others then
    v_stamp_since := null;
  end;

  select count(*) into v_observation_count
    from assessments a
   where a.type = 'otp'
     and lower(trim(a.content->>'teacher')) = lower(trim(p_teacher))
     and (coalesce(a.content->>'round', '') = '' or v_round is null or v_round = '' or a.content->>'round' = v_round);

  if v_school is not null then
    select greatest(count(*),
                    coalesce(max(case when coalesce(content->>'lap', '') ~ '^\d+$' then (content->>'lap')::int end), 0)) + 1
      into v_next_lap
      from assessments
     where school_id = v_school and type = 'otp'
       and lower(btrim(coalesce(content->>'teacher', ''))) = lower(btrim(p_teacher));
  end if;

  select count(*) into v_open_count
    from assessments a
   where a.type = 'otp'
     and lower(trim(a.content->>'teacher')) = lower(trim(p_teacher))
     and (coalesce(a.content->>'round', '') = '' or v_round is null or v_round = '' or a.content->>'round' = v_round)
     and coalesce(a.content->>'status', 'observed') <> 'closed';

  select a.content, a.coach_emailed_at, a.teacher_emailed_at
    into v_open_content, v_open_coach_emailed_at, v_open_teacher_emailed_at
    from assessments a
   where a.type = 'otp'
     and lower(trim(a.content->>'teacher')) = lower(trim(p_teacher))
     and (coalesce(a.content->>'round', '') = '' or v_round is null or v_round = '' or a.content->>'round' = v_round)
     and coalesce(a.content->>'status', 'observed') <> 'closed'
   order by case when coalesce(a.content->>'lap', '') ~ '^\d+$' then (a.content->>'lap')::int end desc nulls last,
            nullif(a.content->>'submitted_at', '') desc nulls last
   limit 1;

  if found then
    if coalesce(v_open_content->>'lap', '') ~ '^\d+$' then
      v_open_lap := (v_open_content->>'lap')::int;
    end if;
    begin
      v_open_submitted_at := nullif(v_open_content->>'submitted_at', '')::timestamptz;
    exception when others then
      v_open_submitted_at := null;
    end;
    v_emails_legacy := v_stamp_since is null
      or (v_open_submitted_at is not null and v_open_submitted_at < v_stamp_since);

    if v_open_lap is not null and v_open_lap > 1 then
      select a.content into v_predecessor
        from assessments a
       where a.type = 'otp'
         and lower(trim(a.content->>'teacher')) = lower(trim(p_teacher))
         and coalesce(a.content->>'status', 'observed') = 'closed'
         and coalesce(a.content->>'lap', '') ~ '^\d+$'
         and (a.content->>'lap')::int = v_open_lap - 1
       limit 1;
    end if;
  end if;

  select a.content into v_last_closed
    from assessments a
   where a.type = 'otp'
     and lower(trim(a.content->>'teacher')) = lower(trim(p_teacher))
     and a.content->>'status' = 'closed'
     and (coalesce(a.content->>'round', '') = '' or v_round is null or v_round = '' or a.content->>'round' = v_round)
   order by nullif(a.content->>'observation_date', '') desc nulls last,
            nullif(a.content->>'submitted_at', '') desc nulls last
   limit 1;

  return jsonb_build_object(
    'success', true,
    'observation_count', v_observation_count,
    'next_lap', v_next_lap,
    'open_count', v_open_count,
    'open', case when v_open_content is null then null else jsonb_build_object(
      'record_token', v_open_content->>'record_token',
      'record_id', v_open_content->>'record_id',
      'lap', v_open_lap,
      'observation_date', v_open_content->>'observation_date',
      'observer', v_open_content->>'observer',
      'submitted_at', v_open_content->>'submitted_at',
      'next_step_1', v_open_content->>'next_step_1',
      'next_step_2', v_open_content->>'next_step_2',
      'next_step_3', v_open_content->>'next_step_3',
      'coach_emailed_at', case when v_open_coach_emailed_at is null then '' else to_char(v_open_coach_emailed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'teacher_emailed_at', case when v_open_teacher_emailed_at is null then '' else to_char(v_open_teacher_emailed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'emails_legacy', v_emails_legacy) end,
    'predecessor', case when v_predecessor is null then null else jsonb_build_object(
      'lap', v_predecessor->>'lap',
      'observation_date', v_predecessor->>'observation_date',
      'observer', v_predecessor->>'observer',
      'closed_at', v_predecessor->>'closed_at',
      'next_step_1', v_predecessor->>'next_step_1',
      'next_step_2', v_predecessor->>'next_step_2',
      'next_step_3', v_predecessor->>'next_step_3') end,
    'last_closed', case when v_last_closed is null then null else jsonb_build_object(
      'lap', v_last_closed->>'lap',
      'observation_date', v_last_closed->>'observation_date',
      'observer', v_last_closed->>'observer',
      'closed_at', v_last_closed->>'closed_at',
      'next_step_1', v_last_closed->>'next_step_1',
      'next_step_2', v_last_closed->>'next_step_2',
      'next_step_3', v_last_closed->>'next_step_3') end);
end $$;
revoke all on function public.get_teacher_lap_state(text) from public;
grant execute on function public.get_teacher_lap_state(text) to anon, authenticated;

commit;
