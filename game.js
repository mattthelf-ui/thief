// Night Shift — first-person (three.js). Gameplay ported 1:1 from the top-down build; world units: 50 ≈ 1 m.
import * as THREE from './vendor/three.module.min.js';
const $=id=>document.getElementById(id);
const cv=$('c');
const isTouch=matchMedia('(pointer:coarse)').matches||'ontouchstart'in window;
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,isTouch?1.5:2));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
const scene=new THREE.Scene();const FOG=0x141c30;scene.background=new THREE.Color(FOG);scene.fog=new THREE.FogExp2(FOG,0.0011);
const camera=new THREE.PerspectiveCamera(70,1,2,4000);
let W,H;function resize(){W=innerWidth;H=innerHeight;renderer.setSize(W,H,false);camera.aspect=W/H;camera.fov=W<H?78:62;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
const WW=1900,WH=1000,TAU=Math.PI*2;
const rnd=(a,b)=>a+Math.random()*(b-a),cl=(v,a,b)=>v<a?a:v>b?b:v,dist=(a,b,c,d)=>Math.hypot(c-a,d-b);
// ---------- world (unchanged layout) ----------
const houses=[{x:120,y:200,w:400,h:300,name:'Rourke'},{x:740,y:170,w:440,h:330,name:'Delgado'},{x:1360,y:210,w:380,h:290,name:'Pham'}];
let walls,doors,loot,guards,dog,cam,lights,noises,police,state,P,meter,alarmT,haul,night,msg,msgT,flash;
let save=JSON.parse(localStorage.getItem('ns_save')||'{"debt":25000,"night":1}');
function wall(x,y,w,h,k){walls.push({x,y,w,h,k:k||'wall'});}
function build(){
 walls=[];doors=[];loot=[];noises=[];
 wall(0,-20,WW,20,'edge');wall(0,WH,WW,20,'edge');wall(-20,0,20,WH,'edge');wall(WW,0,20,WH,'edge');
 const T=12;
 houses.forEach((h,i)=>{
  const dw=50,dxp=h.x+h.w/2-dw/2;
  wall(h.x,h.y,h.w,T);wall(h.x,h.y,T,h.h);wall(h.x+h.w-T,h.y,T,h.h);
  wall(h.x,h.y+h.h-T,dxp-h.x,T);wall(dxp+dw,h.y+h.h-T,h.x+h.w-(dxp+dw),T);
  wall(h.x+h.w*0.55,h.y,T,h.h*0.55);
  const d={x:dxp,y:h.y+h.h-T,w:dw,h:T,k:'door',locked:true,prog:0,open:false,h_:i,need:[1.1,1.5,1.9][i],front:true};
  doors.push(d);walls.push(d);
  const bd={x:h.x+40,y:h.y,w:40,h:T,k:'door',locked:true,prog:0,open:false,h_:i,need:2.2,front:false};doors.push(bd);walls.push(bd);
  const fx0=h.x-50,fy0=h.y-60,fw=h.w+100,fh=h.h+150,F=5;
  wall(fx0,fy0,fw,F,'fence');wall(fx0,fy0,F,fh,'fence');wall(fx0+fw-F,fy0,F,fh,'fence');
  wall(fx0,fy0+fh-F,fw/2-40,F,'fence');wall(fx0+fw/2+40,fy0+fh-F,fw/2-40,F,'fence');
 });
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
 P={x:60,y:780,a:0,pitch:-0.05,bag:[],step:0,bob:0};
 meter=0;alarmT=0;police=null;haul=0;msg='';msgT=0;flash=0;
}
const GETAWAY={x:1820,y:900,w:60,h:34};
// ---------- input ----------
const keys={};let stick={id:null,ox:0,oy:0,x:0,y:0},look={id:null,lx:0,ly:0},btn={sprint:null,use:null};
addEventListener('keydown',e=>{keys[e.code]=1;if(state!=='play')tapAny();});addEventListener('keyup',e=>keys[e.code]=0);
const LOOKS=isTouch?0.0065:0.0028;
function turn(dx,dy){P.a+=dx*LOOKS;P.pitch=cl(P.pitch-dy*LOOKS,-1.2,1.0);}
cv.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='play'){tapAny();return;}
 if(e.pointerType==='mouse'){if(document.pointerLockElement!==cv&&cv.requestPointerLock)cv.requestPointerLock();return;}
 if(stick.id===null&&e.clientX<W*0.45){stick={id:e.pointerId,ox:e.clientX,oy:e.clientY,x:0,y:0};}
 else if(look.id===null){look={id:e.pointerId,lx:e.clientX,ly:e.clientY};}});
addEventListener('pointermove',e=>{
 if(e.pointerType==='mouse'&&document.pointerLockElement===cv&&state==='play'){turn(e.movementX,e.movementY);return;}
 if(e.pointerId===stick.id){let dx=e.clientX-stick.ox,dy=e.clientY-stick.oy,m=Math.hypot(dx,dy),R=50;if(m>R){dx*=R/m;dy*=R/m;}stick.x=dx/R;stick.y=dy/R;}
 else if(e.pointerId===look.id){turn(e.clientX-look.lx,e.clientY-look.ly);look.lx=e.clientX;look.ly=e.clientY;}});
function up(e){if(e.pointerId===stick.id)stick={id:null,x:0,y:0};if(e.pointerId===look.id)look.id=null;for(const k in btn)if(btn[k]===e.pointerId)btn[k]=null;}
addEventListener('pointerup',up);addEventListener('pointercancel',up);
for(const [k,id] of [['use','buse'],['sprint','bsprint']]){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();btn[k]=e.pointerId;});}
$('screen').addEventListener('pointerdown',e=>{e.preventDefault();tapAny();});
function tapAny(){if(state==='title'||state==='end'){if(state==='end'&&performance.now()-endAt<900)return;start();}}
// ---------- helpers (unchanged rules) ----------
function hitWall(x,y,r){for(const w of walls){if(w.k==='door'&&w.open)continue;const nx=cl(x,w.x,w.x+w.w),ny=cl(y,w.y,w.y+w.h);if((x-nx)**2+(y-ny)**2<r*r)return w;}return null;}
function move(o,dx,dy,r){if(!hitWall(o.x+dx,o.y,r))o.x+=dx;if(!hitWall(o.x,o.y+dy,r))o.y+=dy;}
function los(ax,ay,bx,by){const d=dist(ax,ay,bx,by),n=Math.ceil(d/10);for(let i=1;i<n;i++){const x=ax+(bx-ax)*i/n,y=ay+(by-ay)*i/n;for(const w of walls){if(w.k==='fence'||w.k==='car'||w.k==='edge'||(w.k==='door'&&w.open))continue;if(x>w.x&&x<w.x+w.w&&y>w.y&&y<w.y+w.h)return false;}}return true;}
function lightAt(x,y){let l=0.12;for(const L of lights){const d=dist(x,y,L.x,L.y);if(d<L.r)l+=(1-d/L.r)*0.9;}if(police){const d=dist(x,y,police.x,police.y);if(d<200)l+=(1-d/200)*0.8;}return Math.min(1,l);}
function noise(x,y,r,src){noises.push({x,y,r,t:0,src});for(const g of guards){if(dist(g.x,g.y,x,y)<r&&g.mode!=='chase'){g.mode='investigate';g.tx=x;g.ty=y;g.wait=2.5;}}
 if(src!=='dog'&&dist(dog.x,dog.y,x,y)<r+120&&dog.cd<=0){dog.bark=1.2;dog.cd=3;noise(dog.x,dog.y,300,'dog');say('Dog barking!');}}
function say(t){msg=t;msgT=2.2;}
function start(){build();resetVisuals();state='play';night=save.night;say('Night '+night+' — case the street. Stay out of the light.');showScreen();}
function trigger(){if(state!=='play'||alarmT>0)return;alarmT=60;meter=1;say('ALARM! Get to the car!');police={x:-40,y:780,a:0,spd:150};guards.forEach(g=>g.mode='chase');}
function weight(){return P.bag.reduce((s,i)=>s+i.wt,0);}
let endAt=0,result=null;
function end(kind){state='end';endAt=performance.now();const kept=kind==='escaped'?haul:0;result={kind,haul,kept,items:P.bag.length};if(kept){save.debt=Math.max(0,save.debt-kept);}save.night++;localStorage.setItem('ns_save',JSON.stringify(save));if(document.pointerLockElement)document.exitPointerLock();showScreen();}
// ---------- update ----------
function update(dt){
 if(msgT>0)msgT-=dt;flash+=dt;
 if(state!=='play')return;
 let st=stick.x,fw=-stick.y;
 if(keys.KeyA)st=-1;if(keys.KeyD)st=1;if(keys.KeyW||keys.ArrowUp)fw=1;if(keys.KeyS||keys.ArrowDown)fw=-1;
 if(keys.ArrowLeft)P.a-=2.2*dt;if(keys.ArrowRight)P.a+=2.2*dt;
 let m=Math.hypot(st,fw);if(m>1){st/=m;fw/=m;m=1;}
 const sprint=(btn.sprint!==null||keys.ShiftLeft||keys.ShiftRight)&&m>0.2;
 const using=btn.use!==null||keys.KeyE||keys.Space;
 const slow=Math.max(0.6,1-weight()*0.025);
 const sp=(sprint?190:95)*slow;
 const ca=Math.cos(P.a),sa=Math.sin(P.a);
 const mx=ca*fw-sa*st,my=sa*fw+ca*st;
 move(P,mx*sp*dt,my*sp*dt,11);
 P.step+=m*sp*dt;P.bob+=m*sp*dt*(sprint?0.075:0.06);
 if(sprint&&P.step>70){P.step=0;noise(P.x,P.y,180,'p');}
 if(!sprint&&P.step>140){P.step=0;}
 let target=null,td=1e9;
 for(const d of doors)if(d.locked){const q=dist(P.x,P.y,d.x+d.w/2,d.y+d.h/2);if(q<42&&q<td){td=q;target=d;}}
 for(const l of loot)if(!l.taken){const q=dist(P.x,P.y,l.x,l.y);if(q<34&&q<td){td=q;target=l;}}
 P.target=target;
 for(const d of doors)if(d!==target)d.prog=Math.max(0,d.prog-dt*2);
 for(const l of loot)if(l!==target)l.prog=0;
 if(target&&using){target.prog+=dt;
  if(target.k==='door'){if(target.prog>=target.need){target.locked=false;target.open=true;say('Lock picked');renderer.shadowMap.needsUpdate=true;if(Math.random()<0.3)noise(target.x,target.y,120,'p');}}
  else if(target.prog>=0.45){target.taken=true;P.bag.push(target);haul+=target.v;say('+$'+target.v+' '+target.n+(target.wt>5?' (heavy)':''));}}
 const vis=lightAt(P.x,P.y);P.vis=vis;let seen=0;
 for(const g of guards){
  let tx,ty,s=g.spd;
  if(g.mode==='chase'){tx=P.x;ty=P.y;s=g.spd*2.3;}
  else if(g.mode==='investigate'){tx=g.tx;ty=g.ty;s=g.spd*1.4;if(dist(g.x,g.y,tx,ty)<14){g.wait-=dt;tx=g.x;ty=g.y;g.a+=dt*1.5;if(g.wait<=0)g.mode='patrol';}}
  else{const p=g.path[g.wp];tx=p[0];ty=p[1];if(dist(g.x,g.y,tx,ty)<6)g.wp=(g.wp+1)%g.path.length;}
  const dx=tx-g.x,dy=ty-g.y,d=Math.hypot(dx,dy);
  if(d>2){const ta=Math.atan2(dy,dx);let da=((ta-g.a+Math.PI*3)%TAU)-Math.PI;g.a+=cl(da,-4*dt,4*dt);const ox=g.x,oy=g.y;move(g,dx/d*s*dt,dy/d*s*dt,11);g.moving=Math.hypot(g.x-ox,g.y-oy)/dt;if(Math.hypot(g.x-ox,g.y-oy)<0.01*s*dt&&g.mode==='chase'){move(g,Math.sign(dy)*s*dt*0.7,-Math.sign(dx)*s*dt*0.7,11);}}else g.moving=0;
  const pd=dist(g.x,g.y,P.x,P.y),pa=Math.atan2(P.y-g.y,P.x-g.x);let da=Math.abs(((pa-g.a+Math.PI*3)%TAU)-Math.PI);
  const range=120+180*vis;
  g.sees=pd<range&&da<0.55&&los(g.x,g.y,P.x,P.y)||pd<26;
  if(g.sees){seen=Math.max(seen,(0.35+vis)*(1.4-pd/300));if(g.mode==='patrol'){g.mode='investigate';g.tx=P.x;g.ty=P.y;g.wait=2;}}
  if(alarmT>0&&alarmT<58&&pd<20)return end('busted');
 }
 cam.t+=dt;cam.a=cam.base+Math.sin(cam.t*0.7)*0.8;
 {const pd=dist(cam.x,cam.y,P.x,P.y),pa=Math.atan2(P.y-cam.y,P.x-cam.x);const da=Math.abs(((pa-cam.a+Math.PI*3)%TAU)-Math.PI);cam.sees=pd<260&&da<0.35&&los(cam.x,cam.y,P.x,P.y);if(cam.sees)seen=Math.max(seen,0.5+vis);}
 dog.cd-=dt;dog.bark-=dt;dog.a=Math.atan2(P.y-dog.y,P.x-dog.x);
 if(dist(dog.x,dog.y,P.x,P.y)<110&&dog.cd<=0){dog.bark=1.2;dog.cd=3;noise(dog.x,dog.y,300,'dog');say('Dog barking!');meter+=0.15;}
 if(dog.bark>0)seen=Math.max(seen,0.2);
 if(alarmT<=0){if(seen>0)meter+=seen*dt*0.9;else meter-=dt*0.18;meter=cl(meter,0,1);if(meter>=1)trigger();}
 P.seen=seen>0;
 noises.forEach(n=>n.t+=dt);noises=noises.filter(n=>n.t<1);
 if(alarmT>0){alarmT-=dt;if(alarmT<=0)return end('busted');
  const p=police,tx=P.x,ty=P.y;const ta=Math.atan2(ty-p.y,tx-p.x);let da=((ta-p.a+Math.PI*3)%TAU)-Math.PI;p.a+=cl(da,-2.5*dt,2.5*dt);
  p.spd=Math.min(230,p.spd+dt*8);const ox=p.x,oy=p.y;move(p,Math.cos(p.a)*p.spd*dt,Math.sin(p.a)*p.spd*dt,18);if(Math.hypot(p.x-ox,p.y-oy)<1)p.a+=0.8*dt*5;
  if(dist(p.x,p.y,P.x,P.y)<28)return end('busted');}
 if(P.x>GETAWAY.x-10&&P.y>GETAWAY.y-20&&P.y<GETAWAY.y+GETAWAY.h+20){if(P.bag.length||alarmT>0)return end('escaped');else if(msgT<=0)say('Grab some loot first');}
}
// ---------- textures ----------
function tex(size,draw,rep){const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');draw(g,size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(rep)t.repeat.set(rep[0],rep[1]);return t;}
function speckle(g,s,n,cols,sz){for(let i=0;i<n;i++){g.fillStyle=cols[i%cols.length];const r=Math.random()*sz;g.fillRect(Math.random()*s,Math.random()*s,r,r);}}
const T={
 asphalt:tex(256,(g,s)=>{g.fillStyle='#3a3d44';g.fillRect(0,0,s,s);speckle(g,s,5000,['#2c2f35','#4a4d55','#33363c','#55585f'],3);g.strokeStyle='rgba(20,20,24,.6)';g.lineWidth=2;g.beginPath();g.moveTo(10,40);g.bezierCurveTo(80,60,120,20,200,90);g.stroke();}),
 grass:tex(256,(g,s)=>{g.fillStyle='#2e4228';g.fillRect(0,0,s,s);speckle(g,s,7000,['#263a22','#3a5232','#2a3d25','#445c38'],3);}),
 siding:tex(256,(g,s)=>{g.fillStyle='#8a8578';g.fillRect(0,0,s,s);for(let y=0;y<s;y+=32){g.fillStyle='rgba(0,0,0,.28)';g.fillRect(0,y+28,s,4);g.fillStyle='rgba(255,255,255,.07)';g.fillRect(0,y,s,3);}speckle(g,s,1500,['rgba(0,0,0,.1)','rgba(255,255,255,.05)'],3);}),
 plaster:tex(256,(g,s)=>{g.fillStyle='#b4a890';g.fillRect(0,0,s,s);speckle(g,s,2500,['rgba(0,0,0,.06)','rgba(255,255,255,.06)'],4);}),
 wood:tex(256,(g,s)=>{for(let x=0;x<s;x+=32){const v=90+Math.random()*30|0;g.fillStyle=`rgb(${v},${v*.62|0},${v*.38|0})`;g.fillRect(x,0,32,s);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x,0,2,s);g.fillRect(x,(Math.random()*s)|0,32,2);}speckle(g,s,1500,['rgba(0,0,0,.08)'],6);}),
 fence:tex(128,(g,s)=>{for(let x=0;x<s;x+=16){const v=70+Math.random()*25|0;g.fillStyle=`rgb(${v},${v*.75|0},${v*.55|0})`;g.fillRect(x,0,16,s);g.fillStyle='rgba(0,0,0,.45)';g.fillRect(x,0,2,s);}}),
 roof:tex(128,(g,s)=>{g.fillStyle='#2a2c30';g.fillRect(0,0,s,s);for(let y=0;y<s;y+=16){g.fillStyle='rgba(0,0,0,.5)';g.fillRect(0,y,s,2);for(let x=(y/16%2)*12;x<s;x+=24)g.fillRect(x,y,2,16);}speckle(g,s,600,['#3a3c42'],2);}),
 conc:tex(128,(g,s)=>{g.fillStyle='#6c6a66';g.fillRect(0,0,s,s);speckle(g,s,1500,['#5e5c58','#7a7874'],2);g.fillStyle='rgba(0,0,0,.4)';g.fillRect(0,0,s,2);g.fillRect(0,0,2,s);}),
 hedge:tex(128,(g,s)=>{g.fillStyle='#22361f';g.fillRect(0,0,s,s);speckle(g,s,3000,['#1a2a17','#2f4a2a','#3c5a33'],5);}),
};
// box with world-scaled UVs (1 tile per `ts` units)
function box(w,h,d,mat,ts=120){const g=new THREE.BoxGeometry(w,h,d);const uv=g.attributes.uv;const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*dims[f][0]/ts,uv.getY(i)*dims[f][1]/ts);}const m=new THREE.Mesh(g,mat);m.castShadow=m.receiveShadow=true;return m;}
const M={
 siding:new THREE.MeshLambertMaterial({map:T.siding}),plaster:new THREE.MeshLambertMaterial({map:T.plaster}),
 fence:new THREE.MeshLambertMaterial({map:T.fence}),hedge:new THREE.MeshLambertMaterial({map:T.hedge}),
 door:new THREE.MeshLambertMaterial({color:0x5a3220}),backdoor:new THREE.MeshLambertMaterial({color:0x48505a}),
 roof:new THREE.MeshLambertMaterial({map:T.roof}),edge:new THREE.MeshLambertMaterial({map:T.fence,color:0x777777}),
 dark:new THREE.MeshLambertMaterial({color:0x22242a}),
};
// ---------- static scene ----------
const WALLH={wall:140,door:132,fence:46,hedge:70,edge:70};
const hemi=new THREE.HemisphereLight(0x8fa6d6,0x5a5040,1.9);scene.add(hemi);
const moon=new THREE.DirectionalLight(0xaabbe0,1.1);moon.position.set(WW/2-500,900,WH/2+600);moon.target.position.set(WW/2,0,WH/2);
moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-1200,right:1200,top:900,bottom:-900,near:100,far:2600});moon.shadow.bias=-0.0008;moon.shadow.normalBias=1.5;
scene.add(moon,moon.target);
{const mc=document.createElement('canvas');mc.width=mc.height=128;const g=mc.getContext('2d');const gr=g.createRadialGradient(64,64,10,64,64,64);gr.addColorStop(0,'rgba(255,250,235,1)');gr.addColorStop(.32,'rgba(240,240,255,.9)');gr.addColorStop(.36,'rgba(170,190,255,.25)');gr.addColorStop(1,'rgba(120,140,220,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(mc),fog:false,depthWrite:false}));s.scale.set(420,420,1);s.position.set(WW/2-1800,1500,WH/2+1800);scene.add(s);}
function plane(x0,y0,w,h,mat,yy=0,ts){const g=new THREE.PlaneGeometry(w,h);if(ts){const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/ts,uv.getY(i)*h/ts);}const m=new THREE.Mesh(g,mat);m.rotation.x=-Math.PI/2;m.position.set(x0+w/2,yy,y0+h/2);m.receiveShadow=true;scene.add(m);return m;}
const ROADY=720,ROADH=120;
plane(-600,-600,WW+1200,WH+1200,new THREE.MeshLambertMaterial({map:T.grass}),0,90);
plane(-600,ROADY,WW+1200,ROADH,new THREE.MeshPhongMaterial({map:T.asphalt,shininess:60,specular:0x445066}),0.4,140);
plane(-600,ROADY-36,WW+1200,36,new THREE.MeshLambertMaterial({map:T.conc}),0.8,36);
plane(-600,ROADY+ROADH,WW+1200,36,new THREE.MeshLambertMaterial({map:T.conc}),0.8,36);
{const lm=new THREE.MeshBasicMaterial({color:0xb8a860});for(let x=-560;x<WW+600;x+=90)plane(x,ROADY+ROADH/2-2,46,4,lm,0.6);}
houses.forEach(h=>{plane(h.x+h.w/2-30,h.y+h.h,60,ROADY-36-(h.y+h.h),new THREE.MeshLambertMaterial({map:T.conc}),0.7,60);
 plane(h.x,h.y,h.w,h.h,new THREE.MeshLambertMaterial({map:T.wood}),0.9,80);
 const c=new THREE.Mesh(new THREE.PlaneGeometry(h.w,h.h),new THREE.MeshLambertMaterial({color:0x8a8272}));c.rotation.x=Math.PI/2;c.position.set(h.x+h.w/2,140,h.y+h.h/2);scene.add(c);
 // gable roof
 const rh=90,sl=Math.hypot(h.h/2+20,rh);for(const s of [-1,1]){const r=box(h.w+40,6,sl,M.roof,60);r.position.set(h.x+h.w/2,140+rh/2,h.y+h.h/2+s*(h.h/4+5));r.rotation.x=s*Math.atan2(rh,h.h/2+20);scene.add(r);}
 const gs=new THREE.Shape();gs.moveTo(-h.h/2,0);gs.lineTo(h.h/2,0);gs.lineTo(0,rh);gs.closePath();for(const s of [0,1]){const gm=new THREE.Mesh(new THREE.ShapeGeometry(gs),M.siding);gm.material=new THREE.MeshLambertMaterial({color:0x6e6a60,side:THREE.DoubleSide});gm.rotation.y=Math.PI/2;gm.position.set(h.x+s*h.w,140,h.y+h.h/2);scene.add(gm);}
});
// static walls
let staticDone=false;const doorMeshes=[];
function buildStatic(){
 for(const w of walls){if(w.k==='door'||w.k==='car')continue;const hh=WALLH[w.k];let m;
  if(w.k==='wall'){m=box(w.w,hh,w.h,[M.siding,M.siding,M.dark,M.dark,M.siding,M.siding]);
   // interior faces: plaster if inner wall
   const inner=houses.some(h=>w.x>h.x+20&&w.x<h.x+h.w-20&&w.w<20);if(inner)m.material=M.plaster;}
  else m=box(w.w,hh,w.h,M[w.k],w.k==='fence'?60:80);
  m.position.set(w.x+w.w/2,hh/2,w.y+w.h/2);scene.add(m);}
 // inner plaster lining on house walls (thin)
 houses.forEach(h=>{const t=2,y=70;const add=(x,z,w,d)=>{const m=box(w,138,d,M.plaster,100);m.castShadow=false;m.position.set(x,y,z);scene.add(m);};
  add(h.x+h.w/2,h.y+12+t/2,h.w-24,t);add(h.x+12+t/2,h.y+h.h/2,t,h.h-24);add(h.x+h.w-12-t/2,h.y+h.h/2,t,h.h-24);
  const dxp=h.x+h.w/2-25;add((h.x+12+dxp)/2,h.y+h.h-12-t/2,dxp-h.x-12,t);add((dxp+50+h.x+h.w-12)/2,h.y+h.h-12-t/2,h.x+h.w-12-dxp-50,t);
  // furniture silhouettes (no collision; decor)
  const sofa=box(110,34,40,new THREE.MeshLambertMaterial({color:0x4a3b46}));sofa.position.set(h.x+h.w*0.3,17,h.y+h.h-70);scene.add(sofa);
  const tbl=box(70,30,50,new THREE.MeshLambertMaterial({map:T.wood}),60);tbl.position.set(h.x+h.w*0.78,15,h.y+h.h*0.7);scene.add(tbl);
  const rug=plane(h.x+h.w*0.15,h.y+h.h*0.35,h.w*0.3,h.h*0.3,new THREE.MeshLambertMaterial({color:0x5a2a26}),1.2);
  // warm windows on street side (emissive glass)
  for(const fx of [0.2,0.8]){const wnd=new THREE.Mesh(new THREE.PlaneGeometry(56,40),new THREE.MeshBasicMaterial({color:0xffb55a}));wnd.material.color.multiplyScalar(fx>0.5?1:0.55);wnd.position.set(h.x+h.w*fx,82,h.y+h.h+0.6);scene.add(wnd);const wi=wnd.clone();wi.material=new THREE.MeshBasicMaterial({color:0x1a2a40});wi.rotation.y=Math.PI;wi.position.z=h.y+h.h-12.6;scene.add(wi);}
 });
}
// parked car
function carMesh(col){const g=new THREE.Group();const b=box(90,22,40,new THREE.MeshPhongMaterial({color:col,shininess:80}));b.position.y=18;g.add(b);const t=box(50,18,36,new THREE.MeshPhongMaterial({color:0x111418,shininess:120,specular:0x99aacc}));t.position.set(-4,36,0);g.add(t);
 for(const [x,z] of [[-28,-20],[28,-20],[-28,20],[28,20]]){const w=new THREE.Mesh(new THREE.CylinderGeometry(9,9,6,12),M.dark);w.rotation.x=Math.PI/2;w.position.set(x,9,z);g.add(w);}return g;}
{const c=carMesh(0x6a1e1e);c.position.set(1025,0,630);scene.add(c);}
const getaway=carMesh(0x2a3a4a);getaway.position.set(GETAWAY.x+30,0,GETAWAY.y+17);getaway.rotation.y=Math.PI;scene.add(getaway);
const hazards=[];for(const z of [-16,16])for(const x of [-46,46]){const l=new THREE.Mesh(new THREE.BoxGeometry(2,5,8),new THREE.MeshBasicMaterial({color:0xffa020}));l.position.set(x,22,z);getaway.add(l);hazards.push(l);}
const hazLight=new THREE.PointLight(0xffa030,0,220,1.4);hazLight.position.set(GETAWAY.x+30,40,GETAWAY.y+17);scene.add(hazLight);
// street lamps / light sources (match `lights` for detection)
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,220,160,.6)');gr.addColorStop(1,'rgba(255,200,120,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const poolMat=new THREE.MeshBasicMaterial({map:glowTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,color:0x7a5a30});
function addLamp(L){const inside=!!L.in;const h=inside?128:150;
 if(!inside){const pole=new THREE.Mesh(new THREE.CylinderGeometry(2.5,3.5,h,8),M.dark);pole.position.set(L.x,h/2,L.y-28);scene.add(pole);const arm=box(4,4,30,M.dark);arm.position.set(L.x,h,L.y-14);scene.add(arm);}
 const bulb=new THREE.Mesh(new THREE.SphereGeometry(5,10,8),new THREE.MeshBasicMaterial({color:0xffe2a8}));bulb.position.set(L.x,h-4,L.y);scene.add(bulb);
 const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,blending:THREE.AdditiveBlending,depthWrite:false,color:0xffc070}));sp.scale.set(60,60,1);sp.position.copy(bulb.position);scene.add(sp);
 const pl=new THREE.PointLight(0xffb868,inside?5.5:7,L.r*2.2,1.15);pl.position.set(L.x,h-10,L.y);scene.add(pl);
 const pool=plane(L.x-L.r,L.y-L.r,L.r*2,L.r*2,poolMat,inside?1.4:1.0);pool.receiveShadow=false;}
// ---------- dynamic actors ----------
const coneMat=()=>new THREE.MeshBasicMaterial({color:0xfff0c0,transparent:true,opacity:0.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
function person(coat){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(10,11,58,10),new THREE.MeshLambertMaterial({color:coat}));body.position.y=48;g.add(body);
 const legs=new THREE.Mesh(new THREE.CylinderGeometry(9,8,22,8),new THREE.MeshLambertMaterial({color:0x22252c}));legs.position.y=11;g.add(legs);
 const head=new THREE.Mesh(new THREE.SphereGeometry(8.5,12,10),new THREE.MeshLambertMaterial({color:0xc89a7a}));head.position.y=86;g.add(head);
 const cap=new THREE.Mesh(new THREE.CylinderGeometry(9,9,4,10),new THREE.MeshLambertMaterial({color:0x15181e}));cap.position.y=92;g.add(cap);
 const fl=new THREE.Mesh(new THREE.CylinderGeometry(2,2.5,10,6),M.dark);fl.rotation.z=Math.PI/2;fl.position.set(14,62,6);g.add(fl);
 const lens=new THREE.Mesh(new THREE.SphereGeometry(3,8,6),new THREE.MeshBasicMaterial({color:0xfff6d0}));lens.position.set(19,62,6);g.add(lens);
 const spot=new THREE.SpotLight(0xfff0c8,9,330,0.5,0.45,1.1);spot.position.set(19,62,6);const tgt=new THREE.Object3D();tgt.position.set(200,0,6);g.add(spot,tgt);spot.target=tgt;
 const cone=new THREE.Mesh(new THREE.ConeGeometry(130,260,20,1,true),coneMat());cone.rotation.z=Math.PI/2;cone.position.set(150,40,6);cone.rotation.y=0;g.add(cone);
 return {g,spot,cone,body};}
let dyn=null;
function resetVisuals(){
 if(!staticDone){buildStatic();lights.forEach(addLamp);staticDone=true;}
 if(dyn){scene.remove(dyn.root);}
 const root=new THREE.Group();scene.add(root);dyn={root,guards:[],loot:[],doors:[],rings:[]};
 guards.forEach((g,i)=>{const p=person(i===2?0x3a4a5e:0x5a4a3a);root.add(p.g);dyn.guards.push(p);});
 const dg=new THREE.Group();const db=box(36,16,14,new THREE.MeshLambertMaterial({color:0x4a3626}));db.position.y=18;dg.add(db);const dh=box(14,12,12,new THREE.MeshLambertMaterial({color:0x3e2c1e}));dh.position.set(22,28,0);dg.add(dh);for(const [x,z] of [[-12,-5],[12,-5],[-12,5],[12,5]]){const l=box(4,12,4,M.dark);l.position.set(x,6,z);dg.add(l);}root.add(dg);dyn.dog=dg;
 const cg=new THREE.Group();const cb=box(18,10,10,new THREE.MeshLambertMaterial({color:0xd8d8d8}));cg.add(cb);const led=new THREE.Mesh(new THREE.SphereGeometry(2,6,4),new THREE.MeshBasicMaterial({color:0xff2020}));led.position.set(10,3,0);cg.add(led);
 const cc=new THREE.Mesh(new THREE.ConeGeometry(90,260,16,1,true),coneMat());cc.material.color.set(0xff6050);cc.rotation.z=Math.PI/2;cc.position.set(130,-20,0);cg.add(cc);
 cg.position.set(cam.x,128,cam.y);root.add(cg);dyn.cam={g:cg,led,cone:cc};
 const lootCols={TV:0x222226,Jewellery:0xffd860,Laptop:0x9aa0aa,Console:0x1a1a1a,'Cash box':0x3a6a3a,Watch:0xe0c060,Guitar:0x9a4a20,Tablet:0x606870};
 loot.forEach(l=>{const s=6+l.wt*2.2;const g=new THREE.Group();const ped=box(30,26,30,new THREE.MeshLambertMaterial({map:T.wood}),40);ped.position.y=13;g.add(ped);
  const it=new THREE.Mesh(new THREE.BoxGeometry(s*1.4,s,s*0.7),new THREE.MeshLambertMaterial({color:lootCols[l.n]||0x888888,emissive:0x3a2a08}));it.position.y=26+s/2;g.add(it);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,blending:THREE.AdditiveBlending,depthWrite:false,color:0xb08820,opacity:0.9}));gl.scale.set(38,38,1);gl.position.y=30+s/2;g.add(gl);
  g.position.set(l.x,0,l.y);root.add(g);dyn.loot.push({g,it,gl});});
 doors.forEach(d=>{const piv=new THREE.Group();piv.position.set(d.x,0,d.y+d.h/2);const m=box(d.w,WALLH.door,6,d.front?M.door:M.backdoor);m.position.set(d.w/2,WALLH.door/2,0);piv.add(m);
  const kn=new THREE.Mesh(new THREE.SphereGeometry(2.5,6,4),new THREE.MeshBasicMaterial({color:0xd8b860}));kn.position.set(d.w-8,62,d.front?5:-5);piv.add(kn);root.add(piv);dyn.doors.push({piv,d});});
 const pc=carMesh(0x15161a);pc.visible=false;const bars=[];for(const [z,c] of [[-8,0xff2020],[8,0x2050ff]]){const b=new THREE.Mesh(new THREE.BoxGeometry(10,5,12),new THREE.MeshBasicMaterial({color:c}));b.position.set(-4,48,z);pc.add(b);bars.push(b);}
 const pl=new THREE.PointLight(0xff2020,0,320,1.1);pl.position.set(0,60,0);pc.add(pl);root.add(pc);dyn.police={g:pc,bars,pl};
 for(let i=0;i<8;i++){const r=new THREE.Mesh(new THREE.RingGeometry(0.92,1,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false}));r.rotation.x=-Math.PI/2;r.position.y=3;r.visible=false;root.add(r);dyn.rings.push(r);}
 renderer.shadowMap.needsUpdate=true;
}
// ---------- render ----------
const eye=new THREE.Vector3(),lk=new THREE.Vector3();
function render(t){
 if(!dyn)return;
 // actors
 guards.forEach((g,i)=>{const v=dyn.guards[i];v.g.position.set(g.x,0,g.y);v.g.rotation.y=-g.a;const sw=g.moving?Math.sin(t*9+i)*2:0;v.body.position.y=48+Math.abs(sw)*0.6;
  const c=g.sees?0xff6a50:(g.mode==='investigate'?0xffd070:0xfff0c8);v.spot.color.set(c);v.cone.material.color.set(c);v.cone.material.opacity=g.sees?0.13:0.07;});
 dyn.dog.position.set(dog.x,dog.bark>0?Math.abs(Math.sin(t*20))*4:0,dog.y);dyn.dog.rotation.y=-dog.a;
 dyn.cam.g.rotation.y=-cam.a;dyn.cam.led.visible=cam.sees||Math.sin(t*4)>0;dyn.cam.cone.material.opacity=cam.sees?0.16:0.06;
 loot.forEach((l,i)=>{const v=dyn.loot[i];v.it.visible=v.gl.visible=!l.taken;v.it.rotation.y=t*0.6;const tg=P.target===l;v.gl.scale.setScalar(tg?54:38+Math.sin(t*3+i)*4);});
 dyn.doors.forEach(o=>{const goal=o.d.open?(o.d.front?1:-1)*Math.PI/2*0.92:0;o.piv.rotation.y+=(goal-o.piv.rotation.y)*0.15;});
 const pv=dyn.police;pv.g.visible=!!police;if(police){pv.g.position.set(police.x,0,police.y);pv.g.rotation.y=-police.a;const ph=Math.floor(t*6)%2;pv.bars[0].visible=ph===0;pv.bars[1].visible=ph===1;pv.pl.color.set(ph?0x3060ff:0xff2020);pv.pl.intensity=14;}
 noises.forEach((n,i)=>{const r=dyn.rings[i];if(!r)return;r.visible=true;r.position.x=n.x;r.position.z=n.y;r.scale.setScalar(Math.max(1,n.r*n.t));r.material.opacity=(1-n.t)*0.5;r.material.color.set(n.src==='dog'?0xff9050:0xffffff);});
 for(let i=noises.length;i<dyn.rings.length;i++)dyn.rings[i].visible=false;
 const hz=(state==='play'&&(P.bag.length||alarmT>0))?(Math.sin(t*6)>0?1:0):0.15;hazards.forEach(h=>h.material.color.setScalar(1).multiply(new THREE.Color(hz?0xffa020:0x553310)));hazLight.intensity=hz>0.5?6:0;
 // camera
 if(state==='title'){const a=t*0.08;eye.set(950+Math.sin(a)*700,95,800);camera.position.copy(eye);lk.set(950+Math.sin(a+0.4)*500,60,380);camera.lookAt(lk);}
 else{const b=Math.sin(P.bob)*2.2;eye.set(P.x,80+b,P.y);camera.position.copy(eye);const cp=Math.cos(P.pitch);lk.set(P.x+Math.cos(P.a)*cp*100,80+b+Math.sin(P.pitch)*100,P.y+Math.sin(P.a)*cp*100);camera.lookAt(lk);}
 renderer.render(scene,camera);
}
// ---------- HUD ----------
const el={hud:$('hud'),gem:$('gemcore'),gl:$('gemlbl'),mf:$('meterfill'),haul:$('haul'),wt:$('wt'),debt:$('debt'),timer:$('timer'),msg:$('msg'),pr:$('prompt'),pt:$('ptxt'),pf:$('pfill'),sb:$('stickbase'),sk:$('stickknob'),use:$('buse'),spr:$('bsprint'),afx:$('alarmfx'),scr:$('screen')};
let hudCache={};function setT(k,e,v){if(hudCache[k]!==v){hudCache[k]=v;e.textContent=v;}}
function hud(t){
 if(state!=='play'){el.hud.style.display='none';el.afx.style.opacity=0;return;}el.hud.style.display='block';
 const v=P.vis||0.12,c=Math.round(40+v*215);el.gem.style.background=`rgb(${c},${Math.round(c*0.85)},${Math.round(c*0.45)})`;el.gem.style.boxShadow=`0 0 ${v*26}px rgba(255,210,120,${v})`;
 setT('gl',el.gl,P.seen?'SEEN':v>0.45?'LIT':'HIDDEN');el.gl.style.color=P.seen?'#ff7060':v>0.45?'#f0d68a':'#9fb4d8';
 el.mf.style.width=(meter*100)+'%';
 setT('h',el.haul,'$'+haul.toLocaleString());setT('w',el.wt,'bag '+weight()+' kg · '+P.bag.length+' items');setT('d',el.debt,'debt $'+save.debt.toLocaleString());
 setT('tm',el.timer,alarmT>0?'ALARM  '+Math.ceil(alarmT)+'s':'');el.afx.style.opacity=alarmT>0?0.55+0.3*Math.sin(t*8):0;
 setT('m',el.msg,msg);el.msg.style.opacity=msgT>0?Math.min(1,msgT*2):0;
 const tg=P.target;if(tg){el.pr.style.display='block';setT('p',el.pt,tg.k==='door'?'Hold USE · pick lock':'Hold USE · take '+tg.n+' $'+tg.v+' ('+tg.wt+'kg)');el.pf.style.width=(tg.prog/(tg.k==='door'?tg.need:0.45)*100)+'%';}else el.pr.style.display='none';
 el.use.classList.toggle('on',btn.use!==null||!!keys.KeyE);el.spr.classList.toggle('on',btn.sprint!==null||!!keys.ShiftLeft);
 el.use.style.display=el.spr.style.display=isTouch?'flex':'none';
 if(stick.id!==null){el.sb.style.display='block';el.sb.style.left=stick.ox+'px';el.sb.style.top=stick.oy+'px';el.sk.style.transform=`translate(${stick.x*32}px,${stick.y*32}px)`;}else el.sb.style.display='none';
}
function showScreen(){const s=el.scr;
 if(state==='play'){s.style.display='none';return;}s.style.display='flex';
 if(state==='title')s.innerHTML=`<h1>NIGHT SHIFT</h1><div class="s">night ${save.night} · debt $${save.debt.toLocaleString()}</div><div class="tap">tap to begin</div><div class="hint">${isTouch?'left: move · drag right: look · hold USE to pick & grab · RUN is loud':'WASD move · mouse look · hold E to pick & grab · Shift run (loud)'}<br>stay in the dark · reach your car</div>`;
 else{const r=result;s.innerHTML=`<h1 style="color:${r.kind==='escaped'?'#e6d3a8':'#e0564a'}">${r.kind==='escaped'?'CLEAN GETAWAY':'BUSTED'}</h1><div class="s">haul $${r.haul.toLocaleString()} · ${r.items} items</div><div class="s" style="color:${r.kept?'#9fc59a':'#d08a80'}">${r.kind==='escaped'?'paid toward debt $'+r.kept.toLocaleString():'haul seized by police'}</div><div class="s" style="color:#e0a59a">debt remaining $${save.debt.toLocaleString()}</div><div class="tap">tap for next night</div>`;}
}
// ---------- loop ----------
let last=performance.now(),FPS=60,fpsAcc=0,fpsN=0;state='title';build();resetVisuals();showScreen();
function frame(now){const dt=Math.min(0.05,(now-last)/1000);last=now;fpsAcc+=dt;fpsN++;if(fpsAcc>=1){FPS=fpsN/fpsAcc;fpsAcc=0;fpsN=0;}
 update(dt);render(now/1000);hud(now/1000);requestAnimationFrame(frame);}
requestAnimationFrame(frame);
window.NS={get fps(){return FPS},get s(){return{state,P,meter,alarmT,haul,result,police,doors,loot,guards}},trigger,start};
