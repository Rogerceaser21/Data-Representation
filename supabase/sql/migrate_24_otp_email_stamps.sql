-- otp-v0.11 email recipient stamps for OTP observations.
-- Apply: the foreman applies this file (builders never touch the database).
begin;

create or replace function public.stamp_otp_emailed(
  p_token text,
  p_coach_at timestamptz default null,
  p_teacher_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  update assessments
     set coach_emailed_at = coalesce(coach_emailed_at, p_coach_at),
         teacher_emailed_at = coalesce(teacher_emailed_at, p_teacher_at)
   where type = 'otp'
     and source_ref = lower(btrim(coalesce(p_token, '')));
  get diagnostics v_n = row_count;
  return jsonb_build_object('success', true, 'stamped', v_n);
end $$;
revoke all on function public.stamp_otp_emailed(text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.stamp_otp_emailed(text, timestamptz, timestamptz) to service_role;

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
      'mirrored_at', a.mirrored_at)
       from assessments a
      where a.type = 'otp' and a.source_ref = lower(btrim(coalesce(p_token, '')))),
    jsonb_build_object('found', false));
$$;
revoke all on function public.otp_record_for_mirror(text) from public, anon, authenticated;
grant execute on function public.otp_record_for_mirror(text) to service_role;

commit;
