import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream,readFileSync,statSync} from 'node:fs';
// Run only with a disposable Chrome profile and a mock production build.
const base='http://127.0.0.1:4318/ppl-quiz/';
const builtIndex=readFileSync('dist/index.html','utf8');
const entry=builtIndex.match(/src="\/ppl-quiz\/(assets\/[^"]+\.js)"/)?.[1];
assert.ok(entry&&readFileSync('dist/'+entry,'utf8').includes('sb_publishable_mock'), 'Build with the mock Supabase settings before running this smoke test.');
const owner='96ff4e35-f798-4a63-a968-2115b4e94db0';
const user={id:owner,email:'pwa@test.invalid',aud:'authenticated'};
const token=part=>Buffer.from(JSON.stringify(part)).toString('base64url');
const sessions=new Map();
let writes=0,loseResponse=true,figureFailure=true,release=1;
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,base);
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(url.pathname==='/auth/v1/token'){
  const exp=Math.floor(Date.now()/1000)+3600;
  return json({access_token:token({alg:'HS256'})+'.'+token({sub:owner,exp,role:'authenticated'})+'.sig',refresh_token:'mock',expires_in:3600,expires_at:exp,token_type:'bearer',user});
 }
 if(url.pathname==='/rest/v1/rpc/save_completed_quiz'){
  let body='';for await(const chunk of req)body+=chunk;
  const {payload}=JSON.parse(body);
  writes++;
  if(!sessions.has(payload.id))sessions.set(payload.id,payload);
  else assert.deepEqual(sessions.get(payload.id),payload);
  if(loseResponse){loseResponse=false;req.socket.destroy();return;}
  return json(payload.id);
 }
 if(url.pathname.startsWith('/rest/v1/')){
  if(url.pathname.endsWith('quiz_sessions'))return json([...sessions.values()].map(({attempts,...session})=>session));
  if(url.pathname.endsWith('question_attempts'))return json([...sessions.values()].flatMap(p=>p.attempts.map(a=>({...a,session_id:p.id,id:p.id+a.question_id,user_id:owner}))));
  return json(url.pathname.endsWith('question_review_marks')?[{subject_id:'communication',question_id:'COMMUNICATION-089',marked:true}]:[]);
 }
 if(url.pathname==='/functions/v1/ai-tutor')return json({explanation:{whyCorrect:'Saved browser test explanation'},remaining:2,messages:[]});
 if(url.pathname==='/ppl-quiz/sw.js'){
  res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
  let script=readFileSync('dist/sw.js','utf8');
  if(release===2)script=script.replace(/"version":"[a-f0-9]+"/,'"version":"smoke-release-2"');
  return res.end(script);
 }
 if(figureFailure&&url.pathname.includes('/assets/ppl-')&&url.pathname.endsWith('.png')){res.writeHead(503);return res.end();}
 try{
  if(!url.pathname.startsWith('/ppl-quiz/')){res.writeHead(404);return res.end();}
  const file=process.cwd()+'/dist/'+(url.pathname.slice('/ppl-quiz/'.length)||'index.html');
  res.writeHead(200,{'Content-Type':mime[file.slice(file.lastIndexOf('.'))]||'application/octet-stream','Content-Length':statSync(file).size});
  createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}
}).listen(4318,'127.0.0.1');
let ws;
try{
 const targets=await (await fetch('http://127.0.0.1:'+(process.env.PPL_CHROME_DEBUG_PORT||4319)+'/json/list')).json();
 const target=targets.find(item=>item.type==='page'&&(item.url==='about:blank'||item.url.startsWith(base)));
 assert.ok(target,'Launch a disposable Chrome profile with a blank tab on debugging port 4319.');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;
 const pending=new Map(),exceptions=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(m.error):resolve(m.result);}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);};
 const command=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{
  const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
 };
 const wait=async expression=>{
  for(let i=0;i<120;i++){try{if(await evaluate(expression))return;}catch{}await new Promise(r=>setTimeout(r,100));}
  throw Error('Timed out: '+expression+'\n'+await evaluate('document.body.innerText'));
 };
 const click=text=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes(${JSON.stringify(text)})&&!b.disabled)?.click()`);
 const has=text=>'document.body.innerText.includes('+JSON.stringify(text)+')';
 const enabled=text=>`[...document.querySelectorAll('button')].some(b=>b.textContent.includes(${JSON.stringify(text)})&&!b.matches(':disabled'))`;
 const offline=async value=>command('Network.emulateNetworkConditions',{offline:value,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await command('Runtime.enable');await command('Network.enable');
 await command('Page.navigate',{url:'about:blank'});await wait("location.href==='about:blank'");
 await command('Storage.clearDataForOrigin',{origin:new URL(base).origin,storageTypes:'all'});
 await offline(false);
 await command('Page.navigate',{url:base});await wait('!!document.querySelector("#email")');
 await evaluate(`(()=>{for(const [id,value] of [['email','pwa@test.invalid'],['password','password123']]){const el=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
 await click('Sign in');await wait(has('Set up a quiz'));
 await click('Settings');await wait(enabled('Download for offline use'));await click('Download for offline use');await wait(has('Offline storage needs attention'));
 assert.equal(await evaluate(has('Offline Ready')),false);
 figureFailure=false;await click('Retry download');await wait(has('Offline Ready'));
 const manifest=await evaluate("fetch('manifest.webmanifest').then(r=>r.json())");
 assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
 await click('Practice marked questions');await wait(has('1 available'));await click('Start quiz →');
 await wait('document.querySelector(".question-figure img")?.naturalWidth>0');
 await evaluate('document.querySelector(".answer").click()');await wait(enabled('Submit'));await click('Submit');
 await wait(enabled('Explain with AI'));await click('Explain with AI');await wait(has('Saved browser test explanation'));
 await offline(true);await command('Page.reload');await wait(has('Unfinished quizzes'));await wait(has('Offline · studying locally'));
 await click('Resume');await wait('document.querySelector(".question-figure img")?.naturalWidth>0');
 await wait(has('Saved browser test explanation'));await wait(has('Connect to use AI explanations'));
 await click('See results');await wait(has('Quiz results'));await wait(has('1 quiz result(s) pending'));
 await click('My Progress');await wait(has('1 quizzes'));
 const scope=await evaluate('navigator.serviceWorker.getRegistration().then(r=>r.scope)');
 assert.equal(scope,base);
 await offline(false);await wait(has('Progress synchronized.'));
 assert.equal(sessions.size,1);assert.ok(writes>=2);
 await click('Start Quiz');await click('Start quiz →');await wait(enabled('Pause quiz'));
 release=2;
 await evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)');
 await wait(has('Update available'));
 assert.equal(await evaluate(enabled('Update and reload')),false);
 await click('Pause quiz');await wait(enabled('Update and reload'));
 const beforeReload=await evaluate('performance.timeOrigin');
 await click('Update and reload');
 try{await wait(`performance.timeOrigin!==${beforeReload}`);}
 catch(error){
  console.error(await evaluate('navigator.serviceWorker.getRegistration().then(r=>({waiting:r.waiting?.state,active:r.active?.state,controller:navigator.serviceWorker.controller?.state}))'));
  throw error;
 }
 await wait(has('Unfinished quizzes'));
 await click('Settings');await wait(has('Offline Ready'));
 await click('Remove downloaded figures');await wait(has('Download required'));
 assert.equal(sessions.size,1);
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));
 console.log('Chrome production smoke test passed: scoped shell, download, offline cold reload, draft and figure recovery, cached AI, local history, reconnect and lost-response retry, partial download, update deferral and safe figure removal.');
}finally{ws?.close();server.closeAllConnections();server.close();}
