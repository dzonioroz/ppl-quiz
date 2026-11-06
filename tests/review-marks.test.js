import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('review marks enforce account isolation and allow idempotent mark/unmark saves',async()=>{
 const db=new PGlite();const a=crypto.randomUUID(),b=crypto.randomUUID();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202611060001_review_marks.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values ($1),($2)',[a,b]);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
  const save=marked=>db.query(`insert into public.question_review_marks values ($1,'air-law','AIR-LAW-001',$2) on conflict(user_id,subject_id,question_id) do update set marked=excluded.marked`,[a,marked]);
  await save(true);await save(true);await save(false);
  assert.deepEqual((await db.query('select marked from public.question_review_marks')).rows,[{marked:false}]);
  await db.exec(`set request.jwt.claim.sub='${b}';`);
  assert.deepEqual((await db.query('select * from public.question_review_marks')).rows,[]);
  await assert.rejects(db.query(`insert into public.question_review_marks values ($1,'air-law','forged',true)`,[a]));
  assert.equal((await db.query('update public.question_review_marks set marked=true returning *')).rows.length,0);
  await assert.rejects(db.query('delete from public.question_review_marks'));
  await db.exec('reset role;set role anon;');
  await assert.rejects(db.query('select * from public.question_review_marks'));
 }finally{await db.close();}
});
