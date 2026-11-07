/* ===== 20 · Calendário: datas/horas, janelas e estados das partidas ===== */
const DAY_MS=864e5,STAG=5*60000,WIN=DUR*1000; /* janela: T+0/5/10/15 · 150s de jogo */
function fMine(f){return f.a==W.me||f.b==W.me}
/* nova rodada com horários reais (escalonação nunca sobrepõe partidas) */
function newRound(){
  const r=(W.rd-1)%7,arr=[1,2,3,4,5,6,7],seq=[0,...arr.map((_,i)=>arr[(i-r+7)%7])];
  W.fx=[];const base=Date.now();
  for(let i=0;i<4;i++)W.fx.push({a:seq[i],b:seq[7-i],done:0,kick:base+i*STAG,end:base+i*STAG+WIN,frozen:0,entered:0,snap:null,forf:0,shown:0});
  W.fx.forEach(f=>{if(f.b==W.me||(f.a!=W.me&&rnd()<.5))[f.a,f.b]=[f.b,f.a]});
}
/* estados: done | frozen | wait | late | live | pending | late-exp */
function fStatus(f,now){
  if(f.done)return'done';
  if(f.frozen)return'frozen';
  if(fMine(f)){
    if(now<f.kick)return'wait';
    if(now>f.kick+DAY_MS)return'late-exp';
    return'late';
  }
  if(now<f.kick)return'wait';
  if(now<f.end)return'live';
  return'pending';
}
function fmtTime(ms){return new Date(ms).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
function fmtDay(ms){return new Date(ms).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})}
function fmtGap(ms){
  if(!(ms>0))ms=0;
  const s=ms/1000|0,h=s/3600|0,m=(s%3600)/60|0,ss=s%60,p=n=>String(n).padStart(2,'0');
  return h?h+':'+p(m)+':'+p(ss):p(m)+':'+p(ss);
}
function roundWindow(){
  if(!W.fx.length)return null;
  let a=Infinity,b=-Infinity;
  W.fx.forEach(f=>{if(f.kick<a)a=f.kick;if(f.end>b)b=f.end});
  return[a,b];
}
