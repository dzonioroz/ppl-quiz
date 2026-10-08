// Run only against a disposable project with the migration applied.
// Uses existing test users; no credentials or tokens are printed.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const env=process.env;
const enabled=['TEST_SUPABASE_URL','TEST_SUPABASE_KEY','TEST_USER_A_EMAIL','TEST_USER_A_PASSWORD','TEST_USER_B_EMAIL','TEST_USER_B_PASSWORD'].every(k=>env[k]);
test('two-account isolation, anonymous access, atomic validation, and idempotent retries',{skip:!enabled},async()=>{
 const client=()=>createClient(env.TEST_SUPABASE_URL,env.TEST_SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const a=client(),b=client(),anon=client();
 const login=async(c,email,password)=>{const r=await c.auth.signInWithPassword({email,password});assert.equal(r.error,null);return r.data.user.id;};
 const aid=await login(a,env.TEST_USER_A_EMAIL,env.TEST_USER_A_PASSWORD),bid=await login(b,env.TEST_USER_B_EMAIL,env.TEST_USER_B_PASSWORD);
 const payload=(owner=aid)=>{const time=new Date().toISOString();return {id:crypto.randomUUID(),user_id:owner,subject_id:'air-law',mode:'regular',total_questions:1,correct_answers:0,started_at:time,completed_at:time,attempts:[{subject_id:'air-law',question_id:'SECURITY-TEST',selected_answer:1,is_correct:false,answered_at:time}]};};
 try {
  const p=payload(bid);assert.equal((await b.rpc('save_completed_quiz',{payload:p})).error,null);assert.equal((await b.rpc('save_completed_quiz',{payload:p})).error,null);
  assert.equal((await b.from('quiz_sessions').select('*').eq('id',p.id)).data.length,1);assert.equal((await b.from('question_attempts').select('*').eq('session_id',p.id)).data.length,1);
  for(const table of ['profiles','quiz_sessions','question_attempts']){const r=await a.from(table).select('*').eq(table==='profiles'?'id':'user_id',bid);assert.equal(r.error,null);assert.deepEqual(r.data,[]);const n=await anon.from(table).select('*');assert.ok(n.error||n.data.length===0);}
  const update=await a.from('profiles').update({display_name:'forbidden'}).eq('id',bid).select();assert.ok(update.error||update.data.length===0);
  const row=(await b.from('quiz_sessions').select('*').eq('id',p.id)).data[0];
  assert.ok((await a.from('quiz_sessions').insert({...row,id:crypto.randomUUID()})).error);
  assert.ok((await a.from('quiz_sessions').update({correct_answers:1}).eq('id',p.id)).error);
  assert.ok((await a.from('question_attempts').insert({session_id:p.id,user_id:aid,subject_id:'air-law',question_id:'forged',selected_answer:0,is_correct:true,answered_at:p.completed_at})).error);
  assert.ok((await a.from('question_attempts').insert({session_id:p.id,user_id:bid,subject_id:'air-law',question_id:'forged',selected_answer:0,is_correct:true,answered_at:p.completed_at})).error);
  assert.ok((await a.rpc('save_completed_quiz',{payload:{...payload(),user_id:bid}})).error);
  assert.ok((await anon.rpc('save_completed_quiz',{payload:payload()})).error);
  assert.ok((await b.rpc('save_completed_quiz',{payload:{...p,correct_answers:1}})).error);
  const invalid=payload();invalid.attempts.push({...invalid.attempts[0]});invalid.total_questions=2;
  assert.ok((await a.rpc('save_completed_quiz',{payload:invalid})).error);assert.equal((await a.from('quiz_sessions').select('*').eq('id',invalid.id)).data.length,0);
 } finally {await Promise.all([a.auth.signOut(),b.auth.signOut()]);}
});
