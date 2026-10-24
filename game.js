'use strict';
const cv=document.getElementById('c'),cx=cv.getContext('2d');
const dk=document.createElement('canvas'),dx=dk.getContext('2d');
let W,H,DPR,SC;
function resize(){DPR=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;dk.width=W;dk.height=H;SC=Math.max(0.55,Math.min(1.2,Math.min(W,H)/520));}
addEventListener('resize',resize);resize();
const WW=1900,WH=1000,TAU=Math.PI*2;
const rnd=(a,b)=>a+Math.random()*(b-a),cl=(v,a,b)=>v<a?a:v>b?b:v,dist=(a,b,c,d)=>Math.hypot(c-a,d-b);
// ---------- world ----------
const ROAD={y:720,h:120};
const houses=[{x:120,y:200,w:400,h:300,name:'Rourke'},{x:740,y:170,w:440,h:330,name:'Delgado'},{x:1360,y:210,w:380,h:290,name:'Pham'}];
let walls,doors,loot,guards,dog,cam,lights,noises,police,state,P,meter,alarmT,haul,night,msg,msgT,flash,fx;
let save=JSON.parse(localStorage.getItem('ns_save')||'{"debt":25000,"night":1}');
function wall(x,y,w,h,k){walls.push({x,y,w,h,k:k||'wall'});}
function build(){
 walls=[];doors=[];loot=[];noises=[];fx=[];
 wall(0,-20,WW,20);wall(0,WH,WW,20);wall(-20,0,20,WH);wall(WW,0,20,WH);
 const T=12;
 houses.forEach((h,i)=>{
  const dw=50,dxp=h.x+h.w/2-dw/2;
  wall(h.x,h.y,h.w,T);wall(h.x,h.y,T,h.h);wall(h.x+h.w-T,h.y,T,h.h);
  wall(h.x,h.y+h.h-T,dxp-h.x,T);wall(dxp+dw,h.y+h.h-T,h.x+h.w-(dxp+dw),T);
  // inner wall
  wall(h.x+h.w*0.55,h.y,T,h.h*0.55);
  const d={x:dxp,y:h.y+h.h-T,w:dw,h:T,k:'door',locked:true,prog:0,open:false,h_:i,need:[1.1,1.5,1.9][i]};
  doors.push(d);walls.push(d);
  // back door
  const bd={x:h.x+40,y:h.y,w:40,h:T,k:'door',locked:true,prog:0,open:false,h_:i,need:2.2};doors.push(bd);walls.push(bd);
  // fences (yard) with gate gap on street side
  const fx0=h.x-50,fy0=h.y-60,fw=h.w+100,fh=h.h+150,F=5;
  wall(fx0,fy0,fw,F,'fence');wall(fx0,fy0,F,fh,'fence');wall(fx0+fw-F,fy0,F,fh,'fence');
  wall(fx0,fy0+fh-F,fw/2-40,F,'fence');wall(fx0+fw/2+40,fy0+fh-F,fw/2-40,F,'fence');
 });
 // hedge / car obstacles
 wall(600,560,60,60,'hedge');wall(1240,540,70,70,'hedge');wall(980,610,90,40,'car');
 const L=[['TV',600,8,0],['Jewellery',1800,1,0],['Laptop',900,3,0],['Console',500,4,1],['Cash box',1200,2,1],['Watch',1500,1,1],['Guitar',700,6,1],['Jewellery',2200,1,2],['TV',800,9,2],['Tablet',450,2,2]];
 L.forEach(([n,v,wt,hi],j)=>{const h=houses[hi];loot.push({n,v,wt,x:h.x+40+((j*137)%(h.w-80)),y:h.y+50+((j*71)%(h.h-110)),taken:false,prog:0});});
 guards=[
  {x:300,y:640,path:[[200,640],[560,640],[560,560],[200,560]],spd:55,name:'Homeowner'},
  {x:860,y:260,path:[[790,240],[960,240],[960,440],[1140,440],[790,440]],spd:50,name:'Homeowner'},
  {x:1100,y:690,path:[[700,680],[1300,680]],spd:62,name:'Watchman'},
 ].map(g=>({...g,wp:0,a:0,mode:'patrol',tx:0,ty:0,wait:0}));
 dog={x:1300,y:420,a:0,bark:0,cd:0};
 cam={x:1360+12,y:210+12,base:0.9,a:0.9,t:0};
 lights=[{x:330,y:700,r:150},{x:960,y:700,r:150},{x:1580,y:700,r:150},{x:960,y:330,r:110,in:1},{x:1550,y:880,r:120}];
 P={x:60,y:780,a:0,bag:[],vx:0,vy:0,step:0};
 meter=0;alarmT=0;police=null;haul=0;msg='';msgT=0;flash=0;
}
const GETAWAY={x:1820,y:900,w:60,h:34};
// ---------- input ----------
const keys={};let stick={id:null,ox:0,oy:0,x:0,y:0},btn={sprint:null,use:null};
addEventListener('keydown',e=>{keys[e.code]=1;if(state!=='play')tapAny();});addEventListener('keyup',e=>keys[e.code]=0);
function btnRects(){const r=46*SC,m=24*SC;return{use:{x:W-m-r,y:H-m-r-10,r},sprint:{x:W-m-r*3.4,y:H-m-r*0.6-10,r:r*0.85}};}
cv.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='play'){tapAny(e);return;}
 const B=btnRects();for(const k in B){const b=B[k];if(dist(e.clientX,e.clientY,b.x,b.y)<b.r*1.3){btn[k]=e.pointerId;return;}}
 if(stick.id===null&&e.clientX<W*0.6){stick={id:e.pointerId,ox:e.clientX,oy:e.clientY,x:0,y:0};}});
cv.addEventListener('pointermove',e=>{if(e.pointerId===stick.id){let dx=e.clientX-stick.ox,dy=e.clientY-stick.oy,m=Math.hypot(dx,dy),R=50*SC;if(m>R){dx*=R/m;dy*=R/m;}stick.x=dx/R;stick.y=dy/R;}});
function up(e){if(e.pointerId===stick.id)stick={id:null,x:0,y:0};for(const k in btn)if(btn[k]===e.pointerId)btn[k]=null;}
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
function tapAny(e){if(state==='title'||state==='end'){if(state==='end'&&performance.now()-endAt<900)return;start();}}
// ---------- helpers ----------
function hitWall(x,y,r){for(const w of walls){if(w.k==='door'&&w.open)continue;const nx=cl(x,w.x,w.x+w.w),ny=cl(y,w.y,w.y+w.h);if((x-nx)**2+(y-ny)**2<r*r)return w;}return null;}
function move(o,dx,dy,r){if(!hitWall(o.x+dx,o.y,r))o.x+=dx;if(!hitWall(o.x,o.y+dy,r))o.y+=dy;}
function los(ax,ay,bx,by){const d=dist(ax,ay,bx,by),n=Math.ceil(d/10);for(let i=1;i<n;i++){const x=ax+(bx-ax)*i/n,y=ay+(by-ay)*i/n;for(const w of walls){if(w.k==='fence'||w.k==='car'||(w.k==='door'&&w.open))continue;if(x>w.x&&x<w.x+w.w&&y>w.y&&y<w.y+w.h)return false;}}return true;}
function lightAt(x,y){let l=0.12;for(const L of lights){const d=dist(x,y,L.x,L.y);if(d<L.r)l+=(1-d/L.r)*0.9;}if(police){const d=dist(x,y,police.x,police.y);if(d<200)l+=(1-d/200)*0.8;}return Math.min(1,l);}
function noise(x,y,r,src){noises.push({x,y,r,t:0,src});for(const g of guards){if(dist(g.x,g.y,x,y)<r&&g.mode!=='chase'){g.mode='investigate';g.tx=x;g.ty=y;g.wait=2.5;}}
 if(src!=='dog'&&dist(dog.x,dog.y,x,y)<r+120&&dog.cd<=0){dog.bark=1.2;dog.cd=3;noise(dog.x,dog.y,300,'dog');say('Dog barking!');}}
function say(t){msg=t;msgT=2.2;}
function start(){build();state='play';night=save.night;say('Night '+night+' — case the street. Avoid lights.');}
function trigger(){if(state!=='play'||alarmT>0)return;alarmT=60;meter=1;say('ALARM! Get to the car!');police={x:-40,y:780,a:0,spd:150};guards.forEach(g=>g.mode='chase');}
function weight(){return P.bag.reduce((s,i)=>s+i.wt,0);}
let endAt=0,result=null;
function end(kind){state='end';endAt=performance.now();const kept=kind==='escaped'?haul:0;result={kind,haul,kept,items:P.bag.length};if(kept){save.debt=Math.max(0,save.debt-kept);}save.night++;localStorage.setItem('ns_save',JSON.stringify(save));}
// ---------- update ----------
function update(dt){
 fx.forEach(f=>f.t+=dt);
 if(msgT>0)msgT-=dt;flash+=dt;
 if(state!=='play')return;
 let mx=stick.x,my=stick.y;
 if(keys.KeyA||keys.ArrowLeft)mx=-1;if(keys.KeyD||keys.ArrowRight)mx=1;if(keys.KeyW||keys.ArrowUp)my=-1;if(keys.KeyS||keys.ArrowDown)my=1;
 const m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m;}
 const sprint=(btn.sprint!==null||keys.ShiftLeft||keys.ShiftRight)&&m>0.2;
 const using=btn.use!==null||keys.KeyE||keys.Space;
 const slow=Math.max(0.6,1-weight()*0.025);
 const sp=(sprint?190:95)*slow;
 if(m>0.05){P.a=Math.atan2(my,mx);}
 move(P,mx*sp*dt,my*sp*dt,11);
 P.step+=m*sp*dt;
 if(sprint&&P.step>70){P.step=0;noise(P.x,P.y,180,'p');}
 if(!sprint&&P.step>140){P.step=0;}
 // interact
 let target=null,td=1e9;
 for(const d of doors)if(d.locked){const q=dist(P.x,P.y,d.x+d.w/2,d.y+d.h/2);if(q<42&&q<td){td=q;target=d;}}
 for(const l of loot)if(!l.taken){const q=dist(P.x,P.y,l.x,l.y);if(q<34&&q<td){td=q;target=l;}}
 P.target=target;
 for(const d of doors)if(d!==target)d.prog=Math.max(0,d.prog-dt*2);
 for(const l of loot)if(l!==target)l.prog=0;
 if(target&&using){target.prog+=dt;
  if(target.k==='door'){if(target.prog>=target.need){target.locked=false;target.open=true;say('Lock picked');if(Math.random()<0.3)noise(target.x,target.y,120,'p');}}
  else if(target.prog>=0.45){target.taken=true;P.bag.push(target);haul+=target.v;say('+$'+target.v+' '+target.n+(target.wt>5?' (heavy)':''));}}
 // guards
 const vis=lightAt(P.x,P.y);let seen=0;
 for(const g of guards){
  let tx,ty,s=g.spd;
  if(g.mode==='chase'){tx=P.x;ty=P.y;s=g.spd*2.3;}
  else if(g.mode==='investigate'){tx=g.tx;ty=g.ty;s=g.spd*1.4;if(dist(g.x,g.y,tx,ty)<14){g.wait-=dt;tx=g.x;ty=g.y;g.a+=dt*1.5;if(g.wait<=0)g.mode='patrol';}}
  else{const p=g.path[g.wp];tx=p[0];ty=p[1];if(dist(g.x,g.y,tx,ty)<6)g.wp=(g.wp+1)%g.path.length;}
  const dx=tx-g.x,dy=ty-g.y,d=Math.hypot(dx,dy);
  if(d>2){const ta=Math.atan2(dy,dx);let da=((ta-g.a+Math.PI*3)%TAU)-Math.PI;g.a+=cl(da,-4*dt,4*dt);const ox=g.x,oy=g.y;move(g,dx/d*s*dt,dy/d*s*dt,11);if(Math.hypot(g.x-ox,g.y-oy)<0.01*s*dt&&g.mode==='chase'){move(g,Math.sign(dy)*s*dt*0.7,-Math.sign(dx)*s*dt*0.7,11);}}
  const pd=dist(g.x,g.y,P.x,P.y),pa=Math.atan2(P.y-g.y,P.x-g.x);let da=Math.abs(((pa-g.a+Math.PI*3)%TAU)-Math.PI);
  const range=120+180*vis;
  g.sees=pd<range&&da<0.55&&los(g.x,g.y,P.x,P.y)||pd<26;
  if(g.sees){seen=Math.max(seen,(0.35+vis)*(1.4-pd/300));if(g.mode==='patrol'){g.mode='investigate';g.tx=P.x;g.ty=P.y;g.wait=2;}}
  if(alarmT>0&&alarmT<58&&pd<20)return end('busted');
 }
 // camera
 cam.t+=dt;cam.a=cam.base+Math.sin(cam.t*0.7)*0.8;
 {const pd=dist(cam.x,cam.y,P.x,P.y),pa=Math.atan2(P.y-cam.y,P.x-cam.x);const da=Math.abs(((pa-cam.a+Math.PI*3)%TAU)-Math.PI);cam.sees=pd<260&&da<0.35&&los(cam.x,cam.y,P.x,P.y);if(cam.sees)seen=Math.max(seen,0.5+vis);}
 dog.cd-=dt;dog.bark-=dt;dog.a=Math.atan2(P.y-dog.y,P.x-dog.x);
 if(dist(dog.x,dog.y,P.x,P.y)<110&&dog.cd<=0){dog.bark=1.2;dog.cd=3;noise(dog.x,dog.y,300,'dog');say('Dog barking!');meter+=0.15;}
 if(dog.bark>0)seen=Math.max(seen,0.2);
 if(alarmT<=0){if(seen>0)meter+=seen*dt*0.9;else meter-=dt*0.18;meter=cl(meter,0,1);if(meter>=1)trigger();}
 P.seen=seen>0;
 noises.forEach(n=>n.t+=dt);noises=noises.filter(n=>n.t<1);
 // alarm phase
 if(alarmT>0){alarmT-=dt;if(alarmT<=0)return end('busted');
  const p=police,tx=P.x,ty=P.y;const ta=Math.atan2(ty-p.y,tx-p.x);let da=((ta-p.a+Math.PI*3)%TAU)-Math.PI;p.a+=cl(da,-2.5*dt,2.5*dt);
  p.spd=Math.min(230,p.spd+dt*8);const ox=p.x,oy=p.y;move(p,Math.cos(p.a)*p.spd*dt,Math.sin(p.a)*p.spd*dt,18);if(Math.hypot(p.x-ox,p.y-oy)<1)p.a+=0.8*dt*5;
  if(dist(p.x,p.y,P.x,P.y)<28)return end('busted');}
 // getaway
 if(P.x>GETAWAY.x-10&&P.y>GETAWAY.y-20&&P.y<GETAWAY.y+GETAWAY.h+20){if(P.bag.length||alarmT>0)return end('escaped');else if(msgT<=0)say('Grab some loot first');}
}
// ---------- draw ----------
let camX=0,camY=0,Z=1;
function draw(){
 cx.setTransform(DPR,0,0,DPR,0,0);cx.fillStyle='#05070c';cx.fillRect(0,0,W,H);
 if(state==='title')return drawTitle();
 Z=SC*1.05;
 camX=cl(P.x-W/2/Z,-40,WW-W/Z+40);camY=cl(P.y-H/2/Z,-40,WH-H/Z+40);
 if(W/Z>WW)camX=(WW-W/Z)/2;if(H/Z>WH)camY=(WH-H/Z)/2;
 cx.save();cx.scale(Z,Z);cx.translate(-camX,-camY);
 // ground
 cx.fillStyle='#16201a';cx.fillRect(0,0,WW,WH);
 for(let i=0;i<260;i++){const x=(i*397)%WW,y=(i*211)%700;cx.fillStyle=i%2?'#1a2620':'#121a15';cx.fillRect(x,y,30,18);}
 cx.fillStyle='#2a2b2e';cx.fillRect(0,ROAD.y-30,WW,30);cx.fillRect(0,ROAD.y+ROAD.h,WW,30);
 cx.fillStyle='#17181b';cx.fillRect(0,ROAD.y,WW,ROAD.h);
 cx.fillStyle='#4a4436';for(let x=20;x<WW;x+=90)cx.fillRect(x,ROAD.y+ROAD.h/2-2,46,4);
 cx.fillStyle='rgba(120,140,170,0.07)';for(let i=0;i<30;i++)cx.fillRect((i*233)%WW,ROAD.y+10+(i*37)%100,60+(i%4)*20,6);// puddles
 cx.fillStyle='#14161a';cx.fillRect(0,ROAD.y+ROAD.h+30,WW,WH);
 houses.forEach(h=>{cx.fillStyle='#2b2420';cx.fillRect(h.x,h.y,h.w,h.h);cx.strokeStyle='rgba(0,0,0,0.25)';for(let y=h.y;y<h.y+h.h;y+=14){cx.beginPath();cx.moveTo(h.x,y);cx.lineTo(h.x+h.w,y);cx.stroke();}
  cx.fillStyle='#211c1a';cx.fillRect(h.x+h.w*0.6,h.y+h.h*0.15,h.w*0.3,h.h*0.25);// bed/couch
  cx.fillStyle='#665a4a';cx.font='bold 13px system-ui';cx.fillText(h.name.toUpperCase(),h.x+16,h.y+h.h+40);});
 // getaway
 cx.fillStyle='#1c2a33';cx.fillRect(GETAWAY.x,GETAWAY.y,GETAWAY.w,GETAWAY.h);cx.fillStyle='#e8d27a';cx.fillRect(GETAWAY.x-3,GETAWAY.y+4,4,6);cx.fillRect(GETAWAY.x-3,GETAWAY.y+24,4,6);
 // walls
 for(const w of walls){if(w.k==='door'){if(w.open){cx.fillStyle='#3a2d22';cx.fillRect(w.x,w.y,6,w.h);}else{cx.fillStyle='#5a3f28';cx.fillRect(w.x,w.y,w.w,w.h);if(w.prog>0){cx.fillStyle='#e0b050';cx.fillRect(w.x,w.y-8,w.w*w.prog/w.need,4);}}continue;}
  cx.fillStyle=w.k==='fence'?'#3b3328':w.k==='hedge'?'#0f2414':w.k==='car'?'#2c3038':'#4a4a4e';cx.fillRect(w.x,w.y,w.w,w.h);}
 // loot
 for(const l of loot)if(!l.taken){cx.fillStyle=l.v>=1500?'#d9b44a':'#8aa3b8';cx.fillRect(l.x-6-l.wt/2,l.y-6,12+l.wt,12);if(l.prog>0){cx.fillStyle='#e0b050';cx.fillRect(l.x-12,l.y-16,24*l.prog/0.45,3);}}
 // cones
 const cone=(x,y,a,r,s,c)=>{cx.fillStyle=c;cx.beginPath();cx.moveTo(x,y);cx.arc(x,y,r,a-s,a+s);cx.closePath();cx.fill();};
 const vis=lightAt(P.x,P.y);
 for(const g of guards)cone(g.x,g.y,g.a,120+180*vis,0.55,g.sees?'rgba(255,60,40,0.22)':g.mode!=='patrol'?'rgba(255,170,60,0.16)':'rgba(255,240,190,0.10)');
 cone(cam.x,cam.y,cam.a,260,0.35,cam.sees?'rgba(255,50,40,0.25)':'rgba(120,200,255,0.10)');
 // noises
 for(const n of noises){cx.strokeStyle=`rgba(${n.src==='dog'?'255,140,60':'220,220,255'},${1-n.t})`;cx.lineWidth=2;cx.beginPath();cx.arc(n.x,n.y,n.r*n.t,0,TAU);cx.stroke();}
 // actors
 const body=(x,y,a,c,r)=>{cx.fillStyle='rgba(0,0,0,0.4)';cx.beginPath();cx.ellipse(x+3,y+4,r,r*0.8,0,0,TAU);cx.fill();cx.fillStyle=c;cx.beginPath();cx.arc(x,y,r,0,TAU);cx.fill();cx.fillStyle='rgba(255,255,255,0.25)';cx.beginPath();cx.arc(x+Math.cos(a)*r*0.6,y+Math.sin(a)*r*0.6,r*0.35,0,TAU);cx.fill();};
 for(const g of guards)body(g.x,g.y,g.a,g.mode==='chase'?'#8a3a30':'#6e6658',12);
 body(dog.x,dog.y,dog.a,'#4b3a2a',8);
 cx.fillStyle='#222';cx.fillRect(cam.x-6,cam.y-6,12,12);cx.fillStyle=Math.sin(flash*6)>0?'#f33':'#400';cx.fillRect(cam.x-2,cam.y-2,4,4);
 body(P.x,P.y,P.a,'#1d2533',11);cx.fillStyle='#0b0e14';cx.beginPath();cx.arc(P.x,P.y,6,0,TAU);cx.fill();
 if(police){cx.save();cx.translate(police.x,police.y);cx.rotate(police.a);cx.fillStyle='#e6e6ea';cx.fillRect(-22,-12,44,24);cx.fillStyle='#111';cx.fillRect(-8,-11,16,22);const f=Math.sin(flash*14)>0;cx.fillStyle=f?'#f22':'#22f';cx.fillRect(-3,-10,6,10);cx.fillStyle=f?'#22f':'#f22';cx.fillRect(-3,0,6,10);cx.restore();}
 cx.restore();
 // darkness layer
 dx.globalCompositeOperation='source-over';dx.clearRect(0,0,W,H);dx.fillStyle=alarmT>0?'rgba(4,6,14,0.74)':'rgba(3,5,12,0.8)';dx.fillRect(0,0,W,H);
 dx.globalCompositeOperation='destination-out';
 const hole=(x,y,r,a)=>{const sx=(x-camX)*Z,sy=(y-camY)*Z,R=r*Z;const g=dx.createRadialGradient(sx,sy,0,sx,sy,R);g.addColorStop(0,`rgba(0,0,0,${a})`);g.addColorStop(1,'rgba(0,0,0,0)');dx.fillStyle=g;dx.beginPath();dx.arc(sx,sy,R,0,TAU);dx.fill();};
 lights.forEach(L=>hole(L.x,L.y,L.r*1.4,0.95));
 hole(P.x,P.y,55,0.8);
 {const sx=(P.x-camX)*Z,sy=(P.y-camY)*Z,R=230*Z;const g=dx.createRadialGradient(sx,sy,0,sx,sy,R);g.addColorStop(0,'rgba(0,0,0,0.95)');g.addColorStop(1,'rgba(0,0,0,0)');dx.fillStyle=g;dx.beginPath();dx.moveTo(sx,sy);dx.arc(sx,sy,R,P.a-0.38,P.a+0.38);dx.closePath();dx.fill();}
 guards.forEach(g=>hole(g.x,g.y,70,0.5));
 if(police)hole(police.x,police.y,200,0.9);
 cx.drawImage(dk,0,0,W,H);
 // sodium tint
 cx.globalCompositeOperation='lighter';
 lights.forEach(L=>{const sx=(L.x-camX)*Z,sy=(L.y-camY)*Z,R=L.r*1.3*Z;const g=cx.createRadialGradient(sx,sy,0,sx,sy,R);g.addColorStop(0,L.in?'rgba(120,90,40,0.25)':'rgba(170,90,20,0.30)');g.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=g;cx.fillRect(sx-R,sy-R,R*2,R*2);});
 if(police){const sx=(police.x-camX)*Z,sy=(police.y-camY)*Z,R=260*Z,f=Math.sin(flash*7)>0;const g=cx.createRadialGradient(sx,sy,0,sx,sy,R);g.addColorStop(0,f?'rgba(200,20,20,0.45)':'rgba(20,40,220,0.45)');g.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=g;cx.fillRect(sx-R,sy-R,R*2,R*2);}
 cx.globalCompositeOperation='source-over';
 if(alarmT>0){const f=Math.sin(flash*7)>0;const g=cx.createLinearGradient(0,0,W,0);g.addColorStop(0,f?'rgba(220,0,0,0.28)':'rgba(0,0,0,0)');g.addColorStop(0.5,'rgba(0,0,0,0)');g.addColorStop(1,f?'rgba(0,0,0,0)':'rgba(0,40,255,0.28)');cx.fillStyle=g;cx.fillRect(0,0,W,H);}
 // rain
 cx.strokeStyle='rgba(160,175,200,0.22)';cx.lineWidth=1;cx.beginPath();const t=flash;for(let i=0;i<140;i++){const x=((i*173+t*120)%(W+60))-30,y=((i*97+t*900)%(H+40))-20;cx.moveTo(x,y);cx.lineTo(x-4,y+14);}cx.stroke();
 // vignette
 const vg=cx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.7);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.6)');cx.fillStyle=vg;cx.fillRect(0,0,W,H);
 drawHUD();
 if(state==='end')drawEnd();
}
function txt(s,x,y,sz,c,al){cx.font=`700 ${sz}px system-ui`;cx.textAlign=al||'left';cx.fillStyle='rgba(0,0,0,0.7)';cx.fillText(s,x+1,y+1);cx.fillStyle=c;cx.fillText(s,x,y);}
function drawHUD(){
 const s=SC,pad=12+(s*4);
 txt('$'+haul.toLocaleString(),pad,pad+18*s,20*s,'#e8d27a');
 txt('Bag '+P.bag.length+'  wt '+weight(),pad,pad+38*s,12*s,'#9aa');
 // detection meter
 const mw=Math.min(220,W*0.4)*1,mx=W/2-mw/2,my=pad;
 cx.fillStyle='rgba(0,0,0,0.6)';cx.fillRect(mx,my,mw,10*s);
 cx.fillStyle=alarmT>0?(Math.sin(flash*10)>0?'#f22':'#22f'):meter>0.6?'#e0432c':'#d0a040';cx.fillRect(mx,my,mw*meter,10*s);
 txt(alarmT>0?'ALARM  '+Math.ceil(alarmT)+'s':P.seen?'SEEN':lightAt(P.x,P.y)>0.45?'LIT':'HIDDEN',W/2,my+26*s,12*s,alarmT>0?'#ff6050':P.seen?'#ffb060':'#8aa','center');
 txt('Debt $'+save.debt.toLocaleString(),W-pad,pad+18*s,13*s,'#c88','right');
 if(alarmT>0){txt('→ GETAWAY CAR (east end of street)',W/2,my+44*s,12*s,'#fff','center');}
 if(msgT>0)txt(msg,W/2,H*0.32,15*s,'rgba(255,240,210,'+Math.min(1,msgT)+')','center');
 // controls
 if(stick.id!==null){cx.strokeStyle='rgba(255,255,255,0.25)';cx.lineWidth=2;cx.beginPath();cx.arc(stick.ox,stick.oy,50*s,0,TAU);cx.stroke();cx.fillStyle='rgba(255,255,255,0.25)';cx.beginPath();cx.arc(stick.ox+stick.x*50*s,stick.oy+stick.y*50*s,20*s,0,TAU);cx.fill();}
 else txt('drag to move',pad+30,H-pad-10,11*s,'rgba(255,255,255,0.3)');
 const B=btnRects();
 const b=(o,l,on,c)=>{cx.fillStyle=on?c:'rgba(20,24,32,0.65)';cx.strokeStyle=c;cx.lineWidth=2;cx.beginPath();cx.arc(o.x,o.y,o.r,0,TAU);cx.fill();cx.stroke();txt(l,o.x,o.y+5*s,13*s,'#fff','center');};
 const tg=P.target;
 b(B.use,tg?(tg.k==='door'?'PICK':'GRAB'):'USE',btn.use!==null,tg?'#d0a040':'#556');
 if(tg){const pr=tg.k==='door'?tg.prog/tg.need:tg.prog/0.45;cx.strokeStyle='#e8d27a';cx.lineWidth=4;cx.beginPath();cx.arc(B.use.x,B.use.y,B.use.r+5,-Math.PI/2,-Math.PI/2+TAU*pr);cx.stroke();}
 b(B.sprint,'RUN',btn.sprint!==null,'#7a8aa8');
}
function drawTitle(){
 const t=flash;cx.fillStyle='#070a10';cx.fillRect(0,0,W,H);
 const g=cx.createRadialGradient(W*0.7,H*0.35,0,W*0.7,H*0.35,Math.max(W,H)*0.5);g.addColorStop(0,'rgba(180,100,30,0.35)');g.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=g;cx.fillRect(0,0,W,H);
 const f=Math.sin(t*5)>0;cx.fillStyle=f?'rgba(200,0,0,0.12)':'rgba(0,30,220,0.12)';cx.fillRect(0,H*0.75,W,H*0.25);
 cx.strokeStyle='rgba(160,175,200,0.25)';cx.beginPath();for(let i=0;i<120;i++){const x=((i*173+t*120)%(W+60))-30,y=((i*97+t*900)%(H+40))-20;cx.moveTo(x,y);cx.lineTo(x-4,y+14);}cx.stroke();
 const s=Math.min(W,H)/400;
 txt('NIGHT SHIFT',W/2,H*0.38,44*s,'#e8d27a','center');
 txt('a suburban heist prototype',W/2,H*0.38+30*s,14*s,'#8a93a3','center');
 txt('Night '+save.night+'   ·   Debt $'+save.debt.toLocaleString(),W/2,H*0.55,15*s,'#c88','center');
 if(Math.sin(t*3)>-0.3)txt('TAP TO START',W/2,H*0.7,18*s,'#fff','center');
 txt('Stay in the dark. Pick locks (hold USE). Grab loot. Reach your car (east end).',W/2,H*0.86,Math.max(10,11*s),'#778','center');
 txt('Keys: WASD / Shift run / E use',W/2,H*0.86+18*s,Math.max(10,10*s),'#556','center');
}
function drawEnd(){
 cx.fillStyle='rgba(0,0,0,0.78)';cx.fillRect(0,0,W,H);const s=Math.min(W,H)/400,r=result;
 txt(r.kind==='escaped'?'CLEAN GETAWAY':'BUSTED',W/2,H*0.3,36*s,r.kind==='escaped'?'#e8d27a':'#ff5544','center');
 txt('Haul: $'+r.haul.toLocaleString()+' ('+r.items+' items)',W/2,H*0.42,18*s,'#ddd','center');
 txt(r.kind==='escaped'?'Paid toward debt: $'+r.kept.toLocaleString():'Haul seized by police',W/2,H*0.5,15*s,r.kept?'#9c9':'#c88','center');
 txt('Debt remaining: $'+save.debt.toLocaleString(),W/2,H*0.58,18*s,'#c88','center');
 if(performance.now()-endAt>900)txt('TAP FOR NEXT NIGHT',W/2,H*0.74,16*s,'#fff','center');
}
let last=performance.now();state='title';build();
function loop(n){const dt=Math.min(0.05,(n-last)/1000);last=n;update(dt);draw();requestAnimationFrame(loop);}
requestAnimationFrame(loop);
window.NS={get s(){return{state,P,meter,alarmT,haul,result,police,doors,loot,guards}},trigger,start};
