const NC=500,NF=5000,NIN=69,NH=12,NHMAX=32,NOUT=9,CELL=50,WW=4000,WH=2400,GC=80,GR=48;
let rs=12345>>>0;
function rnd(){rs^=rs<<13;rs>>>=0;rs^=rs>>>17;rs^=rs<<5;rs>>>=0;return (rs&0xffffff)/16777216;}
const ftanh=x=>x>4.97?1:x<-4.97?-1:x*(27+x*x)/(27+9*x*x);
function fcos(x){while(x>3.14159265)x-=6.2831853;while(x<-3.14159265)x+=6.2831853;const x2=x*x;return 1-x2/2+x2*x2/24-x2*x2*x2/720;}
const fsin=x=>fcos(x-1.5707963);
let cr=[],fo=[],gF,gC;
function grid(items){const g=Array.from({length:GC*GR},()=>[]);for(const o of items){let c=(o.x/CELL)|0,r=(o.y/CELL)|0;if(c<0)c=0;if(c>=GC)c=GC-1;if(r<0)r=0;if(r>=GR)r=GR-1;g[r*GC+c].push(o);}return g;}
function init(){cr=[];fo=[];for(let i=0;i<NC;i++){const c={i,x:rnd()*WW,y:rnd()*WH,dir:rnd()*6.28,v:0,sense:150+rnd()*90,diet:rnd()<0.15?0.8:0.1,size:5+rnd()*6,w1:new Float32Array(NHMAX*NIN),w2:new Float32Array(NOUT*(NHMAX+1)),inp:new Float32Array(NIN),hid:new Float32Array(NHMAX),out:new Float32Array(NOUT)};
 for(let k=0;k<c.w1.length;k++)c.w1[k]=rnd()-0.5;for(let k=0;k<c.w2.length;k++)c.w2[k]=(rnd()-0.5)*1.2;cr.push(c);}
 for(let i=0;i<NF;i++)fo.push({x:rnd()*WW,y:rnd()*WH,e:20,meat:rnd()<0.05});}
function step(){gF=grid(fo);gC=grid(cr);let check=0;
 for(const me of cr){const x=me.x,y=me.y,sr=me.sense,pe=1-me.diet,mt=me.diet;
  let c0=((x-sr)/CELL)|0,c1=((x+sr)/CELL)|0,r0=((y-sr)/CELL)|0,r1=((y+sr)/CELL)|0;if(c0<0)c0=0;if(r0<0)r0=0;if(c1>GC-1)c1=GC-1;if(r1>GR-1)r1=GR-1;
  let bf=null,bs=0,bd=0,bo=null,od=1e9;
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){for(const f of gF[r*GC+c]){if(f.e<=0)continue;const dx=f.x-x,dy=f.y-y,d2=dx*dx+dy*dy;if(d2>sr*sr)continue;const d=Math.sqrt(d2),s=(f.meat?mt:pe)*(1-d/sr);if(s>bs){bs=s;bf=f;bd=d;}}
   for(const o of gC[r*GC+c]){if(o===me)continue;const dx=o.x-x,dy=o.y-y,d=Math.sqrt(dx*dx+dy*dy);if(d<od&&d<=sr){od=d;bo=o;}}}
  const inp=me.inp;inp.fill(0);inp[0]=1;
  if(bf){inp[1]=fsin(me.dir)*0.5+(bf.x-x)/sr;inp[2]=fcos(me.dir)*0.5+(bf.y-y)/sr;inp[3]=1-bd/sr;}
  if(bo){inp[4]=(bo.x-x)/sr;inp[5]=(bo.y-y)/sr;inp[6]=1-od/sr;inp[7]=bo.size/me.size-1;inp[8]=bo.diet;}
  for(let k=11;k<41;k++)inp[k]=((k*7+me.i)%5)*0.2;inp[61]=fsin(me.dir);inp[62]=fcos(me.dir);
  for(let h=0;h<NH;h++){let s=0;const k=h*NIN;for(let q=0;q<NIN;q++)s+=inp[q]*me.w1[k+q];me.hid[h]=ftanh(s);}
  for(let o=0;o<NOUT;o++){const k=o*(NHMAX+1);let s=me.w2[k+NHMAX];for(let h=0;h<NH;h++)s+=me.hid[h]*me.w2[k+h];me.out[o]=ftanh(s);}
  me.dir+=me.out[0]*0.2;me.v+=((me.out[1]+1)*0.75-me.v)*0.2;let nx=x+fcos(me.dir)*me.v,ny=y+fsin(me.dir)*me.v;
  if(nx<5)nx=5;if(nx>WW-5)nx=WW-5;if(ny<5)ny=5;if(ny>WH-5)ny=WH-5;me.x=nx;me.y=ny;check+=me.out[2];}
 return check;}
module.exports={init,step};
