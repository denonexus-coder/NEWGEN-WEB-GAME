/* ===== 80 · Controlos (joystick + teclado) ===== */
/* ---------- CONTROLES ---------- */
let jv={x:0,z:0},kv={x:0,z:0},ACT={pass:0,skill:0,shoot:null},jid=null,chg=0,charging=false;
const js=$('#js'),kn=$('#kn');
function jm(e){const r=js.getBoundingClientRect();let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const m=r.width/2,l=Math.hypot(x,y);if(l>m){x*=m/l;y*=m/l}jv={x:x/m,z:y/m};kn.style.transform=`translate(${x}px,${y}px)`}
js.onpointerdown=e=>{jid=e.pointerId;js.setPointerCapture(jid);jm(e)};js.onpointermove=e=>{if(e.pointerId==jid)jm(e)};js.onpointerup=js.onpointercancel=()=>{jid=null;jv={x:0,z:0};kn.style.transform=''};
$('#bp').onpointerdown=()=>ACT.pass=1;$('#bu').onpointerdown=()=>ACT.sub=1;$('#bd').onpointerdown=()=>ACT.skill=1;
const sd=()=>{charging=true;chg=0},su=()=>{if(charging){ACT.shoot=chg;charging=false;$('#bs').style.background=''}};
$('#bs').onpointerdown=sd;$('#bs').onpointerup=$('#bs').onpointercancel=su;
const ks={};addEventListener('keydown',e=>{if(ks[e.code])return;ks[e.code]=1;if(e.code=='KeyJ')ACT.pass=1;if(e.code=='KeyL')ACT.skill=1;if(e.code=='KeyK')sd()});
addEventListener('keyup',e=>{ks[e.code]=0;if(e.code=='KeyK')su()});
function keys(){kv={x:(ks.ArrowRight||ks.KeyD?1:0)-(ks.ArrowLeft||ks.KeyA?1:0),z:(ks.ArrowDown||ks.KeyS?1:0)-(ks.ArrowUp||ks.KeyW?1:0)}}
