/* ===== 70 · Three.js: cena, personagens humanos, câmara (Fase 1) ===== */
/* ---------- 3D ---------- */
const R=new THREE.WebGLRenderer({canvas:$('#c'),antialias:false});R.setPixelRatio(Math.min(devicePixelRatio,1.25));
const sc=new THREE.Scene();sc.background=new THREE.Color(0x0b1a2e);sc.fog=new THREE.Fog(0x0b1a2e,140,300);
const cam=new THREE.PerspectiveCamera(48,1,.5,700);
sc.add(new THREE.HemisphereLight(0xffffff,0x335533,.9));const dl=new THREE.DirectionalLight(0xffffff,.7);dl.position.set(10,30,15);sc.add(dl);
/* ---------- relvado ---------- */
{const c=document.createElement('canvas');c.width=1320;c.height=920;const x=c.getContext('2d');x.scale(2,2);for(let i=0;i<14;i++){x.fillStyle=i%2?'#2f8f3b':'#389c45';x.fillRect(i*47.1,0,48,460)}
for(let i=0;i<14000;i++){x.fillStyle='rgba('+(rnd()<.5?0:200)+','+(rnd()<.5?50:255)+',0,.06)';x.fillRect(rnd()*660,rnd()*460,1.5,1.5)}x.strokeStyle='#fff';x.lineWidth=3;x.strokeRect(30,30,600,400);x.fillStyle='#fff';[80,580].forEach(q=>{x.beginPath();x.arc(q,230,3,0,7);x.fill()});x.beginPath();x.arc(80,230,38,-.9,.9);x.stroke();x.beginPath();x.arc(580,230,38,Math.PI-.9,Math.PI+.9);x.stroke();x.beginPath();x.moveTo(330,30);x.lineTo(330,430);x.stroke();x.beginPath();x.arc(330,230,60,0,7);x.stroke();
x.strokeRect(30,140,80,180);x.strokeRect(550,140,80,180);x.strokeRect(30,190,30,80);x.strokeRect(600,190,30,80);
const t=new THREE.CanvasTexture(c);t.anisotropy=4;const m=new THREE.Mesh(new THREE.PlaneGeometry(66,46),new THREE.MeshLambertMaterial({map:t}));m.rotation.x=-Math.PI/2;sc.add(m)}
{const bm=new THREE.MeshLambertMaterial({color:0xdddddd});[-1,1].forEach(s=>{const b=new THREE.Mesh(new THREE.BoxGeometry(60,.6,.3),bm);b.position.set(0,.3,s*20.2);sc.add(b);
const w=new THREE.MeshLambertMaterial({color:0xffffff});[].forEach(h=>{const gx=h*30;[-3.5,3.5].forEach(z=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.2,2.4,.2),w);p.position.set(gx,1.2,z);sc.add(p)});const cb=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,7.2),w);cb.position.set(gx,2.4,0);sc.add(cb);
const n=new THREE.Mesh(new THREE.BoxGeometry(2.5,2.4,7),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.12,wireframe:true}));n.position.set(gx+h*1.25,1.2,0);sc.add(n)})})}
{const N=700,im=new THREE.InstancedMesh(new THREE.BoxGeometry(.7,1,.7),new THREE.MeshLambertMaterial({color:0xffffff}),N),m4=new THREE.Matrix4(),col=new THREE.Color();
for(let i=0;i<N;i++){const row=i%7,k=Math.random(),side=i%4;let x,z;if(side<2){x=(k-.5)*74;z=(side?1:-1)*(24+row*1.1)}else{x=(side==2?1:-1)*(35+row*1.1);z=(k-.5)*50}
m4.makeTranslation(x,1+row*.9,z);im.setMatrixAt(i,m4);im.setColorAt(i,col.setHSL(rnd(),.5,.35+rnd()*.3))}sc.add(im)}
{const c=document.createElement('canvas');c.width=2;c.height=256;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#050b1c');g.addColorStop(.7,'#1b2f55');g.addColorStop(1,'#e8894a');x.fillStyle=g;x.fillRect(0,0,2,256);sc.background=new THREE.CanvasTexture(c)}
{const cm=new THREE.MeshLambertMaterial({color:0x3a3f4a});for(let r=0;r<7;r++){const hh=.5+r*.9;[-1,1].forEach(s=>{const a=new THREE.Mesh(new THREE.BoxGeometry(82,hh,1.1),cm);a.position.set(0,hh/2,s*(24+r*1.1));sc.add(a);const b=new THREE.Mesh(new THREE.BoxGeometry(1.1,hh,54),cm);b.position.set(s*(35+r*1.1),hh/2,0);sc.add(b)})}
{const w=new THREE.MeshLambertMaterial({color:0xffffff}),nm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.18,wireframe:true});[-1,1].forEach(h=>{const gx=h*HX;[-GW,GW].forEach(z=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.25,2.5,.25),w);p.position.set(gx,1.25,z);sc.add(p)});const cb=new THREE.Mesh(new THREE.BoxGeometry(.25,.25,GW*2+.25),w);cb.position.set(gx,2.5,0);sc.add(cb);const n=new THREE.Mesh(new THREE.BoxGeometry(3,2.45,GW*2),nm);n.position.set(gx+h*1.5,1.22,0);sc.add(n)})}
const ac=[0xe63946,0x4361ee,0xffd60a,0x2a9d8f,0xffffff,0xf4a261];[-1,1].forEach(s=>{for(let i=0;i<7;i++){const a=new THREE.Mesh(new THREE.BoxGeometry(8.4,.8,.15),new THREE.MeshLambertMaterial({color:ac[(i+(s>0?2:0))%6]}));a.position.set(-27+i*9,.4,s*20.7);sc.add(a)}})}
const ST=new THREE.Group();[...sc.children].forEach(o=>{if(!o.isLight)ST.add(o)});ST.scale.setScalar(1.72);sc.add(ST);
/* ---------- cores humanas ---------- */
const SK=[0xd9a77e,0x8d5524,0xf1c27d,0xc68642]; /* tons de pele */
const HR=[0x1a1208,0x4a2c12,0xc9a15a,0x0a0a0a,0x5b4a3a]; /* cabelos */
/* ---------- modelo humano (baixo polígono, animação por código) ---------- */
function mkP(){const g=new THREE.Group(),m=c=>new THREE.MeshLambertMaterial({color:c}),sk=SK[rnd()*4|0],hr=HR[rnd()*5|0];
const b=new THREE.Mesh(new THREE.CylinderGeometry(.34,.28,.85,8),m(0xffffff));b.position.y=1.15;
const sh=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.3,8),m(0xffffff));sh.position.y=.68;
const hd=new THREE.Mesh(new THREE.SphereGeometry(.21,10,8),m(sk));hd.position.y=1.75;
const legs=[-1,1].map(s=>{const L=new THREE.Group();L.position.set(0,.55,s*.13);const lm=new THREE.Mesh(new THREE.BoxGeometry(.16,.5,.16),m(sk));lm.position.y=-.25;L.add(lm);g.add(L);return L});
const sd=new THREE.Mesh(new THREE.CircleGeometry(.55,12),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.3}));sd.rotation.x=-Math.PI/2;sd.position.y=.03;
g.add(b,sh,hd,sd);g.u={b,sh,legs};sc.add(g);return g}
function mkP2(){const g=new THREE.Group(),M=c=>new THREE.MeshLambertMaterial({color:c}),skm=M(SK[rnd()*4|0]),jm=M(0xffffff),sm=M(0x222222),bm=M(0x0e0e0e),hm=M(HR[rnd()*5|0]);
const cy=(a,b,h,m,y)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(a,b,h,8),m);o.position.y=y;return o},sph=(r,m,y)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),m);o.position.y=y;return o};
const torso=cy(.3,.24,.7,jm,1.35);torso.scale.z=1.3;const sh=cy(.25,.27,.3,sm,.97);sh.scale.z=1.25;const head=sph(.2,skm,1.93),hair=new THREE.Mesh(new THREE.SphereGeometry(.215,10,6,0,6.283,0,1.45),hm);hair.position.y=1.95;hair.rotation.z=.15;const neck=cy(.07,.08,.14,skm,1.74);
const limb=(z,top,l1,l2,m1,m2,r,end)=>{const h=new THREE.Group();h.position.set(0,top,z);h.add(cy(r,r*.78,l1,m1,-l1/2));const k=new THREE.Group();k.position.y=-l1;k.add(cy(r*.78,r*.6,l2,m2,-l2/2));end(k,l2);h.add(k);g.add(h);return[h,k]};
const lg=[-.13,.13].map(z=>limb(z,.85,.42,.42,skm,jm,.1,(k,L)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.3,.1,.13),bm);b.position.set(.07,-L-.02,0);k.add(b)}));
const ar=[-.43,.43].map(z=>limb(z,1.62,.3,.28,jm,skm,.065,(k,L)=>k.add(sph(.055,skm,-L))));
const sdw=new THREE.Mesh(new THREE.CircleGeometry(.55,12),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.3}));sdw.rotation.x=-Math.PI/2;sdw.position.y=.03;
g.add(torso,sh,head,hair,neck,sdw);g.u={b:torso,sh,legs:[lg[0][0],lg[1][0]],knees:[lg[0][1],lg[1][1]],arms:[ar[0][0],ar[1][0]],elb:[ar[0][1],ar[1][1]]};g.ph=rnd()*6;sc.add(g);return g}
/* etiqueta com nº + apelido acima da cabeça (Sprite com CanvasTexture) */
function labelTex(nn,no){const c=document.createElement('canvas');c.width=256;c.height=96;const x=c.getContext('2d');x.textAlign='center';x.fillStyle='#00000000';x.fillRect(0,0,256,96);x.strokeStyle='#050b1c';x.lineWidth=10;x.lineJoin='round';x.fillStyle='#fff';x.font='bold 22px Arial';x.strokeText(String(no),128,32);x.fillText(String(no),128,32);x.font='bold 14px Arial';x.strokeText(String(nn).toUpperCase().slice(0,10),128,56);x.fillText(String(nn).toUpperCase().slice(0,10),128,56);const t=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true}));s.scale.set(2.4,1.2,1);s.position.set(0,2.55,0);return{s,t,spr:s}}
const PM=[...Array(22)].map(mkP2),RF=mkP2();RF.u.b.material.color.set('#111111');RF.u.sh.material.color.set('#111111');
PM.forEach((g,i)=>setLab(g,String(i%11+1),''));

/* etiqueta: nº grande + apelido pequeno, flutuante acima da cabeça */
/* camisolas por equipa (c1=camisola, c2=calções) + equipamento do GR distinto */
const KIT=[0xff9f1c,0x222222]; /* GR: camisola/calções */
function kitNums(){return[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]}
/* dress: veste a equipa inteira (camisola c1, calções c2, meias c1 escuro) — igual para os 11, sem confusão */
function dress(S){PM.forEach((g,i)=>{const p=S.P[i],T=S.tm[p.s],gk=p.r==0;const c1=new THREE.Color(T.c1),c2=new THREE.Color(T.c2);g.u.b.material.color.set(gk?KIT[0]:c1);g.u.sh.material.color.set(gk?KIT[1]:c2);g.legs&&g.legs.forEach(L=>{L.children[0].material.color.set(gk?KIT[1]:new THREE.Color(T.c2).offsetHSL(0,0,-.15))})})}
/* coloca nº e apelido na etiqueta acima da cabeça (chamado sempre que entra um jogador) */
function setLab(g,nn,no){if(!g.label){g.label=labelTex(nn,no);g.add(g.label.spr)}else{g.label.t.needsUpdate=true}}
/* ---------- simulação ---------- */
const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(.3,1),new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}));sc.add(ball);
const bsd=new THREE.Mesh(new THREE.CircleGeometry(.3,10),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.4}));bsd.rotation.x=-Math.PI/2;sc.add(bsd);
const TR=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.55})),trp=[...Array(18)].map(()=>new THREE.Vector3());TR.frustumCulled=false;sc.add(TR);
const mark=new THREE.Mesh(new THREE.ConeGeometry(.25,.5,8),new THREE.MeshBasicMaterial({color:0xffe600}));mark.rotation.x=Math.PI;sc.add(mark);
/* balizas 3D visíveis em cada extremidade */
const goalMat=new THREE.MeshLambertMaterial({color:0xffffff});
const post=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,2.44,8),goalMat);
const bar=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,2*GW+.28,8),goalMat);bar.rotation.z=Math.PI/2;
[-1,1].forEach(s=>{[-GW,GW].forEach(z=>{const p=post.clone();p.position.set(s*HX,1.22,z);sc.add(p)});
const b=bar.clone();b.position.set(s*HX,2.44,0);sc.add(b);
const net=new THREE.Mesh(new THREE.PlaneGeometry(2*GW+.56,2.44),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.12}));
net.position.set(s*HX,1.22,0);net.rotation.y=s?0:Math.PI;sc.add(net)});
function rs(){R.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}addEventListener('resize',rs);rs();
let cx=0,cz=0;
function anim(S,dt){const B=S.ball;{const bp=trp[0],bs0=Math.hypot(B.vx,B.vz);if(Math.hypot(bp.x-B.x,bp.z-B.z)>4)trp.forEach(v=>v.set(B.x,B.y,B.z));trp.pop();trp.unshift(new THREE.Vector3(B.x,B.y,B.z));TR.geometry.setFromPoints(trp);TR.visible=bs0>11||B.y>1.5}{const dx=B.x*.85-RF.position.x,dz=cl(B.z+7,-HZ,HZ)-RF.position.z,sp=Math.hypot(dx,dz),k=Math.min(1,3*dt),u=RF.u;RF.position.x+=dx*k;RF.position.z+=dz*k;RF.rotation.y=-Math.atan2(B.z-RF.position.z,B.x-RF.position.x);RF.ph+=Math.min(sp,6)*dt*1.5;const w=Math.sin(RF.ph)*.8*Math.min(1,sp/3);u.legs[0].rotation.z=w;u.legs[1].rotation.z=-w;u.arms[0].rotation.z=-w*.7;u.arms[1].rotation.z=w*.7;u.knees[0].rotation.z=-Math.max(0,w)*.8;u.knees[1].rotation.z=-Math.max(0,-w)*.8;u.elb[0].rotation.z=u.elb[1].rotation.z=.5}S.P.forEach((p,i)=>{const g=PM[i],u=g.u,v=Math.hypot(p.vx,p.vz),k=Math.min(1,v/6);if(g.pn!==p.pl){g.pn=p.pl;if(g.label)setLab(g,p.pl.n.split(' ')[1].toUpperCase().slice(0,8),p.pl.no)}g.ph+=v*dt*1.5;const w=Math.sin(g.ph),dsh=p.dash>0,A=(dsh?1.25:.95)*k;
let l0=w*A,l1=-w*A,k0=-Math.max(0,Math.cos(g.ph))*1.1*k,k1=-Math.max(0,-Math.cos(g.ph))*1.1*k,a0=-w*.8*k,a1=w*.8*k,e=.35+.7*k;
if(dsh&&p.sk==1){l0=Math.sin(S.t*40)*1.1;l1=-l0}
if(p.cd>.12){l0=1.5;k0=0;l1=-.2;a0=.7;a1=-.5}
if(S.pause>0&&S.gs==p.s){a0=a1=2.9;e=.15;l0=l1=k0=k1=0}
const dv=p.r==0&&S.owner!=p.i&&S.pause<=0&&Math.hypot(B.x-p.x,B.z-p.z)<5&&Math.hypot(B.vx,B.vz)>9&&B.y<2.4;if(dv){a0=a1=2.9;g.position.y+=.4}
g.rotation.x+=((dv?Math.sign(B.z-p.z||1)*1.25:0)-g.rotation.x)*Math.min(1,12*dt);
if(dsh&&p.sk==2)g.rotation.y+=(1-p.dash/.35)*6.283;
let sl=0;if(p.sl>0){l0=1.45;l1=.2;k0=0;k1=-.6;a0=1;a1=-.6;sl=1.25*Math.min(1,p.sl*5)}if(p.hd>0){a0=a1=2.2;k0=k1=-.4;l0=.5;l1=-.3;g.position.y+=Math.sin(Math.min(1,(.5-p.hd)*2)*Math.PI)*.9}g.rotation.z+=(sl-g.rotation.z)*Math.min(1,14*dt);
const lp=(o,t)=>{o.rotation.z+=(t-o.rotation.z)*Math.min(1,22*dt)};lp(u.legs[0],l0);lp(u.legs[1],l1);lp(u.knees[0],k0);lp(u.knees[1],k1);lp(u.arms[0],a0);lp(u.arms[1],a1);lp(u.elb[0],e);lp(u.elb[1],e)})
}
/* ---------- desenho ---------- */
function draw(dt){if(!S){const t=performance.now()/4000;cam.position.set(Math.sin(t)*40,22,Math.cos(t)*40);cam.lookAt(0,0,0);return}
const B=S.ball,asp=cam.aspect,h=asp<1.2?38:23,zz=asp<1.2?52:33;
S.P.forEach((p,i)=>{const g=PM[i],sp=Math.hypot(p.vx,p.vz),ph=S.t*sp*1.3;g.position.set(p.x,S.pause>0&&S.gs==p.s?Math.abs(Math.sin(performance.now()/110+i))*.5:0,p.z);g.rotation.y=-p.a;g.u.legs[0].rotation.z=Math.sin(ph)*.9*Math.min(1,sp/5);g.u.legs[1].rotation.z=-Math.sin(ph)*.9*Math.min(1,sp/5);g.u.b.rotation.z=-Math.min(.3,sp*.03)})
anim(S,dt);ball.position.set(B.x,B.y,B.z);ball.rotation.z-=B.vx*dt*3;ball.rotation.x+=B.vz*dt*3;bsd.position.set(B.x,.04,B.z);bsd.scale.setScalar(Math.max(.4,1-B.y*.25));
if(S.hu&&S.cp>=0&&!S.over){const p=S.P[S.cp];mark.visible=true;mark.position.set(p.x,2.5+Math.sin(performance.now()/180)*.15,p.z)}else mark.visible=false;
cx+=(B.x*.8-cx)*Math.min(1,3*dt);cz+=(B.z*.3-cz)*Math.min(1,3*dt);cam.position.set(cx,h,zz+cz*.2);cam.lookAt(cx,0,cz)}
