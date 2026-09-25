import fitz, re, json, pathlib, collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
FILES={'Air law.pdf':'Air Law','Aircraft  general knowledge.pdf':'Aircraft General Knowledge','Comunication.pdf':'Communication','Flight performance and planning.pdf':'Flight Performance and Planning','Human performance.pdf':'Human Performance','Metheorology.pdf':'Meteorology','Navigation.pdf':'Navigation','Operational procedures.pdf':'Operational Procedures','Principles of flight.pdf':'Principles of Flight'}
num=re.compile(r'^(\d+)\.\s+(.*)')
opt=re.compile(r'^([a-d])\.\s*(.*)')
figure=re.compile(r'\b(?:see|shown in|according to|attached|refer to|using|from|in)\s+(?:the\s+)?(?:figure|diagram|chart|map|graph|table|picture)\b|\bfigure\s+PPL\b',re.I)
report=[]
for filename,subject in FILES.items():
 doc=fitz.open(ROOT/'upload'/filename); rows=[]; cur=None; part=None
 for page_no,page in enumerate(doc,1):
  for block in page.get_text('blocks'):
   if block[1]>745 or block[3]<75:continue
   for raw in block[4].splitlines():
    s=raw.strip()
    if not s or re.fullmatch(r'\d{3}\.\d+\s*-',s):continue
    m=num.match(s); o=opt.match(s)
    if m and (cur is None or (part=='answer' and int(m.group(1))==cur['sourceNumber']+1)):
     cur={'id':subject.upper().replace(' ','-')+'-'+m.group(1).zfill(3),'sourceNumber':int(m.group(1)),'question':m.group(2),'answers':[],'correctAnswer':0,'explanation':'','sourcePage':page_no};rows.append(cur);part='question'
    elif o and cur:
     if o.group(2) and ord(o.group(1))-ord('a')==len(cur['answers']):
      cur['answers'].append(o.group(2));part='answer'
     elif o.group(2) and part=='answer' and cur['answers']:cur['answers'][-1]+=' '+s
     elif not o.group(2):part='answer'
    elif cur and part and not re.match(r'^\d{3}\.\d+',s):
     if part=='question':cur['question']+=' '+s
     elif cur['answers']:cur['answers'][-1]+=' '+s
 valid=[]; excluded=[]
 for q in rows:
  q['question']=re.sub(r'\s+',' ',q['question']).strip()
  q['answers']=[re.sub(r'\s+',' ',a).strip() for a in q['answers']]
  q['requiresFigure']=bool(figure.search(q['question']))
  reason='incomplete question or answers' if not q['question'] or len(q['answers'])<2 else None
  if reason:excluded.append({'id':q['id'],'page':q['sourcePage'],'reason':reason,'question':q['question']})
  else:valid.append(q)
 slug=subject.lower().replace(' ','-'); (ROOT/'src/data'/f'{slug}.json').write_text(json.dumps({'subject':subject,'source':filename,'questions':valid},ensure_ascii=False,indent=2)+'\n')
 report.append({'subject':subject,'source':filename,'detected':len(rows),'included':len(valid),'figureReferences':sum(q['requiresFigure'] for q in valid),'excluded':excluded,'answerCounts':dict(collections.Counter(len(q['answers']) for q in valid))})
(ROOT/'extraction-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
for item in report:print(item['subject'],item['detected'],item['included'],'excluded',len(item['excluded']),item['answerCounts'])
