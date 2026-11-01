'use strict';
import {Cloud} from './cloud.js';
const cloud = new Cloud();
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const animals = ['🐻','🐰','🦊','🐼','🐨','🐯','🐸','🐱'];
const taskIcons = ['🛏️','🪥','📚','🧸','🍽️','🎒','🧹','🌱'];
const weekdays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const paths = {
 bath:'M8 3h4a4 4 0 0 1 4 4v2M13 9h6M12 13v1M16 13v1M20 13v1M11 18v1M16 18v1M21 18v1',
 devices:'M3 4h18v12H3zM8 21h8M12 16v5',
 home:'M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
 check:'M5 12l4 4L19 6', tasks:'M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1',
 lock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4',
 unlock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 7-2',
 calendar:'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
 arrow:'M5 12h14M14 7l5 5-5 5', plus:'M12 5v14M5 12h14',
 info:'M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 close:'M6 6l12 12M18 6L6 18', edit:'M15 4l5 5M3 21l5-1L21 7l-5-5L3 15z',
 users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M20 8v6M17 11h6',
 shield:'M12 3l8 3v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6',
 logout:'M9 5H4v14h5M10 12h11M17 8l4 4-4 4',
 download:'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',
 upload:'M12 16V4M7 9l5-5 5 5M4 16v5h16v-5',
 history:'M3 3v6h6M3 9a9 9 0 1 1 0 7M12 7v5l3 2',
 trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
 coin:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M15 8H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H9M12 6v12'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.check}"/></svg>`;
let state, token='', view='home', childId='', date='', month='', busy=false, lastInteraction=Date.now();
let toastTimer, requestSequence=0;
function toast(message) { if(!message)return; const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),4500); }
async function transport(payload) { return cloud.request(payload); }
async function call(op='get',args={},options={}) {
  const sequence=++requestSequence;
  const response=await transport({op,token,childId,date:date||undefined,month:month||undefined,activity:options.activity!==false,...args});
  if(!response.ok)throw Error(response.error);
  if(response.token) token=response.token;
  if(response.state && sequence===requestSequence) {
    state=response.state;
    if(!state.authenticated && token) { token='';view='home';date=state.today;month=state.today.slice(0,7); }
    childId=state.child?.id || ''; date=state.date;month=state.month;
    if(options.render!==false)render();
  }
  if(options.toast!==false)toast(response.message);
  return response;
}
const btn = (label,action,ic='',kind='',extra='') => `<button type="button" class="button ${kind}" data-action="${action}" ${extra}>${ic?icon(ic):''}${label}</button>`;
function childTabs() { return `<div class="child-tabs" role="group" aria-label="Escolher criança">${state.children.map(c=>`<button class="chip ${c.id===childId?'active':''}" data-action="select-child" data-id="${c.id}" aria-pressed="${c.id===childId}"><span>${animals[c.avatar]}</span>${esc(c.name)}</button>`).join('')}</div>`; }
function header(title,subtitle,action='') { return `<div class="heading"><div><h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div>${action}</div>`; }
function navItem(label,ic,key) { return `<button class="nav-item ${view===key?'active':''}" data-action="nav" data-view="${key}" aria-label="${label}" title="${label}" ${key==='daily'&&!childId?'disabled':''}>${icon(ic)}<span class="nav-label">${label}</span></button>`; }
function render() {
  const admin=state.authenticated;
  if(!admin && !['home','daily','bath'].includes(view)) view='home';
  const content=({home:home,daily:daily,children:children,tasks:tasks,review:review,guardians:guardians,backup:backup,bath:bath,devices:devices}[view]||home)();
  $('#app').innerHTML=`<div class="shell"><aside class="sidebar" aria-label="Navegação da família"><div class="brand"><span class="brand-mark" aria-hidden="true"></span><div class="brand-text"><div class="brand-name">passinho</div><div class="brand-sub">A rotina da família</div></div></div><nav class="nav" aria-label="Navegação principal">${navItem('Início','home','home')}${navItem('Banho da vez','bath','bath')}${admin?navItem('Validar o dia','check','review')+navItem('Crianças','users','children')+navItem('Tarefas','tasks','tasks')+navItem('Responsáveis','shield','guardians')+navItem('Backup','download','backup')+navItem('Aparelhos','devices','devices'):navItem('Minhas tarefas','tasks','daily')}</nav><div class="sidebar-bottom"><div class="sidebar-tip"><strong>Um passo de cada vez.</strong>Pequenas tarefas, grandes conquistas.</div><button class="nav-item" data-action="${admin?'logout':'login'}" aria-label="${admin?'Bloquear área dos responsáveis':'Área dos responsáveis'}" title="${admin?'Bloquear área dos responsáveis':'Área dos responsáveis'}">${icon(admin?'logout':'lock')}<span class="nav-label">${admin?'Bloquear acesso':'Responsáveis'}</span></button></div></aside><main class="main"><div class="topbar"><div class="date">${icon('calendar')}${new Date(state.today+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</div><div class="mode"><span class="mode-dot"></span>${admin?'Área dos responsáveis':'Espaço das crianças'}</div></div>${state.online===false?'<div class="notice warning">Sem conexão. Exibindo os dados já carregados. Conecte à internet para salvar alterações.</div>':''}${content}</main></div>`;
  // Progress is visual and uses no inline style, keeping the document CSP strict.
  document.querySelectorAll('[data-progress]').forEach(el=>el.style.width=el.dataset.progress+'%');
}
function home() {
  const title=state.children.length?'Quem vai dar o próximo passo?':'A rotina começa por aqui.';
  let html=header(title,state.children.length?'Escolha seu nome para ver as tarefas de hoje.':'Um lugar para cuidar das tarefas e acompanhar a mesada.',btn('Como funciona','help','info','secondary'));
  if(!state.children.length) return html+`<div class="empty"><div class="welcome-art" aria-hidden="true"><span>🐻</span><span>✓</span></div><h2>Vamos preparar a família?</h2><p>Um responsável cadastra as crianças, combina as tarefas e define a mesada. Depois, cada criança entra pelo próprio nome.</p>${btn(state.setup?'Criar minha família':state.authenticated?'Cadastrar criança':'Entrar como responsável',state.setup?'setup':state.authenticated?'add-child':'login','plus')}${state.paired===false?btn('Conectar a uma família existente','pair','devices','secondary'):state.authenticated?btn('Importar Banho da Vez','import-bath','bath','secondary'):''}</div>`;
  html+=`<div class="section-head"><h2>Nossa turma</h2><span class="small muted">${new Date(state.today+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</span></div><div class="family-grid">`;
  state.children.forEach(c=>{
    html+=`<article class="child-card"><div class="child-card-header"><span class="avatar" aria-hidden="true">${animals[c.avatar]}</span><div><h2>${esc(c.name)}</h2><p class="small muted">Seu próximo passo está aqui</p></div></div><div class="child-card-body"><div class="money-label">Sua mesada até agora</div><div class="money-row"><div class="money">${money(c.balance)}</div><span class="deduction ${c.deducted?'':'zero'}">${c.deducted?'- '+money(c.deducted):'Sem descontos'}</span></div><div class="ledger-line muted small"><span>Mesada do mês</span><strong>${money(c.amount)}</strong></div>${btn('Ver minhas tarefas','open-child','arrow','',`data-id="${c.id}"`)}</div></article>`;
  });
  return html+`</div>${state.bathToday?`<button type="button" class="bath-banner" data-action="nav" data-view="bath"><span class="bath-drop">${icon('bath')}</span><span><small>Banho da vez · hoje</small><strong>${esc(state.bathToday.name)}</strong></span><span class="bath-banner-link">Ver os próximos dias ${icon('arrow')}</span></button>`:''}<div class="home-note">${icon('info')}<p><strong>Seu esforço conta, todos os dias.</strong> O saldo já considera as tarefas não feitas nos dias fechados. As tarefas de hoje ainda podem ser marcadas.</p></div>`;
}
function allowance(c) {
  return `<section class="panel allowance"><div class="eyebrow">${new Date(state.month+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long'})} · Mesada</div><div class="money-label allowance-label">Você tem até agora</div><div class="money">${money(c.balance)}</div><hr><div class="ledger-line"><span>Mesada do mês</span><strong>${money(c.amount)}</strong></div><div class="ledger-line"><span>Descontos acumulados</span><strong>− ${money(c.deducted)}</strong></div><p class="small muted">${c.missed} ${c.missed===1?'tarefa não feita':'tarefas não feitas'} em dias fechados.</p><button class="text-link" data-action="help">${icon('info')}Como a mesada é calculada?</button></section>`;
}
function daily() {
  if(!state.child)return home();
  const c=state.child,d=state.day;
  const percent=d.total?Math.round(d.done/d.total*100):0;
  const all=d.total>0&&d.done===d.total;
  return header(`Vamos lá, ${esc(c.name)}!`,d.closed?'O dia foi fechado. Você pode conferir suas tarefas.':'Fez uma tarefa? Toque nela para marcar seu check.')+childTabs()+`<div class="task-layout"><section><div class="section-head"><h2>Meus passos de hoje</h2><span class="small muted">${d.done} de ${d.total}</span></div><div class="daily-progress"><div class="progress" role="progressbar" aria-label="Tarefas concluídas" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" data-progress="${percent}"></div></div><span>${percent}%</span></div>${d.closed?'<div class="notice">Dia fechado pelo responsável. Para mudar uma marcação, peça ajuda a ele.</div>':''}<div class="task-list">${d.tasks.length?d.tasks.map(t=>`<button class="task-card ${t.status}" data-action="child-check" data-id="${t.id}" data-done="${t.status!=='done'}" aria-pressed="${t.status==='done'}" ${d.closed||t.reviewed?'disabled':''}><span class="task-icon" aria-hidden="true">${taskIcons[t.icon]}</span><span class="task-text"><strong>${esc(t.title)}</strong><small>${t.status==='done'?'Concluída'+(t.reviewed?' · validada pelo responsável':' · você conseguiu!'):t.status==='failed'?'Não concluída · avaliada pelo responsável':'Não marcada · toque quando terminar'}</small></span><span class="check-box" aria-hidden="true">${t.status==='done'?icon('check'):t.status==='failed'?icon('close'):''}</span></button>`).join(''):`<div class="no-tasks"><span aria-hidden="true">🌤️</span><strong>Sem tarefas para hoje.</strong><p>Seu responsável pode combinar novos passos com você.</p></div>`}</div><div class="celebrate"><span aria-hidden="true">${all?'🌟':'🌱'}</span><div><strong>${all?'Todos os passos de hoje completos!':'Cada check é uma conquista.'}</strong><p>${all?'As tarefas ficam disponíveis para a avaliação do responsável.':'Marque só depois de terminar. Você pode fazer no seu ritmo.'}</p></div></div></section><aside aria-label="Resumo da mesada">${allowance(c)}<p class="read-only">O dia fecha à meia-noite no horário de Brasília. Um responsável também pode fechar antes.</p></aside></div>`;
}
function children() {
  return header('As crianças da casa','Perfis, avatares e o valor mensal combinado.',btn('Cadastrar criança','add-child','plus'))+`<div class="row-list">${state.children.length?state.children.map(c=>`<article class="data-row"><span class="avatar" aria-hidden="true">${animals[c.avatar]}</span><div class="task-text"><strong>${esc(c.name)}</strong><p>Mesada: ${money(c.amount)} por mês</p></div>${btn('Editar','edit-child','edit','secondary',`data-id="${c.id}"`)}</article>`).join(''):'<div class="empty"><h2>A turma ainda está vazia</h2><p>Cadastre a primeira criança para começar.</p></div>'}</div><div class="home-note">${icon('coin')}<p>Ao editar a mesada, o novo valor passa a valer para <strong>o mês atual e os próximos</strong>. O saldo deste mês é recalculado; os meses anteriores mantêm seu valor.</p></div>`;
}
function tasks() {
  if(!state.child)return header('Tarefas da família','Primeiro, cadastre uma criança.',btn('Cadastrar criança','add-child','plus'));
  return header('Pequenos passos, todo dia.','Escolha as tarefas e os dias da semana de cada criança.',btn('Nova tarefa','add-task','plus'))+childTabs()+`<div class="row-list">${state.templates.length?state.templates.map(t=>`<article class="data-row"><span class="task-icon" aria-hidden="true">${taskIcons[t.icon]}</span><div class="task-text"><strong>${esc(t.title)}</strong><p>${t.weekdays.map(d=>weekdays[d]).join(' · ')}</p><span class="pill ${t.active?'':'inactive'}">${t.active?'Ativa':'Pausada'}${t.from>state.today?' · a partir de amanhã':''}</span></div><div class="row-actions"><button class="icon-btn" aria-label="Editar ${esc(t.title)}" data-action="edit-task" data-id="${t.id}">${icon('edit')}</button><button class="icon-btn" aria-label="${t.active?'Pausar':'Reativar'} ${esc(t.title)}" data-action="toggle-task" data-id="${t.id}">${icon(t.active?'close':'plus')}</button></div></article>`).join(''):'<div class="empty"><h2>Qual vai ser o primeiro passo?</h2><p>Adicione uma tarefa e marque em quais dias ela deve aparecer.</p></div>'}</div><div class="home-note">${icon('history')}<p>As mudanças valem a partir de hoje, ou de amanhã se hoje já estiver fechado. O histórico anterior é preservado. <strong>A quantidade de tarefas do mês e os descontos são recalculados com a agenda.</strong></p></div>`;
}
function calendar() {
  const first=new Date(state.month+'-01T12:00:00').getDay();
  return `<section class="panel"><div class="section-head"><h3>Histórico do mês</h3>${icon('calendar')}</div><div class="field"><label for="history-month">Mês</label><input id="history-month" type="month" value="${state.month}" max="${state.today.slice(0,7)}" min="${state.child.createdOn.slice(0,7)}"></div><div class="calendar">${weekdays.map(d=>`<div class="cal-label">${d.slice(0,1)}</div>`).join('')}${Array.from({length:first},()=>'<span></span>').join('')}${state.calendar.map(d=>`<button class="cal-day ${d.date===date?'selected':''} ${d.date===state.today?'today':''} ${d.closed&&d.total?(d.failed?'failed':'done'):''}" data-action="select-date" data-date="${d.date}" ${d.date>state.today||d.date<state.child.createdOn?'disabled':''} aria-label="${d.date.split('-').reverse().join('/')} · ${d.total} tarefas${d.closed?', dia fechado':''}">${Number(d.date.slice(-2))}</button>`).join('')}</div><div class="calendar-legend"><span><i class="dot"></i>Concluídas</span><span><i class="dot red"></i>Com pendências</span></div></section>`;
}
function review() {
  if(!state.child)return header('Validar o dia','Cadastre uma criança para começar.',btn('Cadastrar criança','add-child','plus'));
  const d=state.day;
  return header('Um olhar sobre o dia.','Avalie as tarefas, feche o dia ou corrija marcações anteriores.')+childTabs()+`<div class="admin-toolbar"><div class="field"><label for="review-date">Dia da avaliação</label><input id="review-date" type="date" value="${date}" max="${state.today}" min="${state.child.createdOn}"></div>${btn('Voltar para hoje','today','calendar','secondary')}${d.closed?'<span class="chip">'+icon('lock')+'Dia fechado</span>':btn('Validar e fechar o dia','close-day','check')}</div><div class="task-layout"><section><div class="notice ${d.closed?'':'warning'}">${d.closed?(d.closureSource==='automatic'?'Fechado automaticamente. Os checks da criança foram mantidos.':'Dia validado e fechado pelo responsável.')+' Você pode corrigir os status abaixo; o saldo será atualizado.':'O dia está aberto. Marcar “não concluída” bloqueia alterações pela criança. O desconto entra no saldo quando o dia fecha.'}</div><div class="panel"><div class="section-head"><h2>${esc(state.child.name)} · ${d.done}/${d.total} feitas</h2></div>${d.tasks.length?d.tasks.map(t=>`<div class="admin-task"><span class="task-icon" aria-hidden="true">${taskIcons[t.icon]}</span><div class="task-text"><strong>${esc(t.title)}</strong><small>${t.reviewed?'Avaliada por responsável':t.status==='done'?'Check da criança':d.closed?'Fechamento automático':'Aguardando marcação'}</small></div><div class="status-group" role="group" aria-label="Status de ${esc(t.title)}">${[['pending','Não marcada'],['failed','Não concluída'],['done','Concluída']].map(([key,label])=>`<button class="status-button ${key} ${key===t.status?'selected':''}" aria-pressed="${key===t.status}" data-action="review-task" data-id="${t.id}" data-status="${key}" ${d.closed&&key==='pending'?'disabled':''}>${label}</button>`).join('')}</div></div>`).join(''):'<p class="muted">Nenhuma tarefa agendada para esse dia.</p>'}</div><div class="panel spaced-panel">${allowanceDetails(state.child)}</div></section><aside aria-label="Histórico das tarefas">${calendar()}</aside></div>`;
}
function allowanceDetails(c) { return `<h3>Mesada em ${new Date(month+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long'})}</h3><div class="ledger-line"><span>Mesada do mês</span><strong>${money(c.amount)}</strong></div><div class="ledger-line"><span>Descontos (${c.missed} de ${c.occurrences} ocorrências)</span><strong>− ${money(c.deducted)}</strong></div><div class="ledger-line"><strong>Saldo atual</strong><strong>${money(c.balance)}</strong></div><button class="text-link" data-action="help">Entender o cálculo</button>`; }
function guardians() {
  return header('Quem cuida da rotina.','Cada responsável tem seu próprio nome e senha.',btn('Novo responsável','add-guardian','plus'))+`<div class="row-list">${state.guardians.map(g=>`<article class="data-row"><span class="task-icon">${icon('shield')}</span><div class="task-text"><strong>${esc(g.name)}</strong><p>${g.id===state.actor?'Seu acesso atual':'Acesso com senha'}</p></div><div class="row-actions"><button class="icon-btn" aria-label="Editar ${esc(g.name)}" data-action="edit-guardian" data-id="${g.id}">${icon('edit')}</button>${g.id!==state.actor?`<button class="icon-btn" aria-label="Remover ${esc(g.name)}" data-action="delete-guardian" data-id="${g.id}">${icon('trash')}</button>`:''}</div></article>`).join('')}</div><div class="home-note">${icon('lock')}<p>A área protegida bloqueia ao sair do aplicativo ou depois de 5 minutos sem atividade. <strong>Guarde sua senha.</strong> Cada responsável pode alterar a própria senha. Mantenha um segundo responsável para recuperar o acesso à família.</p></div>`;
}
function backup() {
  return header('Uma cópia para guardar.','O histórico é compartilhado entre os aparelhos. Você também pode guardar uma cópia.')+`<section class="panel"><h2>Backup da família</h2><p class="muted spaced-copy">O arquivo inclui crianças, agendas, marcações, mesadas e a fila do banho. Os acessos dos responsáveis ficam no Firebase e são preservados ao restaurar. Guarde a cópia em um local privado.</p><div class="backup-actions">${btn('Salvar backup','export','download')}${btn('Restaurar backup','import','upload','secondary')}</div><input class="file-picker" type="file" id="import-file" accept="application/json,.json" aria-label="Escolher backup"></section><section class="panel spaced-panel"><div class="section-head"><h2>Últimas alterações</h2>${icon('history')}</div>${state.audit.length?state.audit.slice(-20).reverse().map(a=>`<div class="log-row">${esc(a.message)}<small>${new Date(a.at).toLocaleString('pt-BR')} · ${esc(state.guardians.find(g=>g.id===a.actor)?.name||'Responsável')}</small></div>`).join(''):'<p class="muted">As alterações dos responsáveis aparecerão aqui.</p>'}</section>`;
}
function bath() {
  const current=state.bathToday;
  const actions=state.authenticated?btn(state.bath?'Configurar fila':'Criar fila','edit-bath','edit'):'';
  let html=header('De quem é a vez do banho?','A fila se reveza automaticamente, um dia de cada vez.',actions);
  if(!current)return html+`<div class="empty"><div class="bath-empty" aria-hidden="true">🚿</div><h2>Vamos combinar a fila?</h2><p>Um responsável escolhe as crianças que participam, a data inicial e quem começa.</p>${state.authenticated?btn('Configurar fila','edit-bath','plus')+btn('Importar do Banho da Vez','import-bath','download','secondary'):btn('Entrar como responsável','login','lock')}</div>`;
  html+=`<div class="bath-layout"><section class="bath-today"><span class="eyebrow">Hoje · ${new Date(state.today+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long'})}</span><div class="bath-bubbles" aria-hidden="true">${icon('bath')}</div><span class="avatar big" aria-hidden="true">${animals[current.avatar]}</span><p>A vez do banho é de</p><h2>${esc(current.name)}</h2><span class="bath-promise">Amanhã, a fila dá o próximo passo.</span></section><section class="panel"><div class="section-head"><h2>Próximos dias</h2>${icon('calendar')}</div><div class="bath-queue">${state.bathUpcoming.map((d,i)=>`<div class="bath-row ${i===0?'today':''}"><span class="bath-small-avatar" aria-hidden="true">${animals[d.child?.avatar||0]}</span><strong>${esc(d.child?.name||'—')}</strong><span>${i===0?'Hoje':i===1?'Amanhã':new Date(d.date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'})}<small>${d.date.slice(8)}/${d.date.slice(5,7)}</small></span></div>`).join('')}</div></section></div>${state.authenticated?`<div class="backup-actions">${btn('Reiniciar fila a partir de hoje','restart-bath','history','secondary')}</div>`:''}`;
  return html;
}
function devices() {
  return header('A mesma família, em todo lugar.','Conecte o tablet e o navegador para compartilhar tarefas, mesada e a fila do banho.')+`<section class="panel"><div class="section-head"><h2>Conectar outro aparelho</h2>${icon('devices')}</div><p class="muted">No outro aparelho, abra o Passinho e escolha “Conectar a uma família existente”. Informe o código desta família uma única vez. Depois, as crianças entram pelo nome, sem senha.</p><div class="backup-actions">${btn('Mostrar código de conexão','show-pairing','devices')}</div><p class="small muted spaced-copy">O código permite consultar a família e marcar tarefas como criança. Compartilhe somente com os aparelhos da casa. A área dos responsáveis continua exigindo senha.</p></section><div class="home-note">${icon('info')}<p>Cadastros, marcações e avaliações são sincronizados pelo Firebase. Conecte à internet para salvar alterações. O app pode consultar os dados já carregados enquanto estiver sem conexão.</p></div>`;
}
function pairDialog() {
  openModal('Conectar a sua família',formShell(`<p class="muted small">Em um aparelho já configurado, um responsável encontra o código em <strong>Aparelhos → Mostrar código de conexão</strong>.</p><div class="field"><label for="pair-code">Código da família</label><input id="pair-code" name="code" required minlength="48" maxlength="48" autocomplete="off" spellcheck="false" autocapitalize="none"><small>Você precisa conectar este aparelho apenas uma vez.</small></div>`,'Conectar aparelho'),()=>bindForm(async f=>{await call('pair',{code:f.get('code')});view='home';render();}));
}
async function showPairing() {
  const r=await call('pairing',{}, {render:false});
  openModal('Conectar outro aparelho',`<p class="muted">Copie este código no outro aparelho. Ele dá acesso ao espaço das crianças da família.</p><div class="field spaced-copy"><label for="family-pairing">Código da família</label><input id="family-pairing" readonly value="${r.pairingCode}" spellcheck="false"></div><div class="dialog-actions">${btn('Fechar','close-modal','','secondary')}${btn('Copiar código','copy-pairing','devices')}</div>`);
}
function editBath(restart=false) {
  if(state.children.length<2){toast('Cadastre pelo menos duas crianças para criar a fila do banho.');return;}
  const previous=state.bath;
  let order=[...(previous?.participants||[]),...state.children.map(c=>c.id).filter(cid=>!previous?.participants.includes(cid))];
  const selected=new Set(previous?.participants||order);
  let starter=restart?(state.bathToday?.id||order[0]):previous?.startChildId||order[0];
  openModal(restart?'Reiniciar a fila do banho':'Configurar a fila do banho',formShell(`<div class="field"><span>Participantes e ordem da fila</span><div id="bath-participants" class="bath-participants"></div><small>Marque pelo menos duas crianças. Use as setas para ajustar a ordem.</small></div><div class="form-grid"><div class="field"><label for="bath-start">Data inicial</label><input id="bath-start" name="startDate" type="date" required value="${restart?state.today:previous?.startDate||state.today}"></div><div class="field"><label for="bath-first">Quem começa nessa data?</label><select id="bath-first" name="startChildId" required></select></div></div>`,'Salvar fila'),()=>{
    const paint=()=>{
      $('#bath-participants').innerHTML=order.map((cid,i)=>{const c=state.children.find(c=>c.id===cid);return `<div class="bath-participant"><label><input type="checkbox" name="participants" value="${cid}" ${selected.has(cid)?'checked':''}><span aria-hidden="true">${animals[c.avatar]}</span>${esc(c.name)}</label><button type="button" class="icon-btn" data-bath-move="-1" data-cid="${cid}" aria-label="Mover ${esc(c.name)} para cima" ${i===0?'disabled':''}>↑</button><button type="button" class="icon-btn" data-bath-move="1" data-cid="${cid}" aria-label="Mover ${esc(c.name)} para baixo" ${i===order.length-1?'disabled':''}>↓</button></div>`;}).join('');
      const starters=()=>{if(!selected.has(starter))starter=order.find(cid=>selected.has(cid));$('#bath-first').innerHTML=order.filter(cid=>selected.has(cid)).map(cid=>`<option value="${cid}" ${cid===starter?'selected':''}>${esc(state.children.find(c=>c.id===cid).name)}</option>`).join('');};starters();
      $('#bath-first').onchange=e=>starter=e.target.value;
      $('#bath-participants').querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{if(input.checked)selected.add(input.value);else selected.delete(input.value);starters();}));
      $('#bath-participants').querySelectorAll('[data-bath-move]').forEach(b=>b.addEventListener('click',()=>{const i=order.indexOf(b.dataset.cid),j=i+Number(b.dataset.bathMove);[order[i],order[j]]=[order[j],order[i]];paint();}));
    };paint();bindForm(async f=>{await call('saveBath',{participants:order.filter(cid=>selected.has(cid)),startDate:f.get('startDate'),startChildId:f.get('startChildId')});});
  });
}
function openModal(title,body,after) {
  const d=$('#modal');
  d.innerHTML=`<div class="dialog-head"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button></div>${body}`;
  if(!d.open)d.showModal();
  if(after)after();
}
function help() {
  openModal('Cada tarefa tem o mesmo peso.',`<div class="help-copy"><p>A mesada é dividida por <strong>todas as ocorrências de tarefas agendadas no mês</strong>. Uma tarefa que acontece de segunda a sexta conta uma vez em cada um desses dias.</p><div class="formula">Desconto = mesada × tarefas não feitas em dias fechados ÷ ocorrências agendadas no mês</div><p>Exemplo: mesada de <strong>R$ 200</strong> e <strong>100 ocorrências</strong>. Cada tarefa não feita desconta <strong>R$ 2</strong>. Com 3 tarefas não feitas, o saldo fica em R$ 194.</p><p><strong>Dia aberto:</strong> tarefas sem check ou marcadas como não concluídas ainda não descontam. O responsável pode fechar o dia antes; caso contrário, o fechamento é automático à meia-noite, pelo horário de Brasília.</p><p><strong>Fechamento automático:</strong> mantém os checks da criança e transforma o que ficou sem marcação em “não concluída”. Isso vale mesmo com o app fechado ou o tablet desligado. Ao reabrir, o saldo já considera os dias que passaram.</p><p><strong>Correções:</strong> o responsável pode corrigir dias anteriores. Mesada nova vale neste mês e nos próximos; agenda nova preserva os dias anteriores. Mudanças na agenda podem alterar o peso de cada ocorrência no mês atual.</p><p>Sem tarefas no mês, não há desconto. O total é arredondado uma única vez para centavos e nunca ultrapassa a mesada. Cadastros no meio do mês usam a mesada integral, distribuída pelas ocorrências a partir do cadastro.</p></div><div class="dialog-actions">${btn('Entendi','close-modal','check')}</div>`);
}
function formShell(fields,submitLabel) { return `<form id="dialog-form" class="dialog-form">${fields}<p id="form-error" class="form-error" role="alert"></p><div class="dialog-actions">${btn('Cancelar','close-modal','','secondary')}<button class="button" type="submit">${submitLabel}</button></div></form>`; }
function bindForm(handler) {
  $('#dialog-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;
    const submit=event.currentTarget.querySelector('[type=submit]');submit.disabled=true;
    try { await handler(new FormData(event.currentTarget));$('#modal').close(); }
    catch(e){if($('#form-error'))$('#form-error').textContent=e.message;else toast(e.message);}
    finally {busy=false;submit.disabled=false;}
  });
}
function login(setup=state.setup) {
  const fields=setup?`<p class="muted small">Crie o primeiro acesso de responsável. As crianças vão entrar escolhendo o nome, sem senha.</p><div class="field"><label for="guardian-name">Seu nome</label><input id="guardian-name" name="name" required maxlength="40" autocomplete="name"></div>`:`<div class="field"><label for="guardian-select">Responsável</label><select id="guardian-select" name="guardianId">${state.guardians.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></div>`;
  openModal(setup?'Vamos configurar a família':'Acesso dos responsáveis',formShell(fields+`<div class="field"><label for="login-password">${setup?'Crie sua senha':'Senha'}</label><input id="login-password" name="password" type="password" required minlength="6" maxlength="128" autocomplete="${setup?'new-password':'current-password'}"><small>${setup?'Pelo menos 6 caracteres. Anote em um local seguro.':'Use a senha cadastrada para este responsável.'}</small></div>${setup?'<div class="field"><label for="confirm-password">Repita a senha</label><input id="confirm-password" name="confirm" type="password" minlength="6" required autocomplete="new-password"></div>':''}`,setup?'Criar minha família':'Desbloquear'),()=>bindForm(async f=>{
    if(setup&&f.get('password')!==f.get('confirm'))throw Error('As senhas não são iguais.');
    await call(setup?'setup':'login',Object.fromEntries(f),{render:false});
    lastInteraction=Date.now();view=setup?'children':'review';date=state.today;month=date.slice(0,7);await call('get');
  }));
}
function editChild(id) {
  const c=state.children.find(c=>c.id===id);let avatar=c?.avatar||0;
  openModal(c?'Editar criança':'Uma nova criança na turma',formShell(`<div class="field"><label for="child-name">Nome da criança</label><input id="child-name" name="name" maxlength="40" required value="${esc(c?.name||'')}" autocomplete="off"></div><div class="field"><span>Escolha um avatar</span><div class="avatars" role="group" aria-label="Avatar da criança">${animals.map((v,i)=>`<button class="choice ${i===avatar?'selected':''}" type="button" data-choice="avatar" data-value="${i}" aria-label="Avatar ${['urso','coelho','raposa','panda','coala','tigre','sapo','gato'][i]}" aria-pressed="${i===avatar}">${v}</button>`).join('')}</div></div><div class="field"><label for="allowance">Mesada mensal (R$)</label><input id="allowance" name="amount" type="text" inputmode="decimal" required value="${c?(c.amount/100).toFixed(2).replace('.',','):'100,00'}"><small>Vale para o mês atual e os próximos. Meses anteriores são preservados.</small></div>`,'Salvar criança'),()=>{
    $('#modal').querySelectorAll('[data-choice=avatar]').forEach(b=>b.addEventListener('click',()=>{avatar=Number(b.dataset.value);$('#modal').querySelectorAll('[data-choice=avatar]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b);});}));
    bindForm(async f=>{const raw=f.get('amount').trim();if(!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(raw))throw Error('Informe um valor como 100,00, sem separador de milhar.');const amount=Math.round(Number(raw.replace(',','.'))*100);await call('saveChild',{id:id||'',name:f.get('name'),avatar,amount});});
  });
}
function editTask(id) {
  const t=state.templates.find(t=>t.id===id);let chosenIcon=t?.icon||0;
  openModal(t?'Editar tarefa':'Um novo passo na rotina',formShell(`<div class="field"><label for="task-title">O que precisa ser feito?</label><input id="task-title" name="title" maxlength="100" required value="${esc(t?.title||'')}" placeholder="Ex.: Arrumar a cama" autocomplete="off"></div><div class="field"><span>Ícone da tarefa</span><div class="task-icons" role="group" aria-label="Ícone da tarefa">${taskIcons.map((v,i)=>`<button class="choice ${i===chosenIcon?'selected':''}" type="button" data-choice="task-icon" data-value="${i}" aria-label="Ícone ${['cama','escova de dentes','livros','brinquedos','prato','mochila','vassoura','planta'][i]}" aria-pressed="${i===chosenIcon}">${v}</button>`).join('')}</div></div><div class="field"><span>Em quais dias da semana?</span><div class="weekdays">${weekdays.map((d,i)=>`<label><input type="checkbox" name="weekdays" value="${i}" ${(t?.weekdays||[1,2,3,4,5]).includes(i)?'checked':''} aria-label="${d}"><span class="choice weekday">${d}</span></label>`).join('')}</div><small>As tarefas começam hoje, ou amanhã se hoje já estiver fechado.</small></div>`,'Salvar tarefa'),()=>{
    $('#modal').querySelectorAll('[data-choice=task-icon]').forEach(b=>b.addEventListener('click',()=>{chosenIcon=Number(b.dataset.value);$('#modal').querySelectorAll('[data-choice=task-icon]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b);});}));
    bindForm(async f=>{const ds=f.getAll('weekdays').map(Number);if(!ds.length)throw Error('Escolha pelo menos um dia da semana.');await call('saveTask',{id:id||'',title:f.get('title'),weekdays:ds,icon:chosenIcon,active:t?.active??true});});
  });
}
function editGuardian(id) {
  const g=state.guardians.find(g=>g.id===id);
  openModal(g?'Editar responsável':'Novo responsável',formShell(`<div class="field"><label for="edit-guardian-name">Nome</label><input id="edit-guardian-name" name="name" maxlength="40" required value="${esc(g?.name||'')}" autocomplete="off"></div><div class="field"><label for="edit-guardian-password">${g?'Sua nova senha (opcional)':'Senha'}</label><input id="edit-guardian-password" name="password" type="password" minlength="6" maxlength="128" ${g&&g.id!==state.actor?'disabled':g?'':'required'} autocomplete="new-password"><small>${g?(g.id===state.actor?'Deixe em branco para manter sua senha.':'A senha é alterada pelo próprio responsável. Para substituir este acesso, remova e cadastre novamente.'):'Pelo menos 6 caracteres.'}</small></div><div class="field"><label for="repeat-guardian-password">Repita a nova senha</label><input id="repeat-guardian-password" name="confirm" type="password" minlength="6" ${g?'':'required'} autocomplete="new-password"></div>`,'Salvar responsável'),()=>bindForm(async f=>{
    if((f.get('password')||'')!==(f.get('confirm')||''))throw Error('As senhas não são iguais.');
    await call('saveGuardian',{id:id||'',name:f.get('name'),password:f.get('password')||''});
  }));
}
function confirmAction(title,description,label,handler,danger=false) {
  openModal(title,formShell(`<p class="muted">${description}</p>`,label),()=>{
    if(danger)$('#dialog-form [type=submit]').classList.add('danger');bindForm(handler);
  });
}
async function lock(showToast=false) {
  token='';view='home';date=state.today;month=date.slice(0,7);$('#modal').close();
  await call('logout');if(showToast)toast('Área dos responsáveis bloqueada.');
}
window.lockFromNative=()=>{token='';view='home';date=state?.today||'';month=date.slice(0,7);$('#modal').close();cloud.lock().then(()=>call('get')).catch(e=>toast(e.message));};
window.handleBack=()=>{if(!state)return true;if($('#modal').open){$('#modal').close();return false;}if(state.authenticated){lock();return false;}if(view!=='home'){view='home';render();return false;}return true;};
document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-action]');if(!b||b.disabled||busy)return;
  const action=b.dataset.action;
  try {
    switch(action) {
      case 'nav': view=b.dataset.view;if(['home','daily','children','tasks'].includes(view)){date=state.today;month=date.slice(0,7);}await call('get');break;
      case 'help':help();break;
      case 'login':login();break;
      case 'setup':login(true);break;
      case 'pair':pairDialog();break;
      case 'edit-bath':editBath();break;
      case 'restart-bath':editBath(true);break;
      case 'show-pairing':await showPairing();break;
      case 'import-bath':confirmAction('Importar a fila do app anterior?','As crianças da fila anterior serão aproveitadas pelo nome. Crianças novas entram com mesada de R$ 0 para você definir depois. A ordem e a data inicial do banho serão mantidas.','Importar fila',()=>call('importBath'));break;
      case 'copy-pairing':{const r=await call('pairing');if(window.Android?.copyText)Android.copyText(r.pairingCode);else await navigator.clipboard.writeText(r.pairingCode);toast('Código copiado. Cole no outro aparelho.');break;}
      case 'logout':await lock(true);break;
      case 'close-modal':$('#modal').close();break;
      case 'open-child':childId=b.dataset.id;view='daily';date=state.today;month=date.slice(0,7);await call('get');break;
      case 'select-child':childId=b.dataset.id;if(view==='daily'){date=state.today;month=date.slice(0,7);}await call('get');break;
      case 'child-check':busy=true;await call('childCheck',{taskId:b.dataset.id,done:b.dataset.done==='true'});break;
      case 'add-child':editChild();break;
      case 'edit-child':editChild(b.dataset.id);break;
      case 'add-task':editTask();break;
      case 'edit-task':editTask(b.dataset.id);break;
      case 'toggle-task':{const t=state.templates.find(t=>t.id===b.dataset.id);confirmAction(t.active?'Pausar esta tarefa?':'Reativar esta tarefa?',`A mudança vale a partir de ${state.day?.closed&&date===state.today?'amanhã':'hoje (ou amanhã, se hoje já estiver fechado)'}. As ocorrências anteriores são preservadas. O total de tarefas do mês e o saldo serão recalculados.`,t.active?'Pausar tarefa':'Reativar tarefa',()=>call('saveTask',{id:t.id,title:t.title,weekdays:t.weekdays,icon:t.icon,active:!t.active}));break;}
      case 'add-guardian':editGuardian();break;
      case 'edit-guardian':editGuardian(b.dataset.id);break;
      case 'delete-guardian':confirmAction('Remover responsável?',`${esc(state.guardians.find(g=>g.id===b.dataset.id).name)} perderá o acesso à área protegida.`,'Remover acesso',()=>call('deleteGuardian',{id:b.dataset.id}),true);break;
      case 'review-task':busy=true;await call('review',{taskId:b.dataset.id,status:b.dataset.status});break;
      case 'close-day':confirmAction('Validar e fechar este dia?',`Os checks concluídos serão mantidos. ${state.day.total-state.day.done} tarefa(s) sem conclusão serão descontadas da mesada. A criança não poderá mais alterar esse dia; os responsáveis poderão corrigir depois.`,'Validar e fechar',()=>call('closeDay'));break;
      case 'today':date=state.today;month=date.slice(0,7);await call('get');break;
      case 'select-date':date=b.dataset.date;month=date.slice(0,7);await call('get');break;
      case 'export':{const r=await call('backup');if(window.Android?.saveBackup){Android.saveBackup(r.backup);}else{const url=URL.createObjectURL(new Blob([r.backup],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`passinho-backup-${state.today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Backup preparado para salvar.');}}break;
      case 'import':$('#import-file').click();break;
    }
  }catch(e){toast(e.message);}
  finally{busy=false;}
});
document.addEventListener('change',async e=>{
  try {
    if(e.target.id==='review-date'&&e.target.value){date=e.target.value;month=date.slice(0,7);await call('get');}
    if(e.target.id==='history-month'&&e.target.value){month=e.target.value;date=month===state.today.slice(0,7)?state.today:month+'-01';if(date<state.child.createdOn)date=state.child.createdOn;await call('get');}
    if(e.target.id==='import-file'&&e.target.files[0]){
      const file=e.target.files[0];e.target.value='';if(file.size>5_000_000)throw Error('O backup deve ter no máximo 5 MB.');
      const raw=await file.text();try{JSON.parse(raw);}catch{throw Error('O arquivo não é um backup JSON válido.');}
      confirmAction('Substituir os dados da família?','A restauração substitui os dados compartilhados em todos os aparelhos. Os acessos e as senhas atuais dos responsáveis serão mantidos. Salve uma cópia atual antes de continuar.','Restaurar backup',async()=>{await call('restore',{backup:raw});view='home';date=state.today;month=date.slice(0,7);await call('get');},true);
    }
  }catch(e){toast(e.message);}
});
['pointerdown','keydown'].forEach(name=>document.addEventListener(name,()=>{lastInteraction=Date.now();},{passive:true}));
document.addEventListener('visibilitychange',()=>{if(!window.Android&&document.hidden&&state?.authenticated&&!busy)lock();else if(!document.hidden&&state&&!busy)call('get').catch(e=>toast(e.message));});
// Read-only refresh: also rolls the child screen to the new date at midnight.
setInterval(async()=>{
  if(!state||busy||$('#modal').open||document.hidden)return;
  try{
    if(state.authenticated&&Date.now()-lastInteraction>300_000){await lock(true);return;}
    const oldToday=state.today;
    await call('get',{}, {toast:false,activity:Date.now()-lastInteraction<30_000});
    if(state.today!==oldToday){date=state.today;month=date.slice(0,7);await call('get');}
  }catch(e){toast(e.message);}
},30_000);
cloud.onChange=(error)=>{if(error)toast(error);if(state&&!busy&&!$('#modal').open)call('get',{}, {toast:false,activity:false}).catch(e=>toast(e.message));};
window.addEventListener('online',()=>cloud.notify());window.addEventListener('offline',()=>cloud.notify());
call('get').catch(e=>{$('#app').innerHTML=`<div class="empty"><h1>Não foi possível abrir o app.</h1><p>${esc(e.message)} Feche e tente novamente.</p></div>`;});
