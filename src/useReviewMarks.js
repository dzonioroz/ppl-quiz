import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';
import {questionKey} from './progress';
import {acknowledgeMark,importMark,localRecords,localValue,storeValue,toggleReviewMark} from './offlineStore';

const key = row => questionKey(row.subject_id,row.question_id);

export function useReviewMarks(user){
 const owner=user.id,legacyKey=`ppl-review-pending:${owner}`;
 const alive=useRef(true),running=useRef(null),dirty=useRef(false);
 const [state,setState]=useState({marked:new Set(),pending:0});
 const [error,setError]=useState(''),[loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  const [rows,edits]=await Promise.all([localValue(owner,'marks'),localRecords(owner,'mark-edit')]);
  const combined=new Map((rows||[]).map(row=>[key(row),row.marked]));
  for(const edit of edits)combined.set(key(edit),edit.marked);
  if(alive.current)setState({marked:new Set([...combined].filter(([,marked])=>marked).map(([id])=>id)),pending:edits.length});
  return edits;
 },[owner]);

 const sync=useCallback(function synchronize(){
  if(running.current){dirty.current=true;return running.current;}
  const drain=async()=>{
   const legacy=JSON.parse(localStorage.getItem(legacyKey)||'{}');
   for(const [id,edit] of Object.entries(legacy)){
    await importMark(owner,edit,id);
    const latest=JSON.parse(localStorage.getItem(legacyKey)||'{}');
    if(latest[id]?.version===edit.version){delete latest[id];localStorage.setItem(legacyKey,JSON.stringify(latest));}
   }
   do{
    dirty.current=false;
    const edits=await refresh();
    if(!alive.current||!navigator.onLine)return;
    for(const edit of edits){
     const {data,error}=await supabase.auth.getSession();
     if(error)throw error;
     if(!alive.current||data.session?.user.id!==owner||(data.session.expires_at&&data.session.expires_at*1000<=Date.now())){
      throw Error('Sign in with the original account to synchronize review marks.');
     }
     const {error:saveError}=await supabase.from('question_review_marks').upsert({user_id:owner,subject_id:edit.subject_id,question_id:edit.question_id,marked:edit.marked},{onConflict:'user_id,subject_id,question_id'});
     if(saveError)throw saveError;
     await acknowledgeMark(owner,edit,key(edit));
    }
    const fetched=[];
    for(let offset=0;;offset+=500){
     const {data,error:readError}=await supabase.from('question_review_marks').select('*').eq('user_id',owner).order('subject_id').order('question_id').range(offset,offset+499);
     if(readError)throw readError;
     fetched.push(...data);
     if(data.length<500)break;
    }
    await storeValue(owner,'marks',fetched);
    await refresh();
    if(alive.current)setError('');
   }while(alive.current&&dirty.current);
  };
  running.current=Promise.resolve().then(()=>navigator.locks?.request(`ppl-review:${owner}`,drain)??drain())
   .catch(async e=>{
    await refresh().catch(()=>{});
    if(alive.current)setError(`Review marks need synchronization: ${e.message}`);
   }).finally(()=>{
    running.current=null;
    if(alive.current){setLoading(false);if(dirty.current)void synchronize();}
   });
  return running.current;
 },[owner,legacyKey,refresh]);

 const toggle=useCallback(async(subject,id)=>{
  const edit={subject_id:subject,question_id:id,version:crypto.randomUUID()};
  try{
   await toggleReviewMark(owner,edit,key(edit));
   await refresh();
   if(alive.current)void sync();
  }catch(e){if(alive.current)setError(`Review change could not be saved: ${e.message}`);}
 },[owner,refresh,sync]);
 useEffect(()=>{
  alive.current=true;
  void refresh().catch(e=>{if(alive.current)setError(e.message);});
  void sync();
  const resume=()=>{if(document.visibilityState!=='hidden')void sync();};
  window.addEventListener('online',resume);
  document.addEventListener('visibilitychange',resume);
  return ()=>{
   alive.current=false;
   window.removeEventListener('online',resume);
   document.removeEventListener('visibilitychange',resume);
  };
 },[refresh,sync]);
 return {...state,error,loading,toggle,sync};
}
