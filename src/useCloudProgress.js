import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';
import {readPending} from './pending';
import {acknowledge,cacheHistory,localRecords,localValue,recordSyncFailure,storeValue} from './offlineStore';
import {mergeHistory,retryAt} from './offlineProgress';

const empty={sessions:[],attempts:[]};
async function fetchAll(table,user,columns){
 const rows=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await supabase.from(table).select(columns).eq('user_id',user).order('id').range(offset,offset+499);
  if(error)throw error;
  rows.push(...data);
  if(data.length<500)return rows;
 }
}

export function useCloudProgress(user){
 const owner=user.id;
 const [state,setState]=useState({...empty,pending:0,lastSync:null});
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[syncing,setSyncing]=useState(false);
 const alive=useRef(true),running=useRef(null),timer=useRef(null),dirty=useRef(false),forceNext=useRef(false);
 const local=useCallback(async()=>{
  const [history,outbox,acknowledged]=await Promise.all([
   localValue(owner,'history'),localRecords(owner,'outbox'),localRecords(owner,'acknowledged'),
  ]);
  if(alive.current)setState({
   ...mergeHistory(history||empty,[...acknowledged,...outbox.map(row=>row.payload),...readPending(localStorage,owner)]),
   pending:outbox.length+readPending(localStorage,owner).length,lastSync:history?.lastSync??null,
  });
  return outbox;
 },[owner]);

 const sync=useCallback(function synchronize(force=false){
  if(running.current){dirty.current=true;if(force)forceNext.current=true;return running.current;}
  clearTimeout(timer.current);
  const drain=async()=>{
   do{
    dirty.current=false;
    force=force||forceNext.current;forceNext.current=false;
    let queue=await local();
    if(!alive.current||!navigator.onLine)return;
    setSyncing(true);
    const verify=async()=>{
     const {data,error}=await supabase.auth.getSession();
     if(error)throw error;
     if(!alive.current||data.session?.user.id!==owner||(data.session.expires_at && data.session.expires_at*1000<=Date.now())){
      throw Error('Sign in with the original account to synchronize these results.');
     }
    };
    await verify();
    for(const payload of readPending(localStorage,owner)){
     if(payload.user_id!==owner)throw Error('A queued result belongs to another account.');
     if(!queue.some(row=>row.id===payload.id)){
      await storeValue(owner,'outbox',{id:payload.id,owner,payload,createdAt:payload.completed_at,tries:0,nextAt:0},payload.id);
     }
     const remaining=readPending(localStorage,owner).filter(row=>row.id!==payload.id);
     localStorage.setItem(`ppl-pending-v1:${owner}`,JSON.stringify(remaining));
    }
    queue=(await local()).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
    const failures=[];
    let nextWake=Infinity;
    for(const operation of queue){
     if(!force&&(operation.nextAt===null||operation.nextAt>Date.now())){
      if(operation.nextAt!==null)nextWake=Math.min(nextWake,operation.nextAt);
      if(operation.error)failures.push(operation.error);
      continue;
     }
     await verify();
     if(operation.owner!==owner||operation.payload.user_id!==owner)throw Error('A queued result belongs to another account.');
     let response;
     try{response=await supabase.rpc('save_completed_quiz',{payload:operation.payload});}
     catch(error){response={error,status:0};}
     if(response.error){
      const nextAt=retryAt({...response.error,status:response.status??response.error.status},operation.tries);
      await recordSyncFailure(owner,operation,{tries:operation.tries+1,nextAt,error:response.error.message});
      if(nextAt!==null)nextWake=Math.min(nextWake,nextAt);
      failures.push(response.error.message);
      continue;
     }
     await acknowledge(owner,operation);
    }
    if(Number.isFinite(nextWake)&&alive.current)timer.current=setTimeout(()=>void synchronize(),Math.max(0,nextWake-Date.now()));
    await local();
    const [sessions,attempts]=await Promise.all([
     fetchAll('quiz_sessions',owner,'id,user_id,subject_id,mode,total_questions,correct_answers,started_at,completed_at'),
     fetchAll('question_attempts',owner,'*'),
    ]);
    await cacheHistory(owner,{sessions,attempts,lastSync:new Date().toISOString()});
    if(alive.current)setError(failures.length?`Results pending: ${failures[0]}`:'');
    await local();
    force=false;
   }while(alive.current&&dirty.current);
  };
  running.current=Promise.resolve().then(()=>navigator.locks?.request(`ppl-progress:${owner}`,drain)??drain())
   .catch(e=>{if(alive.current)setError(`Synchronization unavailable: ${e.message}`);})
   .finally(()=>{
    running.current=null;
    if(alive.current){setLoading(false);setSyncing(false);if(dirty.current)void synchronize();}
   });
  return running.current;
 },[owner,local]);

 const changed=useCallback(()=>{
  void local().catch(e=>{if(alive.current)setError(e.message);});
  void sync();
 },[local,sync]);
 useEffect(()=>{
  alive.current=true;
  void local().catch(e=>{if(alive.current)setError(e.message);});
  void sync();
  const resume=()=>{if(document.visibilityState!=='hidden')void sync();};
  const online=()=>void sync();
  window.addEventListener('online',online);
  document.addEventListener('visibilitychange',resume);
  const {data}=supabase.auth.onAuthStateChange?.((event)=>{
   if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')queueMicrotask(()=>{if(alive.current)void sync(true);});
  })??{};
  return ()=>{
   alive.current=false;
   clearTimeout(timer.current);
   window.removeEventListener('online',online);
   document.removeEventListener('visibilitychange',resume);
   data?.subscription.unsubscribe();
  };
 },[sync,local]);
 return {...state,error,loading,syncing,sync,changed,refresh:sync};
}
