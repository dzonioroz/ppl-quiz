import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createHandler,questionHash,generateStructured,validateExplanation,validateFollowUp,explanationSchema} from '../supabase/functions/ai-tutor/core.js';
const a=crypto.randomUUID(),b=crypto.randomUUID();
const question={subjectId:'air-law',subject:'Air Law',id:'AIR-LAW-001',question:'What are VMC?',answers:['Visual meteorological conditions','Another answer'],correctAnswer:0,requiresFigure:false};
const explanation={status:'ok',whyCorrect:'Visual meteorological conditions allow visual flight.',whyOthersWrong:[{answer:'Another answer',reason:'Not the definition.'}],examTip:'Remember VMC.',suggestedFollowUps:['Explain more simply'],warning:null};
const bank={[JSON.stringify([question.subjectId,question.id])]:question};
const db=new PGlite();
async function setup(){
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 for(const name of ['202610080001_progress.sql','202610110001_ai_tutor.sql'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'));
 await db.query('insert into auth.users values ($1),($2)',[a,b]);
}
const rpc=async(name,args)=>{
 const values=Object.values(args);
 const {rows}=await db.query(`select public.${name}(${values.map((_,i)=>`$${i+1}`).join(',')}) as result`,values);
 return rows[0].result;
};
let calls=[];
let output=()=>explanation;
let handler;
const makeHandler=(options={})=>createHandler({verifyUser:async token=>token==='a'?{id:a}:token==='b'?{id:b}:null,rpc,bank,generate:async args=>{calls.push(args);return output(args);},...options});
const body=(sessionId=crypto.randomUUID(),action='explanation',message)=>({action,sessionId,requestId:crypto.randomUUID(),subjectId:question.subjectId,questionId:question.id,...(message?{message}:{})});
const send=async(payload,token='a',h=handler)=>{
 const req=new Request('http://local/ai-tutor',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:JSON.stringify(payload)});
 const res=await h(req);return {status:res.status,data:await res.json()};
};
test('AI tutor: real PostgreSQL migration, cache, limits, security and request lifecycle',async t=>{
 await setup();handler=makeHandler();
 await t.test('unauthenticated, tampered and invalid questions are rejected before generation',async()=>{
  assert.equal((await send(body(),null)).status,401);
  assert.equal((await send(body(),'invalid')).status,401);
  assert.equal((await send({...body(),user_id:b})).status,400);
  assert.equal((await send({...body(),remaining:200})).status,400);
  assert.equal((await send({...body(),questionId:'UNKNOWN'})).status,404);
  assert.equal((await send(body(undefined,'follow-up','x'.repeat(501)))).status,400);
  assert.equal(calls.length,0);
 });
 let initial=body();
 await t.test('cache miss generates, stores, and idempotent request replay avoids another call',async()=>{
  const r=await send(initial);assert.equal(r.status,200);assert.equal(r.data.cached,false);assert.equal(r.data.remaining,2);assert.equal(calls.length,1);
  assert.deepEqual((await send(initial)).data,r.data);assert.equal(calls.length,1);
  assert.equal((await send({...initial,sessionId:crypto.randomUUID()})).status,409);
  assert.equal((await db.query('select count(*)::int as count from ai_explanations where explanation is not null')).rows[0].count,1);
 });
 await t.test('other users reuse the cache but have independent encounters',async()=>{
  const r=await send(body(),'b');assert.equal(r.data.cached,true);assert.equal(r.data.remaining,2);assert.equal(calls.length,1);
 });
 await t.test('follow-ups include authoritative context; two accepted, third rejected without OpenAI',async()=>{
  output=()=>({inScope:true,answer:'A concise clarification.'});
  const first=await send(body(initial.sessionId,'follow-up','Explain more simply'));
  assert.equal(first.data.remaining,1);
  assert.deepEqual(calls.at(-1).input.explanation,explanation);
  assert.equal(calls.at(-1).input.storedCorrectAnswer,question.answers[0]);
  const second=await send(body(initial.sessionId,'follow-up','Why is the other wrong?'));
  assert.equal(second.data.remaining,0);assert.equal(calls.at(-1).input.conversation.length,1);
  const count=calls.length;const third=await send(body(initial.sessionId,'follow-up','Again'));
  assert.equal(third.status,429);assert.equal(third.data.remaining,0);assert.equal(calls.length,count);
  const fresh=await send(body());assert.equal(fresh.data.remaining,2);
 });
 await t.test('a different user cannot follow up in A’s encounter or supply a forged owner',async()=>{
  const before=calls.length;
  assert.equal((await send(body(initial.sessionId,'follow-up','Explain'),'b')).status,409);
  assert.equal((await send({...body(initial.sessionId,'follow-up','Explain'),user_id:a},'b')).status,400);
  assert.equal(calls.length,before);
 });
 await t.test('out-of-scope refusal does not consume allowance or persist unrelated conversation',async()=>{
  const session=body();await send(session);output=()=>({inScope:false,answer:'Unrelated content must not be shown.'});
  const result=await send(body(session.sessionId,'follow-up','Write about Rome'));
  assert.equal(result.data.remaining,2);assert.equal(result.data.messages.length,0);
  assert.match(result.data.answer,/limited to the current PPL question/);
 });
 await t.test('answer corrections and prompt version invalidate cache',async()=>{
  output=()=>explanation;const old=await questionHash(question,'1');question.correctAnswer=1;
  assert.notEqual(await questionHash(question,'1'),old);
  let before=calls.length;assert.equal((await send(body())).data.cached,false);assert.equal(calls.length,before+1);
  before=calls.length;assert.equal((await send(body(),'a',makeHandler({version:'2'}))).data.cached,false);assert.equal(calls.length,before+1);
  question.correctAnswer=0;
 });
 await t.test('missing figures produce warning without generation',async()=>{
  question.requiresFigure=true;const before=calls.length;
  const result=await send(body());assert.equal(result.data.explanation.status,'missing_figure');assert.match(result.data.explanation.warning,/cannot be independently verified/);assert.equal(calls.length,before);question.requiresFigure=false;
 });
 await t.test('question-bank disagreements are cached without modifying bank',async()=>{
  const original=JSON.stringify(question);output=()=>({...explanation,status:'possible_question_bank_error',warning:'The stored answer may be questionable.'});
  const result=await send(body(),'a',makeHandler({version:'warning'}));
  assert.equal(result.data.explanation.status,'possible_question_bank_error');assert.equal(JSON.stringify(question),original);
 });
 await t.test('provider/invalid-output failures release leases and allow retry',async()=>{
  const h=makeHandler({version:'failure'});output=()=>{throw Error('Provider failed');};
  const session=body();assert.equal((await send(session,'a',h)).status,503);
  output=()=>({status:'ok'});assert.equal((await send(body(session.sessionId),'a',h)).status,503);
  output=()=>explanation;assert.equal((await send(body(session.sessionId),'a',h)).status,200);
 });
 await t.test('overlapping cache misses generate only once across users',async()=>{
  let release,started;const ready=new Promise(r=>{started=r;});
  output=()=>{started();return new Promise(r=>{release=()=>r(explanation);});};
  const h=makeHandler({version:'concurrent'});const pending=send(body(),'a',h);await ready;
  const before=calls.length;assert.equal((await send(body(),'b',h)).status,409);assert.equal(calls.length,before);
  release();assert.equal((await pending).status,200);
  assert.equal((await send(body(),'b',h)).data.cached,true);
 });
 await t.test('overlapping follow-ups cannot exceed the limit, and request retries do not count twice',async()=>{
  output=()=>explanation;const session=body();await send(session);
  output=()=>({inScope:true,answer:'First answer'});await send(body(session.sessionId,'follow-up','First'));
  let release,started;const ready=new Promise(r=>{started=r;});
  output=()=>{started();return new Promise(r=>{release=()=>r({inScope:true,answer:'Second answer'});});};
  const second=body(session.sessionId,'follow-up','Second');const pending=send(second);await ready;
  const before=calls.length;assert.equal((await send(body(session.sessionId,'follow-up','Race'))).status,409);assert.equal(calls.length,before);
  release();assert.equal((await pending).data.remaining,0);
  assert.equal((await send(second)).data.remaining,0);assert.equal(calls.length,before);
 });
 await t.test('expired leases can be reclaimed without letting an old response overwrite the new result',async()=>{
  let release,started;const ready=new Promise(r=>{started=r;});
  const h=makeHandler({version:'expired-lease'});
  output=()=>{started();return new Promise(r=>{release=()=>r({...explanation,whyCorrect:'Stale result'});});};
  const session=body();const pending=send(session,'a',h);await ready;
  await db.query("update ai_tutor_encounters set lease_until=now()-interval '1 second' where user_id=$1 and session_id=$2",[a,session.sessionId]);
  await db.query("update ai_explanations set lease_until=now()-interval '1 second' where lease_id=$1",[session.requestId]);
  output=()=>explanation;
  assert.equal((await send(body(session.sessionId),'a',h)).status,200);
  release();assert.equal((await pending).status,503);
  assert.deepEqual((await send(body(session.sessionId),'a',h)).data.explanation,explanation);
 });
 await t.test('the least-privileged service role can execute cache/encounter operations',async()=>{
  await db.exec('set role service_role');
  try{assert.equal((await send(body())).status,200);}finally{await db.exec('reset role');}
 });
 await t.test('RLS isolates encounter reads and denies client cache writes/counter updates/RPC execution',async()=>{
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${b}',false);`);
  try{
   const rows=(await db.query('select user_id from ai_tutor_encounters')).rows;assert.ok(rows.length>0);assert.ok(rows.every(r=>r.user_id===b));
   await assert.rejects(db.exec('select * from ai_explanations'),/permission denied/);
   await assert.rejects(db.exec('update ai_tutor_encounters set follow_ups=0'),/permission denied/);
   await assert.rejects(rpc('begin_ai_tutor',{p_user:a,p_session:crypto.randomUUID(),p_subject:'air-law',p_question:question.id,p_hash:'h',p_version:'1',p_action:'explanation',p_request:crypto.randomUUID(),p_fingerprint:'f'}),/permission denied/);
  } finally{await db.exec('reset role');}
  await db.exec('set role anon');
  try{await assert.rejects(db.exec('select * from ai_tutor_encounters'),/permission denied/);}finally{await db.exec('reset role');}
 });
 await t.test('hourly rate limit survives new encounter IDs',async()=>{
  await db.query(`insert into ai_tutor_requests(user_id,request_id,fingerprint) select $1,gen_random_uuid(),'rate-test' from generate_series(1,30)`,[b]);
  const before=calls.length;assert.equal((await send(body(),'b')).status,429);assert.equal(calls.length,before);
 });
 await db.close();
});

test('Responses API uses strict structured output, bounded tokens and rejects incomplete/refused output',async()=>{
 let sent;
 const call=(response)=>generateStructured({apiKey:'test-only',model:'gpt-4o-mini',instructions:'Teach',input:{question:'Example'},schema:explanationSchema,name:'explanation',fetcher:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);return Response.json(response);}});
 assert.deepEqual(await call({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(explanation)}]}]}),explanation);
 assert.equal(sent.store,false);assert.equal(sent.max_output_tokens,1200);assert.equal(sent.text.format.strict,true);
 await assert.rejects(call({status:'incomplete',output:[]}));
 await assert.rejects(call({status:'completed',output:[{content:[{type:'refusal',refusal:'No'}]}]}));
 assert.throws(()=>validateExplanation({...explanation,status:'ambiguous',warning:null}));
 assert.throws(()=>validateFollowUp({answer:'Invalid'}));
});
