/* ===== 30 · Relógio do Mundo =====
   Regras:
   - só corre na APP aberta, com o menu visível e sem pausa;
   - a MINHA partida nunca corre sem mim (notificação + 1 dia → forfeit);
   - partidas nunca vistas seguem o calendário e produzem resultado;
   - partida congelada (saí) só avança quando eu voltar a entrar.       */
function worldTick(){
  if(document.hidden||NG.paused||NG.view!=='menu'||W.me==null||!W.fx.length)return;
  const now=Date.now();
  let changed=false;
  for(let i=0;i<W.fx.length;i++){
    const f=W.fx[i];
    if(f.done||f.frozen)continue;
    if(fMine(f)){
      /* sem presença após o prazo: derrota 0–3 + penalidades */
      if(!f.entered&&now>f.kick+DAY_MS){doForfeit(f);changed=true}
      /* kickoff da minha partida: aviso (1× por partida) */
      else if(!f.entered&&now>=f.kick&&!f.shown){if(showKickModal(i)){f.shown=1;changed=true}}
    }else{
      /* fim da janela sem exibição: resultado automático */
      if(now>=f.end){
        quick(f);changed=true;
        notif('🏁 '+W.T[f.a].n+' '+f.sc[0]+'–'+f.sc[1]+' '+W.T[f.b].n,'good');
      }
    }
  }
  /* rodada completa → nova rodada com novos horários */
  if(W.fx.every(f=>f.done)){adv();changed=true;notif('⏭ Rodada completa — nova rodada agendada','good')}
  if(changed){markDirty();save()}
}
