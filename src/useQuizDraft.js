import {useCallback,useRef,useState} from 'react';
import {discardDraft,localRecords,saveDraft} from './offlineStore';

export function useQuizDraft(owner){
 const [draft,setDraft]=useState(null),[saved,setSaved]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const locked=useRef(false);
 const refresh=useCallback(async()=>{
  try{
   const rows=await localRecords(owner,'draft');
   setSaved(rows.filter(row=>!row.completed).sort((a,b)=>b.session.startedAt.localeCompare(a.session.startedAt)));
  }catch(error){setError(`Saved quizzes could not be loaded. ${error.message}`);}
 },[owner]);

 async function write(action){
  if(locked.current)return false;
  locked.current=true;setBusy(true);setError('');
  try{await action();return true;}
  catch(error){
   setError(`Quiz changes could not be saved. ${error.message}`);
   await refresh();
   return false;
  }finally{locked.current=false;setBusy(false);}
 }
 function save(value,payload){
  const next={...value,revision:value.revision+1};
  return write(async()=>{
   await saveDraft(owner,next,payload);
   setDraft(next);
   setSaved(previous=>[...(next.completed?[]:[next]),...previous.filter(row=>row.session.id!==next.session.id)]);
  });
 }
 function discard(){
  return write(async()=>{
   await discardDraft(owner,draft);
   setSaved(rows=>rows.filter(row=>row.session.id!==draft.session.id));
   setDraft(null);
  });
 }
 return {draft,saved,busy,error,save,discard,resume:setDraft,refresh};
}
