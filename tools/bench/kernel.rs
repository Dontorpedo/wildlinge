const NC: usize = 500; const NF: usize = 5000; const NIN: usize = 69; const NH: usize = 12; const NHMAX: usize = 32; const NOUT: usize = 9;
const CELL: f32 = 50.0; const WW: f32 = 4000.0; const WH: f32 = 2400.0; const GC: usize = 80; const GR: usize = 48;
struct Rng(u32);
impl Rng { fn f(&mut self) -> f32 { let mut s = self.0; s ^= s << 13; s ^= s >> 17; s ^= s << 5; self.0 = s; (s & 0xffffff) as f32 / 16777216.0 } }
fn ftanh(x: f32) -> f32 { if x > 4.97 { 1.0 } else if x < -4.97 { -1.0 } else { let x2 = x * x; x * (27.0 + x2) / (27.0 + 9.0 * x2) } }
fn fcos(mut x: f32) -> f32 { while x > 3.14159265 { x -= 6.2831853 } while x < -3.14159265 { x += 6.2831853 } let x2 = x * x; 1.0 - x2 / 2.0 + x2 * x2 / 24.0 - x2 * x2 * x2 / 720.0 }
fn fsin(x: f32) -> f32 { fcos(x - 1.5707963) }
fn cell_of(x: f32, y: f32) -> usize { let c = ((x / CELL) as i32).clamp(0, GC as i32 - 1) as usize; let r = ((y / CELL) as i32).clamp(0, GR as i32 - 1) as usize; r * GC + c }
fn grid(xs: &[f32], ys: &[f32], st: &mut [usize], it: &mut [usize], tmp: &mut [usize]) {
  tmp.fill(0); for i in 0..xs.len() { tmp[cell_of(xs[i], ys[i])] += 1; }
  st[0] = 0; for i in 0..GC * GR { st[i + 1] = st[i] + tmp[i]; } for i in 0..GC * GR { tmp[i] = st[i]; }
  for i in 0..xs.len() { let c = cell_of(xs[i], ys[i]); it[tmp[c]] = i; tmp[c] += 1; }
}
struct W { cx: Vec<f32>, cy: Vec<f32>, cdir: Vec<f32>, cv: Vec<f32>, cs: Vec<f32>, cd: Vec<f32>, csz: Vec<f32>, fx: Vec<f32>, fy: Vec<f32>, fe: Vec<f32>, fm: Vec<bool>,
  w1: Vec<f32>, w2: Vec<f32>, sf: Vec<usize>, if_: Vec<usize>, sc: Vec<usize>, ic: Vec<usize>, tmp: Vec<usize> }
fn init() -> W { let mut r = Rng(12345); let mut w = W { cx: vec![0.;NC], cy: vec![0.;NC], cdir: vec![0.;NC], cv: vec![0.;NC], cs: vec![0.;NC], cd: vec![0.;NC], csz: vec![0.;NC], fx: vec![0.;NF], fy: vec![0.;NF], fe: vec![0.;NF], fm: vec![false;NF],
  w1: vec![0.; NC*NHMAX*NIN], w2: vec![0.; NC*NOUT*(NHMAX+1)], sf: vec![0; GC*GR+1], if_: vec![0; NF], sc: vec![0; GC*GR+1], ic: vec![0; NC], tmp: vec![0; GC*GR] };
  for i in 0..NC { w.cx[i] = r.f()*WW; w.cy[i] = r.f()*WH; w.cdir[i] = r.f()*6.28; w.cs[i] = 150.+r.f()*90.; w.cd[i] = if r.f() < 0.15 {0.8} else {0.1}; w.csz[i] = 5.+r.f()*6.;
    for k in 0..NHMAX*NIN { w.w1[i*NHMAX*NIN+k] = r.f()-0.5; } for k in 0..NOUT*(NHMAX+1) { w.w2[i*NOUT*(NHMAX+1)+k] = (r.f()-0.5)*1.2; } }
  for i in 0..NF { w.fx[i] = r.f()*WW; w.fy[i] = r.f()*WH; w.fe[i] = 20.; w.fm[i] = r.f() < 0.05; } w }
fn step(w: &mut W) -> f32 {
  grid(&w.fx, &w.fy, &mut w.sf, &mut w.if_, &mut w.tmp); grid(&w.cx, &w.cy, &mut w.sc, &mut w.ic, &mut w.tmp);
  let mut check = 0.; let mut inp = [0f32; NIN]; let mut hid = [0f32; NHMAX]; let mut out = [0f32; NOUT]; let mut nz = [0usize; NIN];
  for i in 0..NC { let (x, y, sr, pe, me) = (w.cx[i], w.cy[i], w.cs[i], 1. - w.cd[i], w.cd[i]);
    let c0 = (((x-sr)/CELL) as i32).max(0) as usize; let c1 = (((x+sr)/CELL) as i32).min(GC as i32-1) as usize; let r0 = (((y-sr)/CELL) as i32).max(0) as usize; let r1 = (((y+sr)/CELL) as i32).min(GR as i32-1) as usize;
    let (mut bf, mut bs, mut bd) = (usize::MAX, 0f32, 0f32);
    for r in r0..=r1 { for c in c0..=c1 { let cell = r*GC+c; for k in w.sf[cell]..w.sf[cell+1] { let f = w.if_[k]; if w.fe[f] <= 0. { continue; }
      let (dx, dy) = (w.fx[f]-x, w.fy[f]-y); let d2 = dx*dx+dy*dy; if d2 > sr*sr { continue; } let d = d2.sqrt(); let s = (if w.fm[f] {me} else {pe})*(1.-d/sr); if s > bs { bs = s; bf = f; bd = d; } } } }
    let (mut bo, mut od) = (usize::MAX, 1e9f32);
    for r in r0..=r1 { for c in c0..=c1 { let cell = r*GC+c; for k in w.sc[cell]..w.sc[cell+1] { let o = w.ic[k]; if o == i { continue; }
      let (dx, dy) = (w.cx[o]-x, w.cy[o]-y); let d = (dx*dx+dy*dy).sqrt(); if d < od && d <= sr { od = d; bo = o; } } } }
    inp.fill(0.); inp[0] = 1.;
    if bf != usize::MAX { let a = w.cdir[i]; inp[1] = fsin(a)*0.5+(w.fx[bf]-x)/sr; inp[2] = fcos(a)*0.5+(w.fy[bf]-y)/sr; inp[3] = 1.-bd/sr; }
    if bo != usize::MAX { inp[4] = (w.cx[bo]-x)/sr; inp[5] = (w.cy[bo]-y)/sr; inp[6] = 1.-od/sr; inp[7] = w.csz[bo]/w.csz[i]-1.; inp[8] = w.cd[bo]; }
    for k in 11..41 { inp[k] = (((k*7+i)%5) as f32)*0.2; } inp[61] = fsin(w.cdir[i]); inp[62] = fcos(w.cdir[i]);
    let mut nn = 0; for k in 0..NIN { if inp[k] != 0. { nz[nn] = k; nn += 1; } }
    let wb = i*NHMAX*NIN; for h in 0..NH { let wr = &w.w1[wb+h*NIN..wb+h*NIN+NIN]; let mut s = 0.; for j in 0..nn { let q = nz[j]; s += inp[q]*wr[q]; } hid[h] = ftanh(s); }
    let ob = i*NOUT*(NHMAX+1); for o in 0..NOUT { let wr = &w.w2[ob+o*(NHMAX+1)..ob+(o+1)*(NHMAX+1)]; let mut s = wr[NHMAX]; for h in 0..NH { s += hid[h]*wr[h]; } out[o] = ftanh(s); }
    w.cdir[i] += out[0]*0.2; w.cv[i] += ((out[1]+1.)*0.75-w.cv[i])*0.2;
    w.cx[i] = (x+fcos(w.cdir[i])*w.cv[i]).clamp(5., WW-5.); w.cy[i] = (y+fsin(w.cdir[i])*w.cv[i]).clamp(5., WH-5.); check += out[2]; }
  check }
fn main() { let mut w = init(); for _ in 0..300 { step(&mut w); } let n = 3000; let t = std::time::Instant::now(); let mut c = 0.; for _ in 0..n { c += step(&mut w); }
  let ms = t.elapsed().as_secs_f64()*1000./n as f64; println!("{:<28} {:.3} ms/step {:.2} us/creature (check {:.1})", "Rust nativ (Server)", ms, ms/500.*1000., c); }
