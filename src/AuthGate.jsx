import React,{useEffect,useState} from 'react';
import {supabase,configurationError,authRedirect} from './supabase';
export default function AuthGate({children}) {
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true),[mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  let alive=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{if(!alive)return;setSession(next);setLoading(false);if(event==='PASSWORD_RECOVERY')setMode('recovery');if(event==='SIGNED_OUT')setMode('login');});
  supabase.auth.getSession().then(({data,error})=>{if(alive){setSession(data.session);if(error)setError(error.message);setLoading(false);}}).catch(e=>{if(alive){setError(e.message);setLoading(false);}});
  return()=>{alive=false;subscription.unsubscribe();};
 },[]);
 async function action(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{
  let response;
  if(mode==='register')response=await supabase.auth.signUp({email,password,options:{emailRedirectTo:authRedirect()}});
  else if(mode==='forgot')response=await supabase.auth.resetPasswordForEmail(email,{redirectTo:authRedirect()});
  else if(mode==='recovery')response=await supabase.auth.updateUser({password});
  else response=await supabase.auth.signInWithPassword({email,password});
  if(response.error)throw response.error;
  setPassword('');
  if(mode==='register'&&!response.data.session)setMessage('Check your email to confirm your account before signing in.');
  if(mode==='forgot')setMessage('If an account exists, check your email for a reset link.');
  if(mode==='recovery'){setMode('login');setMessage('Password updated.');}
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 async function logout(){setError('');const {error}=await supabase.auth.signOut();if(error)setError(error.message);}
 if(session&&mode!=='recovery')return <>{error&&<p role="alert" className="cloud-status">{error}</p>}{children(session.user,logout)}</>;
 const title={login:'Sign in to practise',register:'Create your account',forgot:'Reset your password',recovery:'Choose a new password'}[mode];
 return <div className="shell"><header><div className="brand"><span className="mark">✦</span><strong>PPL Question Bank</strong></div></header><main className="login-main"><section className="panel login-panel"><h1>{title}</h1>{configurationError?<p role="alert">{configurationError}</p>:loading?<p role="status">Restoring your session…</p>:<><form onSubmit={action}>{mode!=='recovery'&&<><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></>}{mode!=='forgot'&&<><label htmlFor="password">Password</label><input id="password" type="password" minLength={mode==='login'?1:8} autoComplete={mode==='login'?'current-password':'new-password'} required value={password} onChange={e=>setPassword(e.target.value)}/></>}<button className="primary" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':mode==='register'?'Register':mode==='forgot'?'Send reset email':'Update password'}</button></form>{mode!=='recovery'&&<div className="auth-actions">{['login','register','forgot'].filter(m=>m!==mode).map(m=><button className="quiet" disabled={busy} key={m} onClick={()=>{setMode(m);setError('');setMessage('');setPassword('');}}>{m==='login'?'Sign in':m==='register'?'Create account':'Forgot password?'}</button>)}</div>}</>}{error&&<p role="alert" className="login-error">{error}</p>}{message&&<p role="status">{message}</p>}</section></main></div>;
}
