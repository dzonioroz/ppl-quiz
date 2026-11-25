import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('existing completion RPC deduplicates retries, retains separate device sessions and enforces ownership',async()=>{
 const db=new PGlite(),owner=crypto.randomUUID(),other=crypto.randomUUID();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610080001_progress.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values ($1),($2)',[owner,other]);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
  const timestamp='2026-11-01T00:00:00Z';
  const payload={id:crypto.randomUUID(),user_id:owner,subject_id:'air-law',mode:'regular',started_at:timestamp,completed_at:timestamp,
   total_questions:1,correct_answers:1,attempts:[{subject_id:'air-law',question_id:'q1',selected_answer:0,is_correct:true,answered_at:timestamp}]};
  const save=p=>db.query('select public.save_completed_quiz($1::jsonb)',[JSON.stringify(p)]);
  await save(payload);
  await Promise.all([save(payload),save(payload),save({...payload,id:crypto.randomUUID()})]);
  assert.equal((await db.query('select id from public.quiz_sessions')).rows.length,2);
  assert.equal((await db.query('select id from public.question_attempts')).rows.length,2);
  await assert.rejects(save({...payload,correct_answers:0}),/retry differs/);
  await db.exec(`set request.jwt.claim.sub='${other}';`);
  await assert.rejects(save(payload),/another account/);
  assert.equal((await db.query('select id from public.quiz_sessions')).rows.length,0);
 }finally{await db.close();}
});
