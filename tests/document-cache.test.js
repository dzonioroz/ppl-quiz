import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadDocumentBytes} from '../src/documentCache.js';

test('reference cache reuses a full document without another network request',async t=>{
 const entries=new Map();let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(new Uint8Array([37,80,68,70]));});
 const original=globalThis.caches;t.after(()=>{if(original===undefined)delete globalThis.caches;else globalThis.caches=original;});
 globalThis.caches={open:async()=>({match:async key=>entries.get(key)?.clone(),put:async(key,value)=>entries.set(key,value)})};
 const first=await loadDocumentBytes('https://example.test/hashed.pdf');
 const second=await loadDocumentBytes('https://example.test/hashed.pdf');
 assert.equal(first.stored,true);assert.equal(second.cached,true);assert.equal(calls,1);
 assert.deepEqual([...second.data],[37,80,68,70]);
});
test('cache denial still allows reading, while failed downloads reject',async t=>{
 const original=globalThis.caches;t.after(()=>{if(original===undefined)delete globalThis.caches;else globalThis.caches=original;});
 globalThis.caches={open:async()=>{throw new Error('Storage denied');}};
 t.mock.method(globalThis,'fetch',async()=>new Response('PDF'));
 assert.equal((await loadDocumentBytes('/reference.pdf')).stored,false);
 t.mock.method(globalThis,'fetch',async()=>new Response('Not found',{status:404}));
 await assert.rejects(loadDocumentBytes('/missing.pdf'),/404/);
});
