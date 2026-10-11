import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';

export async function requestTutor(body) {
 if(!supabase)throw Error('AI Tutor is not configured.');
 // functions.invoke reuses the existing authenticated Supabase session.
 const {data,error}=await supabase.functions.invoke('ai-tutor',{body});
 if(error){
  let details;
  try{details=await error.context?.json();}catch{/* Network/non-JSON failure. */}
  const failure=Error(details?.error || 'AI Tutor is temporarily unavailable. Please try again.');
  failure.remaining=details?.remaining;
  throw failure;
 }
 if(data?.error)throw Error(data.error);
 return data;
}
export default function AiTutor({sessionId,question,request=requestTutor}) {
 const [explanation,setExplanation]=useState(null),[messages,setMessages]=useState([]),[remaining,setRemaining]=useState(2);
 const [message,setMessage]=useState(''),[loading,setLoading]=useState(''),[error,setError]=useState(''),[refusal,setRefusal]=useState('');
 const busy=useRef(false),active=useRef(true);
 // An unmounted question must never receive another question's late response.
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 async function send(action,prompt) {
  if(busy.current || (action==='follow-up' && (!prompt?.trim() || remaining===0)))return;
  busy.current=true;setLoading(action);setError('');setRefusal('');
  try {
   const data=await request({action,sessionId,subjectId:question.subjectId,questionId:question.id,requestId:crypto.randomUUID(),...(action==='follow-up'?{message:prompt.trim()}:{})});
   if(!active.current)return;
   if(data.explanation)setExplanation(data.explanation);
   setRemaining(data.remaining);setMessages(data.messages || []);
   if(action==='follow-up'){if(data.inScope===false)setRefusal(data.answer);else setMessage('');}
  } catch(e){if(active.current){setError(e.message);if(e.remaining===0)setRemaining(0);}}
  finally{busy.current=false;if(active.current)setLoading('');}
 }
 const disabled=!!loading || remaining===0;
 return <section className="ai-tutor" aria-label="AI Tutor" aria-busy={!!loading}>
  <div className="tutor-heading">
   <span className="tutor-icon" aria-hidden="true">✦</span>
   <div><h2>PPL AI Tutor</h2><p>Understand the answer. Remember the concept.</p></div>
   <span className="tutor-tag">Study companion</span>
  </div>
  {!explanation&&<div className="tutor-intro">
   <p>Get a focused explanation of this question, then explore it with two follow-ups.</p>
   <button className="tutor-explain" disabled={!!loading} onClick={()=>void send('explanation')}>Explain with AI</button>
  </div>}
  {loading&&<p className="tutor-loading" role="status"><span className="tutor-spinner" aria-hidden="true"/>{loading==='explanation'?'Generating explanation…':'Asking AI…'}</p>}
  {error&&<p className="tutor-error" role="alert">{error}</p>}
  {explanation&&<>
   <div className="tutor-explanation">
    {explanation.warning&&<div className="tutor-warning" role="status"><strong>AI verification warning</strong><p>{explanation.warning}</p></div>}
    {explanation.whyCorrect&&<div className="tutor-section"><h3>Why this is correct</h3><p>{explanation.whyCorrect}</p></div>}
    {!!explanation.whyOthersWrong?.length&&<div className="tutor-section"><h3>Why the other answers are wrong</h3><ul className="tutor-alternatives">{explanation.whyOthersWrong.map((x,i)=><li key={i}><strong>{x.answer}</strong><p>{x.reason}</p></li>)}</ul></div>}
    {explanation.examTip&&<div className="tutor-tip"><h3><span aria-hidden="true">✧ </span>Exam tip</h3><p>{explanation.examTip}</p></div>}
   </div>
   <div className="tutor-follow-ups">
    <div className="tutor-follow-up-heading"><h3>Explore this question</h3><span className="tutor-count" aria-label={`${remaining} of 2 follow-ups available`}>{remaining} / 2 left</span></div>
    {!!messages.length&&<div className="tutor-conversation">{messages.map((x,i)=><div className="tutor-exchange" key={i}><div className="tutor-message tutor-message-user"><strong>You</strong><p>{x.question}</p></div><div className="tutor-message tutor-message-ai"><strong>AI Tutor</strong><p>{x.answer}</p></div></div>)}</div>}
    {refusal&&<p className="tutor-refusal" role="status">{refusal}</p>}
    <div className="tutor-suggestions">{(explanation.suggestedFollowUps?.length?explanation.suggestedFollowUps:['Explain more simply','Why are the others wrong?','Give me a memory trick']).slice(0,3).map(prompt=><button key={prompt} disabled={disabled} onClick={()=>void send('follow-up',prompt)}>{prompt}</button>)}</div>
    <form className="tutor-compose" onSubmit={e=>{e.preventDefault();void send('follow-up',message);}}>
     <label htmlFor={`tutor-question-${question.subjectId}-${question.id}`}>Ask AI about this question</label>
     <div className="tutor-input-wrap"><textarea id={`tutor-question-${question.subjectId}-${question.id}`} maxLength={500} value={message} disabled={disabled} onChange={e=>setMessage(e.target.value)} placeholder="What would you like to understand better?"/>
     <div className="tutor-input-footer"><span>{message.length} / 500</span><button className="tutor-explain" disabled={disabled || !message.trim()}>Ask AI</button></div></div>
    </form>
    <p className="tutor-remaining" aria-live="polite">{remaining===0?"You've used your 2 follow-up questions for this question.":`${remaining} follow-up question${remaining===1?'':'s'} remaining`}</p>
   </div>
   <p className="tutor-disclaimer">AI can make mistakes. Verify uncertain information with your training materials.</p>
  </>}
 </section>;
}
