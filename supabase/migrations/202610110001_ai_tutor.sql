begin;
-- Sessions are currently saved only on completion. Reuse the running quiz UUID
-- without requiring an unfinished quiz to appear in progress statistics.
create table public.ai_tutor_encounters (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null,
 subject_id text not null,
 question_id text not null,
 question_hash text,
 explanation jsonb,
 messages jsonb not null default '[]'::jsonb,
 follow_ups integer not null default 0 check (follow_ups between 0 and 2),
 lease_id uuid,
 lease_until timestamptz,
 created_at timestamptz not null default now(),
 unique(user_id,session_id,subject_id,question_id)
);
create table public.ai_explanations (
 subject_id text not null,
 question_id text not null,
 question_hash text not null,
 prompt_version text not null,
 explanation jsonb,
 model text,
 lease_id uuid,
 lease_until timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(subject_id,question_id,question_hash)
);
create table public.ai_tutor_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 fingerprint text not null,
 response jsonb,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
create index ai_requests_rate on public.ai_tutor_requests(user_id,created_at);
alter table public.ai_tutor_encounters enable row level security;
alter table public.ai_explanations enable row level security;
alter table public.ai_tutor_requests enable row level security;
revoke all on public.ai_tutor_encounters,public.ai_explanations,public.ai_tutor_requests from public,anon,authenticated;
grant select on public.ai_tutor_encounters to authenticated;
create policy tutor_encounter_read on public.ai_tutor_encounters for select to authenticated using ((select auth.uid())=user_id);
grant select on public.quiz_sessions to service_role;
grant all on public.ai_tutor_encounters,public.ai_explanations,public.ai_tutor_requests to service_role;

-- These RPCs are service-role-only. Identity and canonical question/hash are
-- supplied by the Edge Function after auth.getUser(), never by a browser RPC.
create function public.begin_ai_tutor(p_user uuid,p_session uuid,p_subject text,p_question text,p_hash text,p_version text,p_action text,p_request uuid,p_fingerprint text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare e public.ai_tutor_encounters; c public.ai_explanations; r public.ai_tutor_requests; result jsonb;
begin
 if p_action not in ('explanation','follow-up') then raise exception 'Invalid action'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,1));
 select * into r from public.ai_tutor_requests where user_id=p_user and request_id=p_request;
 if found then
  if r.fingerprint<>p_fingerprint then return jsonb_build_object('error','Request ID already used','code',409); end if;
  if r.response is not null then return jsonb_build_object('response',r.response); end if;
  return jsonb_build_object('error','Request is still processing. Retry shortly.','code',409);
 end if;
 if (select count(*) from public.ai_tutor_requests where user_id=p_user and created_at>now()-interval '1 hour')>=30 then
  return jsonb_build_object('error','AI Tutor hourly limit reached. Please try later.','code',429);
 end if;
 -- A completed session owned by someone else cannot be claimed for tutoring.
 if exists(select 1 from public.quiz_sessions where id=p_session and user_id<>p_user) then
  return jsonb_build_object('error','Invalid quiz encounter','code',403);
 end if;
 insert into public.ai_tutor_encounters(user_id,session_id,subject_id,question_id)
 values(p_user,p_session,p_subject,p_question) on conflict do nothing;
 select * into e from public.ai_tutor_encounters where user_id=p_user and session_id=p_session and subject_id=p_subject and question_id=p_question for update;
 if e.lease_until>now() then return jsonb_build_object('error','Tutor is busy. Retry shortly.','code',409); end if;
 if p_action='follow-up' then
  if e.explanation is null or e.question_hash is distinct from p_hash then return jsonb_build_object('error','Request a current explanation first.','code',409); end if;
  if e.follow_ups>=2 then return jsonb_build_object('error','You have used your 2 follow-up questions for this question.','code',429,'remaining',0); end if;
 else
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_subject||p_question||p_hash,2));
  insert into public.ai_explanations(subject_id,question_id,question_hash,prompt_version) values(p_subject,p_question,p_hash,p_version) on conflict do nothing;
  select * into c from public.ai_explanations where subject_id=p_subject and question_id=p_question and question_hash=p_hash for update;
  if c.explanation is not null then
   update public.ai_tutor_encounters set question_hash=p_hash,explanation=c.explanation where id=e.id;
   result:=jsonb_build_object('explanation',c.explanation,'remaining',2-e.follow_ups,'messages',e.messages,'cached',true);
   insert into public.ai_tutor_requests(user_id,request_id,fingerprint,response) values(p_user,p_request,p_fingerprint,result);
   return jsonb_build_object('response',result);
  end if;
  if c.lease_until>now() then return jsonb_build_object('error','Explanation is being generated. Retry shortly.','code',409); end if;
  update public.ai_explanations set lease_id=p_request,lease_until=now()+interval '120 seconds' where subject_id=p_subject and question_id=p_question and question_hash=p_hash;
 end if;
 insert into public.ai_tutor_requests(user_id,request_id,fingerprint) values(p_user,p_request,p_fingerprint);
 update public.ai_tutor_encounters set lease_id=p_request,lease_until=now()+interval '120 seconds' where id=e.id;
 return jsonb_build_object('encounter',to_jsonb(e));
end;
$$;

create function public.finish_ai_tutor(p_user uuid,p_request uuid,p_encounter uuid,p_action text,p_hash text,p_model text,p_explanation jsonb,p_message text,p_answer text,p_in_scope boolean,p_success boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare e public.ai_tutor_encounters; result jsonb;
begin
 select * into e from public.ai_tutor_encounters where id=p_encounter and user_id=p_user for update;
 if not found or e.lease_id is distinct from p_request or e.lease_until<=now() then raise exception 'Expired tutor request'; end if;
 if not p_success then
  result:=jsonb_build_object('error','AI Tutor is temporarily unavailable. Please try again.','code',503);
 elsif p_action='explanation' then
  update public.ai_explanations set explanation=p_explanation,model=p_model,updated_at=now(),lease_id=null,lease_until=null
   where subject_id=e.subject_id and question_id=e.question_id and question_hash=p_hash and lease_id=p_request and lease_until>now();
  if not found then raise exception 'Expired explanation request'; end if;
  e.explanation:=p_explanation; e.question_hash:=p_hash;
  result:=jsonb_build_object('explanation',p_explanation,'remaining',2-e.follow_ups,'messages',e.messages,'cached',false);
 elsif p_action='follow-up' then
  if p_in_scope then
   e.follow_ups:=e.follow_ups+1;
   e.messages:=e.messages||jsonb_build_array(jsonb_build_object('question',p_message,'answer',p_answer));
  end if;
  result:=jsonb_build_object('answer',p_answer,'inScope',p_in_scope,'remaining',2-e.follow_ups,'messages',e.messages);
 else raise exception 'Invalid action';
 end if;
 update public.ai_tutor_encounters set explanation=e.explanation,question_hash=e.question_hash,messages=e.messages,follow_ups=e.follow_ups,lease_id=null,lease_until=null where id=e.id;
 if not p_success then
  update public.ai_explanations set lease_id=null,lease_until=null where subject_id=e.subject_id and question_id=e.question_id and question_hash=p_hash and lease_id=p_request;
 end if;
 update public.ai_tutor_requests set response=result where user_id=p_user and request_id=p_request;
 return result;
end;
$$;
revoke all on function public.begin_ai_tutor(uuid,uuid,text,text,text,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.finish_ai_tutor(uuid,uuid,uuid,text,text,text,jsonb,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.begin_ai_tutor(uuid,uuid,text,text,text,text,text,uuid,text) to service_role;
grant execute on function public.finish_ai_tutor(uuid,uuid,uuid,text,text,text,jsonb,text,text,boolean,boolean) to service_role;
commit;
