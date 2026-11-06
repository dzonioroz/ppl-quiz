import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from './supabase';
import {questionKey} from './progress';

// Keep unacknowledged edits separate so a refresh cannot overwrite local changes.
export function useReviewMarks(user) {
 const storageKey=`ppl-review-pending:${user.id}`;
 const edits=useRef(null),alive=useRef(true),running=useRef(null);
 const [rows,setRows]=useState([]),[revision,setRevision]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 if(edits.current===null){try{edits.current=JSON.parse(localStorage.getItem(storageKey))||{};}catch{edits.current={};}}
 const persist=useCallback(()=>{try{localStorage.setItem(storageKey,JSON.stringify(edits.current));return true;}catch{if(alive.current)setError('Review marks could not be stored in this browser. Keep this page open and retry synchronization.');return false;}},[storageKey]);
 const sync=useCallback(()=>{
  if(running.current)return running.current;
  running.current=(async()=>{try{
   do {
    for(const [key,edit] of Object.entries(edits.current)){
     const {data,error:authError}=await supabase.auth.getSession();
     if(authError)throw authError;
     if(!alive.current||data.session?.user.id!==user.id)throw new Error('Sign in with the original account to synchronize review marks.');
     const {error:saveError}=await supabase.from('question_review_marks').upsert({user_id:user.id,subject_id:edit.subject_id,question_id:edit.question_id,marked:edit.marked},{onConflict:'user_id,subject_id,question_id'});
     if(saveError)throw saveError;
     if(!alive.current)return;
     setRows(previous=>[...previous.filter(r=>questionKey(r.subject_id,r.question_id)!==key),edit]);
     if(edits.current[key]?.version===edit.version){delete edits.current[key];persist();setRevision(v=>v+1);}
    }
    const fetched=[];
    for(let offset=0;;offset+=500){
     const {data,error:readError}=await supabase.from('question_review_marks').select('*').eq('user_id',user.id).order('subject_id').order('question_id').range(offset,offset+499);
     if(readError)throw readError;fetched.push(...data);if(data.length<500)break;
    }
    if(alive.current){setRows(fetched);setError('');}
   }while(alive.current&&Object.keys(edits.current).length);
  }catch(e){if(alive.current)setError(`Review marks need synchronization: ${e.message}`);}
  finally{running.current=null;if(alive.current)setLoading(false);}})();return running.current;
 },[user.id,persist]);
 const marked=useMemo(()=>{const combined=new Map(rows.map(r=>[questionKey(r.subject_id,r.question_id),r.marked]));for(const [key,edit] of Object.entries(edits.current))combined.set(key,edit.marked);return new Set([...combined].filter(([,value])=>value).map(([key])=>key));},[rows,revision]);
 const toggle=useCallback((subject,id)=>{
  const key=questionKey(subject,id);
  edits.current[key]={subject_id:subject,question_id:id,marked:!(edits.current[key]?.marked??rows.find(r=>questionKey(r.subject_id,r.question_id)===key)?.marked??false),version:crypto.randomUUID()};
  persist();setRevision(v=>v+1);void sync();
 },[rows,persist,sync]);
 const pending=Object.keys(edits.current).length;
 useEffect(()=>{alive.current=true;void sync();const online=()=>void sync();window.addEventListener('online',online);return()=>{alive.current=false;window.removeEventListener('online',online);};},[sync]);
 useEffect(()=>{const warn=e=>{if(pending){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[pending]);
 return {marked,toggle,pending,error,loading,sync};
}
