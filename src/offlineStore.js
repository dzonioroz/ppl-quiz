const databaseName='ppl-offline';
let connection;

function open(){
 if(!connection)connection=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error('IndexedDB is unavailable'));return;}
  const request=indexedDB.open(databaseName,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('records');
  request.onsuccess=()=>{
   const db=request.result;
   db.onversionchange=()=>{db.close();connection=null;};
   resolve(db);
  };
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(Error('Offline storage is blocked by another browser tab.'));
 }).catch(error=>{connection=null;throw error;});
 return connection;
}

async function transaction(mode,action){
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('records',mode);
  const store=tx.objectStore('records');
  let result,failure;
  const read=(request,callback)=>{request.onsuccess=()=>{
   try{callback(request.result);}catch(error){failure=error;tx.abort();}
  };};
  tx.oncomplete=()=>resolve(result);
  tx.onabort=()=>reject(failure||tx.error||Error('Local write was interrupted'));
  try{action(store,read,value=>{result=value;});}
  catch(error){failure=error;tx.abort();}
 });
}

export function localValue(owner,kind,id=''){
 return transaction('readonly',(store,read,result)=>read(store.get([owner,kind,id]),result));
}

export function storeValue(owner,kind,value,id=''){
 return transaction('readwrite',store=>store.put(value,[owner,kind,id]));
}

export function localRecords(owner,kind){
 const range=IDBKeyRange.bound([owner,kind],[owner,kind,[]],false,true);
 return transaction('readonly',(store,read,result)=>read(store.getAll(range),result));
}

export function saveDraft(owner,draft,payload){
 if(payload&&(payload.id!==draft.session.id||payload.user_id!==owner))throw Error('Invalid quiz owner or session');
 const key=[owner,'draft',draft.session.id];
 return transaction('readwrite',(store,read)=>read(store.get(key),previous=>{
  if((previous?.revision??0)!==draft.revision-1||previous?.completed)throw Error('This quiz was changed in another tab. Reopen it from quiz setup.');
  store.put(draft,key);
  if(payload)store.put({id:payload.id,owner,payload,createdAt:payload.completed_at,tries:0,nextAt:0},[owner,'outbox',payload.id]);
 }));
}

export function discardDraft(owner,draft){
 const key=[owner,'draft',draft.session.id];
 return transaction('readwrite',(store,read)=>read(store.get(key),previous=>{
  if(previous?.revision!==draft.revision||previous?.completed)throw Error('This quiz was changed in another tab. Reopen quiz setup.');
  store.delete(key);
 }));
}

export function recordSyncFailure(owner,operation,update){
 const key=[owner,'outbox',operation.id];
 return transaction('readwrite',(store,read)=>read(store.get(key),current=>{
  if(current?.tries===operation.tries)store.put({...current,...update},key);
 }));
}

export function acknowledge(owner,operation){
 return transaction('readwrite',store=>{
  store.put(operation.payload,[owner,'acknowledged',operation.id]);
  store.delete([owner,'outbox',operation.id]);
  store.delete([owner,'draft',operation.id]);
 });
}

export function cacheHistory(owner,history){
 return transaction('readwrite',store=>{
  store.put(history,[owner,'history','']);
  const counts=new Map();
  for(const attempt of history.attempts)counts.set(attempt.session_id,(counts.get(attempt.session_id)||0)+1);
  for(const session of history.sessions){
   if(counts.get(session.id)===session.total_questions)store.delete([owner,'acknowledged',session.id]);
  }
 });
}

export function toggleReviewMark(owner,edit,id){
 return transaction('readwrite',(store,read)=>read(store.get([owner,'mark-edit',id]),pending=>{
  read(store.get([owner,'marks','']),cached=>{
   const previous=pending??cached?.find(row=>row.subject_id===edit.subject_id&&row.question_id===edit.question_id);
   store.put({...edit,marked:!previous?.marked},[owner,'mark-edit',id]);
  });
 }));
}

export function acknowledgeMark(owner,edit,id){
 return transaction('readwrite',(store,read)=>read(store.get([owner,'mark-edit',id]),pending=>{
  if(pending?.version===edit.version)store.delete([owner,'mark-edit',id]);
  read(store.get([owner,'marks','']),rows=>{
   store.put([...(rows||[]).filter(row=>row.subject_id!==edit.subject_id||row.question_id!==edit.question_id),edit],[owner,'marks','']);
  });
 }));
}

export function importMark(owner,edit,id){
 return transaction('readwrite',(store,read)=>read(store.get([owner,'mark-edit',id]),pending=>{
  if(!pending)store.put(edit,[owner,'mark-edit',id]);
 }));
}
