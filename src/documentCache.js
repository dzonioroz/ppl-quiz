// Only shared, versioned reference documents belong here. Never cache account data.
const CACHE_NAME='ppl-reference-documents-v1';
export async function loadDocumentBytes(url,{signal}={}) {
 let cache;
 try { if(globalThis.caches) cache=await caches.open(CACHE_NAME); } catch { /* Private browsing/storage limits: network still works. */ }
 if(signal?.aborted) throw new DOMException('Aborted','AbortError');
 if(cache) {
  try {
   const cached=await cache.match(url);
   if(cached) return {data:new Uint8Array(await cached.arrayBuffer()),cached:true,stored:true};
  } catch { /* Ignore an unavailable or damaged cache. */ }
 }
 const response=await fetch(url,{signal});
 if(!response.ok) throw new Error(`Document download failed (${response.status}).`);
 const copy=response.clone();
 const data=new Uint8Array(await response.arrayBuffer());
 let stored=false;
 if(cache) {try {await cache.put(url,copy);stored=true;} catch { /* Quota errors must not prevent reading. */ }}
 return {data,cached:false,stored};
}
