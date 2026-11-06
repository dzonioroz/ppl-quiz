import React from 'react';
import figures from './reference/question-figures.json';
const assets=import.meta.glob('./assets/figures/*.png',{eager:true,query:'?url',import:'default'});

export function getQuestionFigure(question){
 return Object.values(figures).find(figure=>figure.subjectId===question.subjectId&&figure.questionIds.includes(question.id));
}
export default function QuestionFigure({question}){
 const figure=getQuestionFigure(question);
 if(!figure)return question.requiresFigure?<p className="figure-note">The source question refers to a figure that is not included in this library yet. The marked answer is preserved, but you may need the figure to work it out.</p>:null;
 const image=assets[`./assets/figures/${figure.asset}`];
 return <figure className="question-figure">
  <a href={image} target="_blank" rel="noreferrer" aria-label={`Open ${figure.title} at full size`}><img src={image} alt={figure.alt} loading="lazy"/></a>
  <figcaption><strong>{figure.title}</strong> · <a href={image} target="_blank" rel="noreferrer">Open full size ↗</a><br/><a href={figure.sourceUrl} target="_blank" rel="noreferrer">{figure.sourceLabel}</a></figcaption>{figure.note&&<p className="fine">{figure.note}</p>}{figure.questionNotes?.[question.id]&&<p className="figure-note">{figure.questionNotes[question.id]}</p>}
 </figure>;
}
