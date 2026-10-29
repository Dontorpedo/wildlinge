//! Evolving brains in the style of NEAT (Stanley and Miikkulainen 2002):
//! the network structure itself (neurons and connections) is inherited and mutates.
//! Within a lifetime, connections into motor outputs learn by reward-modulated eligibility traces.
use crate::consts::*;
use crate::util::{clamp, ftanh};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const OUT0: u32 = NIN as u32;
pub const HID0: u32 = (NIN + NOUT) as u32;
pub const INIT_HIDDEN: u32 = 8;

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct NodeGene {
    pub id: u32,
    pub d: f32,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct ConnGene {
    pub s: u32,
    pub t: u32,
    pub w: f32,
    pub en: bool,
    pub inn: u32,
}

/// Global innovation registry: the same structural mutation gets the same number in every genome,
/// so genomes with different structure can still be crossed over.
#[derive(Clone, Serialize, Deserialize)]
pub struct Innov {
    pub next_inn: u32,
    pub next_node: u32,
    pub pairs: BTreeMap<u64, u32>,
    pub split: BTreeMap<u32, u32>,
}

impl Default for Innov {
    fn default() -> Self {
        Innov { next_inn: 1, next_node: HID0 + INIT_HIDDEN, pairs: BTreeMap::new(), split: BTreeMap::new() }
    }
}

impl Innov {
    pub fn conn(&mut self, s: u32, t: u32) -> u32 {
        let k = ((s as u64) << 32) | t as u64;
        if let Some(&i) = self.pairs.get(&k) {
            return i;
        }
        if self.pairs.len() > 60000 {
            self.pairs.clear();
        }
        let i = self.next_inn;
        self.next_inn += 1;
        self.pairs.insert(k, i);
        i
    }
    pub fn node_for_split(&mut self, inn: u32) -> u32 {
        if let Some(&n) = self.split.get(&inn) {
            return n;
        }
        if self.split.len() > 30000 {
            self.split.clear();
        }
        let n = self.next_node;
        self.next_node += 1;
        self.split.insert(inn, n);
        n
    }
}

pub fn node_depth(id: u32, nodes: &[NodeGene]) -> f32 {
    if id < OUT0 {
        0.0
    } else if id < HID0 {
        1.0
    } else {
        nodes.iter().find(|n| n.id == id).map(|n| n.d).unwrap_or(0.5)
    }
}

/// Compiled network for fast evaluation.
#[derive(Clone, Default)]
pub struct Net {
    pub n: usize,
    pub hidden: usize,
    pub order: Vec<u16>,
    pub start: Vec<u32>,
    pub src: Vec<u16>,
    pub fwd: Vec<bool>,
    pub w: Vec<f32>,
    pub w0: Vec<f32>,
    pub gene: Vec<u32>,
    pub motor: Vec<u32>,
    pub motor_o: Vec<u8>,
    pub vals: Vec<f32>,
    pub prev: Vec<f32>,
    pub elig: Vec<f32>,
}

impl Net {
    pub fn compile(nodes: &[NodeGene], conns: &[ConnGene]) -> Net {
        let base = NIN + NOUT;
        let mut idx: BTreeMap<u32, usize> = BTreeMap::new();
        for (k, nd) in nodes.iter().enumerate() {
            idx.insert(nd.id, base + k);
        }
        let n = base + nodes.len();
        let mut depth = vec![0.0f32; n];
        for d in depth.iter_mut().take(base).skip(NIN) {
            *d = 1.0;
        }
        for (k, nd) in nodes.iter().enumerate() {
            depth[base + k] = clamp(nd.d, 0.01, 0.99);
        }
        let node_index = |id: u32| -> Option<usize> {
            if id < OUT0 {
                Some(id as usize)
            } else if id < HID0 {
                Some(id as usize)
            } else {
                idx.get(&id).copied()
            }
        };
        let mut order: Vec<usize> = (NIN..n).collect();
        order.sort_by(|&a, &b| depth[a].partial_cmp(&depth[b]).unwrap_or(std::cmp::Ordering::Equal).then(a.cmp(&b)));
        let mut incoming: Vec<Vec<(usize, f32, u32)>> = vec![Vec::new(); n];
        for (gi, c) in conns.iter().enumerate() {
            if !c.en {
                continue;
            }
            if let (Some(s), Some(t)) = (node_index(c.s), node_index(c.t)) {
                if t >= NIN {
                    incoming[t].push((s, c.w, gi as u32));
                }
            }
        }
        let mut net = Net { n, hidden: nodes.len(), ..Default::default() };
        net.start.push(0);
        for &node in &order {
            for &(s, w, gi) in &incoming[node] {
                let ci = net.src.len() as u32;
                net.src.push(s as u16);
                net.fwd.push(depth[s] < depth[node]);
                net.w.push(w);
                net.w0.push(w);
                net.gene.push(gi);
                let o = node as i32 - NIN as i32;
                if (0..5).contains(&o) {
                    net.motor.push(ci);
                    net.motor_o.push(o as u8);
                }
            }
            net.order.push(node as u16);
            net.start.push(net.src.len() as u32);
        }
        net.vals = vec![0.0; n];
        net.prev = vec![0.0; n];
        net.elig = vec![0.0; net.w.len()];
        net
    }

    #[inline]
    pub fn run(&mut self, inp: &[f32]) {
        std::mem::swap(&mut self.vals, &mut self.prev);
        self.vals[..NIN].copy_from_slice(&inp[..NIN]);
        for oi in 0..self.order.len() {
            let node = self.order[oi] as usize;
            let (a, b) = (self.start[oi] as usize, self.start[oi + 1] as usize);
            let mut s = 0.0;
            for c in a..b {
                let sidx = self.src[c] as usize;
                let v = if self.fwd[c] { self.vals[sidx] } else { self.prev[sidx] };
                s += self.w[c] * v;
            }
            self.vals[node] = ftanh(s);
        }
    }
    #[inline]
    pub fn out(&self, o: usize) -> f32 {
        self.vals[NIN + o]
    }
    pub fn set_out(&mut self, o: usize, v: f32) {
        self.vals[NIN + o] = v;
    }
    pub fn trace(&mut self, xi: &[f32; 5]) {
        for (m, &c) in self.motor.iter().enumerate() {
            let c = c as usize;
            let sidx = self.src[c] as usize;
            let v = if self.fwd[c] { self.vals[sidx] } else { self.prev[sidx] };
            self.elig[c] = 0.92 * self.elig[c] + xi[self.motor_o[m] as usize] * v;
        }
    }
    pub fn learn(&mut self, lr_delta: f32) {
        for &c in &self.motor {
            let c = c as usize;
            self.w[c] = clamp(self.w[c] + lr_delta * self.elig[c], -6.0, 6.0);
        }
    }
    pub fn learned(&self) -> f32 {
        self.w.iter().zip(self.w0.iter()).map(|(a, b)| (a - b).abs()).sum()
    }
    /// Activity of up to `k` neurons (hidden first, then outputs) for integration measures.
    pub fn sample(&self, k: usize, out: &mut Vec<f32>) {
        out.clear();
        let base = NIN + NOUT;
        for i in 0..self.hidden.min(k) {
            out.push(self.vals[base + i]);
        }
        let mut o = 0;
        while out.len() < k && o < NOUT {
            out.push(self.vals[NIN + o]);
            o += 1;
        }
    }
}
