begin;
create table public.question_review_marks (
 user_id uuid not null references auth.users(id) on delete cascade,
 subject_id text not null check(subject_id in ('air-law','aircraft-general-knowledge','communication','flight-performance-and-planning','human-performance','meteorology','navigation','operational-procedures','principles-of-flight')),
 question_id text not null check(length(question_id) between 1 and 200),
 marked boolean not null,
 primary key(user_id,subject_id,question_id)
);
alter table public.question_review_marks enable row level security;
revoke all on public.question_review_marks from public,anon,authenticated;
grant select,insert,update on public.question_review_marks to authenticated;
create policy review_read on public.question_review_marks for select to authenticated using ((select auth.uid())=user_id);
create policy review_insert on public.question_review_marks for insert to authenticated with check ((select auth.uid())=user_id);
create policy review_update on public.question_review_marks for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
commit;
