/* ===== 10 · Mundo: constantes, equipas, save, migração ===== */
const HX=51.6,HZ=34.4,GW=3.66,DUR=150,$=q=>document.querySelector(q),rnd=Math.random,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const GN=['press','line','pass','shoot','drib','risk'],GL={press:'Pressão',line:'Linha alta',pass:'Passe',shoot:'Chute',drib:'Drible',risk:'Risco'};
const D=[['Leões de Aço','#e63946','#ffffff','Pressão alta',[.9,.8,.5,.5,.4,.6],[.5,.4,.7,.3]],
['Tigres do Norte','#f4a261','#222222','Contra-ataque',[.3,.3,.6,.6,.5,.7],[.4,.6,.5,.5]],
['Estrelas FC','#4361ee','#ffffff','Tiki-taka',[.5,.6,.95,.4,.3,.3],[.2,.3,.6,.2]],
['Dragões Verdes','#2a9d8f','#ffffff','Jogo direto',[.5,.5,.4,.8,.4,.8],[.5,.5,.4,.4]],
['Fúria Negra','#2b2b2b','#e63946','Individualista',[.5,.5,.1,.7,.95,.7],[.95,.7,.6,.8]],
['Corvos Reais','#7b2cbf','#ffffff','Retranca',[.2,.15,.5,.4,.3,.2],[.3,.5,.3,.6]],
['Sol Dourado','#ffd60a','#222222','Ataque total',[.7,.9,.5,.9,.6,.8],[.6,.9,.9,.5]],
['Gelo Azul','#90e0ef','#023047','Posse',[.6,.55,.85,.35,.35,.3],[.2,.2,.8,.3]]];
function mk(d){const g={};GN.forEach((k,i)=>g[k]=d[4][i]);return{n:d[0],c1:d[1],c2:d[2],sty:d[3],g,ego:d[5][0],greed:d[5][1],amb:d[5][2],env:d[5][3],ovr:62+Math.round(rnd()*10),fm:rnd()*3|0,pts:0,pl:0,w:0,d:0,l:0,gf:0,ga:0,mo:0,last:[]}}
let W;try{W=JSON.parse(localStorage.getItem('ngne2'))}catch(e){}
if(!W||!W.T)W={T:D.map(mk),me:null,rd:1,fx:[],log:['Mundo criado. Todos querem a glória.']};
/* estado de sessão da UI/jogo (não persistido) */
const NG={view:'menu',cur:-1,paused:false,hudOn:false,dirty:false};
function markDirty(){NG.dirty=true}
function save(){
  try{
    localStorage.setItem('ngne2',JSON.stringify(W));
    NG.dirty=false;
    const el=document.getElementById('saved');
    if(el){el.innerHTML='<i class="dg"></i>Guardado ✓';el.classList.remove('pk');void el.offsetWidth;el.classList.add('pk')}
  }catch(e){}
}
function po(q){return(q.spd+q.sht+q.pas+q.dri+q.def+q.stm)/6}
function ovrOf(t){return[...t.sq].map(po).sort((x,y)=>y-x).slice(0,11).reduce((x,y)=>x+y,0)/11}
/* todos os nomes já usados no mundo (elencos existentes) */
function allNames(){const u=new Set();W.T.forEach(t=>{if(t.sq)t.sq.forEach(q=>u.add(q.n))});return u}
function giveSquad(t){
  const G=['G','G','D','D','D','D','D','M','M','M','M','M','M','F','F','F','F','F'],
        NO=[1,12,2,3,4,5,13,6,8,14,15,16,7,9,10,11,17,18],
        B={G:[-10,-25,-10,-20,12,0],D:[0,-12,0,-8,12,2],M:[0,0,10,4,0,6],F:[5,12,-4,10,-14,0]},
        K=['spd','sht','pas','dri','def','stm'],u=allNames();
  t.sq=G.map((g,i)=>{
    const n=mkPlayerName(u),a={};
    K.forEach((k,j)=>a[k]=cl(Math.round(t.ovr+B[g][j]+(rnd()-.5)*18),35,95));
    return{n,g,no:NO[i],a,inj:0,gl:0}
  });
  t.ovr=ovrOf(t);
}
/* migração de saves antigos + garantias do mundo novo */
function migrateWorld(){
  if(!W.T||!W.T.length){W={T:D.map(mk),me:null,rd:1,fx:[],log:['Mundo criado.']}}
  W.T.forEach(t=>{if(!t.sq||!t.sq.length)giveSquad(t)});
  /* nomes únicos em TODO o mundo (não só por equipa) */
  const used=allNames(); /* todos os nomes originais */
  const seen=new Set();  /* nomes já atribuídos */
  W.T.forEach(t=>t.sq.forEach(q=>{
    if(seen.has(q.n))q.n=mkPlayerName(used); /* repete → novo nome nunca usado */
    seen.add(q.n);
    used.add(q.n);
  }));
  /* treinador por equipa */
  const cu=new Set();
  W.T.forEach(t=>{if(!t.coach){t.coach=mkCoachName(cu);cu.add(t.coach)}else cu.add(t.coach)});
  /* extras */
  W.T.forEach(t=>{if(!t.last)t.last=[]});
  if(!W.log)W.log=['Mundo criado.'];
  if(!W.ss)W.ss=1;
  if(!W.hist)W.hist=[];
  /* calendário: fixtures antigos sem datas são reagendados a partir de agora */
  if(!W.fx||!W.fx.length){newRound()}
  else{
    let need=false;
    W.fx.forEach(f=>{if(!f.done&&f.kick==null)need=true});
    if(need){
      const base=Date.now();let k=0;
      W.fx.forEach(f=>{if(!f.done){f.kick=base+k*STAG;f.end=f.kick+WIN;k++}});
    }
    W.fx.forEach(f=>{
      if(f.frozen==null)f.frozen=0;
      if(f.entered==null)f.entered=0;
      if(f.snap===undefined)f.snap=null;
      if(f.forf==null)f.forf=0;
      if(f.shown==null)f.shown=0;
    });
  }
  W._v=2;
}
