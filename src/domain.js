export const SCHEMA=2;
export const clone=value=>structuredClone(value);
export const id=()=>crypto.randomUUID();
export function todayISO(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;
}
export const dayNumber=date=>Math.floor(Date.parse(date+'T12:00:00Z')/86400000);
export function addDays(date,n){return new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
export function validDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Data inválida.');return date;}
export function monthDates(month){if(!/^\d{4}-\d{2}$/.test(month)||+month.slice(5)<1||+month.slice(5)>12)throw Error('Mês inválido.');const first=month+'-01';const out=[];for(let date=first;date.slice(0,7)===month;date=addDays(date,1))out.push(date);return out;}
export const dayKey=(childId,date)=>`${childId}|${date}`;
export const checkKey=(childId,date,taskId)=>`${childId}|${date}|${taskId}`;
export function emptyFamily(ownerUid){return {schema:SCHEMA,ownerUid,children:{},tasks:{},guardians:{},bath:null,audit:[],createdOn:todayISO()};}
export function allowance(child,month){const keys=Object.keys(child.allowances).filter(k=>k<=month).sort();return keys.length?child.allowances[keys.at(-1)]:0;}
export function version(task,date){return task.versions.filter(v=>v.from<=date).at(-1)||null;}
export const TASK_PERIODS={morning:'Manhã',afternoon:'Tarde',evening:'Noite',overnight:'Madrugada'};
export function normalizeSchedule(value){
  if(value==null)return null;
  if(typeof value!=='object'||Array.isArray(value))throw Error('Horário da tarefa inválido.');
  const time=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if(value.type==='time'&&time(value.time))return {type:'time',time:value.time};
  if(value.type==='range'&&time(value.start)&&time(value.end)){
    if(value.end<=value.start)throw Error('A hora final deve ser posterior à hora inicial.');
    return {type:'range',start:value.start,end:value.end};
  }
  if(value.type==='period'&&Object.hasOwn(TASK_PERIODS,value.period))return {type:'period',period:value.period};
  throw Error('Preencha um horário válido ou escolha um período do dia.');
}
export function scheduleLabel(value){
  const s=normalizeSchedule(value);
  if(!s)return '';
  if(s.type==='time')return s.time;
  if(s.type==='range')return `${s.start} às ${s.end}`;
  return TASK_PERIODS[s.period];
}
export function occurrences(root,cid,date){
  const child=root.children[cid];if(!child||date<child.createdOn)return [];
  const weekday=new Date(date+'T12:00:00Z').getUTCDay();
  return Object.values(root.tasks).filter(t=>t.childId===cid).flatMap(t=>{const v=version(t,date);return v?.active&&v.weekdays.includes(weekday)?[{...v,id:t.id}]:[];});
}
export function closed(cid,date,closures,today){return date<today||Boolean(closures[dayKey(cid,date)]?.closed);}
export function dayView(root,cid,date,checks={},closures={},today=todayISO()){
  validDate(date);const isClosed=closed(cid,date,closures,today);
  const tasks=occurrences(root,cid,date).map(t=>{const c=checks[checkKey(cid,date,t.id)];let status=c?.status||'pending';if(isClosed&&status==='pending')status='failed';return {id:t.id,title:t.title,icon:t.icon,schedule:t.schedule||null,status,reviewed:Boolean(c?.reviewed)};});
  return {date,closed:isClosed,closureSource:closures[dayKey(cid,date)]?.closed?'guardian':isClosed?'automatic':'open',tasks,total:tasks.length,done:tasks.filter(t=>t.status==='done').length,failed:tasks.filter(t=>t.status==='failed').length};
}
export function summary(root,child,month,checks={},closures={},today=todayISO()){
  let total=0,missed=0,completed=0;
  for(const date of monthDates(month)){const d=dayView(root,child.id,date,checks,closures,today);total+=d.total;if(d.closed){missed+=d.total-d.done;completed+=d.done;}}
  const amount=allowance(child,month),deducted=total?Math.min(amount,Math.round(amount*missed/total)):0;
  return {...child,allowances:undefined,amount,deducted,balance:amount-deducted,occurrences:total,missed,completed};
}
export function bathChild(root,date){
  const b=root.bath;if(!b?.participants?.length||!b.startDate)return null;
  const index=b.participants.indexOf(b.startChildId);if(index<0)return null;
  const offset=dayNumber(date)-dayNumber(b.startDate);const i=((index+offset)%b.participants.length+b.participants.length)%b.participants.length;
  return root.children[b.participants[i]]||null;
}
export function snapshot(root,checks,closures,args={},context={}){
  const today=context.today||todayISO(),date=args.date||today,month=args.month||date.slice(0,7);validDate(date);monthDates(month);
  const children=Object.values(root.children).map(c=>summary(root,c,month,checks,closures,today));
  const child=children.find(c=>c.id===args.childId)||children[0];
  const guardians=Object.values(root.guardians).map(g=>({id:g.id,name:g.name}));
  const result={today,date,month,children,guardians,authenticated:Boolean(context.admin),actor:context.admin?context.uid:'',setup:false,paired:true,familyId:context.familyId,online:context.online!==false,bath:root.bath,bathToday:bathChild(root,today),bathUpcoming:Array.from({length:7},(_,i)=>({date:addDays(today,i),child:bathChild(root,addDays(today,i))}))};
  if(child){result.child=child;result.day=dayView(root,child.id,date,checks,closures,today);}
  if(context.admin){result.calendar=child?monthDates(month).map(d=>dayView(root,child.id,d,checks,closures,today)):[];result.templates=child?Object.values(root.tasks).filter(t=>t.childId===child.id).map(t=>({...version(t,addDays(today,1)),id:t.id})).filter(t=>t.from):[];result.audit=root.audit||[];}
  return result;
}
export function record(root,message,uid,at=new Date().toISOString()){root.audit=[...(root.audit||[]),{message,actor:uid,at}].slice(-500);}
function text(value,max=40){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error(`Preencha o nome com até ${max} caracteres.`);return value.trim();}
export function mutateRoot(source,op,a,{today=todayISO(),uid,closures={}}={}){
  const root=clone(source);let message='',selectedChildId=a.childId;
  switch(op){
    case 'saveChild':{
      const cid=a.id||id();if(a.id&&!root.children[cid])throw Error('Criança não encontrada.');
      if(!Number.isSafeInteger(a.amount)||a.amount<0||a.amount>100000000)throw Error('Informe uma mesada entre R$ 0 e R$ 1.000.000.');
      const c=root.children[cid]||{id:cid,createdOn:today,allowances:{}};
      c.name=text(a.name);c.avatar=((Number(a.avatar)||0)%8+8)%8;c.allowances[today.slice(0,7)]=a.amount;root.children[cid]=c;selectedChildId=cid;
      message='Criança salva. A mesada vale para este mês e os próximos.';record(root,'Cadastro e mesada de '+c.name,uid);break;
    }
    case 'saveTask':{
      if(!root.children[a.childId])throw Error('Criança não encontrada.');
      const days=a.weekdays;if(!Array.isArray(days)||!days.length||days.length>7||new Set(days).size!==days.length||days.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Escolha pelo menos um dia da semana.');
      const tid=a.id||id(),task=root.tasks[tid]||{id:tid,childId:a.childId,versions:[]};
      if(a.id&&!root.tasks[tid]||task.childId!==a.childId)throw Error('Tarefa não encontrada.');
      const from=closed(a.childId,today,closures,today)?addDays(today,1):today;
      const schedule=normalizeSchedule(a.schedule===undefined?version(task,from)?.schedule:a.schedule);
      task.versions=task.versions.filter(v=>v.from<from);
      task.versions.push({from,fromDay:dayNumber(from),title:text(a.title,100),weekdays:[...days].sort(),icon:((Number(a.icon)||0)%8+8)%8,active:a.active!==false,schedule});root.tasks[tid]=task;
      message=`Agenda salva a partir de ${from===today?'hoje':'amanhã, pois hoje já está fechado'}.`;record(root,'Alteração na agenda de '+root.children[a.childId].name,uid);break;
    }
    case 'saveBath':{
      const participants=a.participants;
      if(!Array.isArray(participants)||participants.length<2||new Set(participants).size!==participants.length||participants.some(cid=>!root.children[cid]))throw Error('Escolha pelo menos duas crianças para a fila.');
      validDate(a.startDate);if(!participants.includes(a.startChildId))throw Error('Escolha quem começa a fila.');
      root.bath={participants:[...participants],startDate:a.startDate,startChildId:a.startChildId};record(root,'Configuração da fila do banho',uid);message='Fila do banho salva e compartilhada.';break;
    }
    case 'deleteGuardian':{
      if(a.id===uid||Object.keys(root.guardians).length<2)throw Error('Você não pode remover seu próprio acesso nem o último responsável.');
      if(!root.guardians[a.id])throw Error('Responsável não encontrado.');delete root.guardians[a.id];record(root,'Remoção de responsável',uid);message='Responsável removido.';break;
    }
    default:throw Error('Ação desconhecida.');
  }
  return {root,message,selectedChildId};
}
export function validateReview(root,a,today=todayISO()){
  validDate(a.date);if(a.date>today)throw Error('Não é possível avaliar dias futuros.');
  if(!root.children[a.childId]||a.date<root.children[a.childId].createdOn)throw Error('Data anterior ao cadastro da criança.');
  if(a.taskId&&!occurrences(root,a.childId,a.date).some(t=>t.id===a.taskId))throw Error('Tarefa fora da agenda.');
  if(a.status&&!['pending','failed','done'].includes(a.status))throw Error('Status inválido.');
}
export function convertLegacy(data,existing,today=todayISO()){
  if(data.schema!==1||!Array.isArray(data.children)||!Array.isArray(data.tasks)||!data.days)throw Error('Backup offline incompatível.');
  const root=clone(existing);root.children={};root.tasks={};
  for(const c of data.children){validDate(c.createdOn);if(!c.id||c.createdOn>today||!c.allowances)throw Error('Backup inválido.');text(c.name);for(const [m,v]of Object.entries(c.allowances)){monthDates(m);if(!Number.isSafeInteger(v)||v<0||v>100000000)throw Error('Mesada inválida no backup.');}root.children[c.id]={id:c.id,name:c.name,avatar:c.avatar,createdOn:c.createdOn,allowances:c.allowances};}
  for(const t of data.tasks){if(!root.children[t.childId]||!t.id||!Array.isArray(t.versions)||!t.versions.length)throw Error('Agenda inválida no backup.');root.tasks[t.id]={...t,versions:t.versions.map(v=>{validDate(v.from);text(v.title,100);if(!Array.isArray(v.weekdays)||!v.weekdays.length||v.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Dias inválidos no backup.');return {...v,fromDay:dayNumber(v.from)};})};}
  const checks={},closures={};
  for(const [key,d]of Object.entries(data.days)){const sep=key.lastIndexOf('|'),cid=key.slice(0,sep),date=key.slice(sep+1);validDate(date);if(!root.children[cid]||date>today)throw Error('Dia inválido no backup.');if(d.closed)closures[key]={childId:cid,date,closed:true};for(const[tid,c]of Object.entries(d.checks||{})){if(!root.tasks[tid]||!['pending','failed','done'].includes(c.status))throw Error('Marcação inválida no backup.');checks[checkKey(cid,date,tid)]={childId:cid,date,taskId:tid,status:c.status,reviewed:Boolean(c.reviewed)};}}
  root.bath=null;return {root,checks,closures};
}
