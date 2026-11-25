import React,{useEffect,useState} from 'react';
import {useConnectivity} from './OfflineSettings';
import {supabase,configurationError,authRedirect} from './supabase';
const recognizedKey='ppl-recognized-account';
function recognized(){
 try{return JSON.parse(localStorage.getItem(recognizedKey));}catch{return null;}
}
function remember(user){
 try{
  if(user)localStorage.setItem(recognizedKey,JSON.stringify({id:user.id,email:user.email}));
  else localStorage.removeItem(recognizedKey);
 }catch{/* The supported Supabase session remains available when storage permits. */}
}
export default function AuthGate({children}) {
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true),[mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const online=useConnectivity();
 const [localUser,setLocalUser]=useState(recognized);
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  let alive=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{if(!alive)return;setSession(next);if(next?.user){remember(next.user);setLocalUser(recognized());}setLoading(false);if(event==='PASSWORD_RECOVERY')setMode('recovery');if(event==='SIGNED_OUT'){remember(null);setLocalUser(null);setMode('login');}});
  const restore=()=>supabase.auth.getSession().then(({data,error})=>{if(alive){setSession(data.session);if(data.session?.user){remember(data.session.user);setLocalUser(recognized());}if(error)setError(error.message);setLoading(false);}}).catch(e=>{if(alive){setError(e.message);setLoading(false);}});
  void restore();
  window.addEventListener('online',restore);
  return()=>{alive=false;subscription.unsubscribe();window.removeEventListener('online',restore);};
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
 async function logout(){
  setError('');
  if(!online){
   try{
    // Remove the local Supabase session on this device using its supported API.
    const {error}=await supabase.auth.signOut({scope:'local'});
    if(error)throw error;
    remember(null);setSession(null);setLocalUser(null);
   }catch(error){setError(`Reconnect to sign out: ${error.message}`);}
   return;
  }
  const {error}=await supabase.auth.signOut();if(error)setError(error.message);
 }
 const user=session?.user||(!online?localUser:null);
 if(user&&mode!=='recovery')return <>{error&&<p role="alert" className="cloud-status">{error}</p>}{children(user,logout)}</>;
 const title={login:'Sign in to practise',register:'Create your account',forgot:'Reset your password',recovery:'Choose a new password'}[mode];
 return <div className="shell"><header><div className="brand"><span className="mark">✦</span><strong>PPL Question Bank</strong></div></header><main className="login-main"><section className="panel login-panel"><h1>{title}</h1>{configurationError?<p role="alert">{configurationError}</p>:loading?<p role="status">Restoring your session…</p>:!online?<p>Connect to the internet to sign in on this device.</p>:<><form onSubmit={action}>{mode!=='recovery'&&<><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></>}{mode!=='forgot'&&<><label htmlFor="password">Password</label><input id="password" type="password" minLength={mode==='login'?1:8} autoComplete={mode==='login'?'current-password':'new-password'} required value={password} onChange={e=>setPassword(e.target.value)}/></>}<button className="primary" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':mode==='register'?'Register':mode==='forgot'?'Send reset email':'Update password'}</button></form>{mode!=='recovery'&&<div className="auth-actions">{['login','register','forgot'].filter(m=>m!==mode).map(m=><button className="quiet" disabled={busy} key={m} onClick={()=>{setMode(m);setError('');setMessage('');setPassword('');}}>{m==='login'?'Sign in':m==='register'?'Create account':'Forgot password?'}</button>)}</div>}</>}{error&&<p role="alert" className="login-error">{error}</p>}{message&&<p role="status">{message}</p>}</section></main></div>;
}
