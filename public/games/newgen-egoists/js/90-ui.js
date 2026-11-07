/* ===== 90 · UI: menus, HUD, pausa, modais, loop principal ===== */
let tab='d',sel=0,acc=0,frameL=0;
let HL={pl:null}; /* HUD cacheado */

/* ---------- helpers ---------- */
function pct(v){return Math.round(v*100)}
function bar(l,v,c){return `<div class="bar"><span>${l}</span><div class="tr"><b style="width:${pct(v)}%${c?`;background:${c}`:''}"></b></div><em>${pct(v)}</em></div>`}
function posG(g){return g=='G'?'GOL':g=='D'?'DEF':g=='M'?'MEI':'ATA'}
function formBad(t){const a=t.last||[];if(!a.length)return'<span class="fdim">—</span>';return a.map(x=>`<span class="f ${x=='V'?'v':x=='E'?'e':'d'}">${x}</span>`).join('')}
function ovrColor(o){return o>=75?'var(--win)':o>=68?'var(--ac)':'var(--gold)'}
function standings(){return[...W.T.keys()].sort((a,b)=>W.T[b].pts-W.T[a].pts||(W.T[b].gf-W.T[b].ga)-(W.T[a].gf-W.T[a].ga)||W.T[b].gf-W.T[a].gf)}
function myPos(){return standings().indexOf(W.me)+1}
function cc(i){return S&&S.tm[i].c1=='#2b2b2b'?'#aaa':(S?S.tm[i].c1:'#fff')}
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>{e.style.display='none'},1900)}

/* ---------- notificações (banner) ---------- */
function notif(text,kind){
  const c=$('#notif');if(!c)return;
  const d=document.createElement('div');
  d.className='nft '+(kind||'');d.textContent=text;
  c.appendChild(d);
  setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),320)},4400);
}

/* ---------- HUD do jogo ---------- */
function showHUD(on){NG.hudOn=on;$('#sb').style.display=on?'flex':'none'}
function setupHUD(){
  HL={pl:null};
  const c0=S.tm[0].c1=='#2b2b2b'?'#aaa':S.tm[0].c1,c1=S.tm[1].c1=='#2b2b2b'?'#aaa':S.tm[1].c1;
  $('#h-c0').style.background=c0;$('#h-c1').style.background=c1;
  $('#h-a0').textContent=S.tm[0].n.slice(0,3).toUpperCase();
  $('#h-a1').textContent=S.tm[1].n.slice(0,3).toUpperCase();
}
function hud(){
  if(!S||!NG.hudOn)return;
  const m=S.t/DUR*90,mm=Math.min(90,m|0),ss=Math.floor((m%1)*60);
  const tstr=mm+':'+String(ss).padStart(2,'0');
  if(HL.t!==tstr){HL.t=tstr;$('#h-t').textContent=tstr}
  if(HL.s0!==S.sc[0]){HL.s0=S.sc[0];$('#h-s0').textContent=S.sc[0]}
  if(HL.s1!==S.sc[1]){HL.s1=S.sc[1];$('#h-s1').textContent=S.sc[1]}
  const half=S.t>=DUR/2?'2º T':'1º T';
  if(HL.h!==half){HL.h=half;$('#h-half').textContent=half}
  if(S.hu&&S.cp>=0){
    const p=S.P[S.cp],n=Math.round(p.nrg);
    if(HL.pl!==p.pl){HL.pl=p.pl;$('#h-pl').style.display='';$('#h-pln').textContent=p.pl.n.split(' ').slice(-1)[0]}
    if(HL.e!==n){HL.e=n;$('#h-pre').textContent='⚡'+n+'%'}
  }else if(HL.pl!==null){HL.pl=null;$('#h-pl').style.display='none'}
  if(S.gm!=null){toast(S.gm<0?'INTERVALO':'GOL! '+S.tm[S.gm].n+(S.gn?' · '+S.gn:''));S.gm=null}
  if(S.msg){toast(S.msg);S.msg=null}
  if(charging)$('#bs').style.background=`linear-gradient(90deg,#ffe600 ${chg*100}%,#e6394699 ${chg*100}%)`;
}

/* ---------- modais ---------- */
function modalOpen(){return !$('#modal').classList.contains('hidden')}
function showModal(title,body,actions){
  $('#md-t').textContent=title;
  $('#md-b').innerHTML=body;
  NG.acts=actions||[];
  const a=$('#md-a');a.innerHTML='';
  NG.acts.forEach((act,i)=>{
    const b=document.createElement('button');
    b.className='btn '+(act.cls||'');
    b.dataset.act='mda';b.dataset.v=String(i);
    b.textContent=act.label;
    a.appendChild(b);
  });
  $('#modal').classList.remove('hidden');
}
function hideModal(){$('#modal').classList.add('hidden');NG.acts=[]}
function showKickModal(i){
  if(modalOpen())return false;
  const f=W.fx[i],now=Date.now(),late=now>f.kick+15*60000;
  const opp=f.a==W.me?W.T[f.b]:W.T[f.a];
  if(late){
    showModal('🟡 APRESENTAÇÃO PENDENTE',
      `<p><b>${W.T[W.me].n}</b> × ${opp.n}</p><p>${fmtDay(f.kick)} · ${fmtTime(f.kick)}</p>
       <p class="warn">Prazo: <b data-cd="${f.kick+DAY_MS}">${fmtGap(f.kick+DAY_MS-now)}</b> para te apresentares.<br>Sem presença → derrota 0–3 + multa.</p>`,
      [{label:'⚽ Entrar e jogar',cls:'pri',fn:()=>{hideModal();go(i,1)}},
       {label:'Depois',cls:'ghost',fn:hideModal}]);
  }else{
    showModal('⚽ SUA PARTIDA COMEÇOU',
      `<p><b>${W.T[W.me].n}</b> × ${opp.n}</p><p>${fmtDay(f.kick)} · ${fmtTime(f.kick)}</p>
       <p>O adversário espera por ti!</p>`,
      [{label:'⚽ ENTRAR AGORA',cls:'pri',fn:()=>{hideModal();go(i,1)}},
       {label:'Depois',cls:'ghost',fn:hideModal}]);
  }
  return true;
}
function showForfeitModal(f,multa){
  const opp=f.a==W.me?W.T[f.b]:W.T[f.a],t=W.T[W.me];
  showModal('🟥 DERROTA POR NÃO COMPARECIMENTO',
    `<p class="bigsc">${t.n} 0 – 3 (w.o.) ${opp.n}</p>
     <p class="warn">Penalidades: multa €${multa} · OVR ${t.ovr.toFixed(0)}</p>
     <p>Registado no Diário do Mundo.</p>`,
    [{label:'Continuar',cls:'pri',fn:hideModal}]);
}

/* ---------- pausa ---------- */
function toHost(t){try{if(window.parent&&window.parent!==window)window.parent.postMessage({ng:t},'*')}catch(e){}}
function openPause(){
  if(NG.paused)return;
  NG.paused=true;
  $('#pov-t').textContent=S?'PARTIDA PAUSADA':'PAUSADO';
  if(S){
    $('#pov-sc').innerHTML=`<span style="color:${cc(0)}">${S.tm[0].n.slice(0,3).toUpperCase()}</span> ${S.sc[0]} – ${S.sc[1]} <span style="color:${cc(1)}">${S.tm[1].n.slice(0,3).toUpperCase()}</span> <small>${Math.min(90,S.t/DUR*90|0)}'</small>`;
    $('#pov-exit').style.display=S.fin?'none':'';
    if(!S.fin)saveSnap();
  }else{
    $('#pov-sc').textContent='';
    $('#pov-exit').style.display='none';
  }
  $('#pov').classList.remove('hidden');
  toHost('paused');
}
function closePause(){
  if(!NG.paused)return;
  NG.paused=false;
  $('#pov').classList.add('hidden');
  toHost('resumed');
}
/* ponte com o launcher */
addEventListener('message',e=>{
  const d=e.data;
  if(!d||typeof d!=='object')return;
  if(d.ng==='pause')openPause();
  else if(d.ng==='resume')closePause();
});
addEventListener('keydown',e=>{
  if(e.code!=='Escape')return;
  if(modalOpen()){hideModal();return}
  if(NG.paused)closePause();else openPause();
});

/* ---------- cartões de partida ---------- */
function fxHTML(i,variant){
  const f=W.fx[i],now=Date.now(),st=fStatus(f,now),a=W.T[f.a],b=W.T[f.b],mine=fMine(f);
  const kick=`<span class="fxk"><b data-cd="${f.kick}" data-cdf="time">${fmtTime(f.kick)}</b><small>${fmtDay(f.kick)}</small></span>`;
  let pill,cd='',acts='';
  if(st==='done'){
    pill='<span class="pill done">Resultado</span>';
    acts=`<span class="fxsc">${f.sc[0]}–${f.sc[1]}${f.forf?' <small>w.o.</small>':''}</span>`;
  }else if(st==='frozen'){
    pill='<span class="pill frozen">⏸ Congelada</span>';
    acts=mine
      ?'<button class="btn pri" data-act="play" data-v="'+i+'">▶ Retomar</button>'
      :'<button class="btn pri2" data-act="watch" data-v="'+i+'">▶ Retomar</button>';
  }else if(st==='wait'){
    pill='<span class="pill wait">⏳ Agendada</span>';
    acts=`<button class="btn" disabled><span data-cd="${f.kick}">${fmtGap(f.kick-now)}</span></button>`;
  }else if(st==='live'){
    pill='<span class="pill live">● Ao vivo</span>';
    acts=`<button class="btn live" data-act="watch" data-v="${i}">👁 Assistir</button>`;
  }else if(st==='late'){
    pill='<span class="pill late">🟡 Apresentação</span>';
    cd=`prazo <span data-cd="${f.kick+DAY_MS}">${fmtGap(f.kick+DAY_MS-now)}</span>`;
    acts=`<button class="btn pri big" data-act="play" data-v="${i}">⚽ Jogar</button>`;
  }else{
    pill='<span class="pill wait">⌛ Processando</span>';
  }
  const teams=`<span class="fxt"><i class="dot" style="background:${a.c1}"></i><b class="${mine?'mn':''}">${a.n}</b><span class="fxs">${f.done?f.sc[0]+'–'+f.sc[1]:'×'}</span><b class="${f.b==W.me?'mn':''}">${b.n}</b><i class="dot" style="background:${b.c1}"></i></span>`;
  if(variant==='big'){
    const cdBig=st==='done'?`<b>${f.sc[0]} – ${f.sc[1]}</b>${f.forf?' <small>(w.o.)</small>':''}`
      :st==='wait'?`começa em <b data-cd="${f.kick}">${fmtGap(f.kick-now)}</b>`
      :st==='late'?`apresenta-te — prazo <b data-cd="${f.kick+DAY_MS}">${fmtGap(f.kick+DAY_MS-now)}</b>`
      :st==='frozen'?'parada onde ficaste'
      :st==='live'?'a decorrer agora — podes entrar':'…';
    return `<div class="nxt">
      <div class="nxttop">${pill}<span class="fxk" style="margin-left:auto;text-align:right"><b data-cd="${f.kick}" data-cdf="time">${fmtTime(f.kick)}</b> <small>${fmtDay(f.kick)}</small></span></div>
      <div class="nxtteams"><i class="dot" style="background:${a.c1}"></i>${a.n}<span class="fxs">${f.done?f.sc[0]+'–'+f.sc[1]:'×'}</span>${b.n}<i class="dot" style="background:${b.c1}"></i></div>
      <div class="nxtcd">${cdBig}</div>
      <div class="nxtacts">${acts}</div>
    </div>`;
  }
  if(variant==='mini'){
    return `<div class="fxmini">${kick}${teams}${pill}</div>`;
  }
  return `<span class="fxl">${kick}${pill}</span>${teams}<span class="fxr">${cd?`<span class="fxcd">${cd}</span>`:''}${acts}</span>`;
}

/* ---------- telas ---------- */
function screenPick(){
  return `<header class="mhead"><div class="brand">NEWGEN<i>·</i>NEWEGOISTS</div>
    <div class="season">Escolhe o teu clube</div></header>
    <p class="lead">As outras 7 equipas evoluem sozinhas — ego, ganância, ambição e inveja movem o mundo. Tens uma partida por rodada: só tu podes jogá-la.</p>
    <div class="teams">${W.T.map((t,i)=>`<button class="tcard" data-act="team" data-v="${i}">
      <span class="tbar" style="background:linear-gradient(90deg,${t.c1},${t.c2})"></span>
      <b>${t.n}</b><small>${t.sty}</small>
      <span class="tmeta"><i class="dot" style="background:${t.c1}"></i> OVR ${t.ovr|0} · ${t.coach||'—'}</span>
    </button>`).join('')}</div>`;
}
function dashNotif(mi){
  if(mi<0){
    if(W.fx.length&&W.fx.every(f=>f.done))return '<div class="nft good">✅ Rodada completa — resultados registados no calendário.</div>';
    return '';
  }
  const f=W.fx[mi],now=Date.now(),st=fStatus(f,now);
  if(st==='late')return `<div class="nft warn">🟡 Apresentação pendente — prazo <b data-cd="${f.kick+DAY_MS}">${fmtGap(f.kick+DAY_MS-now)}</b>. Sem presença: 0–3 + multa.</div>`;
  if(st==='frozen')return '<div class="nft">⏸ Partida congelada — entra para continuar de onde parou.</div>';
  if(st==='wait')return `<div class="nft">⏳ Sua partida às <b>${fmtTime(f.kick)}</b> (${fmtDay(f.kick)}).</div>`;
  return '';
}
function screenDash(){
  const t=W.T[W.me],pos=myPos();
  let mi=-1;W.fx.forEach((f,i)=>{if(fMine(f)&&!f.done)mi=i});
  const others=W.fx.map((f,i)=>({f,i})).filter(x=>!fMine(x.f));
  const hist=(W.hist||[]).slice(0,5);
  return `<div class="dash">
  <section class="card col">
    <div class="clabel">O meu clube</div>
    <div class="tname"><i class="dot big" style="background:${t.c1}"></i><div><b>${t.n}</b><small>${t.sty} · ${['4-3-3','4-4-2','3-5-2'][t.fm||0]}</small></div></div>
    <div class="kv"><span>Treinador</span><b>${t.coach||'—'}</b></div>
    <div class="kv"><span>Posição</span><b>${pos}º de 8</b></div>
    <div class="kv"><span>Pontos</span><b>${t.pts} pts · ${t.pl} J</b></div>
    ${bar('OVR',cl((t.ovr-50)/42,0,1))}
    <div class="formrow">${formBad(t)}<span class="fdim">forma (V/E/D)</span></div>
  </section>
  <section class="card col">
    <div class="clabel">Próxima partida</div>
    ${mi>=0?fxHTML(mi,'big'):'<div class="empty">Nenhuma partida pendente.</div>'}
    <div class="clabel" style="margin-top:6px">Outras da rodada</div>
    ${others.map(x=>fxHTML(x.i,'mini')).join('')||'<div class="empty">—</div>'}
  </section>
  <section class="card col">
    <div class="clabel">Classificação</div>
    ${standings().slice(0,4).map((i,k)=>{const x=W.T[i];return `<div class="rank ${i==W.me?'me':''}"><span>${k+1}</span><i class="dot" style="background:${x.c1}"></i><b>${x.n}</b><em>${x.pts}</em></div>`}).join('')}
    <div class="clabel" style="margin-top:8px">Últimos resultados</div>
    ${hist.length?hist.map(h=>`<div class="hres"><b>${W.T[h.a].n}</b><span>${h.sc[0]}–${h.sc[1]}</span><b>${W.T[h.b].n}</b></div>`).join(''):'<div class="empty">Ainda sem resultados</div>'}
    ${dashNotif(mi)}
  </section>
</div>`;
}
function screenRound(){
  const w=roundWindow(),now=Date.now();
  const nfz=W.fx.filter(f=>f.frozen).length;
  const doneAll=W.fx.every(f=>f.done);
  return `<div class="card rhead">
    <div><div class="clabel">Janela da rodada</div><b>${w?fmtDay(w[0])+' · '+fmtTime(w[0])+' → '+fmtTime(w[1]):'—'}</b></div>
    <div><div class="clabel">Estado</div>${doneAll?'<span class="pill done">Completa</span>':nfz?`<span class="pill frozen">${nfz} congelada(s)</span>`:'<span class="pill live">Em curso</span>'}</div>
    <div class="rinfo">${W.ch?'🏆 '+W.ch+' · ':''}Temporada ${W.ss||1} · Rodada ${(W.rd-1)%7+1}/7</div>
  </div>
  ${W.fx.map((f,i)=>{const st=fStatus(f,now);return `<div class="fx ${fMine(f)?'mine':''} ${st=='live'?'live':''}">${fxHTML(i,'row')}</div>`}).join('')}
  <p class="hint2">Sem botões de velocidade — tudo corre a tempo real. Saires de uma partida = ela congela; as que não assistes produzem resultado no horário.</p>`;
}
function screenTable(){
  const o=standings();
  const top=W.T.flatMap(t=>t.sq.map(q=>({q,t}))).filter(x=>x.q.gl).sort((a,b)=>b.q.gl-a.q.gl).slice(0,8);
  return `<div class="card">
    <div class="clabel">Classificação · Temporada ${W.ss||1}</div>
    <table class="tbl"><thead><tr><th>#</th><th>Equipa</th><th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GM</th><th>GS</th><th>SG</th><th>Forma</th><th>OVR</th><th>€</th></tr></thead>
    <tbody>${o.map((i,k)=>{const t=W.T[i];return `<tr class="${i==W.me?'me':''}"><td>${k+1}</td><td class="tcell"><i class="dot" style="background:${t.c1}"></i>${t.n}${t.tit?' 🏆':''}</td><td class="pts">${t.pts}</td><td>${t.pl}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td><td>${t.gf-t.ga>0?'+':''}${t.gf-t.ga}</td><td>${formBad(t)}</td><td>${t.ovr|0}</td><td>${t.mo}</td></tr>`}).join('')}</tbody></table>
  </div>
  <div class="card">
    <div class="clabel">Artilheiros</div>
    ${top.length?top.map((x,k)=>`<div class="rank"><span>${k+1}</span><i class="dot" style="background:${x.t.c1}"></i><b>${x.q.n} <small style="color:var(--dim)">(${x.t.n})</small></b><em>⚽ ${x.q.gl}</em></div>`).join(''):'<div class="empty">Sem golos ainda.</div>'}
  </div>`;
}
function screenTeam(){
  const t=W.T[W.me];
  const sq=[...t.sq].sort((a,b)=>po(b)-po(a));
  return `<div class="card">
    <div class="ehead">
      <div class="tname"><i class="dot big" style="background:${t.c1}"></i><div><b>${t.n}</b><small>${t.sty} · OVR ${t.ovr.toFixed(1)}</small></div></div>
      <div class="ekv"><span>Treinador</span><b>${t.coach||'—'}</b></div>
      <div class="ekv"><span>Formação</span><select data-ch="fm">${['4-3-3','4-4-2','3-5-2'].map((x,ix)=>`<option value="${ix}" ${(t.fm||0)==ix?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="ekv"><span>Caixa</span><b>€ ${t.mo}</b></div>
      <div class="ekv"><span>Títulos</span><b>${t.tit||0}</b></div>
    </div>
  </div>
  <div class="cols2">
    <div class="card"><div class="clabel">Tática</div>${GN.map(k=>bar(GL[k],t.g[k])).join('')}</div>
    <div class="card"><div class="clabel">Perfil do clube</div>${bar('Ego',t.ego,'#e63946')}${bar('Ganância',t.greed,'#ffb020')}${bar('Ambição',t.amb,'#4361ee')}${bar('Inveja',t.env,'#7b2cbf')}</div>
  </div>
  <div class="card">
    <div class="clabel">Elenco (${sq.length})</div>
    <table class="tbl sq"><thead><tr><th>#</th><th>Nome</th><th>Pos</th><th>OVR</th><th>Golos</th><th>Estado</th></tr></thead>
    <tbody>${sq.map(q=>{const o=Math.round(po(q));return `<tr><td>${q.no}</td><td class="tcell">${q.n}</td><td>${posG(q.g)}</td><td><span class="ovrbar"><i style="width:${o}%;background:${ovrColor(o)}"></i></span>${o}</td><td>${q.gl||0}</td><td>${q.inj>0?`<span class="pill late">🩹 ${q.inj} jogos</span>`:'<span class="pill done">✓</span>'}</td></tr>`}).join('')}</tbody></table>
  </div>`;
}
function screenWorld(){
  sel=cl(sel,0,W.T.length-1);
  const t=W.T[sel];
  return `<div class="card">
    <div class="clabel">Equipas do mundo</div>
    <div class="tb">${W.T.map((x,i)=>`<button data-act="mteam" data-v="${i}" class="${i==sel?'on':''}"><i class="dot" style="background:${x.c1}"></i>${x.n.split(' ')[0]}</button>`).join('')}</div>
    <div class="tname" style="margin-top:6px"><i class="dot big" style="background:${t.c1}"></i><div><b>${t.n}</b><small>${t.sty} · Treinador ${t.coach||'—'} · OVR ${t.ovr.toFixed(1)}</small></div></div>
    <div class="cols2" style="margin-top:8px">
      <div>${GN.map(k=>bar(GL[k],t.g[k])).join('')}</div>
      <div>${bar('Ego',t.ego,'#e63946')}${bar('Ganância',t.greed,'#ffb020')}${bar('Ambição',t.amb,'#4361ee')}${bar('Inveja',t.env,'#7b2cbf')}</div>
    </div>
    <div class="clabel" style="margin-top:6px">Onze inicial (melhores)</div>
    <div class="mini11">${[...t.sq].sort((a,b)=>po(b)-po(a)).slice(0,11).map(q=>`<span>${q.no} ${q.n} <b>${Math.round(po(q))}</b></span>`).join('')}</div>
  </div>
  <div class="card">
    <div class="clabel">Diário do mundo</div>
    <div class="tl">${W.log.slice(0,20).map(x=>`<div>${x}</div>`).join('')}</div>
  </div>`;
}
function screenSet(){
  return `<div class="cols2">
    <div class="card">
      <div class="clabel">Controles</div>
      <div class="lgd"><span>Joystick / WASD ou setas</span><b>mover</b></div>
      <div class="lgd"><span>PASSE / J</span><b>passar</b></div>
      <div class="lgd"><span>CHUTE / K</span><b>segure para dar força</b></div>
      <div class="lgd"><span>DRIBLE / L</span><b>conduzir</b></div>
      <div class="lgd"><span>SUB</span><b>trocar jogador</b></div>
      <div class="lgd"><span>ESC / botão ⏸</span><b>pausar (tudo congela)</b></div>
    </div>
    <div class="card">
      <div class="clabel">Regras da competição</div>
      <div class="lgd"><span>Sem velocidade</span><b>tudo a tempo real</b></div>
      <div class="lgd"><span>Saires = congela</span><b>retomas onde paraste</b></div>
      <div class="lgd"><span>A tua partida</span><b>só tu a podes jogar</b></div>
      <div class="lgd"><span>Ausência</span><b>+1 dia → 0–3 + multa</b></div>
      <div class="lgd"><span>Outras partidas</span><b>resultam no horário</b></div>
      <div class="lgd"><span>Guardar</span><b>automático</b></div>
    </div>
  </div>
  <div class="card danger-zone">
    <div class="clabel">Zona de perigo</div>
    <div class="dzrow">
      <button class="btn danger" data-act="reset">Reiniciar mundo</button>
      <button class="btn" data-act="switch">Trocar de equipa</button>
    </div>
    <p class="hint2">Reiniciar apaga toda a evolução. Trocar de equipa reinicia a rodada atual com novos horários.</p>
  </div>`;
}

/* ---------- render ---------- */
function headHTML(){
  return `<header class="mhead">
    <div class="brand">NEWGEN<i>·</i>NEWEGOISTS</div>
    <div class="season">Temporada ${W.ss||1} · Rodada ${(W.rd-1)%7+1}/7${W.ch?' · 🏆 '+W.ch:''}</div>
    <div class="saved" id="saved"><i class="dg"></i>Guardado ✓</div>
  </header>`;
}
function tabsHTML(){
  return `<nav class="tabs">${[['d','Dashboard'],['r','Rodada'],['t','Tabela'],['e','Equipe'],['m','Mundo'],['s','⚙ Defs']]
    .map(x=>`<button data-act="tab" data-v="${x[0]}" class="${tab==x[0]?'on':''}">${x[1]}</button>`).join('')}</nav>`;
}
function sigNow(){
  const now=Date.now();
  return W.rd+'|'+W.ss+'|'+W.me+'|'+W.fx.map(f=>fStatus(f,now)).join(',')+'|'+W.fx.filter(f=>f.done).length;
}
function menu(keep){
  const s=$('#scr');
  const oldTop=s.scrollTop,oldTab=tab;
  s.style.display='block';
  s.classList.remove('endmode');
  if(W.me==null){s.innerHTML=screenPick();uiTick.sig=sigNow();return}
  let body='';
  if(tab=='r')body=screenRound();
  else if(tab=='t')body=screenTable();
  else if(tab=='e')body=screenTeam();
  else if(tab=='m')body=screenWorld();
  else if(tab=='s')body=screenSet();
  else body=screenDash();
  s.innerHTML=headHTML()+tabsHTML()+`<main class="mbody">${body}</main>`;
  if(keep&&tab===oldTab)s.scrollTop=oldTop;
  uiTick.sig=sigNow();
}

/* ---------- ações de menus ---------- */
function pick2(i){
  W.me=i;newRound();sel=i;markDirty();save();
  tab='d';menu();
  toast('⚔ '+W.T[i].n+' é a tua equipa!');
}
function resetWorld(){
  W={T:D.map(mk),me:null,rd:1,fx:[],log:['Mundo recriado.']};
  migrateWorld();markDirty();save();
  tab='d';menu();
}
function confirmReset(){showModal('Reiniciar o mundo?','<p>Toda a evolução, tabela, elencos e calendário serão apagados.</p>',
  [{label:'Reiniciar',cls:'danger',fn:()=>{hideModal();resetWorld()}},{label:'Cancelar',cls:'ghost',fn:hideModal}])}
function confirmSwitch(){showModal('Trocar de equipa?','<p>A rodada atual é reiniciada com novos horários.</p>',
  [{label:'Trocar',cls:'pri',fn:()=>{hideModal();W.me=null;markDirty();save();menu()}},{label:'Cancelar',cls:'ghost',fn:hideModal}])}

/* ---------- fim de jogo ---------- */
function endM(){
  if(!S||S.fin)return;
  S.fin=1;
  const L=apply(S,F);
  if(F){F.snap=null;F.frozen=0}
  markDirty();save();
  showHUD(false);
  $('#ctl').style.display='none';
  const ab=i=>S.tm[i].n.slice(0,3).toUpperCase();
  const goals=S.gl||[];
  const s=$('#scr');
  s.style.display='block';s.classList.add('endmode');s.scrollTop=0;
  s.innerHTML=`<div class="endcard">
    <div class="clabel">Fim de jogo · Rodada ${(W.rd-1)%7+1}/7</div>
    <h1 class="endscore"><span style="color:${cc(0)}">${ab(0)}</span>${S.sc[0]}<i>–</i>${S.sc[1]}<span style="color:${cc(1)}">${ab(1)}</span></h1>
    <div class="endname">${S.tm[0].n} × ${S.tm[1].n}${S.hu?' · jogaste este jogo':''}</div>
    ${goals.length?`<div class="goals">${goals.map(g=>`<div><b>${g.m}'</b> ${g.who||'—'} <span style="color:${cc(g.s)}">${ab(g.s)}</span></div>`).join('')}</div>`:''}
    <div class="clabel" style="margin-top:12px">O mundo reagiu</div>
    <div class="tl">${L.slice(0,6).map(x=>`<div>${x}</div>`).join('')||'<div>Ninguém mudou o estilo desta vez.</div>'}</div>
    <button class="btn pri big" data-act="cont">Continuar</button>
  </div>`;
}
function after(){
  S=null;F=null;NG.view='menu';NG.cur=-1;
  try{mark.visible=false}catch(e){}
  showHUD(false);$('#ctl').style.display='none';
  closePause();
  adv();
  tab='d';menu();
  toast('💾 Guardado');
}

/* ---------- delegação de eventos ---------- */
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');
  if(!el)return;
  const a=el.dataset.act,v=el.dataset.v;
  switch(a){
    case 'tab':tab=v;menu();break;
    case 'team':pick2(+v);break;
    case 'mteam':sel=+v;menu(true);break;
    case 'play':go(+v,1);break;
    case 'watch':go(+v,0);break;
    case 'pause':openPause();break;
    case 'resume':closePause();break;
    case 'exitmatch':exitMatch();break;
    case 'cont':after();break;
    case 'mda':{const act=(NG.acts||[])[+v];if(act&&act.fn)act.fn();break}
    case 'reset':confirmReset();break;
    case 'switch':confirmSwitch();break;
  }
});
document.addEventListener('change',e=>{
  const el=e.target.closest('[data-ch]');
  if(!el)return;
  if(el.dataset.ch==='fm'&&W.me!=null){
    W.T[W.me].fm=+el.value;
    markDirty();save();
    toast('Formação: '+['4-3-3','4-4-2','3-5-2'][+el.value]);
    menu(true);
  }
});

/* ---------- atualizações de 1s (contagens + estados) ---------- */
function uiTick(){
  if(NG.dirty&&Date.now()-(uiTick.ls||0)>15000){uiTick.ls=Date.now();save()}
  if(NG.view!=='menu')return;
  const sig=sigNow();
  if(sig!==uiTick.sig){uiTick.sig=sig;menu(true)}
  const now=Date.now();
  document.querySelectorAll('[data-cd]').forEach(el=>{
    const target=+el.dataset.cd;
    const txt=el.dataset.cdf==='time'?fmtTime(target):fmtGap(target-now);
    if(el.textContent!==txt)el.textContent=txt;
  });
}

/* ---------- loop principal ---------- */
function frame(t){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(t-(frame.l||0))/1000||0);frame.l=t;
  if(NG.view==='match'&&S){
    if(!NG.paused){
      if(!S.fin){
        keys();
        if(charging)chg=Math.min(1,chg+dt*1.3);
        acc+=dt;let n=0;
        while(acc>=1/60&&n<24){acc-=1/60;step(S,1/60)}
        if(S.over)endM();
      }
      if(S.fin)S.rv=null;
      else if(S.rp&&S.pause>0&&S.pause<=5.2){
        const i=Math.min(S.rp.length-1,Math.floor((5.2-S.pause)*12)),rp=S.rp[i];
        if(!S.rpOn){S.rpOn=1;toast('⏪ REPLAY')}
        S.rv={...S,P:rp.p,ball:rp.b,pause:0,gs:-1,hu:0,owner:-1};
      }else S.rv=null;
      const S0=S;if(S&&S.rv)S=S.rv;draw(dt);S=S0;
      if(NG.hudOn)hud();
      R.render(sc,cam);
      if(t-(frame.snap||0)>8000){frame.snap=t;saveSnap()}
    }
  }else if(!NG.paused){
    worldTick();
  }
  if(t-(frame.ui||0)>1000){frame.ui=t;uiTick()}
}

/* ---------- arranque ---------- */
function boot(){
  migrateWorld();
  menu();
  requestAnimationFrame(frame);
}
boot();
