-- otp-v0.11 lap tracker: atomically block a second open observation.
-- Implements PLAN.md section 3.6.
-- Apply: the foreman applies this file (builders never touch the database).
begin;

create or replace function public.otp_write(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- enforce_open_block is intentionally not in cols, so the only loop that
  -- copies client fields into content can never persist this control flag.
  cols text[] := array[
    'record_id', 'submitted_at',
    'teacher', 'curriculum', 'observer', 'observation_date',
    'room_number', 'time_in', 'subject', 'school', 'support_teachers_cas',
    'otp_ref', 'otp_aspect',
    'sp1_beginner', 'sp1_emerging', 'sp1_good', 'sp1_great', 'sp1_outstanding',
    'sp1_selected_text',
    'observer_comments', 'other_observations',
    'next_step_1', 'next_step_2', 'next_step_3',
    'record_token', 'evidence_pad_id',
    'sp1_present', 'sp1_partially_present', 'sp1_not_present',
    'sp1_not_seen', 'grade',
    'sp1_notes', 'rubric_version',
    'time_out',
    'status', 'closed_at', 'lap', 'round'];
  locked text[] := array['record_id', 'submitted_at', 'record_token', 'lap', 'round'];
  v_action   text := p_action;
  v_dup      boolean := false;
  v_school   uuid;
  v_now      timestamptz := clock_timestamp();
  v_now_iso  text;
  v_token    text;
  v_id       text;
  v_lap      int;
  v_round    text;
  v_teacher  text;
  v_existing jsonb;
  v_rec      jsonb := '{}'::jsonb;
  v_ing      jsonb;
  v_derived  text;
  v_is_close boolean;
  v_block    boolean;
  v_block_config text;
  v_open     jsonb;
  c          text;
begin
  if v_action is null or v_action not in ('submit', 'update', 'close') then
    return jsonb_build_object('success', false, 'error', 'bad action');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('success', false, 'error', 'bad payload');
  end if;
  select id into v_school from schools where slug = 'ais-sharjah';
  if v_school is null then
    return jsonb_build_object('success', false, 'error', 'school not found');
  end if;
  v_now_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  v_token := lower(btrim(coalesce(p_payload->>'record_token', '')));
  if v_action = 'submit' and v_token !~ '^[0-9a-f]{32}$' then
    v_token := replace(gen_random_uuid()::text, '-', '');
  end if;
  if v_token !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('success', false, 'error', 'Record not found');
  end if;
  select content into v_existing from assessments
   where school_id = v_school and type = 'otp' and source_ref = v_token;

  if v_action = 'submit' and found then
    -- The same token again: a double tap, a retry after a lost answer, or a
    -- retry after a visible failure with more typed in. An open lap takes the
    -- new content (update semantics); a closed one answers as it stands.
    if coalesce(v_existing->>'status', 'observed') = 'closed' then
      return jsonb_build_object('success', true, 'duplicate', true,
        'id', v_existing->>'record_id', 'token', v_token,
        'status', 'closed', 'closed_at', coalesce(v_existing->>'closed_at', ''));
    end if;
    v_action := 'update';
    v_dup := true;
  end if;

  if v_action = 'submit' then
    v_teacher := btrim(coalesce(p_payload->>'teacher', ''));
    if v_teacher = '' then
      return jsonb_build_object('success', false, 'error', 'no teacher');
    end if;
    v_block := coalesce(p_payload->>'enforce_open_block' = 'true', false);
    if not v_block then
      select value into v_block_config from app_config where key = 'otp_block_open_required';
      v_block := coalesce(v_block_config = 'true', false);
    end if;
    select value into v_round from app_config where key = 'current_round_otp';
    if v_block then
      perform pg_advisory_xact_lock(hashtext('otp:' || lower(btrim(v_teacher))));
      select a.content into v_open
        from assessments a
       where a.type = 'otp'
         and lower(trim(a.content->>'teacher')) = lower(trim(v_teacher))
         and (coalesce(a.content->>'round', '') = '' or v_round is null or v_round = '' or a.content->>'round' = v_round)
         and coalesce(a.content->>'status', 'observed') <> 'closed'
         and a.source_ref <> v_token
       order by case when coalesce(a.content->>'lap', '') ~ '^\d+$' then (a.content->>'lap')::int end desc nulls last,
                nullif(a.content->>'submitted_at', '') desc nulls last
       limit 1;
      if found then
        return jsonb_build_object('success', false, 'error', 'open_observation',
          'lap', case when coalesce(v_open->>'lap', '') ~ '^\d+$' then (v_open->>'lap')::int else null end,
          'id', v_open->>'record_id');
      end if;
    end if;
    v_id := 'AIS-OTP-' || to_char(v_now at time zone 'Asia/Dubai', 'YYYYMMDD"-"HH24MISS');
    -- 1 + this teacher's earlier OTP rows, as computeOtpLap counts on the Sheet,
    -- but never below 1 + the highest lap already stamped (a row deleted on one
    -- side only must not hand out a used number).
    select greatest(count(*),
                    coalesce(max(case when coalesce(content->>'lap', '') ~ '^\d+$' then (content->>'lap')::int end), 0)) + 1
      into v_lap
      from assessments
     where school_id = v_school and type = 'otp'
       and lower(btrim(coalesce(content->>'teacher', ''))) = lower(v_teacher);
    select value into v_round from app_config where key = 'current_round_otp';
    foreach c in array cols loop
      v_rec := v_rec || jsonb_build_object(c, case c
        when 'record_id'        then to_jsonb(v_id)
        when 'submitted_at'     then to_jsonb(v_now_iso)
        when 'observer'         then to_jsonb(coalesce(nullif(p_payload->>'inspector', ''), p_payload->>'observer', ''))
        when 'observation_date' then to_jsonb(coalesce(nullif(p_payload->>'date', ''), p_payload->>'observation_date', ''))
        when 'record_token'     then to_jsonb(v_token)
        when 'school'           then to_jsonb(coalesce(nullif(otp_school_for_grade(p_payload->>'grade'), ''), p_payload->>'school', ''))
        when 'status'           then to_jsonb('observed'::text)
        when 'closed_at'        then to_jsonb(''::text)
        when 'lap'              then to_jsonb(v_lap)
        when 'round'            then to_jsonb(coalesce(v_round, ''))
        else coalesce(nullif(p_payload->c, 'null'::jsonb), to_jsonb(''::text))
      end);
    end loop;
    v_ing := ingest_otp(v_rec);
    if coalesce((v_ing->>'success')::boolean, false) is not true then
      return v_ing;
    end if;
    update assessments set mirrored_at = null, mirror_pending_since = v_now
     where school_id = v_school and type = 'otp' and source_ref = v_token;
    return jsonb_build_object('success', true, 'id', v_id, 'token', v_token,
      'status', 'observed', 'closed_at', '', 'lap', v_lap,
      'pending_since', v_now, 'record', v_rec);
  end if;

  -- update / close
  v_is_close := (v_action = 'close');
  if not found then
    return jsonb_build_object('success', false, 'error', 'Record not found');
  end if;
  if coalesce(v_existing->>'status', 'observed') = 'closed' then
    if v_is_close then
      -- closing a closed lap: idempotent (a close whose answer was lost, then retried)
      return jsonb_build_object('success', true, 'duplicate', true,
        'id', v_existing->>'record_id', 'token', v_token,
        'status', 'closed', 'closed_at', coalesce(v_existing->>'closed_at', ''));
    end if;
    return jsonb_build_object('success', false, 'error', 'already_closed',
      'id', v_existing->>'record_id', 'token', v_token,
      'status', 'closed', 'closed_at', coalesce(v_existing->>'closed_at', ''));
  end if;
  if v_action = 'update'
     and not v_dup
     and p_payload ? 'teacher'
     and lower(btrim(coalesce(p_payload->>'teacher', '')))
         is distinct from lower(btrim(coalesce(v_existing->>'teacher', ''))) then
    v_teacher := btrim(coalesce(p_payload->>'teacher', ''));
    v_block := coalesce(p_payload->>'enforce_open_block' = 'true', false);
    if not v_block then
      select value into v_block_config from app_config where key = 'otp_block_open_required';
      v_block := coalesce(v_block_config = 'true', false);
    end if;
    if v_block then
      select value into v_round from app_config where key = 'current_round_otp';
      perform pg_advisory_xact_lock(hashtext('otp:' || lower(btrim(v_teacher))));
      select a.content into v_open
        from assessments a
       where a.type = 'otp'
         and lower(trim(a.content->>'teacher')) = lower(trim(v_teacher))
         and (coalesce(a.content->>'round', '') = '' or v_round is null or v_round = '' or a.content->>'round' = v_round)
         and coalesce(a.content->>'status', 'observed') <> 'closed'
         and a.source_ref <> v_token
       order by case when coalesce(a.content->>'lap', '') ~ '^\d+$' then (a.content->>'lap')::int end desc nulls last,
                nullif(a.content->>'submitted_at', '') desc nulls last
       limit 1;
      if found then
        return jsonb_build_object('success', false, 'error', 'open_observation',
          'lap', case when coalesce(v_open->>'lap', '') ~ '^\d+$' then (v_open->>'lap')::int else null end,
          'id', v_open->>'record_id');
      end if;
    end if;
  end if;
  v_rec := v_existing;
  foreach c in array cols loop
    if c = any(locked) then continue; end if;
    if c = 'status' then
      v_rec := v_rec || jsonb_build_object('status', case when v_is_close then 'closed' else 'observed' end);
      continue;
    end if;
    if c = 'closed_at' then
      if v_is_close then
        v_rec := v_rec || jsonb_build_object('closed_at', coalesce(nullif(p_payload->>'closed_at', ''), v_now_iso));
      end if;
      continue;
    end if;
    if c = 'observer' then
      if p_payload ? 'inspector' or p_payload ? 'observer' then
        v_rec := v_rec || jsonb_build_object('observer', coalesce(nullif(p_payload->>'inspector', ''), p_payload->>'observer', ''));
      end if;
      continue;
    end if;
    if c = 'observation_date' then
      if p_payload ? 'date' or p_payload ? 'observation_date' then
        v_rec := v_rec || jsonb_build_object('observation_date', coalesce(nullif(p_payload->>'date', ''), p_payload->>'observation_date', ''));
      end if;
      continue;
    end if;
    if c = 'school' then
      if p_payload ? 'grade' or p_payload ? 'school' then
        v_derived := otp_school_for_grade(p_payload->>'grade');
        v_rec := v_rec || jsonb_build_object('school', coalesce(nullif(v_derived, ''), p_payload->>'school', ''));
      end if;
      continue;
    end if;
    if p_payload ? c then
      v_rec := v_rec || jsonb_build_object(c, coalesce(nullif(p_payload->c, 'null'::jsonb), to_jsonb(''::text)));
    end if;
  end loop;
  v_ing := ingest_otp(v_rec);
  if coalesce((v_ing->>'success')::boolean, false) is not true then
    return v_ing;
  end if;
  update assessments set mirrored_at = null, mirror_pending_since = v_now
   where school_id = v_school and type = 'otp' and source_ref = v_token;
  return jsonb_build_object('success', true, 'duplicate', v_dup,
    'id', v_rec->>'record_id', 'token', v_token,
    'status', v_rec->>'status', 'closed_at', coalesce(v_rec->>'closed_at', ''),
    'lap', nullif(v_rec->>'lap', '')::int,
    'pending_since', v_now, 'record', v_rec);
end $$;
revoke all on function public.otp_write(text, jsonb) from public, anon, authenticated;
grant execute on function public.otp_write(text, jsonb) to service_role;

commit;
