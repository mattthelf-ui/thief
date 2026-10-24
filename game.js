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
// ---------- render (v2: lightmapped) ----------
const LS=0.5;let ART=null;
function mkC(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function srand(s){return()=>{s=(s*16807)%2147483647;return s/2147483647;};}
function blockers(){return walls.filter(w=>!(w.k==='door'&&w.open)&&w.y>-1&&w.x>-1&&w.x<WW&&w.y<WH);}
function rayHit(x,y,dx,dy,maxd,bl){let t=maxd;for(const w of bl){let t0=-1e9,t1=1e9;
 if(dx===0){if(x<w.x||x>w.x+w.w)continue;}else{let a=(w.x-x)/dx,b=(w.x+w.w-x)/dx;if(a>b)[a,b]=[b,a];t0=a;t1=b;}
 if(dy===0){if(y<w.y||y>w.y+w.h)continue;}else{let a=(w.y-y)/dy,b=(w.y+w.h-y)/dy;if(a>b)[a,b]=[b,a];t0=Math.max(t0,a);t1=Math.min(t1,b);}
 if(t0<=t1&&t1>0&&t0<t){t=Math.max(0,t0);}}return t;}
function visPath(c,x,y,r,a0,a1,n,bl,s){c.beginPath();const full=a1-a0>=TAU-0.01;if(!full)c.moveTo(x*s,y*s);
 for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n,dx=Math.cos(a),dy=Math.sin(a),t=rayHit(x,y,dx,dy,r,bl)+4;c.lineTo((x+dx*t)*s,(y+dy*t)*s);}c.closePath();}
function addLight(c,x,y,r,col,a,bl,s,a0,a1,n){c.save();visPath(c,x,y,r,a0===undefined?0:a0,a1===undefined?TAU:a1,n||96,bl,s);c.clip();
 const g=c.createRadialGradient(x*s,y*s,0,x*s,y*s,r*s);g.addColorStop(0,`rgba(${col},${a})`);g.addColorStop(0.4,`rgba(${col},${a*0.6})`);g.addColorStop(1,`rgba(${col},0)`);c.fillStyle=g;c.fillRect((x-r)*s,(y-r)*s,r*2*s,r*2*s);c.restore();}
// visual light set: gameplay lights + small porch/window glows (porch = dim, purely decorative)
function visLights(){const L=lights.map(l=>({x:l.x,y:l.y,r:l.r*1.9,col:l.in?'255,196,130':'255,170,90',a:1}));
 houses.forEach((h,i)=>{L.push({x:h.x+h.w/2+40,y:h.y+h.h+8,r:60,col:'255,190,120',a:0.55});});
 return L;}
function buildArt(){const R=srand(7),A={};
 // ---- ground ----
 const g=mkC(WW,WH),c=g.getContext('2d');A.ground=g;
 c.fillStyle='#0d140f';c.fillRect(0,0,WW,WH);
 for(let i=0;i<26000;i++){const x=R()*WW,y=R()*WH,v=R();c.fillStyle=v<0.5?'rgba(40,62,38,0.35)':'rgba(5,10,6,0.45)';c.fillRect(x,y,1.5,2+R()*3);}
 for(let x=0;x<WW;x+=36){c.fillStyle=(x/36)%2?'rgba(255,255,255,0.012)':'rgba(0,0,0,0.04)';c.fillRect(x,0,36,ROAD.y-30);}
 // sidewalks
 const sw=(y)=>{c.fillStyle='#2a2b2c';c.fillRect(0,y,WW,30);for(let i=0;i<4000;i++){c.fillStyle=R()<0.5?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.12)';c.fillRect(R()*WW,y+R()*30,2,2);}c.strokeStyle='rgba(0,0,0,0.45)';c.lineWidth=1;for(let x=0;x<WW;x+=34){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+30);c.stroke();}c.fillStyle='#3a3b3c';c.fillRect(0,y===ROAD.y-30?y+28:y,WW,2);};
 sw(ROAD.y-30);sw(ROAD.y+ROAD.h);
 // asphalt
 c.fillStyle='#111214';c.fillRect(0,ROAD.y,WW,ROAD.h);
 for(let i=0;i<30000;i++){c.fillStyle=R()<0.5?'rgba(255,255,255,0.035)':'rgba(0,0,0,0.25)';c.fillRect(R()*WW,ROAD.y+R()*ROAD.h,1.5,1.5);}
 c.strokeStyle='rgba(0,0,0,0.6)';c.lineWidth=1;for(let i=0;i<18;i++){let x=R()*WW,y=ROAD.y+R()*ROAD.h;c.beginPath();c.moveTo(x,y);for(let k=0;k<6;k++){x+=R()*24-6;y+=R()*14-7;c.lineTo(x,y);}c.stroke();}
 c.fillStyle='rgba(180,160,100,0.35)';for(let x=20;x<WW;x+=90)c.fillRect(x,ROAD.y+ROAD.h/2-2,46,3);
 A.puddles=[];for(let i=0;i<14;i++){const p={x:R()*WW,y:ROAD.y+14+R()*(ROAD.h-28),rx:30+R()*50,ry:6+R()*8};A.puddles.push(p);c.fillStyle='rgba(20,26,38,0.85)';c.beginPath();c.ellipse(p.x,p.y,p.rx,p.ry,0,0,TAU);c.fill();}
 c.fillStyle='#0b0c0e';c.fillRect(0,ROAD.y+ROAD.h+30,WW,WH);for(let i=0;i<6000;i++){c.fillStyle='rgba(255,255,255,0.025)';c.fillRect(R()*WW,ROAD.y+ROAD.h+30+R()*120,1.5,1.5);}
 // driveways / paths
 houses.forEach(h=>{const px=h.x+h.w/2-25;c.fillStyle='#232322';c.fillRect(px,h.y+h.h,50,ROAD.y-30-(h.y+h.h));c.strokeStyle='rgba(0,0,0,0.4)';for(let y=h.y+h.h;y<ROAD.y-30;y+=22){c.beginPath();c.moveTo(px,y);c.lineTo(px+50,y);c.stroke();}});
 // interiors
 houses.forEach((h,hi)=>{c.fillStyle='#1d1712';c.fillRect(h.x,h.y,h.w,h.h);
  for(let y=h.y;y<h.y+h.h;y+=11){const off=R()*80;for(let x=h.x-off;x<h.x+h.w;x+=80){c.fillStyle=`rgba(${60+R()*25|0},${42+R()*15|0},${28+R()*10|0},0.55)`;c.fillRect(Math.max(h.x,x),y,Math.min(78,h.x+h.w-x),10);}}
  // tiled kitchen (right room)
  const kx=h.x+h.w*0.55,ky=h.y,kw=h.w*0.45,kh=h.h*0.55;c.fillStyle='#24262a';c.fillRect(kx,ky,kw,kh);c.strokeStyle='rgba(0,0,0,0.5)';for(let x=kx;x<kx+kw;x+=18){c.beginPath();c.moveTo(x,ky);c.lineTo(x,ky+kh);c.stroke();}for(let y=ky;y<ky+kh;y+=18){c.beginPath();c.moveTo(kx,y);c.lineTo(kx+kw,y);c.stroke();}
  c.fillStyle='#3a3833';c.fillRect(h.x+h.w-34,h.y+12,22,kh-24);c.fillRect(kx+12,h.y+12,kw-24,20);
  // rug + sofa + table
  c.fillStyle='#3a1f1c';c.fillRect(h.x+40,h.y+h.h*0.55,h.w*0.38,h.h*0.28);c.strokeStyle='rgba(200,160,110,0.15)';c.strokeRect(h.x+46,h.y+h.h*0.55+6,h.w*0.38-12,h.h*0.28-12);
  c.fillStyle='#2b2f36';c.fillRect(h.x+40,h.y+h.h-60,h.w*0.38,26);c.fillStyle='#363b44';c.fillRect(h.x+44,h.y+h.h-56,h.w*0.38-8,10);
  c.fillStyle='#2a1e14';c.fillRect(h.x+h.w*0.62,h.y+h.h*0.68,70,44);
  // bed (left back room)
  c.fillStyle='#2c2a30';c.fillRect(h.x+h.w*0.25,h.y+20,90,110);c.fillStyle='#4a4650';c.fillRect(h.x+h.w*0.25+8,h.y+26,32,20);c.fillRect(h.x+h.w*0.25+50,h.y+26,32,20);
 });
 // fences/hedges/cars/walls drawn on ground
 for(const w of walls){if(w.k==='door'||w.x<0||w.y<0||w.x>=WW||w.y>=WH)continue;
  if(w.k==='wall'){c.fillStyle='#08090b';c.fillRect(w.x+3,w.y+4,w.w,w.h);c.fillStyle='#3d3c3a';c.fillRect(w.x,w.y,w.w,w.h);c.fillStyle='#5a5853';c.fillRect(w.x,w.y,w.w,2);c.fillRect(w.x,w.y,2,w.h);}
  else if(w.k==='fence'){c.fillStyle='rgba(0,0,0,0.6)';c.fillRect(w.x+2,w.y+3,w.w,w.h);c.fillStyle='#3a2c1e';c.fillRect(w.x,w.y,w.w,w.h);c.fillStyle='#4d3a26';const hz=w.w>w.h;for(let k=0;k<(hz?w.w:w.h);k+=9){hz?c.fillRect(w.x+k,w.y,1,w.h):c.fillRect(w.x,w.y+k,w.w,1);}}
  else if(w.k==='hedge'){for(let i=0;i<40;i++){const x=w.x+R()*w.w,y=w.y+R()*w.h,r=6+R()*10;c.fillStyle=`rgba(${12+R()*14|0},${30+R()*22|0},${16+R()*10|0},0.9)`;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}}
  else if(w.k==='car'){carSprite(c,w.x,w.y,w.w,w.h,'#2a2f38');}}
 carSprite(c,GETAWAY.x,GETAWAY.y,GETAWAY.w,GETAWAY.h,'#1b2b33');
 // ---- static lightmap ----
 const lm=mkC(WW*LS|0,WH*LS|0),l=lm.getContext('2d');A.lm=lm;
 l.fillStyle='rgb(36,44,64)';l.fillRect(0,0,lm.width,lm.height);// moonlight ambient
 l.globalCompositeOperation='lighter';const bl=walls.filter(w=>w.k!=='door'&&w.x>=0&&w.y>=0&&w.x<WW&&w.y<WH);
 A.vl=visLights();A.vl.forEach(L=>{addLight(l,L.x,L.y,L.r,L.col,L.a,bl,LS);addLight(l,L.x,L.y,L.r*0.6,L.col,L.a*0.8,bl,LS);});
 // window glow spill (interior Delgado lit, others faint)
 l.globalCompositeOperation='source-over';
 if('filter' in l){const t=mkC(lm.width,lm.height),tc=t.getContext('2d');tc.filter='blur(3px)';tc.drawImage(lm,0,0);A.lm=t;}
 // ---- sprites ----
 const glow=mkC(128,128),gc=glow.getContext('2d'),gg=gc.createRadialGradient(64,64,0,64,64,64);gg.addColorStop(0,'rgba(255,220,170,1)');gg.addColorStop(0.08,'rgba(255,190,110,0.8)');gg.addColorStop(0.3,'rgba(255,140,60,0.18)');gg.addColorStop(1,'rgba(255,120,40,0)');gc.fillStyle=gg;gc.fillRect(0,0,128,128);A.glow=glow;
 const gr=mkC(160,160),grc=gr.getContext('2d'),id=grc.createImageData(160,160);for(let i=0;i<id.data.length;i+=4){const v=Math.random()*255;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=14;}grc.putImageData(id,0,0);A.grain=gr;
 A.dyn=mkC(lm.width,lm.height);
 return A;}
function carSprite(c,x,y,w,h,col){c.fillStyle='rgba(0,0,0,0.55)';c.beginPath();c.roundRect(x+4,y+5,w,h,8);c.fill();c.fillStyle=col;c.beginPath();c.roundRect(x,y,w,h,8);c.fill();
 const hz=w>h;c.fillStyle='rgba(120,150,180,0.25)';if(hz){c.fillRect(x+w*0.22,y+4,w*0.14,h-8);c.fillRect(x+w*0.68,y+4,w*0.1,h-8);c.fillStyle='rgba(0,0,0,0.3)';c.fillRect(x+w*0.36,y+3,w*0.32,h-6);}else{c.fillRect(x+4,y+h*0.22,w-8,h*0.14);}
 c.strokeStyle='rgba(255,255,255,0.08)';c.lineWidth=1;c.beginPath();c.roundRect(x+0.5,y+0.5,w-1,h-1,8);c.stroke();}
let camX=0,camY=0,Z=1,frames=0,fpsT=0,FPS=0;
function figure(x,y,a,body,head,r,rim){cx.save();cx.translate(x,y);cx.rotate(a);
 cx.fillStyle='rgba(0,0,0,0.5)';cx.beginPath();cx.ellipse(3,4,r*0.8,r*1.15,0,0,TAU);cx.fill();
 cx.fillStyle=body;cx.beginPath();cx.ellipse(0,0,r*0.7,r*1.1,0,0,TAU);cx.fill();
 cx.fillStyle=head;cx.beginPath();cx.arc(r*0.15,0,r*0.5,0,TAU);cx.fill();
 cx.strokeStyle=rim;cx.lineWidth=1.2;cx.beginPath();cx.ellipse(0,0,r*0.7,r*1.1,0,-1.2,1.2);cx.stroke();cx.restore();}
function draw(){
 if(!ART)ART=buildArt();
 cx.setTransform(DPR,0,0,DPR,0,0);cx.fillStyle='#030406';cx.fillRect(0,0,W,H);
 const now=performance.now();frames++;if(now-fpsT>1000){FPS=frames*1000/(now-fpsT);frames=0;fpsT=now;}
 Z=SC*1.05;
 let fx_=P.x,fy_=P.y;if(state==='title'){fx_=900+Math.sin(flash*0.08)*500;fy_=640;}
 camX=cl(fx_-W/2/Z,-40,WW-W/Z+40);camY=cl(fy_-H/2/Z,-40,WH-H/Z+40);
 if(W/Z>WW)camX=(WW-W/Z)/2;if(H/Z>WH)camY=(WH-H/Z)/2;
 cx.save();cx.scale(Z,Z);cx.translate(-camX,-camY);
 cx.drawImage(ART.ground,0,0);
 // doors
 for(const d of doors){if(d.open){cx.fillStyle='#2a1d12';d.w>d.h?cx.fillRect(d.x,d.y-d.w+d.h,4,d.w):cx.fillRect(d.x,d.y,d.w,4);}else{cx.fillStyle='#3b2817';cx.fillRect(d.x,d.y,d.w,d.h);cx.fillStyle='#b08a4a';cx.fillRect(d.x+d.w-8,d.y+d.h/2-1,3,3);}}
 // loot
 for(const l of loot)if(!l.taken){const s=6+l.wt*0.7;cx.fillStyle='rgba(0,0,0,0.5)';cx.fillRect(l.x-s+2,l.y-5+3,s*2,10);cx.fillStyle=l.v>=1500?'#8a7038':'#3c4650';cx.beginPath();cx.roundRect(l.x-s,l.y-5,s*2,10,2);cx.fill();cx.fillStyle=l.v>=1500?'#e8c870':'#9fb4c4';cx.fillRect(l.x-s+2,l.y-4,s*2-4,1.5);}
 // noise rings
 for(const n of noises){cx.strokeStyle=`rgba(${n.src==='dog'?'255,150,80':'200,210,230'},${0.5*(1-n.t)})`;cx.lineWidth=1.5;cx.beginPath();cx.arc(n.x,n.y,n.r*n.t,0,TAU);cx.stroke();}
 // actors
 for(const g of guards)figure(g.x,g.y,g.a,g.mode==='chase'?'#5a2a24':'#4a4f58','#c9a988',12,'rgba(255,220,180,0.35)');
 cx.save();cx.translate(dog.x,dog.y);cx.rotate(dog.a);cx.fillStyle='rgba(0,0,0,0.5)';cx.beginPath();cx.ellipse(2,3,11,6,0,0,TAU);cx.fill();cx.fillStyle='#3b2c20';cx.beginPath();cx.ellipse(0,0,11,5.5,0,0,TAU);cx.fill();cx.beginPath();cx.ellipse(11,0,5,4,0,0,TAU);cx.fill();cx.fillRect(-15,-1,5,2);cx.restore();
 cx.save();cx.translate(cam.x,cam.y);cx.rotate(cam.a);cx.fillStyle='#1a1b1e';cx.fillRect(-7,-5,14,10);cx.fillStyle='#2c2e33';cx.fillRect(4,-3,6,6);cx.restore();
 figure(P.x,P.y,P.a,'#15181e','#0c0e12',11,'rgba(150,170,210,0.45)');
 if(police){cx.save();cx.translate(police.x,police.y);cx.rotate(police.a);cx.fillStyle='rgba(0,0,0,0.6)';cx.fillRect(-20,-10,46,26);cx.fillStyle='#d8d8dc';cx.beginPath();cx.roundRect(-23,-12,46,24,6);cx.fill();cx.fillStyle='#111';cx.fillRect(-10,-11,20,22);cx.fillStyle='rgba(120,150,180,0.35)';cx.fillRect(10,-9,6,18);cx.restore();}
 cx.restore();
 // ---- lighting ----
 const D=ART.dyn,d=D.getContext('2d');d.globalCompositeOperation='source-over';d.drawImage(ART.lm,0,0);
 d.globalCompositeOperation='lighter';const bl=blockers();
 for(const g of guards){const col=g.sees?'255,90,70':g.mode!=='patrol'?'255,190,120':'215,225,245';addLight(d,g.x,g.y,300,col,1,bl,LS,g.a-0.55,g.a+0.55,28);addLight(d,g.x,g.y,40,'200,200,210',0.25,bl,LS,0,TAU,16);}
 addLight(d,cam.x,cam.y,260,cam.sees?'255,70,60':'120,170,230',0.45,bl,LS,cam.a-0.35,cam.a+0.35,20);
 addLight(d,P.x,P.y,200,'230,220,200',0.8,bl,LS,P.a-0.38,P.a+0.38,24);addLight(d,P.x,P.y,48,'150,165,200',0.35,bl,LS,0,TAU,16);
 if(police){const f=Math.sin(flash*14)>0;addLight(d,police.x,police.y,260,f?'255,40,40':'50,80,255',0.9,bl,LS,0,TAU,48);addLight(d,police.x,police.y,260,'255,250,230',0.6,bl,LS,police.a-0.3,police.a+0.3,16);}
 cx.save();cx.globalCompositeOperation='multiply';cx.imageSmoothingEnabled=true;cx.drawImage(D,-camX*Z,-camY*Z,WW*Z,WH*Z);cx.restore();
 // ---- bloom + wet reflections ----
 cx.save();cx.globalCompositeOperation='lighter';
 for(const L of ART.vl){const sx=(L.x-camX)*Z,sy=(L.y-camY)*Z;if(sx<-200||sy<-200||sx>W+200||sy>H+200)continue;const s=(L.r>150?90:40)*Z*L.a;cx.globalAlpha=0.7;cx.drawImage(ART.glow,sx-s,sy-s,s*2,s*2);
  if(L.r>150){cx.globalAlpha=0.16;cx.drawImage(ART.glow,sx-14*Z,sy+10*Z,28*Z,130*Z);}}
 for(const p of ART.puddles){let br=0;for(const L of ART.vl){const dd=dist(p.x,p.y,L.x,L.y);if(dd<L.r)br+=(1-dd/L.r)*L.a;}if(police){const dd=dist(p.x,p.y,police.x,police.y);if(dd<260)br+=(1-dd/260);}if(br<0.05)continue;const sx=(p.x-camX)*Z,sy=(p.y-camY)*Z;cx.globalAlpha=Math.min(0.5,br*0.5);cx.drawImage(ART.glow,sx-p.rx*Z,sy-p.ry*Z*1.5,p.rx*2*Z,p.ry*3*Z);}
 if(police){const sx=(police.x-camX)*Z,sy=(police.y-camY)*Z,f=Math.sin(flash*14)>0;cx.globalAlpha=0.9;cx.fillStyle=f?'#ff3030':'#3050ff';cx.beginPath();cx.arc(sx+(f?-5:5)*Z,sy,6*Z,0,TAU);cx.fill();cx.globalAlpha=0.5;cx.drawImage(ART.glow,sx-40*Z,sy-40*Z,80*Z,80*Z);}
 for(const l of loot)if(!l.taken&&dist(l.x,l.y,P.x,P.y)<160){const sx=(l.x-camX)*Z,sy=(l.y-camY)*Z;cx.globalAlpha=0.25+0.2*Math.sin(flash*3+l.x);cx.drawImage(ART.glow,sx-10*Z,sy-10*Z,20*Z,20*Z);}
 {const sx=(cam.x-camX)*Z,sy=(cam.y-camY)*Z;cx.globalAlpha=Math.sin(flash*4)>0?0.9:0.2;cx.fillStyle='#ff2a2a';cx.fillRect(sx-1.5,sy-1.5,3,3);}
 cx.restore();
 // ---- post ----
 if(alarmT>0){const f=Math.sin(flash*7)>0;cx.fillStyle=f?'rgba(160,0,0,0.10)':'rgba(0,20,160,0.10)';cx.fillRect(0,0,W,H);}
 cx.strokeStyle='rgba(150,165,190,0.12)';cx.lineWidth=1;cx.beginPath();for(let i=0;i<90;i++){const x=((i*173+flash*90)%(W+60))-30,y=((i*97+flash*800)%(H+40))-20;cx.moveTo(x,y);cx.lineTo(x-3,y+12);}cx.stroke();
 cx.save();cx.globalAlpha=0.9;const ox=(Math.random()*160)|0,oy=(Math.random()*160)|0;cx.fillStyle=cx.createPattern(ART.grain,'repeat');cx.translate(-ox,-oy);cx.fillRect(0,0,W+ox,H+oy);cx.restore();
 if(!ART.vig||ART.vig.width!==W||ART.vig.height!==H){const v=mkC(W,H),vc=v.getContext('2d'),g=vc.createRadialGradient(W/2,H/2,Math.min(W,H)*0.25,W/2,H/2,Math.hypot(W,H)*0.6);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,0.75)');vc.fillStyle=g;vc.fillRect(0,0,W,H);ART.vig=v;}
 cx.drawImage(ART.vig,0,0);
 if(state==='title')return drawTitle();
 drawHUD();
 if(state==='end')drawEnd();
}
function txt(s,x,y,sz,c,al,wt){cx.font=`${wt||600} ${sz}px system-ui,-apple-system,sans-serif`;cx.textAlign=al||'left';cx.fillStyle='rgba(0,0,0,0.6)';cx.fillText(s,x,y+1);cx.fillStyle=c;cx.fillText(s,x,y);}
function drawHUD(){
 const s=SC,pad=14+(s*4);
 txt('$'+haul.toLocaleString(),pad,pad+16*s,18*s,'#e2c27a','left',500);
 txt(P.bag.length+' items · '+weight()+' kg',pad,pad+32*s,11*s,'rgba(190,195,205,0.55)','left',400);
 const mw=Math.min(180,W*0.36),mx=W/2-mw/2,my=pad+2;
 cx.fillStyle='rgba(255,255,255,0.08)';cx.fillRect(mx,my,mw,3);
 cx.fillStyle=alarmT>0?(Math.sin(flash*10)>0?'#e33':'#36f'):meter>0.6?'#d8573c':'#c9a35a';cx.fillRect(mx,my,mw*meter,3);
 txt(alarmT>0?'ALARM  '+Math.ceil(alarmT):P.seen?'SEEN':lightAt(P.x,P.y)>0.45?'LIT':'HIDDEN',W/2,my+18*s,10*s,alarmT>0?'#ff6a5a':P.seen?'#ffb070':'rgba(190,200,215,0.6)','center',500);
 txt('debt $'+save.debt.toLocaleString(),W-pad,pad+16*s,11*s,'rgba(210,150,140,0.7)','right',400);
 if(alarmT>0)txt('get to the car — east end',W/2,my+34*s,11*s,'rgba(255,255,255,0.8)','center',400);
 if(msgT>0)txt(msg,W/2,H*0.3,14*s,'rgba(240,230,210,'+Math.min(1,msgT)+')','center',400);
 if(stick.id!==null){cx.strokeStyle='rgba(255,255,255,0.18)';cx.lineWidth=1.5;cx.beginPath();cx.arc(stick.ox,stick.oy,50*s,0,TAU);cx.stroke();cx.fillStyle='rgba(255,255,255,0.18)';cx.beginPath();cx.arc(stick.ox+stick.x*50*s,stick.oy+stick.y*50*s,18*s,0,TAU);cx.fill();}
 const B=btnRects();
 const b=(o,l,on,c)=>{cx.fillStyle=on?'rgba(255,255,255,0.12)':'rgba(8,10,14,0.45)';cx.strokeStyle=c;cx.lineWidth=1.5;cx.beginPath();cx.arc(o.x,o.y,o.r,0,TAU);cx.fill();cx.stroke();txt(l,o.x,o.y+4*s,11*s,'rgba(235,235,240,0.85)','center',500);};
 const tg=P.target;
 b(B.use,tg?(tg.k==='door'?'PICK':'GRAB'):'USE',btn.use!==null,tg?'rgba(226,194,122,0.8)':'rgba(255,255,255,0.2)');
 if(tg){const pr=tg.k==='door'?tg.prog/tg.need:tg.prog/0.45;cx.strokeStyle='#e2c27a';cx.lineWidth=3;cx.beginPath();cx.arc(B.use.x,B.use.y,B.use.r+5,-Math.PI/2,-Math.PI/2+TAU*pr);cx.stroke();}
 b(B.sprint,'RUN',btn.sprint!==null,'rgba(255,255,255,0.2)');
}
function drawTitle(){
 const s=Math.min(W,H)/400;cx.fillStyle='rgba(0,0,0,0.35)';cx.fillRect(0,0,W,H);
 txt('NIGHT SHIFT',W/2,H*0.4,40*s,'#e6d3a8','center',300);
 cx.fillStyle='rgba(226,194,122,0.5)';cx.fillRect(W/2-40*s,H*0.4+14*s,80*s,1);
 txt('night '+save.night+'  ·  debt $'+save.debt.toLocaleString(),W/2,H*0.4+36*s,12*s,'rgba(210,190,180,0.7)','center',400);
 cx.globalAlpha=0.55+0.45*Math.sin(flash*2.5);txt('tap to begin',W/2,H*0.68,14*s,'#fff','center',400);cx.globalAlpha=1;
 txt('stay in the dark · hold USE to pick and grab · reach your car',W/2,H*0.88,Math.max(10,10*s),'rgba(200,205,215,0.5)','center',400);
}
function drawEnd(){
 cx.fillStyle='rgba(0,0,0,0.72)';cx.fillRect(0,0,W,H);const s=Math.min(W,H)/400,r=result;
 txt(r.kind==='escaped'?'CLEAN GETAWAY':'BUSTED',W/2,H*0.3,32*s,r.kind==='escaped'?'#e6d3a8':'#e0564a','center',300);
 txt('haul $'+r.haul.toLocaleString()+'  ·  '+r.items+' items',W/2,H*0.42,15*s,'rgba(230,230,235,0.85)','center',400);
 txt(r.kind==='escaped'?'paid toward debt  $'+r.kept.toLocaleString():'haul seized by police',W/2,H*0.5,13*s,r.kept?'#9fc59a':'#d08a80','center',400);
 txt('debt remaining  $'+save.debt.toLocaleString(),W/2,H*0.58,15*s,'rgba(210,150,140,0.85)','center',400);
 if(performance.now()-endAt>900)txt('tap for next night',W/2,H*0.74,13*s,'rgba(255,255,255,0.8)','center',400);
}
let last=performance.now();state='title';build();
function loop(n){const dt=Math.min(0.05,(n-last)/1000);last=n;update(dt);draw();requestAnimationFrame(loop);}
requestAnimationFrame(loop);
window.NS={get fps(){return FPS},get s(){return{state,P,meter,alarmT,haul,result,police,doors,loot,guards}},trigger,start};
