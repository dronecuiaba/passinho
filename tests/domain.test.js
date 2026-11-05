import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyFamily,mutateRoot,summary,dayView,checkKey,dayKey,snapshot,addDays,dayNumber,bathChild,todayISO,convertLegacy,normalizeSchedule,scheduleLabel,validateReview,normalizeRecurrence} from '../src/domain.js';
const setup=(date='2026-11-01',amount=30000)=>{
  let root=emptyFamily('parent');root.guardians.parent={id:'parent',name:'Responsável',email:'test@example.invalid'};
  root=mutateRoot(root,'saveChild',{id:undefined,name:'Lia',amount,avatar:1},{today:date,uid:'parent'}).root;
  const cid=Object.keys(root.children)[0];
  const task=(title,weekdays=[0,1,2,3,4,5,6],today=date,closures={})=>{root=mutateRoot(root,'saveTask',{childId:cid,title,weekdays,icon:0},{today,uid:'parent',closures}).root;return Object.keys(root.tasks).at(-1);};
  return {get root(){return root;},set root(r){root=r;},cid,task};
};
test('mês começa com objetivos cheios e sem descontos, mesmo com tarefas pendentes',()=>{const f=setup();f.task('Cama');const s=summary(f.root,f.root.children[f.cid],'2026-11',{}, {},'2026-11-01');assert.equal(s.occurrences,30);assert.equal(s.balance,30000);assert.equal(s.objectiveBalance,30000);assert.equal(s.deducted,0);});

test('fechamento automático mantém concluídas e não marcadas sem desconto',()=>{const f=setup();const a=f.task('Cama');f.task('Dentes');const checks={[checkKey(f.cid,'2026-11-01',a)]:{status:'done'}};const d=dayView(f.root,f.cid,'2026-11-01',checks,{},'2026-11-02');assert.equal(d.closed,true);assert.equal(d.closureSource,'automatic');assert.equal(d.done,1);assert.equal(d.failed,0);assert.equal(d.tasks[1].status,'pending');assert.equal(summary(f.root,f.root.children[f.cid],'2026-11',checks,{},'2026-11-02').deducted,0);});

test('descontos são arredondados no total e limitados ao orçamento por objetivos',()=>{
 const f=setup('2026-11-01',10000),tid=f.task('Diária'),checks={};
 for(let i=1;i<=30;i++){const date=`2026-11-${String(i).padStart(2,'0')}`;checks[checkKey(f.cid,date,tid)]={status:'failed'};const result=summary(f.root,f.root.children[f.cid],'2026-11',checks,{},'2026-12-01');assert.equal(result.deducted,Math.round(10000*i/30));assert.equal(result.balance,10000-result.deducted);}
});

test('alteração da mesada vale para o mês atual e os próximos, preservando anteriores',()=>{const f=setup();f.task('Cama');f.root=mutateRoot(f.root,'saveChild',{id:f.cid,name:'Lia',amount:60000,avatar:1},{today:'2026-12-01',uid:'parent'}).root;assert.equal(summary(f.root,f.root.children[f.cid],'2026-11',{}, {},'2026-12-02').amount,30000);assert.equal(summary(f.root,f.root.children[f.cid],'2026-12',{}, {},'2026-12-02').amount,60000);assert.equal(summary(f.root,f.root.children[f.cid],'2027-01',{}, {},'2026-12-02').amount,60000);});
test('agenda preserva nome e ocorrências de datas anteriores',()=>{const f=setup();const tid=f.task('Título antigo');f.root=mutateRoot(f.root,'saveTask',{id:tid,childId:f.cid,title:'Novo título',weekdays:[1,2,3,4,5],icon:2},{today:'2026-11-02',uid:'parent'}).root;assert.equal(dayView(f.root,f.cid,'2026-11-01',{}, {},'2026-11-02').tasks[0].title,'Título antigo');assert.equal(dayView(f.root,f.cid,'2026-11-08',{}, {},'2026-11-02').total,0);});
test('agenda começa amanhã quando hoje foi fechado manualmente',()=>{const f=setup();const closures={[dayKey(f.cid,'2026-11-01')]:{closed:true}};f.task('Nova',[0,1,2,3,4,5,6],'2026-11-01',closures);assert.equal(dayView(f.root,f.cid,'2026-11-01').total,0);assert.equal(dayView(f.root,f.cid,'2026-11-02').total,1);});
test('meses bissextos e cadastro no meio do mês',()=>{const f=setup('2028-02-01',29000);f.task('Diária');assert.equal(summary(f.root,f.root.children[f.cid],'2028-02',{}, {},'2028-02-01').occurrences,29);const p=setup('2026-11-15',16000);p.task('Diária');assert.equal(summary(p.root,p.root.children[p.cid],'2026-11',{}, {},'2026-11-16').occurrences,16);assert.equal(summary(p.root,p.root.children[p.cid],'2026-11',{}, {},'2026-11-16').deducted,0);});
test('sem tarefas não desconta e entrada inválida não altera a origem',()=>{const f=setup();assert.equal(summary(f.root,f.root.children[f.cid],'2026-11',{}, {},'2026-12-01').deducted,0);const before=JSON.stringify(f.root);assert.throws(()=>mutateRoot(f.root,'saveChild',{id:f.cid,name:'Lia',amount:-1},{today:'2026-11-01',uid:'parent'}));assert.equal(JSON.stringify(f.root),before);assert.throws(()=>f.task('Inválida',[]));});
test('fila do banho alterna, repete e permite reiniciar por qualquer criança',()=>{const f=setup();f.root=mutateRoot(f.root,'saveChild',{name:'Bia',amount:0,avatar:2},{today:'2026-11-01',uid:'parent'}).root;const ids=Object.keys(f.root.children);f.root=mutateRoot(f.root,'saveBath',{participants:ids,startDate:'2026-11-01',startChildId:ids[1]},{today:'2026-11-01',uid:'parent'}).root;assert.equal(bathChild(f.root,'2026-11-01').name,'Bia');assert.equal(bathChild(f.root,'2026-11-02').name,'Lia');assert.equal(bathChild(f.root,'2026-11-03').name,'Bia');assert.equal(bathChild(f.root,'2026-10-31').name,'Lia');assert.equal(snapshot(f.root,{}, {},{}, {today:'2026-11-01'}).bathUpcoming.length,7);assert.throws(()=>mutateRoot(f.root,'saveBath',{participants:[ids[0]],startDate:'2026-11-01',startChildId:ids[0]},{uid:'parent'}));});
test('calendário usa datas civis de São Paulo sem erro de UTC ou horário de verão',()=>{assert.equal(todayISO(new Date('2026-11-02T02:59:59Z')),'2026-11-01');assert.equal(todayISO(new Date('2026-11-02T03:00:00Z')),'2026-11-02');assert.equal(addDays('2028-02-28',1),'2028-02-29');assert.equal(addDays('2028-02-29',1),'2028-03-01');assert.equal(dayNumber('2026-11-02')-dayNumber('2026-11-01'),1);});
test('retorno infantil não inclui funções administrativas',()=>{const f=setup();f.task('Diária');const s=snapshot(f.root,{}, {},{},{today:'2026-11-01',admin:false});assert.equal(s.authenticated,false);assert.equal('templates' in s,false);assert.equal('audit'in s,false);assert.equal(s.guardians[0].email,undefined);});
test('backup offline é convertido sem importar hashes como credenciais da nuvem',()=>{const f=setup();const old={schema:1,children:[{id:'c',name:'Antiga',createdOn:'2026-10-01',avatar:1,allowances:{'2026-10':10000}}],tasks:[{id:'t',childId:'c',versions:[{from:'2026-10-01',title:'Diária',weekdays:[0,1,2,3,4,5,6],icon:0,active:true}]}],guardians:[{hash:'hash-antigo',salt:'salt-antigo'}],days:{'c|2026-10-01':{closed:true,checks:{t:{status:'done',reviewed:true}}}}};const r=convertLegacy(old,f.root,'2026-11-01');assert.equal(r.root.children.c.name,'Antiga');assert.equal(r.root.guardians.parent.name,'Responsável');assert.equal(JSON.stringify(r).includes('hash-antigo'),false);assert.equal(r.checks['c|2026-10-01|t'].status,'done');assert.equal(r.closures['c|2026-10-01'].closed,true);assert.throws(()=>convertLegacy({...old,schema:3},f.root));});
test('horário é opcional e aceita hora, intervalo e período do dia',()=>{
  assert.equal(normalizeSchedule(undefined),null);assert.equal(scheduleLabel(null),'');
  assert.equal(scheduleLabel({type:'time',time:'08:30'}),'08:30');
  assert.equal(scheduleLabel({type:'range',start:'14:00',end:'16:00'}),'14:00 às 16:00');
  assert.equal(scheduleLabel({type:'period',period:'morning'}),'Manhã');
  assert.equal(scheduleLabel({type:'period',period:'afternoon'}),'Tarde');
  for(const value of [{type:'time',time:'24:00'},{type:'time',time:'9:60'},{type:'range',start:'16:00',end:'14:00'},{type:'range',start:'08:00',end:'08:00'},{type:'period',period:'unknown'}])assert.throws(()=>normalizeSchedule(value));
});
test('horário salvo aparece no dia e no cadastro e preserva o histórico',()=>{
  const f=setup(),tid=f.task('Leitura'),save=(schedule,today)=>mutateRoot(f.root,'saveTask',{id:tid,childId:f.cid,title:'Leitura',weekdays:[0,1,2,3,4,5,6],icon:2,schedule},{today,uid:'parent'}).root;
  f.root=save({type:'time',time:'08:00'},'2026-11-01');
  f.root=save({type:'range',start:'14:00',end:'16:00'},'2026-11-02');
  assert.equal(scheduleLabel(dayView(f.root,f.cid,'2026-11-01').tasks[0].schedule),'08:00');
  assert.equal(scheduleLabel(dayView(f.root,f.cid,'2026-11-02').tasks[0].schedule),'14:00 às 16:00');
  const s=snapshot(f.root,{}, {},{childId:f.cid,date:'2026-11-02'},{today:'2026-11-02',admin:true,uid:'parent'});
  assert.equal(scheduleLabel(s.templates[0].schedule),'14:00 às 16:00');
  assert.equal(s.child.occurrences,30);assert.equal(s.child.deducted,0);assert.equal(s.child.deducted,0);
});
test('pausar mantém o horário; remover explicitamente mantém a tarefa sem horário',()=>{
  const f=setup(),tid=f.task('Cama'),a={id:tid,childId:f.cid,title:'Cama',weekdays:[0,1,2,3,4,5,6],icon:0};
  f.root=mutateRoot(f.root,'saveTask',{...a,schedule:{type:'period',period:'evening'}},{today:'2026-11-01',uid:'parent'}).root;
  f.root=mutateRoot(f.root,'saveTask',{...a,active:false},{today:'2026-11-01',uid:'parent'}).root;
  assert.equal(scheduleLabel(f.root.tasks[tid].versions.at(-1).schedule),'Noite');
  f.root=mutateRoot(f.root,'saveTask',{...a,active:true,schedule:null},{today:'2026-11-01',uid:'parent'}).root;
  assert.equal(dayView(f.root,f.cid,'2026-11-01').tasks[0].schedule,null);
});
test('fixa protegida e desconto somente quando o dia fecha, com correção posterior',()=>{
 const f=setup('2026-11-01',9000),tid=f.task('Diária');
 f.root=mutateRoot(f.root,'saveChild',{id:f.cid,name:'Lia',fixedAmount:6000,objectiveAmount:9000},{today:'2026-11-01',uid:'parent'}).root;
 const key=checkKey(f.cid,'2026-11-01',tid),checks={[key]:{status:'failed',reviewed:true}};
 const sum=(closures={},today='2026-11-01')=>summary(f.root,f.root.children[f.cid],'2026-11',checks,closures,today);
 assert.equal(sum().balance,15000);assert.equal(sum().deducted,0);
 const closures={[dayKey(f.cid,'2026-11-01')]:{closed:true}};
 assert.equal(sum(closures).balance,14700);assert.equal(sum(closures).fixedAmount,6000);assert.equal(sum({},'2026-11-02').deducted,300);
 checks[key].status='done';assert.equal(sum(closures).balance,15000);
 checks[key].status='pending';assert.equal(sum(closures).balance,15000);
 for(let i=1;i<=30;i++)checks[checkKey(f.cid,`2026-11-${String(i).padStart(2,'0')}`,tid)]={status:'failed'};
 const all=sum({},'2026-12-01');assert.equal(all.balance,6000);assert.equal(all.deducted,9000);
});

test('tarefas sem desconto ficam fora do numerador e da divisão mensal',()=>{
 const f=setup('2026-11-01',9000),a=f.task('Participante'),b=f.task('Sem efeito');
 const args={id:b,childId:f.cid,title:'Sem efeito',weekdays:[0,1,2,3,4,5,6],deductsAllowance:false};
 f.root=mutateRoot(f.root,'saveTask',args,{today:'2026-11-01',uid:'parent'}).root;
 const checks={[checkKey(f.cid,'2026-11-01',a)]:{status:'failed'},[checkKey(f.cid,'2026-11-01',b)]:{status:'failed'}};
 const s=summary(f.root,f.root.children[f.cid],'2026-11',checks,{},'2026-11-02');
 assert.equal(s.occurrences,60);assert.equal(s.deductibleOccurrences,30);assert.equal(s.missed,1);assert.equal(s.deducted,300);assert.equal(s.balance,8700);
 f.root=mutateRoot(f.root,'saveTask',{...args,active:false},{today:'2026-11-01',uid:'parent'}).root;
 assert.equal(f.root.tasks[b].versions.at(-1).deductsAllowance,false);
});

test('opção de desconto é versionada e não muda os dias anteriores',()=>{
 const f=setup('2026-11-01',9000),tid=f.task('Diária');
 f.root=mutateRoot(f.root,'saveTask',{id:tid,childId:f.cid,title:'Diária',weekdays:[0,1,2,3,4,5,6],deductsAllowance:false},{today:'2026-11-02',uid:'parent'}).root;
 assert.equal(dayView(f.root,f.cid,'2026-11-01').tasks[0].deductsAllowance,true);
 assert.equal(dayView(f.root,f.cid,'2026-11-02').tasks[0].deductsAllowance,false);
 assert.throws(()=>mutateRoot(f.root,'saveTask',{childId:f.cid,title:'Inválida',weekdays:[1],deductsAllowance:'false'},{today:'2026-11-02',uid:'parent'}));
});

test('sem tarefas participantes não há desconto mesmo com status não concluído',()=>{
 const f=setup('2026-11-01',9000),tid=f.task('Rotina');
 f.root.tasks[tid].versions[0].deductsAllowance=false;
 const s=summary(f.root,f.root.children[f.cid],'2026-11',{[checkKey(f.cid,'2026-11-01',tid)]:{status:'failed'}},{},'2026-12-01');
 assert.equal(s.deductibleOccurrences,0);assert.equal(s.deducted,0);assert.equal(s.balance,9000);
});

test('mês seguinte começa cheio e alterações de ambos os valores preservam meses anteriores',()=>{
 const f=setup();f.task('Diária');f.root=mutateRoot(f.root,'saveChild',{id:f.cid,name:'Lia',fixedAmount:5000,objectiveAmount:10000},{today:'2026-11-01',uid:'parent'}).root;
 const s=summary(f.root,f.root.children[f.cid],'2026-12',{}, {},'2026-12-01');assert.equal(s.balance,15000);assert.equal(s.deducted,0);
 f.root=mutateRoot(f.root,'saveChild',{id:f.cid,name:'Lia',fixedAmount:7000,objectiveAmount:20000},{today:'2026-12-01',uid:'parent'}).root;
 const old=summary(f.root,f.root.children[f.cid],'2026-11',{}, {},'2026-12-01');assert.equal(old.fixedAmount,5000);assert.equal(old.objectiveAmount,10000);
 assert.equal(summary(f.root,f.root.children[f.cid],'2027-01',{}, {},'2026-12-01').amount,27000);
});

test('cadastros antigos mantêm mesada em objetivos, fixa zero e tarefas participantes',()=>{
 const root=emptyFamily('p'),child={id:'c',name:'Antiga',avatar:0,createdOn:'2026-10-01',allowances:{'2026-10':3100}};root.children.c=child;root.tasks.t={id:'t',childId:'c',versions:[{from:'2026-10-01',title:'Diária',icon:0,active:true,weekdays:[0,1,2,3,4,5,6]}]};
 const s=summary(root,child,'2026-11',{}, {},'2026-11-01');assert.equal(s.fixedAmount,0);assert.equal(s.objectiveAmount,3100);assert.equal(s.balance,3100);assert.equal(s.deductibleOccurrences,30);
});

test('tarefa única aparece apenas na data agendada, inclusive em mês futuro',()=>{
 const f=setup(),save=(onDate,schedule)=>{f.root=mutateRoot(f.root,'saveTask',{childId:f.cid,title:'Consulta',repeat:'once',onDate,schedule},{today:'2026-11-01',uid:'parent'}).root;return Object.keys(f.root.tasks).at(-1);};
 const tid=save('2026-12-08',{type:'range',start:'14:00',end:'16:00'});
 for(const date of ['2026-11-08','2026-12-01','2026-12-09','2026-12-15','2027-12-08'])assert.equal(dayView(f.root,f.cid,date).total,0,date);
 const d=dayView(f.root,f.cid,'2026-12-08');assert.equal(d.total,1);assert.equal(d.tasks[0].id,tid);assert.equal(scheduleLabel(d.tasks[0].schedule),'14:00 às 16:00');
 assert.equal(summary(f.root,f.root.children[f.cid],'2026-11').occurrences,0);assert.equal(summary(f.root,f.root.children[f.cid],'2026-12').occurrences,1);
 const s=snapshot(f.root,{}, {},{childId:f.cid},{today:'2026-11-01',admin:true});assert.equal(s.templates[0].onDate,'2026-12-08');assert.equal(s.templates[0].repeat,'once');
});

test('tarefa única aceita todos os horários atuais e não depende de dias da semana',()=>{
 const f=setup();for(const schedule of [null,{type:'time',time:'08:00'},{type:'range',start:'09:00',end:'10:00'},{type:'period',period:'evening'}]){
  f.root=mutateRoot(f.root,'saveTask',{childId:f.cid,title:'Única',repeat:'once',onDate:'2026-11-02',schedule,weekdays:[]},{today:'2026-11-01',uid:'parent'}).root;
  assert.deepEqual(Object.values(f.root.tasks).at(-1).versions[0].schedule,schedule);
 }
 assert.equal(dayView(f.root,f.cid,'2026-11-02').total,4);assert.equal(dayView(f.root,f.cid,'2026-11-09').total,0);
});

test('datas inválidas, retroativas e dia fechado são rejeitados sem alterar dados',()=>{
 const f=setup(),before=JSON.stringify(f.root),a={childId:f.cid,title:'Única',repeat:'once'};
 for(const onDate of [undefined,'','2026-02-30','2026-13-01','2026-10-31'])assert.throws(()=>mutateRoot(f.root,'saveTask',{...a,onDate},{today:'2026-11-01',uid:'parent'}));
 assert.equal(JSON.stringify(f.root),before);
 const closures={[dayKey(f.cid,'2026-11-01')]:{closed:true}};
 assert.throws(()=>mutateRoot(f.root,'saveTask',{...a,onDate:'2026-11-01'},{today:'2026-11-01',uid:'parent',closures}));
 f.root=mutateRoot(f.root,'saveTask',{...a,onDate:'2026-11-02'},{today:'2026-11-01',uid:'parent',closures}).root;
 assert.equal(dayView(f.root,f.cid,'2026-11-01').total,0);assert.equal(dayView(f.root,f.cid,'2026-11-02').total,1);
 assert.throws(()=>normalizeRecurrence({repeat:'monthly',weekdays:[1]}));
});

test('única participa uma vez do desconto, com não marcada neutra e revisão só na data',()=>{
 const f=setup('2026-11-01',31000),daily=f.task('Diária');
 f.root=mutateRoot(f.root,'saveTask',{childId:f.cid,title:'Única',repeat:'once',onDate:'2026-11-02'},{today:'2026-11-01',uid:'parent'}).root;
 const tid=Object.keys(f.root.tasks).at(-1),checks={[checkKey(f.cid,'2026-11-02',tid)]:{status:'failed'}};
 const s=summary(f.root,f.root.children[f.cid],'2026-11',checks,{},'2026-11-03');assert.equal(s.deductibleOccurrences,31);assert.equal(s.missed,1);assert.equal(s.deducted,1000);
 checks[checkKey(f.cid,'2026-11-02',tid)].status='pending';assert.equal(summary(f.root,f.root.children[f.cid],'2026-11',checks,{},'2026-11-03').deducted,0);
 assert.throws(()=>validateReview(f.root,{childId:f.cid,taskId:tid,date:'2026-11-09'},'2026-11-10'));
 assert.doesNotThrow(()=>validateReview(f.root,{childId:f.cid,taskId:tid,date:'2026-11-02'},'2026-11-10'));
 f.root.tasks[tid].versions[0].deductsAllowance=false;checks[checkKey(f.cid,'2026-11-02',tid)].status='failed';assert.equal(summary(f.root,f.root.children[f.cid],'2026-11',checks,{},'2026-11-03').deducted,0);
 assert.equal(summary(f.root,f.root.children[f.cid],'2026-11',checks,{},'2026-11-03').deductibleOccurrences,30);
});

test('remarcar uma única futura remove a data anterior e pausa preserva seu tipo e horário',()=>{
 const f=setup(),a={childId:f.cid,title:'Dentista',repeat:'once',onDate:'2026-11-05',schedule:{type:'period',period:'afternoon'}};
 f.root=mutateRoot(f.root,'saveTask',a,{today:'2026-11-01',uid:'parent'}).root;const tid=Object.keys(f.root.tasks)[0];
 f.root=mutateRoot(f.root,'saveTask',{...a,id:tid,onDate:'2026-11-06'},{today:'2026-11-02',uid:'parent'}).root;
 assert.equal(dayView(f.root,f.cid,'2026-11-05').total,0);assert.equal(dayView(f.root,f.cid,'2026-11-06').total,1);
 f.root=mutateRoot(f.root,'saveTask',{id:tid,childId:f.cid,title:'Dentista',active:false},{today:'2026-11-02',uid:'parent'}).root;
 const v=f.root.tasks[tid].versions.at(-1);assert.equal(v.repeat,'once');assert.equal(v.onDate,'2026-11-06');assert.equal(scheduleLabel(v.schedule),'Tarde');assert.equal(dayView(f.root,f.cid,'2026-11-06').total,0);
});

test('editar uma única após sua data preserva ocorrência e check anteriores',()=>{
 const f=setup(),a={childId:f.cid,title:'Apresentação',repeat:'once',onDate:'2026-11-02'};
 f.root=mutateRoot(f.root,'saveTask',a,{today:'2026-11-01',uid:'parent'}).root;const tid=Object.keys(f.root.tasks)[0];
 f.root=mutateRoot(f.root,'saveTask',{...a,id:tid,title:'Nova apresentação',onDate:'2026-11-10'},{today:'2026-11-03',uid:'parent'}).root;
 const checks={[checkKey(f.cid,'2026-11-02',tid)]:{status:'done'}};
 assert.equal(dayView(f.root,f.cid,'2026-11-02',checks).tasks[0].title,'Apresentação');assert.equal(dayView(f.root,f.cid,'2026-11-02',checks).done,1);
 assert.equal(dayView(f.root,f.cid,'2026-11-10').tasks[0].title,'Nova apresentação');assert.equal(summary(f.root,f.root.children[f.cid],'2026-11',checks).occurrences,2);
});

test('criança consulta calendário de meses anteriores sem receber funções administrativas',()=>{
 const f=setup(),tid=f.task('Diária'),checks={[checkKey(f.cid,'2026-11-02',tid)]:{status:'done'}};
 const s=snapshot(f.root,checks,{}, {childId:f.cid,date:'2026-11-02',month:'2026-11'},{today:'2026-12-05',admin:false});
 assert.equal(s.calendar.length,30);assert.equal(s.day.date,'2026-11-02');assert.equal(s.day.closed,true);assert.equal(s.day.tasks[0].status,'done');assert.equal(s.calendar[1].done,1);
 assert.equal('templates'in s,false);assert.equal('audit'in s,false);assert.equal(s.authenticated,false);
});
