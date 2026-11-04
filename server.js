const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const crypto=require('crypto');
const path=require('path');
const app=express();const server=http.createServer(app);const io=new Server(server,{maxHttpBufferSize:1e6});
app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(_,res)=>res.json({ok:true}));
const rooms=new Map();
const clean=(s,n=300)=>String(s??'').trim().slice(0,n);
const uid=()=>crypto.randomBytes(8).toString('hex');
const defaults=()=>[
{id:uid(),type:'choice',title:'Como foi sua energia nesta sprint?',options:['🚀 Voamos alto','😎 Foi tranquila','🎢 Montanha-russa','🔥 Foi intensa'],minutes:3,anonymous:false},
{id:uid(),type:'scale',title:'Como você avalia a colaboração do time?',minutes:3,anonymous:false},
{id:uid(),type:'open',title:'Qual foi a maior conquista da sprint?',minutes:6,anonymous:false},
{id:uid(),type:'open',title:'O que dificultou nossas entregas?',minutes:8,anonymous:true},
{id:uid(),type:'vote',title:'Qual dificuldade devemos priorizar?',options:['Dependências','Bugs e retrabalho','Comunicação','Prazos e capacidade'],minutes:5,anonymous:true},
{id:uid(),type:'open',title:'Que ação concreta devemos levar para a próxima sprint?',minutes:7,anonymous:false}
];
function publicRoom(r){return {code:r.code,squad:r.squad,phase:r.phase,index:r.index,questions:r.questions,participants:[...r.members.values()].map(x=>({id:x.id,name:x.name,avatar:x.avatar,online:x.online})),answers:r.answers,actions:r.actions,startedAt:r.startedAt,phaseAt:r.phaseAt,paused:r.paused,remaining:r.remaining,xp:r.xp,finished:r.finished};}
function publish(r){io.to(r.code).emit('state',publicRoom(r));}
function result(cb,data){if(typeof cb==='function')cb(data);}
function validQuestion(q){const type=['choice','scale','open','vote'].includes(q?.type)?q.type:'open';return {id:clean(q.id,40)||uid(),type,title:clean(q.title,240)||'Pergunta sem título',options:(type==='choice'||type==='vote')?(Array.isArray(q.options)?q.options:[]).slice(0,6).map(x=>clean(x,100)).filter(Boolean):[],minutes:Math.max(1,Math.min(30,Number(q.minutes)||5)),anonymous:!!q.anonymous};}
function host(s,r){return !!r&&r.hostToken===s.data.hostToken;}
function member(s,r){return r?.members.get(s.data.memberId);}
function joinSocket(s,r){if(s.data.code&&s.data.code!==r.code)s.leave(s.data.code);s.data.code=r.code;s.join(r.code);}
io.on('connection',s=>{
 s.on('create',(data,cb)=>{const code=String(Math.floor(100000+Math.random()*900000));const token=uid()+uid();const id=uid();const name=clean(data?.name,35)||'Facilitador';const r={code,squad:clean(data?.squad,65)||'Minha squad',hostToken:token,hostId:id,phase:'lobby',index:0,questions:defaults(),members:new Map([[id,{id,name,avatar:clean(data?.avatar,5)||'🎮',online:true}]]),answers:{},actions:[],xp:0,startedAt:null,phaseAt:null,paused:false,remaining:0,finished:false};rooms.set(code,r);s.data={code,memberId:id,hostToken:token};joinSocket(s,r);result(cb,{ok:true,code,token,id});publish(r);});
 s.on('join',(data,cb)=>{const r=rooms.get(clean(data?.code,6));if(!r)return result(cb,{error:'Sala não encontrada. Confira o PIN.'});let id=clean(data?.id,40);let m=id&&r.members.get(id);if(!m){id=uid();m={id,name:clean(data?.name,35)||'Jogador',avatar:clean(data?.avatar,5)||'😎',online:true};r.members.set(id,m);}else m.online=true;const isHost=id===r.hostId&&clean(data?.token,100)===r.hostToken;s.data={code:r.code,memberId:id,hostToken:isHost?r.hostToken:null};joinSocket(s,r);result(cb,{ok:true,code:r.code,id,token:isHost?r.hostToken:null});publish(r);});
 s.on('configure',(data,cb)=>{const r=rooms.get(s.data.code);if(!host(s,r))return result(cb,{error:'Somente o facilitador pode editar.'});if(r.phase!=='lobby')return result(cb,{error:'Edite as perguntas antes de iniciar.'});const questions=Array.isArray(data?.questions)?data.questions.slice(0,40).map(validQuestion):[];if(!questions.length)return result(cb,{error:'Adicione pelo menos uma pergunta.'});for(const q of questions)if(['choice','vote'].includes(q.type)&&q.options.length<2)return result(cb,{error:'Perguntas de alternativas precisam de pelo menos duas opções.'});r.questions=questions;r.squad=clean(data?.squad,65)||r.squad;result(cb,{ok:true});publish(r);});
 s.on('control',(data,cb)=>{const r=rooms.get(s.data.code);if(!host(s,r))return result(cb,{error:'Ação exclusiva do facilitador.'});const action=data?.action;if(action==='start'&&r.phase==='lobby'){r.phase='question';r.index=0;r.startedAt=Date.now();r.phaseAt=Date.now();r.remaining=r.questions[0].minutes*60;r.paused=false;}else if(action==='reveal'&&r.phase==='question'){r.phase='results';r.remaining=0;}else if(action==='next'&&r.phase==='results'){if(r.index+1>=r.questions.length){r.phase='actions';r.phaseAt=Date.now();}else{r.index++;r.phase='question';r.phaseAt=Date.now();r.remaining=r.questions[r.index].minutes*60;r.paused=false;}}else if(action==='finish'&&r.phase==='actions'){r.phase='finished';r.finished=true;}else if(action==='pause'&&r.phase==='question'){r.paused=!r.paused;}else if(action==='backLobby'&&r.phase==='finished'){r.phase='lobby';r.index=0;r.answers={};r.actions=[];r.xp=0;r.finished=false;r.startedAt=null;}else return result(cb,{error:'Comando não disponível nesta etapa.'});result(cb,{ok:true});publish(r);});
 s.on('answer',(data,cb)=>{const r=rooms.get(s.data.code),m=member(s,r);if(!r||!m||r.phase!=='question')return result(cb,{error:'A rodada não está aberta.'});const q=r.questions[r.index],key=q.id;if(!r.answers[key])r.answers[key]={};if(r.answers[key][m.id])return result(cb,{error:'Você já respondeu esta pergunta.'});let value;if(q.type==='scale'){value=Number(data?.value);if(!Number.isInteger(value)||value<1||value>5)return result(cb,{error:'Escolha uma nota de 1 a 5.'});}else if(['choice','vote'].includes(q.type)){value=Number(data?.value);if(!Number.isInteger(value)||value<0||value>=q.options.length)return result(cb,{error:'Selecione uma alternativa.'});}else{value=clean(data?.value,500);if(!value)return result(cb,{error:'Escreva sua resposta.'});}r.answers[key][m.id]={value,at:Date.now()};r.xp+=100;result(cb,{ok:true});publish(r);});
 s.on('addAction',(data,cb)=>{const r=rooms.get(s.data.code),m=member(s,r);if(!r||!m||r.phase!=='actions')return result(cb,{error:'Os planos de ação ainda não estão abertos.'});const title=clean(data?.title,240);if(!title)return result(cb,{error:'Descreva a ação.'});r.actions.push({id:uid(),title,owner:clean(data?.owner,80),due:clean(data?.due,15),createdBy:m.name});r.xp+=150;result(cb,{ok:true});publish(r);});
 s.on('disconnect',()=>{const r=rooms.get(s.data.code),m=member(s,r);if(m){m.online=false;publish(r);}});
});
setInterval(()=>{for(const r of rooms.values()){if(r.phase==='question'&&!r.paused&&r.remaining>0){r.remaining--;if(r.remaining===0)r.phase='results';publish(r);}}},1000);
server.listen(process.env.PORT||3000,()=>console.log('Sprint Challenge iniciado'));
