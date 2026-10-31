//! A single Wildling: body, brain, drives, hormones, categories and words.
use crate::brain::Net;
use crate::consts::*;
use crate::genome::*;
use crate::lexicon::WordLex;
use crate::util::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Serialize, Deserialize, Default)]
pub struct Proto {
    pub v: [f32; FD],
    pub n: u32,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Heard {
    pub s: f32,
    pub c: f32,
    pub loud: f32,
    pub vec: Option<[f32; FD]>,
    pub wa: Option<f32>,
    pub words: String,
    pub from: u32,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct LastSaid {
    pub word: String,
    pub cat: i32,
    pub t: u32,
    pub tokens: String,
    pub sector: i32,
    pub vec: [f32; FD],
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Diary {
    pub t: u32,
    pub k: String,
    pub p: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Creature {
    pub id: u32,
    pub name: String,
    pub g: Genome,
    pub gen: u32,
    pub p1: u32,
    pub p2: u32,
    pub born: u32,
    pub adopted: bool,
    #[serde(default)]
    pub released: bool,
    #[serde(default)]
    pub owner: u64,
    pub diary: Vec<Diary>,
    pub x: f32,
    pub y: f32,
    pub dir: f32,
    pub v: f32,
    pub age: u32,
    pub children: u32,
    pub kills: u32,
    pub cool: u32,
    pub health: f32,
    pub energy: f32,
    pub rbar: f32,
    pub reward_avg: f32,
    pub ext_reward: f32,
    pub racc: f32,
    pub acq: Vec<[f32; 3]>,
    pub mem: [f32; 4],
    pub fear: f32,
    pub fm: Option<(f32, f32, u32)>,
    pub cold: f32,
    pub hot: f32,
    pub horm: [f32; 3],
    pub tired: f32,
    pub asleep: bool,
    pub last_dream: i32,
    pub dreams: u32,
    pub d: [f32; ND],
    pub goal: u8,
    pub wellbeing: f32,
    pub wb_avg: f32,
    pub protos: Vec<Option<Proto>>,
    pub lex: WordLex,
    pub dlex: WordLex,
    pub ord: [u32; 2],
    pub inherited: Vec<String>,
    pub cgen: Vec<(String, u32)>,
    pub cultural_use: bool,
    pub speak_cool: u32,
    pub spoken: u32,
    pub last_said: Option<LastSaid>,
    pub heard: Option<Heard>,
    pub buf: Vec<(String, u32)>,
    pub echoes: u32,
    pub understood: u32,
    pub heard_n: u32,
    pub first_word: bool,
    pub sp: i32,
    pub mutation: Vec<(String, String)>,
    pub visited: Vec<u64>,
    pub visit_q: Vec<u16>,
    pub bio_seen: u8,
    pub stress: [f32; 6],
    pub bm: [f32; 4],
    pub fw: Vec<f32>,
    pub err: f32,
    pub surprise: f32,
    pub ext_force: f32,
    pub gut: f32,
    pub urge: bool,
    pub gut_events: u32,
    pub gut_own: f32,
    pub push: [f32; 2],
    pub last_ate: i64,
    #[serde(skip)]
    pub last_atk: i64,
    #[serde(default)]
    pub cdep: u32,
    #[serde(default)]
    pub cret: u32,
    #[serde(default)]
    pub rx_t: u32,
    #[serde(default)]
    pub rc_t: u32,
    #[serde(skip)]
    pub last_birth: i64,
    #[serde(skip)]
    pub actv: u8,
    #[serde(default)]
    pub actc: [u32; 9],
    pub eaten: u32,
    pub reacts: u32,
    pub self_recog: bool,
    #[serde(default)]
    pub fe: f32,
    #[serde(skip)]
    pub mp: [f32; 2],
    #[serde(skip)]
    pub mo: [f32; 2],
    #[serde(skip)]
    pub mc: [f32; 6],
    pub mirror_t: u32,
    pub mirror_tested: bool,
    pub flew_once: bool,
    pub hurt: bool,
    pub was_boss: bool,
    pub dead: bool,
    pub cause: String,
    pub outv: [f32; NOUT],
    pub net_w: Vec<f32>,
    #[serde(skip)]
    pub net: Net,
    #[serde(skip)]
    pub pp: Vec<Part>,
    #[serde(skip)]
    pub pf: Vec<[f32; NABIL]>,
    #[serde(skip)]
    pub kinds: Vec<u8>,
    #[serde(skip)]
    pub ab: Abil,
    #[serde(skip)]
    pub land_loc: f32,
    #[serde(skip)]
    pub water_loc: f32,
    #[serde(skip)]
    pub fly: bool,
    #[serde(skip)]
    pub sense_r: f32,
    #[serde(skip)]
    pub morph: Morph,
    #[serde(skip)]
    pub inp: Vec<f32>,
    #[serde(skip)]
    pub f: [f32; FD],
    #[serde(skip)]
    pub sal: f32,
    #[serde(skip)]
    pub focus_f: i32,
    #[serde(skip)]
    pub fo: Option<(f32, f32)>,
    #[serde(skip)]
    pub cf: i32,
    #[serde(skip)]
    pub co: u32,
    #[serde(skip)]
    pub act: Vec<f32>,
    #[serde(skip)]
    pub act_n: usize,
    #[serde(skip)]
    pub xi: [f32; 5],
    #[serde(skip)]
    pub fv: [f32; NF],
}

pub const ACT_K: usize = 10;
pub const ACT_T: usize = 128;

pub struct Culture {
    pub protos: Vec<Option<Proto>>,
    pub lex: WordLex,
    pub dlex: WordLex,
    pub ord: [u32; 2],
    pub cgen: Vec<(String, u32)>,
}

impl Creature {
    pub fn new(id: u32, x: f32, y: f32, g: Genome, gen: u32, culture: Option<Culture>, parents: (u32, u32), rng: &mut Rng) -> Creature {
        let mut c = Creature {
            id,
            name: nice_name(rng),
            x,
            y,
            gen,
            p1: parents.0,
            p2: parents.1,
            dir: rng.f() * TAU,
            cool: 200,
            health: 100.0,
            tired: rng.range(0.0, 0.3),
            last_dream: -1,
            d: [0.5, 0.0, 0.0, 0.3, 0.0, 0.5, 0.3, 0.2],
            wellbeing: 0.7,
            wb_avg: 0.7,
            sp: -1,
            last_ate: -1_000_000_000,
            last_atk: -1_000_000_000,
            cdep: 0,
            cret: 0,
            rx_t: 0,
            rc_t: 0,
            last_birth: -1_000_000_000,
            actv: 0,
            actc: [0; 9],
            err: 0.6,
            fw: vec![0.0; 3 * NF],
            visited: vec![0u64; 16],
            ..Default::default()
        };
        c.bm = [g.motor[0] + rng.gauss() * 0.2, g.motor[1] + rng.gauss() * 0.2, g.motor[2] + rng.gauss() * 0.2, g.motor[3] + rng.gauss() * 0.2];
        c.acq = vec![[0.0; 3]; g.parts.len()];
        c.g = g;
        match culture {
            Some(cu) => {
                c.protos = cu.protos;
                c.lex = cu.lex;
                c.dlex = cu.dlex;
                c.ord = cu.ord;
                c.cgen = cu.cgen;
                for (w, a) in &c.lex.m {
                    if a.iter().cloned().fold(0.0, f32::max) > 0.2 {
                        c.inherited.push(w.clone());
                    }
                }
            }
            None => {
                c.protos = vec![None; MAX_PROTO];
                c.lex = WordLex::new(MAX_PROTO);
                c.dlex = WordLex::new(8);
                c.ord = if rng.chance(0.5) { [1, 0] } else { [0, 1] };
            }
        }
        c.rebuild();
        c.net_w.clear();
        c.energy = c.max_e() * 0.5;
        c
    }

    /// Recompute everything derived from the genome (after birth or after loading a save).
    pub fn rebuild(&mut self) {
        self.net = Net::compile(&self.g.nodes, &self.g.conns);
        if self.net_w.len() == self.net.w.len() {
            for (i, w) in self.net_w.iter().enumerate() {
                if w.is_finite() {
                    self.net.w[i] = clamp(*w, -6.0, 6.0);
                }
            }
        }
        if self.acq.len() != self.g.parts.len() {
            self.acq = vec![[0.0; 3]; self.g.parts.len()];
        }
        if self.fw.len() != 3 * NF {
            self.fw = vec![0.0; 3 * NF];
        }
        if self.visited.len() != 16 {
            self.visited = vec![0u64; 16];
        }
        if self.protos.len() != MAX_PROTO {
            self.protos.resize(MAX_PROTO, None);
        }
        self.inp = vec![0.0; NIN];
        self.act = vec![0.0; ACT_K * ACT_T];
        self.act_n = 0;
        self.cf = -1;
        self.co = 0;
        self.morph = morph_of(&self.g);
        self.update_body();
    }

    pub fn update_body(&mut self) {
        self.pp = self
            .g
            .parts
            .iter()
            .enumerate()
            .map(|(i, q)| {
                let a = self.acq.get(i).copied().unwrap_or([0.0; 3]);
                let mut p = q.clone();
                p.p[P_LEN] = clamp(p.p[P_LEN] + a[0], 0.0, 1.0);
                p.p[P_WID] = clamp(p.p[P_WID] + a[1], 0.0, 1.0);
                p.p[P_STIFF] = clamp(p.p[P_STIFF] + a[2], 0.0, 1.0);
                p
            })
            .collect();
        self.pf = self.pp.iter().map(|q| part_fns(q).ab).collect();
        self.kinds = self.pp.iter().map(|q| part_kind(q) as u8).collect();
        self.ab = abilities(&self.pp);
        let a = &self.ab.ab;
        self.land_loc = (0.15 + a[A_LEG] * 1.6).min(1.8);
        self.water_loc = (0.12 + a[A_FIN] * 1.6).min(1.8);
        self.fly = a[A_WING] > 0.3 + self.g.tr[T_SIZE] * 0.04;
        self.sense_r = self.g.tr[T_SENSE] + a[A_SENSE] * 80.0;
    }

    pub fn save_prepare(&mut self) {
        self.net_w = self.net.w.iter().map(|&w| r3(w)).collect();
    }

    #[inline]
    pub fn size(&self) -> f32 {
        self.g.tr[T_SIZE] * (0.5 + 0.5 * (self.age as f32 / (self.g.tr[T_LIFE] * self.g.tr[T_CHILD])).min(1.0))
    }
    #[inline]
    pub fn max_e(&self) -> f32 {
        let s = self.size();
        s * s * 2.5 * (1.0 + 0.8 * self.ab.ab[A_STORAGE])
    }
    #[inline]
    pub fn carn(&self) -> bool {
        self.g.tr[T_DIET] >= 0.5
    }
    #[inline]
    pub fn mature(&self) -> bool {
        self.age as f32 > self.g.tr[T_LIFE] * self.g.tr[T_CHILD]
    }
    #[inline]
    pub fn certainty(&self) -> f32 {
        1.0 / (1.0 + self.err * 6.0)
    }
    pub fn phase(&self) -> &'static str {
        if !self.mature() {
            "child"
        } else if self.age as f32 > self.g.tr[T_LIFE] {
            "elder"
        } else {
            "adult"
        }
    }
    #[inline]
    pub fn camo(&self) -> f32 {
        match self.g.tr[T_PAT] as i32 {
            2 => 0.22,
            1 => 0.12,
            _ => 0.0,
        }
    }
    pub fn order(&self) -> usize {
        if self.ord[0] >= self.ord[1] {
            0
        } else {
            1
        }
    }
    pub fn note(&mut self, t: u32, k: &str, p: &str) {
        self.diary.push(Diary { t, k: k.to_string(), p: p.to_string() });
        let cap = if self.adopted { 80 } else { 12 };
        if self.diary.len() > cap {
            let n = self.diary.len() - cap;
            self.diary.drain(0..n);
        }
    }
    pub fn categorize(&mut self, f: &[f32; FD], create: bool) -> i32 {
        let mut bk: i32 = -1;
        let mut bd = f32::INFINITY;
        let mut free: i32 = -1;
        for k in 0..MAX_PROTO {
            match &self.protos[k] {
                None => {
                    if free < 0 {
                        free = k as i32;
                    }
                }
                Some(p) => {
                    let d = vdist(f, &p.v);
                    if d < bd {
                        bd = d;
                        bk = k as i32;
                    }
                }
            }
        }
        if (bk < 0 || bd > self.g.tr[T_DISC]) && create {
            let mut slot = free;
            if slot < 0 {
                let mut mn = u32::MAX;
                for k in 0..MAX_PROTO {
                    if let Some(p) = &self.protos[k] {
                        if p.n < mn {
                            mn = p.n;
                            slot = k as i32;
                        }
                    }
                }
            }
            let s = slot as usize;
            self.protos[s] = Some(Proto { v: *f, n: 1 });
            self.lex.clear_slot(s);
            return slot;
        }
        if bk >= 0 {
            if let Some(p) = self.protos[bk as usize].as_mut() {
                for i in 0..FD {
                    p.v[i] += 0.04 * (f[i] - p.v[i]);
                }
                p.n += 1;
            }
        }
        bk
    }
    /// Sleep: merge near-identical categories and forget weak words.
    pub fn consolidate(&mut self) {
        for i in 0..MAX_PROTO {
            for j in (i + 1)..MAX_PROTO {
                let (a, q) = match (&self.protos[i], &self.protos[j]) {
                    (Some(a), Some(q)) => (*a, *q),
                    _ => continue,
                };
                if vdist(&a.v, &q.v) > 0.08 {
                    continue;
                }
                let n = a.n + q.n;
                let mut v = [0.0; FD];
                for k in 0..FD {
                    v[k] = (a.v[k] * a.n as f32 + q.v[k] * q.n as f32) / n.max(1) as f32;
                }
                self.protos[i] = Some(Proto { v, n });
                self.lex.merge_slot(i, j);
                self.protos[j] = None;
            }
        }
        self.lex.forget(0.06);
        self.dlex.forget(0.06);
        self.dreams += 1;
    }
    pub fn stress_info(&self) -> Stress {
        let s = &self.stress;
        let dm = (s[0] / 150.0).min(1.0);
        let mut list: [(&'static str, f32); 5] =
            [("injuries", dm), ("cold", s[1].min(1.0)), ("water", s[2].min(1.0)), ("hunger", s[3].min(1.0)), ("stress", self.horm[2] * 0.6)];
        list.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let total = list.iter().map(|q| q.1).sum::<f32>().min(1.0);
        let angle = match list[0].0 {
            "injuries" if dm > 0.05 => Some(s[5].atan2(s[4])),
            "water" => Some(PI / 2.0),
            "hunger" => Some(0.0),
            _ => None,
        };
        Stress { total, angle, cause: list[0].0 }
    }
    /// Half of what the body acquired during life goes into the genes of the child (epigenetics).
    pub fn inherit_genome(&self) -> Genome {
        let mut g = self.g.clone();
        for (i, q) in g.parts.iter_mut().enumerate() {
            if let Some(a) = self.acq.get(i) {
                q.p[P_LEN] = clamp(q.p[P_LEN] + 0.5 * a[0], 0.0, 1.0);
                q.p[P_WID] = clamp(q.p[P_WID] + 0.5 * a[1], 0.0, 1.0);
                q.p[P_STIFF] = clamp(q.p[P_STIFF] + 0.5 * a[2], 0.0, 1.0);
            }
        }
        g
    }
    pub fn record_activity(&mut self) {
        let mut tmp = Vec::with_capacity(ACT_K);
        self.net.sample(ACT_K, &mut tmp);
        let row = self.act_n % ACT_T;
        for k in 0..ACT_K {
            self.act[row * ACT_K + k] = *tmp.get(k).unwrap_or(&0.0);
        }
        self.act_n += 1;
    }
    pub fn visit(&mut self, cell: u16) -> bool {
        let (wi, bi) = ((cell / 64) as usize, cell % 64);
        if wi >= self.visited.len() {
            return false;
        }
        if self.visited[wi] & (1u64 << bi) != 0 {
            return false;
        }
        self.visited[wi] |= 1u64 << bi;
        self.visit_q.push(cell);
        if self.visit_q.len() > 300 {
            let old = self.visit_q.remove(0);
            let (w2, b2) = ((old / 64) as usize, old % 64);
            self.visited[w2] &= !(1u64 << b2);
        }
        true
    }
}
