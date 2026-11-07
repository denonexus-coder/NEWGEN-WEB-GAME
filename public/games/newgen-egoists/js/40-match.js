/* ===== 40 · Partida: entrar, congelar, retomar, snapshots ===== */
let S=null,F=null;

function sqIdx(t,p){return t.sq.indexOf(p)}

/* guarda o estado exato da partida no fixture (retoma "onde parou") */
function saveSnap(){
  if(!S||NG.view!=='match'||S.fin)return;
  const f=W.fx[NG.cur];
  if(!f||f.done)return;
  const T=[W.T.indexOf(S.tm[0]),W.T.indexOf(S.tm[1])];
  f.snap={
    tm:T,t:S.t,sc:S.sc.slice(),ball:{...S.ball},owner:S.owner,pause:S.pause,hu:S.hu,cp:S.cp,
    st:S.st.map(x=>({...x})),lose:S.lose,over:S.over?1:0,gm:S.gm,gs:S.gs,lt:S.lt,
    sb:S.sb.slice(),ht:S.ht?1:0,rec:S.rec?1:0,msg:S.msg||null,cs:S.cs||0,
    lu:S.lu.map((L,i)=>({st:L.st.map(p=>sqIdx(S.tm[i],p)),bn:L.bn.map(p=>sqIdx(S.tm[i],p))})),
    P:S.P.map(p=>({i:p.i,s:p.s,r:p.r,pl:sqIdx(S.tm[p.s],p.pl),nrg:p.nrg,x:p.x,z:p.z,
      vx:p.vx,vz:p.vz,a:p.a,cd:p.cd,dash:p.dash,sg:p.sg,hd:p.hd||0,sl:p.sl||0,
      sk:p.sk||0,sf:p.sf||0,stun:p.stun||0,y:p.y||0,out:p.out||0})),
    rs:S.rs?{...S.rs}:null,
    pk:S.pk?{s:S.pk.s,bx:S.pk.bx,t:S.pk.t,i:S.pk.i,pos:S.pk.pos.slice(),
      line:S.pk.line,rc:S.pk.rc==null?null:S.pk.rc}:null
  };
}

/* reconstrói a partida a partir do snapshot (referências voltam aos elencos) */
function loadSnap(f){
  const g=f.snap;
  if(!g)return null;
  const T=[W.T[g.tm[0]],W.T[g.tm[1]]];
  if(!T[0]||!T[1])return null;
  T.forEach(t=>t.sq.forEach(q=>{q.used=0}));
  const Sx={
    tm:T,t:g.t,sc:g.sc.slice(),P:[],ball:{...g.ball},owner:g.owner,pause:g.pause,hu:g.hu,cp:g.cp,
    st:g.st.map(x=>({...x})),lose:g.lose,over:!!g.over,gm:g.gm,gs:g.gs,lt:g.lt,
    sb:g.sb.slice(),ht:g.ht?1:0,rec:g.rec?1:0,msg:g.msg||null,cs:g.cs||0,fin:0,gl:[],
    lu:g.lu.map((L,i)=>({st:L.st.map(k=>T[i].sq[k]),bn:L.bn.map(k=>T[i].sq[k])})),
    rs:g.rs?{...g.rs}:null,
    pk:g.pk?{s:g.pk.s,bx:g.pk.bx,t:g.pk.t,i:g.pk.i,pos:g.pk.pos.slice(),
      line:g.pk.line,rc:g.pk.rc}:null
  };
  Sx.P=g.P.map(p=>({...p,pl:T[p.s].sq[p.pl]}));
  if(Sx.P.length!==22)return null;
  return Sx;
}

/* entra numa partida (1=jogar · 0=assistir) */
function go(i,play){
  const f=W.fx[i];
  if(!f||f.done)return;
  const now=Date.now(),mine=fMine(f),st=fStatus(f,now);
  /* R4: a minha partida só tem botão Jogar — nunca Assistir */
  if(mine&&!play)return;
  if(st==='wait'&&!f.snap){toast('⏳ Começa às '+fmtTime(f.kick));return}
  if(st==='late-exp'&&!f.entered){toast('⏰ Prazo de apresentação expirado');return}
  if(!mine&&st!=='live'&&st!=='frozen'){toast(st==='pending'?'⏳ A processar resultado…':'Fora da janela de exibição');return}
  NG.cur=i;F=f;f.entered=1;f.frozen=0;
  S=f.snap?loadSnap(f):null;
  if(!S){f.snap=null;S=newM(W.T[f.a],W.T[f.b],mine?1:0)}
  S.hu=mine?1:0;S.rec=1;S.fin=0;S.gl=[];
  dress(S);
  acc=0;cx=cz=0;
  NG.view='match';
  $('#scr').style.display='none';
  showHUD(true);
  $('#ctl').style.display=mine?'block':'none';
  setupHUD();
  markDirty();save();
}

/* sai da partida → congela tudo nela (R2) */
function exitMatch(){
  if(NG.view!=='match')return;
  if(S&&S.fin){after();return}
  const f=W.fx[NG.cur];
  if(S){saveSnap();if(f&&!f.done)f.frozen=1}
  S=null;F=null;NG.view='menu';NG.cur=-1;
  showHUD(false);$('#ctl').style.display='none';
  closePause();
  markDirty();save();
  tab='r';menu();
}

/* guarda imediatamente (usado pelo launcher antes de destruir o iframe
   e quando a APP vai para background) — e congela a partida atual */
function ngSaveNow(){
  try{
    if(NG.view==='match'&&S&&!S.fin){const f=W.fx[NG.cur];if(f&&!f.done){saveSnap();f.frozen=1}}
    save();
  }catch(e){}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)ngSaveNow()});
addEventListener('pagehide',()=>ngSaveNow());
