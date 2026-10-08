import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';
import {enqueue,readPending,flushPending} from './pending';
async function fetchAll(table,user) {
 const rows=[]; for(let offset=0;;offset+=500){const {data,error}=await supabase.from(table).select('*').eq('user_id',user).order('id').range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}
}
export function useCloudProgress(user) {
 const [sessions,setSessions]=useState([]),[attempts,setAttempts]=useState([]),[pending,setPending]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const alive=useRef(true),running=useRef(null),unsaved=useRef(new Map()),request=useRef(0);
 const refresh=useCallback(async()=>{const version=++request.current;try{const [s,a]=await Promise.all([fetchAll('quiz_sessions',user.id),fetchAll('question_attempts',user.id)]);if(alive.current && version===request.current){setSessions(s.sort((a,b)=>b.completed_at.localeCompare(a.completed_at)));setAttempts(a);}}catch(e){if(alive.current)setError(`Cloud history unavailable: ${e.message}`);}finally{if(alive.current)setLoading(false);}},[user.id]);
 const sync=useCallback(()=>{
  if(running.current)return running.current;
  running.current=(async()=>{try{
   for(const p of unsaved.current.values())enqueue(localStorage,user.id,p);
   unsaved.current.clear();
   do { await flushPending(localStorage,user.id,async payload=>{
    const {data,error}=await supabase.auth.getSession();if(error)throw error;
    if(payload.user_id!==user.id || !alive.current||data.session?.user.id!==user.id)throw new Error('Sign in with the original account to synchronize these results.');
    const response=await supabase.rpc('save_completed_quiz',{payload});if(response.error)throw response.error;
   });
   if(alive.current)setError(''); await refresh();
   } while(alive.current && readPending(localStorage,user.id).length);
  }catch(e){if(alive.current)setError(`Results pending: ${e.message}`);}finally{
   if(alive.current){try{setPending(readPending(localStorage,user.id).length+unsaved.current.size);}catch(e){setError(`Browser storage unavailable. Keep this page open and retry: ${e.message}`);}}
   if(alive.current)setLoading(false);
   running.current=null;
  }})();return running.current;
 },[user.id,refresh]);
 const save=useCallback(payload=>{try{enqueue(localStorage,user.id,payload);setPending(readPending(localStorage,user.id).length);}catch(e){unsaved.current.set(payload.id,payload);setPending(unsaved.current.size);setError(`Browser storage unavailable. Keep this page open and retry: ${e.message}`);}void sync();},[user.id,sync]);
 useEffect(()=>{alive.current=true;void sync();const online=()=>void sync();window.addEventListener('online',online);return()=>{alive.current=false;window.removeEventListener('online',online);};},[sync]);
 useEffect(()=>{const warn=e=>{if(pending){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[pending]);
 return {sessions,attempts,pending,error,loading,save,sync,refresh};
}
