import {test} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {acknowledge,cacheHistory,localRecords,saveDraft} from '../src/offlineStore.js';
import {mergeHistory,retryAt} from '../src/offlineProgress.js';

test('draft revisions isolate tabs and completion atomically queues an immutable payload',async()=>{
 const owner=crypto.randomUUID(),other=crypto.randomUUID(),id=crypto.randomUUID();
 const draft={session:{id},questions:[{id:'q',correctIndex:2}],results:[],revision:1};
 await saveDraft(owner,draft);
 const answered={...draft,results:[{choice:2,correct:true}],revision:2};
 await saveDraft(owner,answered);
 await assert.rejects(saveDraft(owner,{...draft,revision:2}),/another tab/);
 assert.deepEqual(await localRecords(owner,'draft'),[answered]);
 assert.deepEqual(await localRecords(other,'draft'),[]);
 const payload={id,user_id:owner,total_questions:1,attempts:[{subject_id:'air-law',question_id:'q',is_correct:true}]};
 await saveDraft(owner,{...answered,revision:3,completed:true},payload);
 const [operation]=await localRecords(owner,'outbox');
 assert.deepEqual(operation.payload,payload);
 assert.deepEqual(await localRecords(other,'outbox'),[]);
 await assert.rejects(saveDraft(owner,{...answered,revision:4,completed:true},payload),/another tab/);
 await acknowledge(owner,operation);
 assert.deepEqual(await localRecords(owner,'outbox'),[]);
 assert.deepEqual(await localRecords(owner,'draft'),[]);
 await cacheHistory(owner,{sessions:[{id,total_questions:1}],attempts:[]});
 assert.deepEqual(await localRecords(owner,'acknowledged'),[payload]);
 await cacheHistory(owner,{sessions:[{id,total_questions:1}],attempts:[{session_id:id}]});
 assert.deepEqual(await localRecords(owner,'acknowledged'),[]);
});

test('local progress merges independent attempts and deduplicates a response lost after commit',()=>{
 const a={subject_id:'navigation',question_id:'q',is_correct:true};
 const history={sessions:[{id:'first',completed_at:'2026-01-01'}],attempts:[{...a,id:'remote',session_id:'first'}]};
 const merged=mergeHistory(history,[
  {id:'first',completed_at:'2026-01-01',attempts:[a]},
  {id:'second',completed_at:'2026-01-02',attempts:[a]},
 ]);
 assert.deepEqual(merged.sessions.map(s=>s.id),['second','first']);
 assert.equal(merged.attempts.length,2);
 assert.equal(merged.attempts[0].id,'remote');
});

test('sync retries transient errors with bounded delay and pauses auth and validation failures',()=>{
 assert.equal(retryAt({status:429},2,100,()=>0.5),4100);
 assert.equal(retryAt({status:503},40,100,()=>0.5),256100);
 assert.equal(retryAt({status:401},0),null);
 assert.equal(retryAt({status:400,code:'22023'},0),null);
});
