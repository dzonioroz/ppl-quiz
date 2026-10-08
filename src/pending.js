const key = user => `ppl-pending-v1:${user}`;
export function readPending(storage,user) {
 const raw=storage.getItem(key(user)); if(!raw)return [];
 const rows=JSON.parse(raw); if(!Array.isArray(rows))throw new Error('Pending results could not be read. Keep browser data and retry.'); return rows;
}
export function enqueue(storage,user,payload) {
 const rows=readPending(storage,user); if(!rows.some(r=>r.id===payload.id)) storage.setItem(key(user),JSON.stringify([...rows,payload]));
}
export async function flushPending(storage,user,save) {
 for(const payload of readPending(storage,user)) {
  await save(payload);
  // Re-read so a result queued while the request was in flight is retained.
  storage.setItem(key(user),JSON.stringify(readPending(storage,user).filter(r=>r.id!==payload.id)));
 }
}
