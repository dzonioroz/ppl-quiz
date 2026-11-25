import React,{useEffect,useState} from 'react';
import {localValue,storeValue} from './offlineStore';

async function verifyStorage(status){
 if(status.ready){
  await storeValue('','content',status.version);
  if(await localValue('','content')!==status.version)throw Error('Offline storage could not be verified.');
 }
 return status;
}

export function useConnectivity(){
 const [online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{
  const update=()=>setOnline(navigator.onLine);
  window.addEventListener('online',update);window.addEventListener('offline',update);
  return ()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};
 },[]);
 return online;
}

function ask(worker,type,progress=()=>{}){
 return new Promise((resolve,reject)=>{
  const channel=new MessageChannel();
  const finish=(result,error)=>{
   clearTimeout(timer);channel.port1.close();
   if(error)reject(error);else resolve(result);
  };
  const timer=setTimeout(()=>finish(null,Error('Offline storage did not respond. Try again.')),180000);
  channel.port1.onmessage=({data})=>{
   if(data.error)finish(null,Error(data.error));
   else if(data.total!==undefined)progress(data);
   else finish(data);
  };
  try{worker.postMessage({type},[channel.port2]);}
  catch(error){finish(null,error);}
 });
}

export default function OfflineSettings({visible,updateBlocked}){
 const [worker,setWorker]=useState(null),[updateReady,setUpdateReady]=useState(false),[install,setInstall]=useState(null);
 const [status,setStatus]=useState(null),[busy,setBusy]=useState(''),[progress,setProgress]=useState(null),[error,setError]=useState('');
 const supported=import.meta.env.PROD&&'serviceWorker' in navigator&&'caches' in window;
 useEffect(()=>{
  if(!supported)return;
  const service=navigator.serviceWorker;
  let active=true;
  let controller=service.controller;
  const changed=()=>{
   const next=service.controller;
   if(controller&&next&&controller!==next)setUpdateReady(true);
   controller=next;
   setWorker(next);
  };
  service.addEventListener('controllerchange',changed);
  service.register(`${import.meta.env.BASE_URL}sw.js`,{updateViaCache:'none'}).then(()=>{
   if(active)changed();
  }).catch(error=>{if(active)setError(error.message);});
  return ()=>{active=false;service.removeEventListener('controllerchange',changed);};
 },[supported]);
 useEffect(()=>{
  const capture=event=>{event.preventDefault();setInstall(event);};
  const installed=()=>setInstall(null);
  window.addEventListener('beforeinstallprompt',capture);window.addEventListener('appinstalled',installed);
  return ()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',installed);};
 },[]);
 useEffect(()=>{
  if(!worker)return;
  let alive=true;
  ask(worker,'status').then(verifyStorage).then(value=>{if(alive)setStatus(value);}).catch(error=>{if(alive)setError(error.message);});
  return ()=>{alive=false;};
 },[worker,visible]);
 async function manage(type){
  setBusy(type);setProgress(null);setError('');
  try{
   if(type==='prepare')await navigator.storage?.persist?.().catch(()=>false);
   setStatus(await verifyStorage(await ask(worker,type,setProgress)));
  }catch(error){setError(error.message);}
  finally{setBusy('');}
 }
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const standalone=navigator.standalone||window.matchMedia?.('(display-mode: standalone)').matches;
 return <>
  {updateReady&&<p role="status" className="cloud-status">Update available. <button className="quiet" disabled={updateBlocked||!!busy} onClick={()=>location.reload()}>Update and reload</button>{updateBlocked&&' Available after leaving the active quiz.'}</p>}
  {visible&&<section className="panel offline-settings">
   <h1>Offline and installation</h1>
   <p role="status">{!supported?'Offline downloads are unavailable in this browser or development build.':busy==='prepare'?`Downloading${progress?` · ${progress.done}/${progress.total} figures`:''}…`:error?'Offline storage needs attention.':status?.ready?'Offline Ready':worker?'Download required':'Preparing the application shell…'}</p>
   {error&&<p role="alert">{error}</p>}
   {status&&<p>Quiz content and app files total {(status.bytes/1000000).toFixed(1)} MB before compression.</p>}
   {supported&&<><button className="primary" disabled={!worker||!!busy} onClick={()=>void manage('prepare')}>{error?'Retry download':'Download for offline use'}</button><button className="secondary" disabled={!worker||!!busy} onClick={()=>void manage('remove')}>Remove downloaded figures</button></>}
   {install&&<button className="secondary" onClick={async()=>{try{await install.prompt();}finally{setInstall(null);}}}>Install app</button>}
   {ios&&!standalone&&<p>On iOS, open Share → Add to Home Screen. Open the installed app online and prepare it there.</p>}
   <p className="fine">The download includes all nine subjects and available question figures. Notes and PDFs use their own download controls. This browser can clear or evict saved data. Local storage is accessible to people with access to this browser profile.</p>
  </section>}
 </>;
}
