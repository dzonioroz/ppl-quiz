export const questionKey = (subject, id) => JSON.stringify([subject, id]);
export function summarize(sessions, attempts, subjects, available) {
  const latest = new Map();
  const ordered = [...attempts].sort((a,b) => a.answered_at.localeCompare(b.answered_at) || a.session_id.localeCompare(b.session_id) || a.id.localeCompare(b.id));
  for (const a of ordered) latest.set(questionKey(a.subject_id,a.question_id), a);
  const incorrect = new Set([...latest].filter(([key,a]) => !a.is_correct && (!available || available.has(key))).map(([key])=>key));
  const stats = rows => ({attempts:rows.length, correct:rows.filter(a=>a.is_correct).length, accuracy:rows.length ? 100*rows.filter(a=>a.is_correct).length/rows.length : null});
  return { ...stats(attempts), quizzes:sessions.length, latest, incorrect,
    subjects:subjects.map(id=>({id,...stats(attempts.filter(a=>a.subject_id===id)),quizzes:sessions.filter(s=>s.subject_id===id || attempts.some(a=>a.session_id===s.id && a.subject_id===id)).length, incorrect:[...incorrect].filter(key=>JSON.parse(key)[0]===id).length})) };
}
export function completedPayload({id,userId,startedAt,subject,mode,results}) {
  return {id,user_id:userId,subject_id:subject,mode,started_at:startedAt,completed_at:new Date().toISOString(),total_questions:results.length,correct_answers:results.filter(r=>r.correct).length,
    attempts:results.map(r=>({subject_id:r.subjectId,question_id:r.id,selected_answer:r.answer,is_correct:r.correct,answered_at:r.answeredAt}))};
}
export function shuffled(items, random=Math.random) {
 const out=[...items]; for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out;
}
