import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const figures=JSON.parse(await readFile(new URL('../src/reference/question-figures.json',import.meta.url)));
test('every recovered figure has an image, source, and exact subject/question mapping',async()=>{
 const seen=new Set();
 for(const figure of Object.values(figures)){
  const bytes=await readFile(new URL(`../src/assets/figures/${figure.asset}`,import.meta.url));
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.ok(bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0);
  assert.match(figure.sourceUrl,/^https:\/\/(?:www\.)?cad\.gov\.rs\//);
  const bank=JSON.parse(await readFile(new URL(`../src/data/${figure.subjectId}.json`,import.meta.url)));
  for(const id of figure.questionIds){
   const key=JSON.stringify([figure.subjectId,id]);
   assert.ok(!seen.has(key),`Duplicate mapping: ${key}`);seen.add(key);
   const question=bank.questions.find(q=>q.id===id);
   assert.ok(question,`Missing question: ${key}`);assert.equal(question.requiresFigure,true);
   const reference=figure.title.replace('PPL ','').split('-');
   assert.match(question.question,new RegExp(`PPL\\s+${reference[0]}\\s*-\\s*${reference[1]}(?:e|[FGH])?\\b`,'i'));
  }
 }
 assert.equal(seen.size,117);
});
