import {before,after,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,serverTimestamp,deleteDoc,writeBatch,runTransaction} from 'firebase/firestore';
import {todayISO,dayNumber,addDays} from '../../src/domain.js';
let env;
const fid='test-family',parent='parent',kid='child',stranger='stranger',code='a'.repeat(48),today=todayISO();
const root={schema:2,ownerUid:parent,children:{c:{id:'c',name:'Criança',avatar:0,createdOn:today,allowances:{[today.slice(0,7)]:10000}}},tasks:{t:{id:'t',childId:'c',versions:[{from:today,fromDay:dayNumber(today),title:'Diária',weekdays:[0,1,2,3,4,5,6],active:true,icon:0}]}},guardians:{parent:{id:parent,name:'Responsável',email:'test@example.invalid'}},bath:null,audit:[]};
const db=uid=>env.authenticatedContext(uid,{firebase:{sign_in_provider:uid===parent?'password':'anonymous'}}).firestore();
const check=(uid,overrides={})=>({childId:'c',date:today,taskId:'t',status:'done',reviewed:false,by:uid,updatedAt:serverTimestamp(),...overrides});
before(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-passinho',firestore:{rules:await readFile('firestore.rules','utf8')}});
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>{const d=ctx.firestore();await setDoc(doc(d,'passinhoFamilies',fid),root);await setDoc(doc(d,'passinhoFamilies',fid,'members',parent),{uid:parent,role:'admin'});await setDoc(doc(d,'passinhoFamilies',fid,'members',kid),{uid:kid,role:'child'});await setDoc(doc(d,'passinhoPairings',code),{familyId:fid});});
});
after(async()=>{await env?.cleanup();});
test('anônimo não vinculado e visitante sem autenticação não leem a família',async()=>{await assertFails(getDoc(doc(db(stranger),'passinhoFamilies',fid)));await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'passinhoFamilies',fid)));});
test('aparelho vinculado pode ler, mas não alterar mesadas e cadastros',async()=>{const d=db(kid);await assertSucceeds(getDoc(doc(d,'passinhoFamilies',fid)));await assertFails(updateDoc(doc(d,'passinhoFamilies',fid),{audit:[]}));await assertFails(setDoc(doc(d,'passinhoFamilies',fid,'private','settings'),{pairingCode:'hacked'}));});
test('conexão exige código correto e nunca permite autoatribuir papel de responsável',async()=>{const d=db('new-device');await assertFails(setDoc(doc(d,'passinhoFamilies',fid,'members','new-device'),{uid:'new-device',role:'admin',pairingCode:code,createdAt:serverTimestamp()}));await assertFails(setDoc(doc(d,'passinhoFamilies',fid,'members','new-device'),{uid:'new-device',role:'child',pairingCode:'b'.repeat(48),createdAt:serverTimestamp()}));await assertSucceeds(setDoc(doc(d,'passinhoFamilies',fid,'members','new-device'),{uid:'new-device',role:'child',pairingCode:code,createdAt:serverTimestamp()}));await assertSucceeds(getDoc(doc(d,'passinhoFamilies',fid)));});
test('criança pode marcar tarefa de hoje e desfazer o próprio check',async()=>{const d=db(kid),r=doc(d,'passinhoFamilies',fid,'checks',`c|${today}|t`);await assertSucceeds(setDoc(r,check(kid)));await assertSucceeds(setDoc(r,check(kid,{status:'pending'})));});
test('criança não pode avaliar como responsável, forjar revisor, tarefa ou dia',async()=>{const d=db(kid);await assertFails(setDoc(doc(d,'passinhoFamilies',fid,'checks',`c|${today}|t`),check(kid,{reviewed:true})));await assertFails(setDoc(doc(d,'passinhoFamilies',fid,'checks',`c|${today}|t`),check(parent)));await assertFails(setDoc(doc(d,'passinhoFamilies',fid,'checks',`c|${today}|fake`),check(kid,{taskId:'fake'})));const yesterday=addDays(today,-1);await assertFails(setDoc(doc(d,'passinhoFamilies',fid,'checks',`c|${yesterday}|t`),check(kid,{date:yesterday})));});
test('responsável avalia e bloqueia a tarefa contra alteração infantil',async()=>{const ref=d=>doc(d,'passinhoFamilies',fid,'checks',`c|${today}|t`);await assertSucceeds(setDoc(ref(db(parent)),check(parent,{status:'failed',reviewed:true})));await assertFails(setDoc(ref(db(kid)),check(kid)));await assertSucceeds(setDoc(ref(db(parent)),check(parent,{status:'pending'})));});
test('fechamento bloqueia checks e somente responsável pode corrigir passado',async()=>{const d=db(parent);await assertSucceeds(setDoc(doc(d,'passinhoFamilies',fid,'closures',`c|${today}`),{childId:'c',date:today,closed:true,by:parent,updatedAt:serverTimestamp()}));await assertFails(setDoc(doc(db(kid),'passinhoFamilies',fid,'checks',`c|${today}|t`),check(kid)));const yesterday=addDays(today,-1);await assertSucceeds(setDoc(doc(d,'passinhoFamilies',fid,'checks',`c|${yesterday}|t`),check(parent,{date:yesterday,status:'done',reviewed:true})));});
test('tarefa criada para amanhã não pode ser marcada hoje',async()=>{await env.withSecurityRulesDisabled(async ctx=>{const d=ctx.firestore();await deleteDoc(doc(d,'passinhoFamilies',fid,'closures',`c|${today}`));await updateDoc(doc(d,'passinhoFamilies',fid),{'tasks.future':{id:'future',childId:'c',versions:[{from:addDays(today,1),fromDay:dayNumber(today)+1,title:'Amanhã',weekdays:[0,1,2,3,4,5,6],active:true,icon:0}]}});});await assertFails(setDoc(doc(db(kid),'passinhoFamilies',fid,'checks',`c|${today}|future`),check(kid,{taskId:'future'})));});
test('responsável pode criar família e todos os vínculos em um único lote',async()=>{const context=env.authenticatedContext('new-owner',{firebase:{sign_in_provider:'password'}}),d=context.firestore(),newFid='new-family',newCode='c'.repeat(48),batch=writeBatch(d);batch.set(doc(d,'passinhoFamilies',newFid),{...root,ownerUid:'new-owner',children:{},tasks:{},guardians:{'new-owner':{id:'new-owner',name:'Novo',email:'x@example.invalid'}}});batch.set(doc(d,'passinhoFamilies',newFid,'members','new-owner'),{uid:'new-owner',role:'admin',createdAt:serverTimestamp()});batch.set(doc(d,'passinhoFamilies',newFid,'members','new-kid'),{uid:'new-kid',role:'child',createdAt:serverTimestamp()});batch.set(doc(d,'passinhoPairings',newCode),{familyId:newFid,createdBy:'new-owner',createdAt:serverTimestamp()});batch.set(doc(d,'passinhoFamilies',newFid,'private','settings'),{pairingCode:newCode});await assertSucceeds(batch.commit());});
test('um visitante anônimo não pode criar família com privilégios de responsável',async()=>{await assertFails(setDoc(doc(db('anonymous-attacker'),'passinhoFamilies','bad-family'),{...root,children:{},tasks:{},ownerUid:'anonymous-attacker',guardians:{'anonymous-attacker':{id:'anonymous-attacker'}}}));});
test('dados de famílias diferentes são isolados e documento antigo mantém a regra original',async()=>{await assertFails(getDoc(doc(db(kid),'passinhoFamilies','new-family')));const d=env.unauthenticatedContext().firestore();await assertSucceeds(setDoc(doc(d,'banho','state'),{children:[],startDate:null,startChildId:null}));assert.equal((await getDoc(doc(d,'banho','state'))).exists(),true);});

test('criança só marca tarefa única na data agendada, sem repetir na semana seguinte',async()=>{
 const task={id:'once',childId:'c',versions:[{from:today,fromDay:dayNumber(today),title:'Única',repeat:'once',onDate:addDays(today,7),weekdays:[0,1,2,3,4,5,6],active:true,icon:0}]};
 await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(doc(ctx.firestore(),'passinhoFamilies',fid),{'tasks.once':task});});
 const d=db(kid),r=doc(d,'passinhoFamilies',fid,'checks',`c|${today}|once`);
 await assertFails(setDoc(r,check(kid,{taskId:'once'})));
 task.versions[0].onDate=today;
 await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(doc(ctx.firestore(),'passinhoFamilies',fid),{'tasks.once':task});});
 await assertSucceeds(setDoc(r,check(kid,{taskId:'once'})));
 await assertSucceeds(setDoc(r,check(kid,{taskId:'once',status:'pending'})));
});
