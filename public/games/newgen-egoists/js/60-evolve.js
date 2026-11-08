/* ===== 60 · Evolução, época e forfeit ===== */
/* ---------- EVOLUÇÃO ---------- */
function apply(S,f){const L=[];f.done=1;f.sc=S.sc.slice();
W.hist=(W.hist||[]);W.hist.unshift({r:W.rd,a:f.a,b:f.b,sc:f.sc.slice(),forf:!!f.forf});if(W.hist.length>12)W.hist.pop();
[0,1].forEach(i=>{const T=S.tm[i],O=S.tm[1-i],st=S.st[i],os=S.st[1-i],gf=S.sc[i],ga=S.sc[1-i],r=gf>ga?1:gf==ga?.5:0,g=T.g;
const ov0=T.ovr;T.pl++;T.gf+=gf;T.ga+=ga;T.pts+=r==1?3:r?1:0;r==1?T.w++:r?T.d++:T.l++;
T.last=(T.last||[]);T.last.push(r==1?'V':r==.5?'E':'D');if(T.last.length>5)T.last.shift();
const pr=Math.round((r==1?100:r?30:0)*(1+T.greed));T.mo+=pr;
if(r==1){T.ovr+=.3+T.amb*.6;g.drib+=T.ego*.05;g.pass-=T.ego*.03;if(T.ego>.6)L.push(`${T.n} venceu e o ego cresceu: mais dribles, menos passes`);if(T.greed>.6)L.push(`${T.n} ganhou € ${pr} e investiu em treino`)}
if(st.cnt){g.line-=.06*st.cnt;g.risk-=.04*st.cnt;L.push(`${T.n} sofreu ${st.cnt} contra-ataque(s) e recuou a linha`)}
if(os.far>=3){g.press+=.06;L.push(`${T.n} viu chutes de longe e passou a pressionar mais`)}
if(st.lo>3){g.risk-=.05;g.pass-=.02;L.push(`${T.n} perdeu bolas no próprio campo e joga mais seguro`)}
if(st.cd>=2){g.press-=.06;L.push(`${T.n} levou cart\u00f5es e passou a jogar mais limpo`)}if(st.sh<3){g.shoot+=.07;L.push(`${T.n} chutou pouco e vai finalizar mais`)}
if(os.dr>=6){g.line-=.03;L.push(`${T.n} estudou os dribles de ${O.n} e fechou espaços`)}
if(r==0){T.ovr+=T.amb*.25-.1;GN.forEach(k=>g[k]+=(O.g[k]-g[k])*T.env*.3);L.push(`${T.n} com inveja copiou o estilo de ${O.n}`)}
if(ga-gf>=2){T.fm=((T.fm||0)+1)%3;L.push(`${T.n} mudou o esquema para ${['4-3-3','4-4-2','3-5-2'][T.fm]}`)}GN.forEach(k=>g[k]=cl(g[k]+(rnd()-.5)*.08*(.5+T.amb),.05,.98));T.ovr=cl(T.ovr,50,92);const dv=T.ovr-ov0;T.sq.forEach(q=>{for(const k in q.a)q.a[k]=cl(q.a[k]+dv+(rnd()-.5)*.6,30,97);if(q.inj>0){if(q.hm)q.hm=0;else q.inj--}});T.ovr=ovrOf(T)});
const a=S.tm[0].n+' '+S.sc[0]+'–'+S.sc[1]+' '+S.tm[1].n;W.log.unshift('Rodada '+W.rd+': '+a);L.slice(0,4).forEach(x=>W.log.unshift('↳ '+x));W.log.length=Math.min(W.log.length,40);return L}
function quick(f){const S=newM(W.T[f.a],W.T[f.b],0);while(!S.over)step(S,.05);return apply(S,f)}
function adv(){if(W.fx.every(f=>f.done)){if((W.rd-1)%7==6){const o=[...W.T.keys()].sort((a,b)=>W.T[b].pts-W.T[a].pts||(W.T[b].gf-W.T[b].ga)-(W.T[a].gf-W.T[a].ga)),c=W.T[o[0]];c.tit=(c.tit||0)+1;c.mo+=Math.round(500*(1+c.greed));c.ovr=cl(c.ovr+.5+c.amb,50,92);W.ch=c.n;W.log.unshift('🏆 Temporada '+(W.ss||1)+': '+c.n+' campeã!');W.ss=(W.ss||1)+1;W.T.forEach(t=>{t.pts=t.pl=t.w=t.d=t.l=t.gf=t.ga=0})}W.rd++;newRound()}save()}
/* forfeit: derrota 0–3 por não comparecimento + penalidades (R7) */
function doForfeit(f){
  const me=W.me,opp=f.a==me?f.b:f.a;
  f.forf=1;
  const S2={tm:[W.T[f.a],W.T[f.b]],sc:f.a==me?[0,3]:[3,0],
    st:[0,1].map(()=>({sh:0,far:0,lo:0,cnt:0,dr:0,fl:0,cd:0}))};
  apply(S2,f); /* f.done=1, evolução e histórico */
  const t=W.T[me],multa=Math.max(150,Math.round(t.mo*.1));
  t.mo=Math.max(0,t.mo-multa);
  t.sq.forEach(q=>{for(const k in q.a)q.a[k]=cl(q.a[k]-1,30,97)});
  t.ovr=ovrOf(t);
  W.log.unshift('🚨 '+t.n+' não se apresentou — derrota 0-3 (w.o.) vs '+W.T[opp].n+' · multa €'+multa+' · OVR '+t.ovr.toFixed(0));
  W.log.length=Math.min(W.log.length,40);
  showForfeitModal(f,multa);
}
