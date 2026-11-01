import {initializeApp} from 'firebase/app';
import {initializeAuth,connectAuthEmulator,browserLocalPersistence,inMemoryPersistence,signInAnonymously,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,updatePassword,deleteUser} from 'firebase/auth';
import {initializeFirestore,connectFirestoreEmulator,getFirestore,persistentLocalCache,persistentMultipleTabManager,doc,collection,getDoc,getDocs,query,where,onSnapshot,runTransaction,writeBatch,serverTimestamp} from 'firebase/firestore';
import {firebaseConfig} from './firebase-config.js';
import {emptyFamily,snapshot,mutateRoot,id,todayISO,checkKey,dayKey,closed,occurrences,validateReview,record,convertLegacy,monthDates} from './domain.js';

const FAMILY_KEY='passinho-family-v2';
const PAIR_HASH='vincular=';
const adminOps=new Set(['saveChild','saveTask','saveBath','review','closeDay','saveGuardian','deleteGuardian','backup','restore','pairing','importBath']);
const cleanError=error=>{
  const code=error.code||'';
  if(/invalid-credential|wrong-password|user-not-found|invalid-login-credentials/.test(code))return 'Nome ou senha incorretos.';
  if(/too-many-requests/.test(code))return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if(/email-already-in-use/.test(code))return 'Este acesso já foi criado. Use a opção de conectar a família ou entre com a senha.';
  if(/permission-denied/.test(code))return 'Acesso negado. A tarefa pode ter sido avaliada em outro aparelho. Atualize e tente novamente.';
  if(/network-request-failed|unavailable|deadline-exceeded/.test(code))return 'Sem conexão com o banco. Conecte à internet e tente novamente.';
  if(/operation-not-allowed/.test(code))return 'O método de entrada ainda não foi habilitado no Firebase.';
  if(/requires-recent-login/.test(code))return 'Por segurança, bloqueie a área e entre novamente antes de mudar a senha.';
  if(/weak-password/.test(code))return 'Use uma senha com pelo menos seis caracteres.';
  return error.message||'Não foi possível concluir. Tente novamente.';
};
export class Cloud {
  constructor(){
    const emulator=import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS==='1';
    const config=emulator?{...firebaseConfig,projectId:'demo-passinho',apiKey:'fake-emulator-key'}:firebaseConfig;
    this.app=initializeApp(config);
    this.auth=initializeAuth(this.app,{persistence:browserLocalPersistence});
    this.db=initializeFirestore(this.app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
    this.adminApp=initializeApp(config,'passinho-guardian');this.adminAuth=initializeAuth(this.adminApp,{persistence:inMemoryPersistence});this.adminDb=getFirestore(this.adminApp);
    this.creatorApp=initializeApp(config,'passinho-creator');this.creatorAuth=initializeAuth(this.creatorApp,{persistence:inMemoryPersistence});
    if(emulator){for(const auth of [this.auth,this.adminAuth,this.creatorAuth])connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});for(const db of [this.db,this.adminDb])connectFirestoreEmulator(db,'127.0.0.1',8080);}
    this.familyId=localStorage.getItem(FAMILY_KEY)||'';this.root=null;this.checks={};this.closures={};this.context={};this.unsub=[];this.lastActivity=0;this.month='';this.online=navigator.onLine;this.lastReadFromCache=false;
    this.ready=this.initialize();
  }
  async initialize(){
    await Promise.all([this.auth.authStateReady(),this.adminAuth.authStateReady(),this.creatorAuth.authStateReady()]);
    if(!this.auth.currentUser)await signInAnonymously(this.auth);
    if(location.hash.startsWith('#'+PAIR_HASH)){
      const code=decodeURIComponent(location.hash.slice(PAIR_HASH.length+1));
      history.replaceState(null,'',location.pathname+location.search);await this.pair(code);
    }else if(this.familyId){try{await this.loadFamily();}catch(error){if(error.code==='permission-denied'){this.familyId='';this.root=null;localStorage.removeItem(FAMILY_KEY);}else throw error;}}
  }
  familyRef(db=this.db){return doc(db,'passinhoFamilies',this.familyId);}
  ref(kind,key,db=this.db){return doc(db,'passinhoFamilies',this.familyId,kind,key);}
  async loadFamily(){
    const snap=await getDoc(this.familyRef());
    if(!snap.exists()){this.familyId='';localStorage.removeItem(FAMILY_KEY);throw Error('Família não encontrada. Conecte este aparelho novamente.');}
    this.root=snap.data();this.subscribe();await this.loadMonth(todayISO().slice(0,7));
  }
  subscribe(){
    this.unsub.forEach(fn=>fn());this.unsub=[];
    this.unsub.push(onSnapshot(this.familyRef(),{includeMetadataChanges:true},s=>{if(s.exists()){this.root=s.data();this.lastReadFromCache=s.metadata.fromCache;this.notify();}},e=>this.notify(cleanError(e))));
  }
  async loadMonth(month){
    monthDates(month);if(month===this.month)return;
    this.monthUnsub?.forEach(fn=>fn());this.month=month;this.checks={};this.closures={};
    const first=month+'-01',last=monthDates(month).at(-1);
    const attach=async(kind,target)=>{
      const q=query(collection(this.db,'passinhoFamilies',this.familyId,kind),where('date','>=',first),where('date','<=',last));
      const initial=await getDocs(q);this[target]=Object.fromEntries(initial.docs.map(d=>[d.id,d.data()]));
      return onSnapshot(q,{includeMetadataChanges:true},s=>{if(this.month!==month)return;this[target]=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));this.notify();},e=>this.notify(cleanError(e)));
    };
    this.monthUnsub=await Promise.all([attach('checks','checks'),attach('closures','closures')]);
  }
  notify(error){if(this.onChange)this.onChange(error);}
  isAdmin(){return Boolean(this.adminAuth.currentUser&&this.root?.guardians[this.adminAuth.currentUser.uid]&&Date.now()-this.lastActivity<300000);}
  ensureAdmin(){if(!this.isAdmin())throw Error('Entre novamente na área dos responsáveis.');this.lastActivity=Date.now();}
  ensureOnline(){if(!navigator.onLine)throw Error('Conecte à internet para salvar alterações. Você pode consultar os dados já carregados.');}
  state(a={}){
    if(!this.root)return {today:todayISO(),date:todayISO(),month:todayISO().slice(0,7),children:[],guardians:[],setup:true,paired:false,authenticated:false,online:navigator.onLine,bath:null};
    return snapshot(this.root,this.checks,this.closures,a,{admin:this.isAdmin(),uid:this.adminAuth.currentUser?.uid,familyId:this.familyId,online:navigator.onLine});
  }
  async pair(raw){
    this.ensureOnline();const code=String(raw).trim();if(!/^[a-f0-9]{48}$/.test(code))throw Error('Código de conexão inválido. Copie o código na área dos responsáveis de um aparelho já conectado.');
    const pairing=await getDoc(doc(this.db,'passinhoPairings',code));if(!pairing.exists())throw Error('Código de conexão não encontrado.');
    const fid=pairing.data().familyId,uid=this.auth.currentUser.uid;
    await runTransaction(this.db,async tx=>{const memberRef=doc(this.db,'passinhoFamilies',fid,'members',uid);const current=await tx.get(memberRef);if(!current.exists())tx.set(memberRef,{uid,role:'child',pairingCode:code,createdAt:serverTimestamp()});});
    this.familyId=fid;localStorage.setItem(FAMILY_KEY,fid);this.month='';await this.loadFamily();
  }
  async setup(a){
    this.ensureOnline();if(this.root)throw Error('Este aparelho já está conectado. Entre como responsável.');
    const name=String(a.name||'').trim();if(!name||name.length>40)throw Error('Informe seu nome.');if(a.password?.length<6)throw Error('Use uma senha com pelo menos seis caracteres.');
    const fid=id(),loginId=id(),email=`${loginId}@${fid}.passinho.invalid`;
    const cred=await createUserWithEmailAndPassword(this.adminAuth,email,a.password),uid=cred.user.uid;
    this.familyId=fid;const root=emptyFamily(uid);root.guardians[uid]={id:uid,name,email};
    const bytes=crypto.getRandomValues(new Uint8Array(24)),code=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    const batch=writeBatch(this.adminDb);
    batch.set(this.familyRef(this.adminDb),root);
    batch.set(this.ref('members',uid,this.adminDb),{uid,role:'admin',createdAt:serverTimestamp()});
    batch.set(this.ref('members',this.auth.currentUser.uid,this.adminDb),{uid:this.auth.currentUser.uid,role:'child',createdAt:serverTimestamp()});
    batch.set(doc(this.adminDb,'passinhoPairings',code),{familyId:fid,createdBy:uid,createdAt:serverTimestamp()});
    batch.set(this.ref('private','settings',this.adminDb),{pairingCode:code});
    try{await batch.commit();}catch(error){this.familyId='';await deleteUser(cred.user).catch(()=>{});throw error;}
    this.root=root;this.lastActivity=Date.now();localStorage.setItem(FAMILY_KEY,fid);this.subscribe();await this.loadMonth(todayISO().slice(0,7));
  }
  async transactionRoot(op,a){
    this.ensureOnline();this.ensureAdmin();const uid=this.adminAuth.currentUser.uid;
    let result;
    await runTransaction(this.adminDb,async tx=>{
      const ref=this.familyRef(this.adminDb),s=await tx.get(ref);if(!s.exists())throw Error('Família não encontrada.');
      const today=todayISO(),closure=await tx.get(this.ref('closures',dayKey(a.childId||'',today),this.adminDb));
      const closures=closure.exists()?{[closure.id]:closure.data()}:{};
      result=mutateRoot(s.data(),op,a,{today,uid,closures});tx.set(ref,result.root);
      if(op==='deleteGuardian')tx.delete(this.ref('members',a.id,this.adminDb));
    },{maxAttempts:3});this.root=result.root;return result;
  }
  async saveCheck(a,review=false){
    this.ensureOnline();if(review)this.ensureAdmin();
    const db=review?this.adminDb:this.db,uid=review?this.adminAuth.currentUser.uid:this.auth.currentUser.uid;
    const key=checkKey(a.childId,a.date,a.taskId),ref=this.ref('checks',key,db),closeRef=this.ref('closures',dayKey(a.childId,a.date),db);
    let data,latestRoot;
    await runTransaction(db,async tx=>{
      const [r,c,d]=await Promise.all([tx.get(this.familyRef(db)),tx.get(ref),tx.get(closeRef)]);
      const root=r.data(),today=todayISO();validateReview(root,a,today);
      if(!review){if(a.date!==today)throw Error('Só é possível marcar as tarefas de hoje.');if(closed(a.childId,a.date,d.exists()?{[d.id]:d.data()}:{},today))throw Error('Este dia já está fechado.');if(c.exists()&&c.data().reviewed)throw Error('A tarefa foi avaliada pelo responsável.');}
      data={childId:a.childId,date:a.date,taskId:a.taskId,status:review?a.status:a.done?'done':'pending',reviewed:review&&a.status!=='pending',by:uid,updatedAt:serverTimestamp()};
      tx.set(ref,data);
      if(review){record(root,'Revisão de tarefa em '+a.date+' · '+root.children[a.childId].name,uid);tx.set(this.familyRef(db),root);latestRoot=root;}
    },{maxAttempts:3});this.checks[key]=data;if(latestRoot)this.root=latestRoot;
  }
  async closeDay(a){
    this.ensureOnline();this.ensureAdmin();const uid=this.adminAuth.currentUser.uid;let data,root;
    await runTransaction(this.adminDb,async tx=>{const s=await tx.get(this.familyRef(this.adminDb));root=s.data();validateReview(root,a);data={childId:a.childId,date:a.date,closed:true,by:uid,updatedAt:serverTimestamp()};record(root,'Fechamento de '+a.date+' · '+root.children[a.childId].name,uid);tx.set(this.ref('closures',dayKey(a.childId,a.date),this.adminDb),data);tx.set(this.familyRef(this.adminDb),root);},{maxAttempts:3});
    this.closures[dayKey(a.childId,a.date)]=data;this.root=root;
  }
  async saveGuardian(a){
    this.ensureOnline();this.ensureAdmin();const name=String(a.name||'').trim();if(!name||name.length>40)throw Error('Informe um nome de até 40 caracteres.');
    const actor=this.adminAuth.currentUser.uid;
    if(a.id){
      if(!this.root.guardians[a.id])throw Error('Responsável não encontrado.');
      if(a.password){if(a.id!==actor)throw Error('Cada responsável altera a própria senha. Para substituir outro acesso, remova-o e cadastre novamente.');await updatePassword(this.adminAuth.currentUser,a.password);}
      await runTransaction(this.adminDb,async tx=>{const ref=this.familyRef(this.adminDb),s=await tx.get(ref),root=s.data();root.guardians[a.id].name=name;record(root,'Cadastro de responsável: '+name,actor);tx.set(ref,root);this.root=root;});return;
    }
    if(a.password?.length<6)throw Error('Use uma senha com pelo menos seis caracteres.');
    const email=`${id()}@${this.familyId}.passinho.invalid`;let user;
    try{
      user=(await createUserWithEmailAndPassword(this.creatorAuth,email,a.password)).user;
      await runTransaction(this.adminDb,async tx=>{const ref=this.familyRef(this.adminDb),s=await tx.get(ref),root=s.data();root.guardians[user.uid]={id:user.uid,name,email};record(root,'Cadastro de responsável: '+name,actor);tx.set(ref,root);tx.set(this.ref('members',user.uid,this.adminDb),{uid:user.uid,role:'admin',createdAt:serverTimestamp()});this.root=root;});
    }catch(error){if(user)await deleteUser(user).catch(()=>{});throw error;}finally{await signOut(this.creatorAuth).catch(()=>{});}
  }
  async exportBackup(){
    this.ensureAdmin();this.ensureOnline();const all={schema:2,family:this.root,checks:{},closures:{},exportedAt:new Date().toISOString()};
    const pairing=await getDoc(this.ref('private','settings',this.adminDb));all.connection={familyId:this.familyId,pairingCode:pairing.data().pairingCode};
    for(const kind of ['checks','closures']){const docs=await getDocs(collection(this.adminDb,'passinhoFamilies',this.familyId,kind));all[kind]=Object.fromEntries(docs.docs.map(d=>[d.id,d.data()]));}
    return JSON.stringify(all,null,2);
  }
  async restore(raw){
    this.ensureAdmin();this.ensureOnline();const data=JSON.parse(raw);let root,checks,closures;
    if(data.schema===1)({root,checks,closures}=convertLegacy(data,this.root));
    else if(data.schema===2&&data.family&&data.checks&&data.closures){root={...data.family,ownerUid:this.root.ownerUid,guardians:this.root.guardians};checks=data.checks;closures=data.closures;validateCloudBackup(root,checks,closures);}
    else throw Error('Backup incompatível.');
    const db=this.adminDb,uid=this.adminAuth.currentUser.uid;record(root,'Backup restaurado (acessos atuais preservados)',uid);
    const existingChecks=await getDocs(collection(db,'passinhoFamilies',this.familyId,'checks')),existingClosures=await getDocs(collection(db,'passinhoFamilies',this.familyId,'closures'));
    const deletes=[...existingChecks.docs,...existingClosures.docs];const count=deletes.length+Object.keys(checks).length+Object.keys(closures).length+1;
    if(count>450)throw Error('Este backup é grande para restauração direta e precisa de uma migração assistida. Os dados atuais foram mantidos.');
    const batch=writeBatch(db);deletes.forEach(d=>batch.delete(d.ref));batch.set(this.familyRef(db),root);
    for(const[key,value]of Object.entries(checks))batch.set(this.ref('checks',key,db),{childId:value.childId,date:value.date,taskId:value.taskId,status:value.status,reviewed:Boolean(value.reviewed),by:uid,updatedAt:serverTimestamp()});
    for(const[key,value]of Object.entries(closures))batch.set(this.ref('closures',key,db),{childId:value.childId,date:value.date,closed:Boolean(value.closed),by:uid,updatedAt:serverTimestamp()});
    await batch.commit();this.root=root;this.month='';await this.loadMonth(todayISO().slice(0,7));
  }
  async importBath(){
    this.ensureAdmin();this.ensureOnline();const old=await getDoc(doc(this.db,'banho','state'));if(!old.exists())throw Error('Não há fila configurada no app anterior.');const bath=old.data();
    if(!Array.isArray(bath.children)||bath.children.length<2)throw Error('A fila anterior não tem pelo menos duas crianças.');
    let imported;
    await runTransaction(this.adminDb,async tx=>{
      const ref=this.familyRef(this.adminDb),s=await tx.get(ref),root=s.data(),today=todayISO(),participants=[],ids={};
      for(const oldChild of bath.children){let c=Object.values(root.children).find(c=>c.name.trim().toLocaleLowerCase('pt-BR')===oldChild.name.trim().toLocaleLowerCase('pt-BR'));if(!c){const cid=id();c={id:cid,name:oldChild.name.trim(),createdOn:today,avatar:Object.keys(root.children).length%8,allowances:{[today.slice(0,7)]:0}};root.children[cid]=c;}participants.push(c.id);ids[oldChild.id]=c.id;}
      root.bath={participants,startDate:bath.startDate||today,startChildId:ids[bath.startChildId]||participants[0]};record(root,'Importação da fila do Banho da Vez',this.adminAuth.currentUser.uid);tx.set(ref,root);imported=root;
    });this.root=imported;
  }
  async request(a){
    try{
      await this.ready;if(a.activity&&this.isAdmin())this.lastActivity=Date.now();
      const op=a.op||'get';let message='',extra={};
      if(op==='setup'){await this.setup(a);extra.token='firebase-session';message='Família criada. Cadastre as crianças ou importe a fila do banho.';}
      else if(op==='pair'){await this.pair(a.code);message='Aparelho conectado à família.';}
      else if(op==='login'){
        this.ensureOnline();const g=this.root?.guardians[a.guardianId];if(!g)throw Error('Responsável não encontrado.');
        await signInWithEmailAndPassword(this.adminAuth,g.email,a.password);this.lastActivity=Date.now();extra.token='firebase-session';message='Área dos responsáveis desbloqueada.';
      }else if(op==='logout'){await signOut(this.adminAuth);}
      else if(op!=='get'){
        if(adminOps.has(op))this.ensureAdmin();
        if(['saveChild','saveTask','saveBath','deleteGuardian'].includes(op)){const r=await this.transactionRoot(op,a);message=r.message;if(r.selectedChildId)a.childId=r.selectedChildId;}
        else if(op==='childCheck'){await this.saveCheck(a);message=a.done?'Tarefa marcada e sincronizada.':'Marcação desfeita.';}
        else if(op==='review'){await this.saveCheck(a,true);message='Avaliação salva. O saldo foi recalculado.';}
        else if(op==='closeDay'){await this.closeDay(a);message='Dia validado e fechado.';}
        else if(op==='saveGuardian'){await this.saveGuardian(a);message='Responsável salvo.';}
        else if(op==='backup'){extra.backup=await this.exportBackup();}
        else if(op==='restore'){await this.restore(a.backup);message='Backup restaurado. Os acessos atuais foram preservados.';}
        else if(op==='pairing'){const s=await getDoc(this.ref('private','settings',this.adminDb));extra.pairingCode=s.data().pairingCode;}
        else if(op==='importBath'){await this.importBath();message='Fila do banho importada. Defina a mesada e as tarefas de cada criança.';}
        else throw Error('Ação desconhecida.');
      }
      if(this.root)await this.loadMonth(a.month||(a.date||todayISO()).slice(0,7));
      return {ok:true,message,...extra,state:this.state(a)};
    }catch(error){return {ok:false,error:cleanError(error)};}
  }
  async lock(){await signOut(this.adminAuth);this.notify();}
}
function validateCloudBackup(root,checks,closures){
  if(root.schema!==2||!root.children||!root.tasks||!Array.isArray(root.audit))throw Error('Backup inválido.');
  for(const[cid,c]of Object.entries(root.children)){if(c.id!==cid||!c.name||!Number.isInteger(c.avatar)||c.avatar<0||c.avatar>7)throw Error('Criança inválida no backup.');monthDates(c.createdOn.slice(0,7));for(const [m,v]of Object.entries(c.allowances)){monthDates(m);if(!Number.isSafeInteger(v)||v<0||v>100000000)throw Error('Mesada inválida.');}}
  for(const[tid,t]of Object.entries(root.tasks)){if(t.id!==tid||!root.children[t.childId]||!Array.isArray(t.versions)||!t.versions.length)throw Error('Agenda inválida no backup.');for(const v of t.versions){if(!v.title||!Array.isArray(v.weekdays)||v.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Tarefa inválida no backup.');}}
  for(const[key,c]of Object.entries(checks)){if(key!==checkKey(c.childId,c.date,c.taskId)||!root.children[c.childId]||!root.tasks[c.taskId]||!['pending','done','failed'].includes(c.status))throw Error('Marcação inválida no backup.');}
  for(const[key,c]of Object.entries(closures))if(key!==dayKey(c.childId,c.date)||!root.children[c.childId])throw Error('Fechamento inválido no backup.');
}
