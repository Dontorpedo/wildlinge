//! Genome: traits, body shape, body parts (built from 7 physical properties) and the evolving brain.
use crate::brain::*;
use crate::consts::*;
use crate::util::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Part {
    pub a: f32,
    pub sym: bool,
    pub p: [f32; NP],
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Genome {
    pub tr: [f32; NT],
    pub shape: [f32; NSHAPE],
    pub dw: [f32; ND],
    pub motor: [f32; 4],
    pub hue: f32,
    #[serde(default, deserialize_with = "de_look")]
    pub look: [[u8; 2]; NLOCI],
    #[serde(default)]
    pub look_set: bool,
    pub parts: Vec<Part>,
    pub nodes: Vec<NodeGene>,
    pub conns: Vec<ConnGene>,
    pub mutated: bool,
}

fn de_look<'de, D: serde::Deserializer<'de>>(d: D) -> Result<[[u8; 2]; NLOCI], D::Error> {
    let v: Vec<[u8; 2]> = serde::Deserialize::deserialize(d)?;
    let mut l = [[255u8; 2]; NLOCI];
    for (i, q) in v.into_iter().take(NLOCI).enumerate() {
        l[i] = q;
    }
    Ok(l)
}

fn pick_allele(n: u8, rng: &mut Rng) -> u8 {
    let f = rng.f();
    ((f * f * n as f32) as u8).min(n - 1)
}

/// Random cosmetic genes: common (dominant) alleles are likely, rare ones are recessive carriers.
pub fn random_look(rng: &mut Rng) -> [[u8; 2]; NLOCI] {
    let mut l = [[0u8; 2]; NLOCI];
    for (i, n) in LOCUS_N.iter().enumerate() {
        l[i] = [pick_allele(*n, rng), pick_allele(*n, rng)];
    }
    l
}

/// Visible look: the dominant (lower index) allele of each locus.
pub fn look_pheno(g: &Genome) -> [u8; NLOCI] {
    let mut p = [0u8; NLOCI];
    for i in 0..NLOCI {
        p[i] = g.look[i][0].min(g.look[i][1]);
    }
    p
}

/// Rarity 0..1 from both alleles (hidden recessive alleles count).
pub fn look_rarity(g: &Genome) -> f32 {
    let mut s = 0.0;
    for i in 0..NLOCI {
        let d = (LOCUS_N[i] - 1).max(1) as f32;
        s += (g.look[i][0] as f32 + g.look[i][1] as f32) / (2.0 * d);
    }
    s / NLOCI as f32
}

fn mutate_look(l: &[[u8; 2]; NLOCI], m: f32, rng: &mut Rng) -> [[u8; 2]; NLOCI] {
    let mut n = *l;
    for i in 0..NLOCI {
        for a in 0..2 {
            if rng.chance(0.01 + m * 0.08) {
                n[i][a] = pick_allele(LOCUS_N[i], rng);
            }
        }
    }
    n
}

/// Mendelian inheritance: one allele from each parent per locus.
fn mendel(a: &[[u8; 2]; NLOCI], b: &[[u8; 2]; NLOCI], rng: &mut Rng) -> [[u8; 2]; NLOCI] {
    let mut n = [[0u8; 2]; NLOCI];
    for i in 0..NLOCI {
        n[i] = [a[i][rng.below(2)], b[i][rng.below(2)]];
    }
    n
}

pub struct Fns {
    pub ab: [f32; NABIL],
    pub mass: f32,
}

pub fn part_fns(q: &Part) -> Fns {
    let p = &q.p;
    let (len, wid, st, mo, se, ho, co) = (p[P_LEN], p[P_WID], p[P_STIFF], p[P_MOT], p[P_SEN], p[P_HOL], p[P_COL]);
    let fwd = q.a.cos().max(0.0);
    Fns {
        ab: [
            mo * len * (1.0 - wid) * (0.5 + 0.5 * st),
            mo * wid.powf(1.5) * (1.0 - 0.6 * len) * (1.0 - 0.5 * st),
            mo * wid * len * (1.0 - 0.4 * st),
            st * len * (1.0 - wid) * fwd * (1.0 - 0.5 * mo),
            st * wid * (1.0 - 0.5 * len) * (1.0 - 0.5 * mo),
            se * len * (1.0 - 0.5 * st),
            ho * wid * (1.0 - mo),
            wid * (1.0 - st) * (1.0 - mo) * (1.0 - 0.5 * ho),
            co * wid * (1.0 - 0.5 * ho),
        ],
        mass: len * wid * (0.4 + st) + len * 0.15,
    }
}

pub fn part_kind(q: &Part) -> usize {
    let f = part_fns(q);
    let mut k = K_BUD;
    let mut m = 0.06;
    for (i, &v) in f.ab.iter().enumerate() {
        if v > m {
            m = v;
            k = i;
        }
    }
    k
}

#[derive(Clone, Default)]
pub struct Abil {
    pub ab: [f32; NABIL],
    pub mass: f32,
    pub mass_mot: f32,
}

pub fn abilities(parts: &[Part]) -> Abil {
    let mut a = Abil::default();
    for q in parts {
        let f = part_fns(q);
        let m = if q.sym { 2.0 } else { 1.0 };
        for i in 0..NABIL {
            a.ab[i] += f.ab[i] * m;
        }
        a.mass += f.mass * m;
        a.mass_mot += f.mass * q.p[P_MOT] * m;
    }
    a
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Morph {
    pub ab: [f32; NABIL],
    pub size: f32,
    pub hue: f32,
    pub diet: f32,
    pub pattern: i32,
    pub shape: [f32; NSHAPE],
}

pub fn morph_of(g: &Genome) -> Morph {
    Morph { ab: abilities(&g.parts).ab, size: g.tr[T_SIZE], hue: g.hue, diet: g.tr[T_DIET], pattern: g.tr[T_PAT] as i32, shape: g.shape }
}

pub fn morph_dist(a: &Morph, b: &Morph) -> f32 {
    let mut s = 0.0;
    for i in 0..NABIL {
        s += (a.ab[i] - b.ab[i]).abs().min(1.0) * 1.5;
    }
    let dh = (a.hue - b.hue).abs() % 360.0;
    s += dh.min(360.0 - dh) / 360.0;
    s += (a.size - b.size).abs() / 13.0 + (a.diet - b.diet).abs() * 2.0 + (a.pattern - b.pattern).abs() as f32 * 0.25;
    s += (a.shape[S_ELONG] - b.shape[S_ELONG]).abs() * 0.8
        + (a.shape[S_BOX] - b.shape[S_BOX]).abs() * 0.6
        + ((a.shape[S_SEG] as i32) - (b.shape[S_SEG] as i32)).abs() as f32 * 0.4
        + (a.shape[S_HEAD] - b.shape[S_HEAD]).abs() * 0.5
        + (a.shape[S_TAPER] - b.shape[S_TAPER]).abs() * 0.25;
    s / 6.0
}

fn base_part(a: f32, sym: bool, p: [f32; NP]) -> Part {
    Part { a, sym, p }
}

fn jitter(rng: &mut Rng, mut q: Part) -> Part {
    for v in q.p.iter_mut() {
        *v = clamp(*v + rng.gauss() * 0.06, 0.0, 1.0);
    }
    q
}

fn add_conn(g: &mut Genome, innov: &mut Innov, s: u32, t: u32, w: f32) {
    if let Some(c) = g.conns.iter_mut().find(|c| c.s == s && c.t == t) {
        c.w = w;
        c.en = true;
        return;
    }
    let inn = innov.conn(s, t);
    g.conns.push(ConnGene { s, t, w, en: true, inn });
}

pub fn random_genome(carn: bool, rng: &mut Rng, innov: &mut Innov) -> Genome {
    let mut parts = vec![
        base_part(PI / 2.0, true, [0.5, 0.2, 0.6, 0.85, 0.05, 0.0, 0.1]),
        base_part(PI, false, [0.4, 0.15, 0.3, 0.5, 0.05, 0.0, 0.1]),
    ];
    if carn {
        parts.push(base_part(0.35, true, [0.35, 0.1, 0.85, 0.1, 0.05, 0.0, 0.1]));
    }
    if rng.chance(0.3) {
        let a = rng.range(-PI, PI);
        let p = [rng.range(0.05, 0.2), rng.range(0.05, 0.2), rng.f(), rng.f(), rng.f(), rng.f(), rng.f()];
        parts.push(base_part(a, true, p));
    }
    let parts = parts.into_iter().map(|q| jitter(rng, q)).collect();
    let mut tr = [0.0; NT];
    tr[T_SIZE] = rng.range(5.0, 9.0) + if carn { 2.0 } else { 0.0 };
    tr[T_SPEED] = rng.range(1.0, 2.0) + if carn { 0.3 } else { 0.0 };
    tr[T_SENSE] = rng.range(70.0, 140.0) + if carn { 40.0 } else { 0.0 };
    tr[T_DIET] = if carn { rng.range(0.7, 1.0) } else { rng.range(0.0, 0.3) };
    tr[T_MUT] = 0.06;
    tr[T_LIFE] = rng.range(4000.0, 7000.0);
    tr[T_LEARN] = rng.range(0.03, 0.1);
    tr[T_CUR] = rng.range(0.3, 0.7);
    tr[T_CHILD] = rng.range(0.08, 0.16);
    tr[T_PAT] = rng.range(0.0, 1.0);
    tr[T_PLAST] = rng.range(0.004, 0.015);
    tr[T_DISC] = rng.range(0.2, 0.32);
    let shape = [rng.range(0.0, 0.35), rng.range(0.0, 0.3), if rng.chance(0.25) { 2.0 } else if rng.chance(0.1) { rng.range(3.0, 6.0) } else { 1.0 }, rng.range(0.3, 0.7), rng.range(-0.3, 0.3)];
    let dw = [
        rng.range(0.6, 1.0),
        rng.range(0.5, 1.0),
        rng.range(0.3, 0.7),
        rng.range(0.3, 0.8),
        rng.range(0.3, 0.7),
        rng.range(0.2, 0.6),
        rng.range(0.1, 0.5),
        rng.range(0.5, 0.9),
    ];
    let motor = [rng.range(-1.0, 1.0), rng.range(-1.0, 1.0), rng.range(-1.0, 1.0), rng.range(-1.0, 1.0)];
    let hue = if carn { (rng.range(-30.0, 50.0) + 360.0) % 360.0 } else { rng.range(0.0, 360.0) };
    let look = random_look(rng);
    let nh = 4 + rng.below(4) as u32;
    let nodes: Vec<NodeGene> = (0..nh).map(|k| NodeGene { id: HID0 + k, d: 0.5 }).collect();
    let mut g = Genome { tr, shape, dw, motor, hue, look, look_set: true, parts, nodes, conns: Vec::new(), mutated: false };
    let h = |k: u32| HID0 + k;
    let o = |k: u32| OUT0 + k;
    add_conn(&mut g, innov, 1, h(0), 2.5);
    add_conn(&mut g, innov, h(0), o(0), 2.0);
    add_conn(&mut g, innov, 3, h(1), 2.0);
    add_conn(&mut g, innov, h(1), o(1), 0.6);
    add_conn(&mut g, innov, 0, o(1), if carn { 0.9 } else { 0.5 });
    add_conn(&mut g, innov, 4, h(2), -1.5);
    add_conn(&mut g, innov, 9, h(2), 2.0);
    if !carn {
        add_conn(&mut g, innov, h(2), o(0), 1.5);
    } else {
        add_conn(&mut g, innov, 0, o(2), 1.5);
    }
    let w3 = rng.gauss() * 0.8 + 0.2;
    add_conn(&mut g, innov, 0, o(3), w3);
    let w4 = rng.gauss() * 0.8;
    add_conn(&mut g, innov, 0, o(4), w4);
    for k in 0..nh {
        for _ in 0..3 {
            let s = rng.below(NIN) as u32;
            let w = rng.gauss() * 0.6;
            add_conn(&mut g, innov, s, h(k), w);
        }
        let t = o(rng.below(NOUT) as u32);
        let w = rng.gauss() * 0.6;
        add_conn(&mut g, innov, h(k), t, w);
    }
    for oo in 0..NOUT as u32 {
        for _ in 0..2 {
            let s = if rng.chance(0.7) { rng.below(NIN) as u32 } else { h(rng.below(nh as usize) as u32) };
            let w = rng.gauss() * 0.6;
            add_conn(&mut g, innov, s, o(oo), w);
        }
    }
    g
}

pub struct Stress {
    pub total: f32,
    pub angle: Option<f32>,
    pub cause: &'static str,
}

pub type MutEvent = (&'static str, String);

fn mutate_parts(parts: &[Part], m: f32, st: &Stress, rng: &mut Rng, ev: &mut Vec<MutEvent>) -> Vec<Part> {
    let mut out: Vec<Part> = parts.to_vec();
    for q in out.iter_mut() {
        for v in q.p.iter_mut() {
            if rng.chance(m * 1.5) {
                *v = clamp(*v + rng.gauss() * 0.07, 0.0, 1.0);
            }
        }
        if rng.chance(m) {
            q.a = wrap_a(q.a + rng.gauss() * 0.15);
        }
        if rng.chance(m * 0.2) {
            q.sym = !q.sym;
        }
    }
    if out.len() < MAX_PARTS && !out.is_empty() && rng.chance(0.025) {
        let src = out[rng.below(out.len())].clone();
        let sign = if rng.chance(0.5) { -1.0 } else { 1.0 };
        let mut np = src.clone();
        np.a = wrap_a(src.a + sign * rng.range(0.35, 0.8));
        ev.push(("mut.dup", KIND_KEYS[part_kind(&src)].to_string()));
        out.push(np);
    }
    if out.len() < MAX_PARTS && rng.chance(0.008 + 0.07 * st.total) {
        let a = match st.angle {
            Some(a) => wrap_a(a + rng.gauss() * 0.3),
            None => rng.range(-PI, PI),
        };
        let p = [rng.range(0.05, 0.3), rng.range(0.05, 0.3), rng.f(), rng.f(), rng.f(), rng.f(), rng.f()];
        out.push(Part { a, sym: rng.chance(0.6), p });
        ev.push(("mut.bud", if st.total > 0.2 { st.cause.to_string() } else { String::new() }));
    }
    if out.len() > 1 && rng.chance(0.012) {
        let mut wi = 0;
        let mut ws = f32::INFINITY;
        for (i, q) in out.iter().enumerate() {
            let s: f32 = part_fns(q).ab.iter().sum();
            if s < ws {
                ws = s;
                wi = i;
            }
        }
        ev.push(("mut.loss", KIND_KEYS[part_kind(&out[wi])].to_string()));
        out.remove(wi);
    }
    out
}

fn mutate_brain(g: &mut Genome, m: f32, rng: &mut Rng, innov: &mut Innov, ev: &mut Vec<MutEvent>) {
    for c in g.conns.iter_mut() {
        if rng.chance(m * 2.0) {
            c.w = clamp(c.w + rng.gauss() * 0.4, -8.0, 8.0);
        }
        if rng.chance(0.01) {
            c.w = rng.gauss();
        }
    }
    let nh = g.nodes.len();
    let pick_src = |rng: &mut Rng, g: &Genome| -> u32 {
        if nh > 0 && rng.chance(0.35) {
            g.nodes[rng.below(nh)].id
        } else {
            rng.below(NIN) as u32
        }
    };
    if g.conns.len() < MAX_CONNS && rng.chance(0.12) {
        let s = pick_src(rng, g);
        let t = if nh > 0 && rng.chance(0.4) { g.nodes[rng.below(nh)].id } else { OUT0 + rng.below(NOUT) as u32 };
        if s != t {
            if let Some(c) = g.conns.iter_mut().find(|c| c.s == s && c.t == t) {
                c.en = true;
            } else {
                let inn = innov.conn(s, t);
                g.conns.push(ConnGene { s, t, w: rng.gauss() * 0.6, en: true, inn });
            }
        }
    }
    if nh < MAX_HIDDEN && g.conns.len() + 2 <= MAX_CONNS && rng.chance(0.07) {
        let en: Vec<usize> = (0..g.conns.len()).filter(|&i| g.conns[i].en).collect();
        if !en.is_empty() {
            let ci = en[rng.below(en.len())];
            let (s, t, w, inn) = (g.conns[ci].s, g.conns[ci].t, g.conns[ci].w, g.conns[ci].inn);
            let nid = innov.node_for_split(inn);
            if !g.nodes.iter().any(|n| n.id == nid) {
                g.conns[ci].en = false;
                let d = clamp((node_depth(s, &g.nodes) + node_depth(t, &g.nodes)) / 2.0, 0.02, 0.98);
                g.nodes.push(NodeGene { id: nid, d });
                let i1 = innov.conn(s, nid);
                let i2 = innov.conn(nid, t);
                g.conns.push(ConnGene { s, t: nid, w: 1.0, en: true, inn: i1 });
                g.conns.push(ConnGene { s: nid, t, w, en: true, inn: i2 });
                ev.push(("mut.neuron", String::new()));
            }
        }
    }
    if !g.conns.is_empty() && rng.chance(0.02) {
        let i = rng.below(g.conns.len());
        g.conns[i].en = !g.conns[i].en;
    }
}

pub fn mutate(g: &Genome, st: &Stress, off: bool, rng: &mut Rng, innov: &mut Innov) -> (Genome, Vec<MutEvent>) {
    let mut n = g.clone();
    let mut ev = Vec::new();
    if off {
        n.mutated = false;
        return (n, ev);
    }
    let m = g.tr[T_MUT];
    for (i, r) in RANGES.iter().enumerate() {
        if rng.chance(0.5) {
            n.tr[i] = clamp(n.tr[i] + rng.gauss() * m * (r.1 - r.0) * 0.15, r.0, r.1);
        }
    }
    for (i, r) in SHAPE_RANGES.iter().enumerate() {
        if rng.chance(0.4) {
            n.shape[i] = clamp(n.shape[i] + rng.gauss() * m * (r.1 - r.0) * 0.2, r.0, r.1);
        }
    }
    if rng.chance(0.02) {
        let i = rng.below(NSHAPE);
        let r = SHAPE_RANGES[i];
        n.shape[i] = rng.range(r.0, r.1);
        ev.push(("mut.shape", i.to_string()));
    }
    for v in n.motor.iter_mut() {
        if rng.chance(0.5) {
            *v = clamp(*v + rng.gauss() * m * 0.5, -1.5, 1.5);
        }
    }
    for v in n.dw.iter_mut() {
        if rng.chance(m * 3.0) {
            *v = clamp(*v + rng.gauss() * 0.08, 0.1, 1.0);
        }
    }
    n.hue = (n.hue + rng.gauss() * m * 40.0 + 360.0) % 360.0;
    n.look = mutate_look(&g.look, m, rng);
    n.parts = mutate_parts(&g.parts, m, st, rng, &mut ev);
    mutate_brain(&mut n, m, rng, innov, &mut ev);
    n.mutated = true;
    (n, ev)
}

/// NEAT crossover: structure from parent `a` (the bearing parent), matching genes mixed.
pub fn crossover(a: &Genome, b: &Genome, rng: &mut Rng) -> Genome {
    let mut n = a.clone();
    for i in 0..NT {
        if rng.chance(0.5) {
            n.tr[i] = b.tr[i];
        }
    }
    for i in 0..NSHAPE {
        if rng.chance(0.5) {
            n.shape[i] = b.shape[i];
        }
    }
    for i in 0..ND {
        if rng.chance(0.5) {
            n.dw[i] = b.dw[i];
        }
    }
    if rng.chance(0.5) {
        n.motor = b.motor;
    }
    if rng.chance(0.5) {
        n.hue = b.hue;
    }
    n.look = mendel(&a.look, &b.look, rng);
    if rng.chance(0.5) {
        n.parts = b.parts.clone();
    }
    let mut bi: Vec<&ConnGene> = b.conns.iter().collect();
    bi.sort_by_key(|c| c.inn);
    for c in n.conns.iter_mut() {
        if let Ok(j) = bi.binary_search_by_key(&c.inn, |x| x.inn) {
            let cb = bi[j];
            if rng.chance(0.5) {
                c.w = cb.w;
            }
            if !c.en || !cb.en {
                c.en = !rng.chance(0.75);
            }
        }
    }
    n
}

/// Repairs genomes from imported files: clamps every value and removes broken references.
pub fn sanitize(g: &mut Genome) {
    for (i, r) in RANGES.iter().enumerate() {
        g.tr[i] = if g.tr[i].is_finite() { clamp(g.tr[i], r.0, r.1) } else { r.0 };
    }
    for (i, r) in SHAPE_RANGES.iter().enumerate() {
        g.shape[i] = if g.shape[i].is_finite() { clamp(g.shape[i], r.0, r.1) } else { r.0 };
    }
    for v in g.dw.iter_mut() {
        *v = if v.is_finite() { clamp(*v, 0.1, 1.0) } else { 0.5 };
    }
    for v in g.motor.iter_mut() {
        *v = if v.is_finite() { clamp(*v, -1.5, 1.5) } else { 0.0 };
    }
    g.hue = if g.hue.is_finite() { g.hue.rem_euclid(360.0) } else { 100.0 };
    if !g.look_set {
        let mut r = Rng::new(g.hue.to_bits() as u64 ^ ((g.conns.len() as u64) << 32) ^ g.nodes.len() as u64);
        g.look = random_look(&mut r);
        g.look_set = true;
    }
    for i in 0..NLOCI {
        for a in 0..2 {
            if g.look[i][a] == 255 {
                let mut r = Rng::new(g.hue.to_bits() as u64 ^ ((i as u64 * 2 + a as u64 + 1) << 40) ^ ((g.conns.len() as u64) << 20));
                g.look[i][a] = pick_allele(LOCUS_N[i], &mut r);
            }
            g.look[i][a] = g.look[i][a].min(LOCUS_N[i] - 1);
        }
    }
    g.parts.truncate(MAX_PARTS);
    for q in g.parts.iter_mut() {
        q.a = if q.a.is_finite() { wrap_a(q.a) } else { 0.0 };
        for v in q.p.iter_mut() {
            *v = if v.is_finite() { clamp(*v, 0.0, 1.0) } else { 0.0 };
        }
    }
    if g.parts.is_empty() {
        g.parts.push(base_part(PI / 2.0, true, [0.5, 0.2, 0.6, 0.85, 0.05, 0.0, 0.1]));
    }
    g.nodes.retain(|n| n.id >= HID0 && n.d.is_finite());
    g.nodes.truncate(MAX_HIDDEN);
    let ids: Vec<u32> = g.nodes.iter().map(|n| n.id).collect();
    let ok = |id: u32| id < HID0 || ids.contains(&id);
    g.conns.retain(|c| ok(c.s) && ok(c.t) && c.t >= OUT0 && c.w.is_finite());
    g.conns.truncate(MAX_CONNS);
    for c in g.conns.iter_mut() {
        c.w = clamp(c.w, -8.0, 8.0);
    }
}
