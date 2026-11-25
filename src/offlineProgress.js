export function mergeHistory(history,payloads){
 const sessions=new Map(history.sessions.map(row=>[row.id,row]));
 const attempts=new Map(history.attempts.map(row=>[JSON.stringify([row.session_id,row.subject_id,row.question_id]),row]));
 for(const payload of payloads){
  const {attempts:answers,...session}=payload;
  if(!sessions.has(session.id))sessions.set(session.id,session);
  for(const answer of answers||[]){
   const key=JSON.stringify([session.id,answer.subject_id,answer.question_id]);
   if(!attempts.has(key))attempts.set(key,{...answer,id:key,session_id:session.id,user_id:session.user_id});
  }
 }
 return {sessions:[...sessions.values()].sort((a,b)=>(b.completed_at||'').localeCompare(a.completed_at||'')),attempts:[...attempts.values()]};
}

export function retryAt(error,tries,now=Date.now(),random=Math.random){
 const status=Number(error.status);
 const code=String(error.code||'');
 if (status===401||status===403||code==='42501') return null;
 if (status===0||status===408||status===429||status>=500||(!Number.isFinite(status)&&!code)){
  return now+Math.min(300000,1000*2**Math.min(tries,8))*(0.75+random()*0.5);
 }
 return null;
}
