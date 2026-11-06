import React from 'react';
import {it,expect,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import QuestionFigure,{getQuestionFigure} from '../src/QuestionFigure';
import figures from '../src/reference/question-figures.json';
import bank from '../src/data/communication.json';
afterEach(cleanup);
it('maps every Kom-1 reference to the recovered original without changing answer keys',()=>{
 const questions=bank.questions.filter(q=>q.question.includes('PPL Kom-1'));
 expect(questions).toHaveLength(6);
 for(const q of questions){
  expect(q.requiresFigure).toBe(true);
  expect(getQuestionFigure({...q,subjectId:'communication'})).toBe(figures['ppl-kom-1']);
 }
 expect(bank.questions.find(q=>q.id==='COMMUNICATION-089').answers[0]).toBe('F.');
 expect(getQuestionFigure({subjectId:'navigation',id:'COMMUNICATION-089'})).toBeUndefined();
});
it('keeps the missing figure notice for unresolved figures and renders nothing for ordinary questions',()=>{
 const {rerender}=render(<QuestionFigure question={{id:'unknown',requiresFigure:true}}/>);
 expect(screen.getByText(/not included in this library yet/)).toBeTruthy();
 rerender(<QuestionFigure question={{id:'ordinary',requiresFigure:false}}/>);
 expect(screen.queryByText(/not included in this library yet/)).toBeNull();
 expect(screen.queryByRole('img')).toBeNull();
});

it('selects the correct asset across subjects and shows source discrepancies',()=>{
 const {rerender}=render(<QuestionFigure question={{subjectId:'aircraft-general-knowledge',id:'AIRCRAFT-GENERAL-KNOWLEDGE-007',requiresFigure:true}}/>);
 expect(screen.getByRole('img').getAttribute('src')).toContain('ppl-akg-2.png');
 rerender(<QuestionFigure question={{subjectId:'operational-procedures',id:'OPERATIONAL-PROCEDURES-115',requiresFigure:true}}/>);
 expect(screen.getByRole('img').getAttribute('src')).toContain('ppl-op-1.png');
 expect(screen.getByText(/Source wording discrepancy/)).toBeTruthy();
 rerender(<QuestionFigure question={{subjectId:'flight-performance-and-planning',id:'FLIGHT-PERFORMANCE-AND-PLANNING-121',requiresFigure:true}}/>);
 expect(screen.queryByRole('img')).toBeNull();
 expect(screen.getByText(/not included in this library yet/)).toBeTruthy();
});
