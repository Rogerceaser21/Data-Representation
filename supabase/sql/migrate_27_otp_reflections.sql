-- otp-v0.14 T1: Teacher Reflection + Plan forms, Supabase layer.
-- Additive only: one new table, one new index, otp_write gains teacher_token
-- generation (locked, never touched by update/close), otp_record_for_mirror /
-- get_teacher_lap_state / get_otp_tracker are replaced with the SAME output
-- plus new keys, everything else is a brand new function. Idempotent
-- (create ... if not exists, create or replace). One transaction.
-- Apply: the foreman applies this file (builders never touch the database).
begin;

-- ---------- 1) otp_reflections table ----------
create table if not exists public.otp_reflections (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid references public.schools(id),
  record_token          text not null,
  part                  smallint not null check (part in (1, 2)),
  answers               jsonb not null,
  submitted_at          timestamptz not null default now(),
  mirrored_at           timestamptz,
  mirror_pending_since  timestamptz,
  teacher_emailed_at    timestamptz,
  coach_emailed_at      timestamptz,
  unique (record_token, part)
);
alter table public.otp_reflections enable row level security;
-- no policies: definer functions only (mirrors app_config / otp_reflections'
-- sibling tables; anon/authenticated never touch this table directly).

-- lookup: assessments rows carrying a teacher_token, the hot path for every
-- teacher-facing read/write (otp_reflect_state, otp_reflect_write,
-- otp_record_by_teacher_token). Legacy rows (no teacher_token) are excluded.
create index if not exists idx_assessments_otp_teacher_token
  on public.assessments ((content->>'teacher_token'))
  where type = 'otp' and coalesce(content->>'teacher_token', '') <> '';

-- ---------- 2) otp_write: copy of migrate_23's body, PLUS teacher_token ----------
-- teacher_token is generated once, at a true 'submit', only when the payload
-- carries reflection_flow:'true'; it is added to `locked` so the update/close
-- loop (which skips every locked column) can never touch it again.
-- reflection_flow itself is never added to `cols`, so it is never stored.
-- Every other behaviour is byte-identical to migrate_23.
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
    'status', 'closed_at', 'lap', 'round', 'teacher_token'];
  locked text[] := array['record_id', 'submitted_at', 'record_token', 'lap', 'round', 'teacher_token'];
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
        -- '' (not omitted) when reflection_flow is absent: teacher_token is a
        -- schema column like every other entry in `cols` (closed_at, lap...),
        -- always present with a blank sentinel until it applies. A record
        -- with '' behaves identically to a pre-v0.14 record that had no such
        -- key at all (reflection_flow / owed / emails all key off "is this
        -- non-empty", never off "does this key exist"); accepted, not omitted.
        when 'teacher_token'    then case when coalesce(p_payload->>'reflection_flow', '') = 'true'
                                       then to_jsonb(replace(gen_random_uuid()::text, '-', ''))
                                       else to_jsonb(''::text) end
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
revoke all on function public.otp_write(text, jsonb) from public, anon, authenticated, dreamlit_app;
grant execute on function public.otp_write(text, jsonb) to service_role;

-- ---------- 3) otp_reflect_links: shared {reflect, view} link resolver ----------
-- Used by otp_record_for_mirror and otp_reflection_for_mirror so the two
-- mirror-facing functions can never disagree on where the links point.
create or replace function public.otp_reflect_links()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'reflect', coalesce(nullif((select value from app_config where key = 'otp_reflect_page_url'), ''),
      'https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-reflect.html'),
    'view', coalesce(nullif((select value from app_config where key = 'otp_teacher_view_url'), ''),
      'https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-record.html')
  );
$$;
revoke all on function public.otp_reflect_links() from public, anon, authenticated, dreamlit_app;
grant execute on function public.otp_reflect_links() to service_role;

-- ---------- 4) otp_reflect_state ----------
-- {found:false} on any miss, a non-canonical token never scans the table.
create or replace function public.otp_reflect_state(p_teacher_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token   text := lower(btrim(coalesce(p_teacher_token, '')));
  v_content jsonb;
  v_status  text;
  v_part1   jsonb;
  v_part2   jsonb;
  v_owed    int[];
begin
  if v_token !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('found', false);
  end if;
  select content into v_content
    from assessments
   where type = 'otp' and content->>'teacher_token' = v_token
   limit 1;
  if not found or v_content is null then
    return jsonb_build_object('found', false);
  end if;
  v_status := coalesce(v_content->>'status', 'observed');

  select jsonb_build_object(
      'sent_at', to_char(submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'answers', answers)
    into v_part1
    from otp_reflections
   where record_token = v_content->>'record_token' and part = 1;

  select jsonb_build_object(
      'sent_at', to_char(submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'answers', answers)
    into v_part2
    from otp_reflections
   where record_token = v_content->>'record_token' and part = 2;

  v_owed := array_remove(array[
    case when v_part1 is null then 1 end,
    case when v_status = 'closed' and v_part2 is null then 2 end
  ], null);

  return jsonb_build_object(
    'found', true,
    'lap', case when coalesce(v_content->>'lap', '') ~ '^\d+$' then (v_content->>'lap')::int else null end,
    'teacher', v_content->>'teacher',
    'observer', v_content->>'observer',
    'subject', v_content->>'subject',
    'grade', v_content->>'grade',
    'observation_date', v_content->>'observation_date',
    'status', v_status,
    'closed_at', coalesce(v_content->>'closed_at', ''),
    'next_steps', case when v_status = 'closed' then
        coalesce((
          select jsonb_agg(v order by ord)
            from unnest(array[v_content->>'next_step_1', v_content->>'next_step_2', v_content->>'next_step_3']) with ordinality as u(v, ord)
           where nullif(btrim(coalesce(v, '')), '') is not null
        ), '[]'::jsonb)
      else '[]'::jsonb end,
    'part1', v_part1,
    'part2', v_part2,
    'view_unlocked', (v_part1 is not null),
    'owed', to_jsonb(v_owed)
  );
end $$;
revoke all on function public.otp_reflect_state(text) from public, anon, authenticated, dreamlit_app;
grant execute on function public.otp_reflect_state(text) to service_role;

-- ---------- 5) otp_reflect_write ----------
create or replace function public.otp_reflect_write(p_teacher_token text, p_parts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token        text := lower(btrim(coalesce(p_teacher_token, '')));
  v_content      jsonb;
  v_record_token text;
  v_status       text;
  v_school       uuid;
  v_existing     int[];
  v_missing      text[] := array[]::text[];
  v_sent         int[] := array[]::int[];
  v_dup          int[] := array[]::int[];
  v_now          timestamptz := clock_timestamp();
  v_pk           text;
  v_part         int;
  v_answers      jsonb;
  v_norm         jsonb;
  v_val          text;
  k              text;
  v_p2_keys      text[] := array['q4', 'q5', 'q6', 'q7', 'q8'];
begin
  if v_token !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('success', false, 'error', 'Record not found');
  end if;
  select content into v_content
    from assessments
   where type = 'otp' and content->>'teacher_token' = v_token
   limit 1;
  if not found or v_content is null then
    return jsonb_build_object('success', false, 'error', 'Record not found');
  end if;
  v_record_token := v_content->>'record_token';
  v_status := coalesce(v_content->>'status', 'observed');
  select id into v_school from schools where slug = 'ais-sharjah';

  if p_parts is null or jsonb_typeof(p_parts) <> 'object' then
    return jsonb_build_object('success', false, 'error', 'bad payload');
  end if;

  if p_parts ? '2' and v_status <> 'closed' then
    return jsonb_build_object('success', false, 'error', 'not_open');
  end if;

  select coalesce(array_agg(part), array[]::int[]) into v_existing
    from otp_reflections where record_token = v_record_token;

  -- pass 1: validate every requested part that is not already stored. A
  -- partially-invalid request writes nothing (all missing keys collected
  -- first, across every not-yet-stored requested part).
  for v_pk in select jsonb_object_keys(p_parts) loop
    if v_pk not in ('1', '2') then continue; end if;
    v_part := v_pk::int;
    if v_part = any(v_existing) then continue; end if;
    v_answers := case when jsonb_typeof(p_parts->v_pk) = 'object' then p_parts->v_pk else '{}'::jsonb end;
    if v_part = 1 then
      foreach k in array array['q1', 'q3'] loop
        if nullif(btrim(coalesce(v_answers->>k, '')), '') is null or length(coalesce(v_answers->>k, '')) > 4000 then
          v_missing := array_append(v_missing, k);
        end if;
      end loop;
      v_val := btrim(coalesce(v_answers->>'q2_level', ''));
      if v_val not in ('Beginner', 'Emerging', 'Good', 'Great', 'Outstanding') then
        v_missing := array_append(v_missing, 'q2_level');
      end if;
      if length(coalesce(v_answers->>'q2_comment', '')) > 4000 then
        v_missing := array_append(v_missing, 'q2_comment');
      end if;
    else
      foreach k in array v_p2_keys loop
        if nullif(btrim(coalesce(v_answers->>k, '')), '') is null or length(coalesce(v_answers->>k, '')) > 4000 then
          v_missing := array_append(v_missing, k);
        end if;
      end loop;
    end if;
  end loop;

  if array_length(v_missing, 1) > 0 then
    return jsonb_build_object('success', false, 'error', 'missing_answers', 'missing', to_jsonb(v_missing));
  end if;

  -- pass 2: write every not-yet-stored requested part (trimmed answers,
  -- mirror_pending_since = now); an already-stored part is left untouched
  -- and listed in duplicate.
  for v_pk in select jsonb_object_keys(p_parts) loop
    if v_pk not in ('1', '2') then continue; end if;
    v_part := v_pk::int;
    if v_part = any(v_existing) then
      v_dup := array_append(v_dup, v_part);
      continue;
    end if;
    v_answers := p_parts->v_pk;
    if v_part = 1 then
      v_norm := jsonb_build_object(
        'q1', btrim(coalesce(v_answers->>'q1', '')),
        'q2_level', btrim(coalesce(v_answers->>'q2_level', '')),
        'q2_comment', btrim(coalesce(v_answers->>'q2_comment', '')),
        'q3', btrim(coalesce(v_answers->>'q3', '')));
    else
      v_norm := jsonb_build_object(
        'q4', btrim(coalesce(v_answers->>'q4', '')),
        'q5', btrim(coalesce(v_answers->>'q5', '')),
        'q6', btrim(coalesce(v_answers->>'q6', '')),
        'q7', btrim(coalesce(v_answers->>'q7', '')),
        'q8', btrim(coalesce(v_answers->>'q8', '')));
    end if;
    -- on conflict do nothing: two concurrent sends of the same part (a
    -- double tap) can both pass the v_existing pre-check above; without this
    -- the second insert throws a unique-violation whose PostgREST error text
    -- carries the record_token, which would then risk being logged by the
    -- caller. A raced loser here is simply reclassified as duplicate below,
    -- exactly like a part that already existed before this call started.
    insert into otp_reflections (school_id, record_token, part, answers, submitted_at, mirror_pending_since)
      values (v_school, v_record_token, v_part, v_norm, v_now, v_now)
      on conflict (record_token, part) do nothing;
    if found then
      v_sent := array_append(v_sent, v_part);
    else
      v_dup := array_append(v_dup, v_part);
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'sent', to_jsonb(v_sent),
    'duplicate', to_jsonb(v_dup),
    'state', otp_reflect_state(p_teacher_token),
    'mirror_ref', v_record_token
  );
end $$;
revoke all on function public.otp_reflect_write(text, jsonb) from public, anon, authenticated, dreamlit_app;
grant execute on function public.otp_reflect_write(text, jsonb) to service_role;

-- ---------- 6) otp_record_by_teacher_token ----------
create or replace function public.otp_record_by_teacher_token(p_teacher_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token         text := lower(btrim(coalesce(p_teacher_token, '')));
  v_content       jsonb;
  v_part1_exists  boolean;
begin
  if v_token !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('found', false);
  end if;
  select content into v_content
    from assessments
   where type = 'otp' and content->>'teacher_token' = v_token
   limit 1;
  if not found or v_content is null then
    return jsonb_build_object('found', false);
  end if;
  select exists(
    select 1 from otp_reflections
     where record_token = v_content->>'record_token' and part = 1
  ) into v_part1_exists;
  if not v_part1_exists then
    return jsonb_build_object('found', true, 'locked', true);
  end if;
  return jsonb_build_object(
    'found', true,
    'locked', false,
    'data', (v_content - 'record_token' - 'teacher_token'),
    'evidence_pad_id', coalesce(v_content->>'evidence_pad_id', '')
  );
end $$;
revoke all on function public.otp_record_by_teacher_token(text) from public, anon, authenticated, dreamlit_app;
grant execute on function public.otp_record_by_teacher_token(text) to service_role;

-- ---------- 6b) otp_record_by_token (replace, migrate_21 body, now also
-- strips teacher_token) ----------
-- migrate_21's body only stripped record_token, because teacher_token did
-- not exist yet. A reflection-flow record's content can now carry
-- teacher_token, and this function feeds the coach's existing ?token= route
-- (supabase/functions/otp-record/index.ts), which is byte-identical in
-- behaviour per the otp-v0.14 contract; byte-identical means it must not
-- start handing back a new secret it never used to carry. Everything else
-- (exact-token lookup, service_role only) is unchanged.
create or replace function public.otp_record_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('found', true, 'data', a.content - 'record_token' - 'teacher_token')
       from assessments a
      where a.type = 'otp'
        and a.source_ref = btrim(coalesce(p_token, ''))
        and btrim(coalesce(p_token, '')) ~ '^[0-9a-f]{32}$'),
    jsonb_build_object('found', false));
$$;
revoke all on function public.otp_record_by_token(text) from public, anon, authenticated, dreamlit_app;
grant execute on function public.otp_record_by_token(text) to service_role;

-- ---------- 7) otp_reflection_for_mirror ----------
create or replace function public.otp_reflection_for_mirror(p_record_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token       text := lower(btrim(coalesce(p_record_token, '')));
  v_content     jsonb;
  v_coach_at    timestamptz;
  v_teacher_at  timestamptz;
  v_record      jsonb;
  v_reflections jsonb;
begin
  select content, coach_emailed_at, teacher_emailed_at
    into v_content, v_coach_at, v_teacher_at
    from assessments
   where type = 'otp' and source_ref = v_token;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  v_record := v_content || jsonb_build_object(
    'coach_emailed_at', case when v_coach_at is null then '' else to_char(v_coach_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'teacher_emailed_at', case when v_teacher_at is null then '' else to_char(v_teacher_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end);

  select coalesce(jsonb_agg(jsonb_build_object(
      'part', r.part,
      'answers', r.answers,
      'submitted_at', to_char(r.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'mirrored_at', case when r.mirrored_at is null then null else to_char(r.mirrored_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'teacher_emailed_at', case when r.teacher_emailed_at is null then null else to_char(r.teacher_emailed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'coach_emailed_at', case when r.coach_emailed_at is null then null else to_char(r.coach_emailed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
    ) order by r.part), '[]'::jsonb)
    into v_reflections
    from otp_reflections r
   where r.record_token = v_token;

  return jsonb_build_object(
    'found', true,
    'record', v_record,
    'reflections', v_reflections,
    'links', otp_reflect_links()
  );
end $$;
revoke all on function public.otp_reflection_for_mirror(text) from public, anon, authenticated, dreamlit_app;
grant execute on function public.otp_reflection_for_mirror(text) to service_role;

-- ---------- 8) mark_reflection_mirrored ----------
create or replace function public.mark_reflection_mirrored(
  p_record_token text, p_part int, p_teacher_at timestamptz default null, p_coach_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  update otp_reflections
     set mirrored_at = now(),
         mirror_pending_since = null,
         teacher_emailed_at = coalesce(teacher_emailed_at, p_teacher_at),
         coach_emailed_at = coalesce(coach_emailed_at, p_coach_at)
   where record_token = lower(btrim(coalesce(p_record_token, '')))
     and part = p_part;
  get diagnostics v_n = row_count;
  return jsonb_build_object('marked', v_n);
end $$;
revoke all on function public.mark_reflection_mirrored(text, int, timestamptz, timestamptz) from public, anon, authenticated, dreamlit_app;
grant execute on function public.mark_reflection_mirrored(text, int, timestamptz, timestamptz) to service_role;

-- ---------- 9) otp_reflections_unmirrored ----------
create or replace function public.otp_reflections_unmirrored(p_older_than_seconds int default 120)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('record_token', record_token, 'part', part) order by mirror_pending_since asc), '[]'::jsonb)
    from otp_reflections
   where mirror_pending_since is not null
     and mirror_pending_since < now() - make_interval(secs => coalesce(p_older_than_seconds, 120));
$$;
revoke all on function public.otp_reflections_unmirrored(int) from public, anon, authenticated, dreamlit_app;
grant execute on function public.otp_reflections_unmirrored(int) to service_role;

-- ---------- 10) otp_record_for_mirror (replace, migrate_24 body + links) ----------
create or replace function public.otp_record_for_mirror(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
      'found', true,
      'record', a.content || jsonb_build_object(
        'coach_emailed_at', case when a.coach_emailed_at is null then '' else to_char(a.coach_emailed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
        'teacher_emailed_at', case when a.teacher_emailed_at is null then '' else to_char(a.teacher_emailed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end),
      'pending_since', a.mirror_pending_since,
      'mirrored_at', a.mirrored_at,
      'links', public.otp_reflect_links())
       from assessments a
      where a.type = 'otp' and a.source_ref = lower(btrim(coalesce(p_token, '')))),
    jsonb_build_object('found', false));
$$;
revoke all on function public.otp_record_for_mirror(text) from public, anon, authenticated, dreamlit_app;
grant execute on function public.otp_record_for_mirror(text) to service_role;

-- ---------- 11) get_teacher_lap_state (replace, migrate_22 body + reflection fields) ----------
-- SAME output as migrate_22, plus reflection_flow / part1_at / part2_at on
-- each of open / predecessor / last_closed (each represents one lap). Never
-- a token: the reflection fields are derived from record_token internally,
-- never returned themselves.
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
    -- record_token / record_id on 'open' are migrate_22 behaviour, unchanged
    -- (the coach's own gated OTP form uses them to keep working an open
    -- draft); "SAME output as today" carries them forward as-is. They are
    -- NOT the token this contract's "never a token" line guards: that line
    -- is about the reflection fields below never leaking teacher_token,
    -- which they do not (reflection_flow/part1_at/part2_at are derived
    -- internally and never return the token itself).
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
      'emails_legacy', v_emails_legacy,
      'reflection_flow', (coalesce(v_open_content->>'teacher_token', '') <> ''),
      'part1_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = v_open_content->>'record_token' and o.part = 1),
      'part2_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = v_open_content->>'record_token' and o.part = 2)) end,
    'predecessor', case when v_predecessor is null then null else jsonb_build_object(
      'lap', v_predecessor->>'lap',
      'observation_date', v_predecessor->>'observation_date',
      'observer', v_predecessor->>'observer',
      'closed_at', v_predecessor->>'closed_at',
      'next_step_1', v_predecessor->>'next_step_1',
      'next_step_2', v_predecessor->>'next_step_2',
      'next_step_3', v_predecessor->>'next_step_3',
      'reflection_flow', (coalesce(v_predecessor->>'teacher_token', '') <> ''),
      'part1_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = v_predecessor->>'record_token' and o.part = 1),
      'part2_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = v_predecessor->>'record_token' and o.part = 2)) end,
    'last_closed', case when v_last_closed is null then null else jsonb_build_object(
      'lap', v_last_closed->>'lap',
      'observation_date', v_last_closed->>'observation_date',
      'observer', v_last_closed->>'observer',
      'closed_at', v_last_closed->>'closed_at',
      'next_step_1', v_last_closed->>'next_step_1',
      'next_step_2', v_last_closed->>'next_step_2',
      'next_step_3', v_last_closed->>'next_step_3',
      'reflection_flow', (coalesce(v_last_closed->>'teacher_token', '') <> ''),
      'part1_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = v_last_closed->>'record_token' and o.part = 1),
      'part2_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = v_last_closed->>'record_token' and o.part = 2)) end);
end $$;
revoke all on function public.get_teacher_lap_state(text) from public;
grant execute on function public.get_teacher_lap_state(text) to anon, authenticated;

-- ---------- 12) get_otp_tracker (replace, migrate_26 body + reflection fields) ----------
-- SAME output as migrate_26, plus reflection_flow / part1_at / part2_at on
-- 'open', 'last_closed' and every 'history' entry (each represents one lap).
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
      a.content->>'next_step_1' as next_step_1,
      a.content->>'next_step_2' as next_step_2,
      a.content->>'next_step_3' as next_step_3,
      a.content->>'record_token' as record_token,
      a.content->>'teacher_token' as teacher_token,
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
      r.coach_emailed_at, r.teacher_emailed_at, r.record_token, r.teacher_token
    from recs2 r
    where r.in_current_round and r.status <> 'closed'
    order by r.teacher_key, r.lap desc nulls last, r.submitted_at_text desc nulls last
  ),
  closed_pick as (
    select distinct on (r.teacher_key)
      r.teacher_key as tkey, r.lap, r.observation_date, r.observer, r.closed_at, r.record_token, r.teacher_token
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
          'emails_done', (yr.emails_legacy or (yr.coach_emailed_at is not null and yr.teacher_emailed_at is not null)),
          -- next_steps (P2-A): the non-empty next_step_1..3, in order. Built from a
          -- fixed 3-element array so order is guaranteed regardless of which slots are
          -- filled; empty/blank slots are dropped, never rendered as empty list items.
          'next_steps', coalesce((
            select jsonb_agg(v order by ord)
              from unnest(array[yr.next_step_1, yr.next_step_2, yr.next_step_3]) with ordinality as u(v, ord)
             where nullif(btrim(coalesce(v, '')), '') is not null
          ), '[]'::jsonb),
          -- reflection_flow / part1_at / part2_at (otp-v0.14 T1): never a token,
          -- derived internally from this lap's own record_token.
          'reflection_flow', (coalesce(yr.teacher_token, '') <> ''),
          'part1_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = yr.record_token and o.part = 1),
          'part2_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = yr.record_token and o.part = 2)
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
        'emails_done', (op.emails_legacy or (op.coach_emailed_at is not null and op.teacher_emailed_at is not null)),
        'reflection_flow', (coalesce(op.teacher_token, '') <> ''),
        'part1_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = op.record_token and o.part = 1),
        'part2_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = op.record_token and o.part = 2)
      ) end,
      'open_count', coalesce(ocnt.open_count, 0),
      'last_closed', case when cp.tkey is null then null else jsonb_build_object(
        'lap', cp.lap,
        'observation_date', coalesce(cp.observation_date, ''),
        'observer', coalesce(cp.observer, ''),
        'closed_at', coalesce(cp.closed_at, ''),
        'reflection_flow', (coalesce(cp.teacher_token, '') <> ''),
        'part1_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = cp.record_token and o.part = 1),
        'part2_at', (select to_char(o.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from otp_reflections o where o.record_token = cp.record_token and o.part = 2)
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

-- ---------- 13) get_otp_portal ----------
-- Teacher-facing aggregate for the Dashboard Teacher Portal (section 6, later
-- node): only laps carrying a teacher_token, teachers A to Z, laps newest
-- first. Never a token, rating, note or record_id.
create or replace function public.get_otp_portal()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_teachers jsonb;
begin
  with recs as (
    select
      a.content->>'teacher' as teacher,
      a.content->>'record_token' as record_token,
      case when coalesce(a.content->>'lap', '') ~ '^\d+$' then (a.content->>'lap')::int end as lap,
      a.content->>'observation_date' as observation_date,
      a.content->>'subject' as subject,
      a.content->>'grade' as grade,
      a.content->>'observer' as observer,
      coalesce(a.content->>'status', 'observed') as status,
      a.content->>'closed_at' as closed_at,
      a.content->>'next_step_1' as next_step_1,
      a.content->>'next_step_2' as next_step_2,
      a.content->>'next_step_3' as next_step_3,
      case when a.content->>'submitted_at' ~ '^\d{4}-\d{2}-\d{2}T'
           then (a.content->>'submitted_at')::timestamptz end as submitted_at_ts
    from assessments a
    where a.type = 'otp'
      and coalesce(a.content->>'teacher_token', '') <> ''
      and nullif(btrim(coalesce(a.content->>'teacher', '')), '') is not null
  ),
  laps as (
    select r.*,
      (select jsonb_build_object('sent_at', to_char(o1.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'answers', o1.answers)
         from otp_reflections o1 where o1.record_token = r.record_token and o1.part = 1) as part1,
      (select jsonb_build_object('sent_at', to_char(o2.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'answers', o2.answers)
         from otp_reflections o2 where o2.record_token = r.record_token and o2.part = 2) as part2
    from recs r
  ),
  per_teacher as (
    select l.teacher,
      jsonb_agg(
        jsonb_build_object(
          'lap', l.lap,
          'observation_date', coalesce(l.observation_date, ''),
          'subject', coalesce(l.subject, ''),
          'grade', coalesce(l.grade, ''),
          'observer', coalesce(l.observer, ''),
          'status', l.status,
          'closed_at', coalesce(l.closed_at, ''),
          'next_steps', case when l.status = 'closed' then
              coalesce((
                select jsonb_agg(v order by ord)
                  from unnest(array[l.next_step_1, l.next_step_2, l.next_step_3]) with ordinality as u(v, ord)
                 where nullif(btrim(coalesce(v, '')), '') is not null
              ), '[]'::jsonb)
            else '[]'::jsonb end,
          'part1', l.part1,
          'part2', l.part2,
          'owed', to_jsonb(array_remove(array[
            case when l.part1 is null then 1 end,
            case when l.status = 'closed' and l.part2 is null then 2 end
          ], null))
        )
        order by l.submitted_at_ts desc nulls last, l.lap desc nulls last
      ) as laps
    from laps l
    group by l.teacher
  )
  select coalesce(jsonb_agg(jsonb_build_object('teacher', pt.teacher, 'laps', pt.laps) order by pt.teacher), '[]'::jsonb)
    into v_teachers
    from per_teacher pt;

  return coalesce(v_teachers, '[]'::jsonb);
end $$;
revoke all on function public.get_otp_portal() from public;
grant execute on function public.get_otp_portal() to anon, authenticated;

commit;
