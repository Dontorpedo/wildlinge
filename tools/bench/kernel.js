const NC=500,NF=5000,NIN=69,NH=12,NHMAX=32,NOUT=9,CELL=50,WW=4000,WH=2400,GC=80,GR=48;
let rs=12345>>>0;
function rnd(){rs^=rs<<13;rs>>>=0;rs^=rs>>>17;rs^=rs<<5;rs>>>=0;return (rs&0xffffff)/16777216;}
const ftanh=x=>x>4.97?1:x<-4.97?-1:x*(27+x*x)/(27+9*x*x);
function fcos(x){while(x>3.14159265)x-=6.2831853;while(x<-3.14159265)x+=6.2831853;const x2=x*x;return 1-x2/2+x2*x2/24-x2*x2*x2/720;}
const fsin=x=>fcos(x-1.5707963);
const F32=n=>new Float32Array(n);
const cx=F32(NC),cy=F32(NC),cdir=F32(NC),cv=F32(NC),cs=F32(NC),cd=F32(NC),csz=F32(NC),fx=F32(NF),fy=F32(NF),fe=F32(NF),fm=new Uint8Array(NF);
const W1=F32(NC*NHMAX*NIN),W2=F32(NC*NOUT*(NHMAX+1)),inp=F32(NIN),hid=F32(NHMAX),out=F32(NOUT),nz=new Int32Array(NIN);
const sF=new Int32Array(GC*GR+1),iF=new Int32Array(NF),sC=new Int32Array(GC*GR+1),iC=new Int32Array(NC),tmp=new Int32Array(GC*GR);
const cellOf=(x,y)=>{let c=(x/CELL)|0,r=(y/CELL)|0;if(c<0)c=0;if(c>=GC)c=GC-1;if(r<0)r=0;if(r>=GR)r=GR-1;return r*GC+c;};
function grid(n,xs,ys,st,it){tmp.fill(0);for(let i=0;i<n;i++)tmp[cellOf(xs[i],ys[i])]++;st[0]=0;for(let i=0;i<GC*GR;i++)st[i+1]=st[i]+tmp[i];for(let i=0;i<GC*GR;i++)tmp[i]=st[i];for(let i=0;i<n;i++)it[tmp[cellOf(xs[i],ys[i])]++]=i;}
function init(){for(let i=0;i<NC;i++){cx[i]=rnd()*WW;cy[i]=rnd()*WH;cdir[i]=rnd()*6.28;cv[i]=0;cs[i]=150+rnd()*90;cd[i]=rnd()<0.15?0.8:0.1;csz[i]=5+rnd()*6;
 for(let k=0;k<NHMAX*NIN;k++)W1[i*NHMAX*NIN+k]=rnd()-0.5;for(let k=0;k<NOUT*(NHMAX+1);k++)W2[i*NOUT*(NHMAX+1)+k]=(rnd()-0.5)*1.2;}
 for(let i=0;i<NF;i++){fx[i]=rnd()*WW;fy[i]=rnd()*WH;fe[i]=20;fm[i]=rnd()<0.05?1:0;}}
function step(){grid(NF,fx,fy,sF,iF);grid(NC,cx,cy,sC,iC);let check=0;
 for(let i=0;i<NC;i++){const x=cx[i],y=cy[i],sr=cs[i],pe=1-cd[i],me=cd[i];
  let c0=((x-sr)/CELL)|0,c1=((x+sr)/CELL)|0,r0=((y-sr)/CELL)|0,r1=((y+sr)/CELL)|0;if(c0<0)c0=0;if(r0<0)r0=0;if(c1>GC-1)c1=GC-1;if(r1>GR-1)r1=GR-1;
  let bf=-1,bs=0,bd=0;
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){const cell=r*GC+c;for(let k=sF[cell];k<sF[cell+1];k++){const f=iF[k];if(fe[f]<=0)continue;const dx=fx[f]-x,dy=fy[f]-y,d2=dx*dx+dy*dy;if(d2>sr*sr)continue;const d=Math.sqrt(d2),s=(fm[f]?me:pe)*(1-d/sr);if(s>bs){bs=s;bf=f;bd=d;}}}
  let bo=-1,od=1e9;
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){const cell=r*GC+c;for(let k=sC[cell];k<sC[cell+1];k++){const o=iC[k];if(o===i)continue;const dx=cx[o]-x,dy=cy[o]-y,d=Math.sqrt(dx*dx+dy*dy);if(d<od&&d<=sr){od=d;bo=o;}}}
  inp.fill(0);inp[0]=1;
  if(bf>=0){const a=cdir[i];inp[1]=fsin(a)*0.5+(fx[bf]-x)/sr;inp[2]=fcos(a)*0.5+(fy[bf]-y)/sr;inp[3]=1-bd/sr;}
  if(bo>=0){inp[4]=(cx[bo]-x)/sr;inp[5]=(cy[bo]-y)/sr;inp[6]=1-od/sr;inp[7]=csz[bo]/csz[i]-1;inp[8]=cd[bo];}
  for(let k=11;k<41;k++)inp[k]=((k*7+i)%5)*0.2;inp[61]=fsin(cdir[i]);inp[62]=fcos(cdir[i]);
  let nn=0;for(let k=0;k<NIN;k++)if(inp[k]!==0)nz[nn++]=k;
  const wb=i*NHMAX*NIN;for(let h=0;h<NH;h++){let s=0;const wr=wb+h*NIN;for(let j=0;j<nn;j++){const q=nz[j];s+=inp[q]*W1[wr+q];}hid[h]=ftanh(s);}
  const ob=i*NOUT*(NHMAX+1);for(let o=0;o<NOUT;o++){const wr=ob+o*(NHMAX+1);let s=W2[wr+NHMAX];for(let h=0;h<NH;h++)s+=hid[h]*W2[wr+h];out[o]=ftanh(s);}
  cdir[i]+=out[0]*0.2;cv[i]+=((out[1]+1)*0.75-cv[i])*0.2;let nx=x+fcos(cdir[i])*cv[i],ny=y+fsin(cdir[i])*cv[i];
  if(nx<5)nx=5;if(nx>WW-5)nx=WW-5;if(ny<5)ny=5;if(ny>WH-5)ny=WH-5;cx[i]=nx;cy[i]=ny;check+=out[2];}
 return check;}
module.exports={init,step};
