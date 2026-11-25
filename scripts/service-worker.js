const scope = self.registration.scope;
const shellName = 'ppl-shell:' + scope + content.version;
const figureName = 'ppl-figures:' + scope + content.version;
const readyKey = new URL('.offline-ready', scope).href;
const absolute = path => new URL(path, scope).href;
const shellUrls = content.shell.map(absolute);
const figureUrls = content.figures.map(absolute);

self.addEventListener('install', event => {
 event.waitUntil((async()=>{
  const cache=await caches.open(shellName);
  try{
   for(const url of shellUrls){
    const response=await fetch(url,{cache:'reload',redirect:'error'});
    const type=response.headers.get('content-type')||'';
    const expected=/\.m?js$/.test(url)?/javascript/:url.endsWith('.css')?/^text\/css/:url.endsWith('.png')?/^image\/png/:url.endsWith('.html')?/^text\/html/:/json|octet-stream/;
    if(!response.ok||!expected.test(type))throw Error('Unexpected application file: '+url);
    await cache.put(url,response);
   }
   const previous=await preparedCaches();
   if(previous.length)await prepareFigures(previous);
   await self.skipWaiting();
  }catch(error){await caches.delete(shellName);await caches.delete(figureName);throw error;}
 })());
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
 const {request}=event;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(request.mode==='navigate' && (url.origin+url.pathname===scope || url.origin+url.pathname===absolute('index.html'))){
  event.respondWith(caches.open(shellName).then(cache=>cache.match(absolute('index.html'))).then(response=>response||fetch(request)));
 }else if(shellUrls.includes(url.href)||figureUrls.includes(url.href)){
  event.respondWith(caches.match(request,{cacheName:figureUrls.includes(url.href)?figureName:shellName}).then(response=>response||fetch(request)));
 }else if(url.origin===location.origin&&url.href.startsWith(absolute('assets/'))&&/-[\w-]{8,}\.(m?js|css|png)$/.test(url.pathname)){
  event.respondWith((async()=>{
   for(const name of await caches.keys()){
    if(!name.startsWith('ppl-shell:'+scope)&&!name.startsWith('ppl-figures:'+scope))continue;
    const response=await caches.match(request,{cacheName:name});
    if(response)return response;
   }
   return fetch(request);
  })());
 }
});

async function isReady(){
 const figures=await caches.open(figureName);
 const shell=await caches.open(shellName);
 return Boolean(await figures.match(readyKey)) &&
  (await Promise.all([...shellUrls.map(url=>shell.match(url)),...figureUrls.map(url=>figures.match(url))])).every(Boolean);
}
async function preparedCaches(){
 const previous=[];
 for(const name of await caches.keys()){
  if(name!==figureName&&name.startsWith('ppl-figures:'+scope)){
   const cache=await caches.open(name);
   if(await cache.match(readyKey))previous.push(cache);
  }
 }
 return previous;
}
async function prepareFigures(previous,progress=()=>{}){
 const cache=await caches.open(figureName);
 let done=0;
 for(const url of figureUrls){
  if(!await cache.match(url)){
   let response;
   for(const older of previous){response=await older.match(url);if(response)break;}
   response??=await fetch(url,{cache:'reload',redirect:'error'});
   if(!response.ok||!response.headers.get('content-type')?.startsWith('image/png'))throw Error('Figure download failed.');
   await cache.put(url,response);
  }
  progress({done:++done,total:figureUrls.length});
 }
 await cache.put(readyKey,new Response(content.version));
 if(!await isReady()){await cache.delete(readyKey);throw Error('Offline files could not be verified. Reload and try again.');}
}
let operation;
self.addEventListener('message',event=>{
 const {type}=event.data||{};
 const port=event.ports[0];
 if(!port)return;
 event.waitUntil((async()=>{
  try{
   if(type==='prepare'||type==='remove'){
    if(operation)throw Error('An offline download operation is already running.');
    operation=(async()=>{
     if(type==='remove'){
      for(const key of await caches.keys())if(key.startsWith('ppl-figures:'+scope))await caches.delete(key);
      return;
     }
     await prepareFigures(await preparedCaches(),value=>port.postMessage(value));
    })();
    try{await operation;}finally{operation=null;}
   }
   port.postMessage({ready:await isReady(),bytes:content.bytes,version:content.version});
  }catch(error){port.postMessage({error:error.message});}
 })());
});
