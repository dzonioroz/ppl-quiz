begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create function public.create_quiz_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values(new.id) on conflict do nothing; return new; end;
$$;
revoke all on function public.create_quiz_profile() from public, anon, authenticated;
create trigger create_quiz_profile after insert on auth.users for each row execute function public.create_quiz_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;
create function public.touch_quiz_profile() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); new.created_at = old.created_at; return new; end;
$$;
create trigger touch_quiz_profile before update on public.profiles for each row execute function public.touch_quiz_profile();
create table public.quiz_sessions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 subject_id text not null check(subject_id in ('all','air-law','aircraft-general-knowledge','communication','flight-performance-and-planning','human-performance','meteorology','navigation','operational-procedures','principles-of-flight')),
 mode text not null check(mode in ('regular','incorrect')),
 total_questions integer not null check(total_questions > 0 and total_questions <= 1500),
 correct_answers integer not null check(correct_answers between 0 and total_questions),
 started_at timestamptz not null,
 completed_at timestamptz not null check(completed_at >= started_at),
 saved_payload jsonb not null,
 unique(id,user_id), unique(id,user_id,subject_id)
);
create table public.question_attempts (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 subject_id text not null check(subject_id in ('air-law','aircraft-general-knowledge','communication','flight-performance-and-planning','human-performance','meteorology','navigation','operational-procedures','principles-of-flight')),
 question_id text not null check(length(question_id) between 1 and 200),
 selected_answer jsonb not null check(jsonb_typeof(selected_answer) in ('number','array')),
 is_correct boolean not null,
 answered_at timestamptz not null,
 foreign key(session_id,user_id) references public.quiz_sessions(id,user_id) on delete cascade,
 unique(session_id,subject_id,question_id)
);
create index quiz_sessions_user_completed on public.quiz_sessions(user_id,completed_at desc);
create index quiz_sessions_user_subject on public.quiz_sessions(user_id,subject_id);
create index question_attempts_latest on public.question_attempts(user_id,subject_id,question_id,answered_at desc,session_id desc,id desc);
create index question_attempts_session on public.question_attempts(session_id,user_id);
alter table public.profiles enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.question_attempts enable row level security;
revoke all on public.profiles,public.quiz_sessions,public.question_attempts from anon,authenticated;
grant select on public.profiles,public.quiz_sessions,public.question_attempts to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert on public.quiz_sessions,public.question_attempts to authenticated;
create policy profile_read on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy profile_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy session_read on public.quiz_sessions for select to authenticated using ((select auth.uid())=user_id);
create policy session_create on public.quiz_sessions for insert to authenticated with check ((select auth.uid())=user_id);
create policy attempt_read on public.question_attempts for select to authenticated using ((select auth.uid())=user_id);
create policy attempt_create on public.question_attempts for insert to authenticated with check ((select auth.uid())=user_id and exists(select 1 from public.quiz_sessions s where s.id=session_id and s.user_id=(select auth.uid()) and (s.subject_id='all' or s.subject_id=question_attempts.subject_id)));
create function public.save_completed_quiz(payload jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
 owner_id uuid := auth.uid(); session_uuid uuid; previous jsonb; entry jsonb;
 started timestamptz; finished timestamptz; total integer; correct_count integer;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 if payload->>'user_id' is distinct from owner_id::text then raise exception 'Queued result belongs to another account'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload->>'id' is null then raise exception 'Invalid payload'; end if;
 session_uuid := (payload->>'id')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(session_uuid::text,0));
 select saved_payload into previous from public.quiz_sessions where id=session_uuid and user_id=owner_id;
 if found then
  if previous <> payload then raise exception 'Session retry differs from saved result'; end if;
  return session_uuid;
 end if;
 started := (payload->>'started_at')::timestamptz;
 finished := (payload->>'completed_at')::timestamptz;
 total := (payload->>'total_questions')::integer;
 correct_count := (payload->>'correct_answers')::integer;
 if started is null or finished is null or not isfinite(started) or not isfinite(finished) or finished < started or jsonb_typeof(payload->'attempts') is distinct from 'array' then raise exception 'Invalid completion data'; end if;
 if total is null or total <> jsonb_array_length(payload->'attempts') or total not between 1 and 1500 then raise exception 'Attempt count mismatch'; end if;
 if correct_count is null or correct_count <> (select count(*) from jsonb_array_elements(payload->'attempts') a where a->'is_correct'='true'::jsonb) then raise exception 'Score mismatch'; end if;
 for entry in select value from jsonb_array_elements(payload->'attempts') loop
  if jsonb_typeof(entry) is distinct from 'object' or jsonb_typeof(entry->'is_correct') is distinct from 'boolean'
   or entry->>'subject_id' is null or entry->>'question_id' is null
   or jsonb_typeof(entry->'selected_answer') not in ('number','array') or entry->'selected_answer' is null
   or entry->>'answered_at' is null then raise exception 'Invalid attempt'; end if;
  if (entry->>'answered_at')::timestamptz not between started and finished then raise exception 'Attempt outside session'; end if;
  if payload->>'subject_id' <> 'all' and entry->>'subject_id' <> payload->>'subject_id' then raise exception 'Subject mismatch'; end if;
  if jsonb_typeof(entry->'selected_answer')='number' then
   if (entry->>'selected_answer')::numeric < 0 or mod((entry->>'selected_answer')::numeric,1)<>0 then raise exception 'Invalid answer index'; end if;
  else
   if jsonb_array_length(entry->'selected_answer')=0 or exists(select 1 from jsonb_array_elements(entry->'selected_answer') v where jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]+$') then raise exception 'Invalid answer array'; end if;
  end if;
 end loop;
 insert into public.quiz_sessions(id,user_id,subject_id,mode,total_questions,correct_answers,started_at,completed_at,saved_payload)
 values(session_uuid,owner_id,payload->>'subject_id',payload->>'mode',total,correct_count,started,finished,payload);
 insert into public.question_attempts(session_id,user_id,subject_id,question_id,selected_answer,is_correct,answered_at)
 select session_uuid,owner_id,a->>'subject_id',a->>'question_id',a->'selected_answer',(a->>'is_correct')::boolean,(a->>'answered_at')::timestamptz from jsonb_array_elements(payload->'attempts') a;
 return session_uuid;
end;
$$;
revoke all on function public.save_completed_quiz(jsonb) from public,anon;
grant execute on function public.save_completed_quiz(jsonb) to authenticated;
commit;
