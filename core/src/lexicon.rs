//! Word lexicon: associations between words and meaning slots (categories or directions).
use crate::consts::MAX_WORDS;
use crate::util::{clean_word, random_word, Rng};
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct WordLex {
    pub k: usize,
    pub m: Vec<(String, Vec<f32>)>,
}

impl WordLex {
    pub fn new(k: usize) -> Self {
        WordLex { k, m: Vec::new() }
    }
    pub fn sanitize(&mut self, k: usize) {
        self.k = k;
        let mut out: Vec<(String, Vec<f32>)> = Vec::new();
        for (w, a) in self.m.drain(..) {
            let w = clean_word(&w);
            if w.is_empty() || out.iter().any(|(x, _)| *x == w) {
                continue;
            }
            let mut v: Vec<f32> = a.into_iter().map(|x| if x.is_finite() { x.clamp(0.0, 1.0) } else { 0.0 }).collect();
            v.resize(k, 0.0);
            out.push((w, v));
        }
        out.truncate(MAX_WORDS);
        self.m = out;
    }
    pub fn clone_scaled(&self, f: f32) -> WordLex {
        WordLex { k: self.k, m: self.m.iter().map(|(w, a)| (w.clone(), a.iter().map(|v| v * f).collect())).collect() }
    }
    pub fn find(&self, w: &str) -> Option<usize> {
        self.m.iter().position(|(x, _)| x == w)
    }
    pub fn best(&self, k: usize) -> Option<&str> {
        let mut bs = 0.15;
        let mut bw = None;
        for (w, a) in &self.m {
            if a[k] > bs {
                bs = a[k];
                bw = Some(w.as_str());
            }
        }
        bw
    }
    pub fn top(&self, w: &str) -> (i32, f32) {
        match self.find(w) {
            None => (-1, 0.0),
            Some(i) => {
                let a = &self.m[i].1;
                let mut k = -1;
                let mut s = 0.0;
                for (j, &v) in a.iter().enumerate() {
                    if v > s {
                        s = v;
                        k = j as i32;
                    }
                }
                (k, s)
            }
        }
    }
    pub fn produce(&mut self, k: usize, rng: &mut Rng) -> String {
        if let Some(w) = self.best(k).map(|s| s.to_string()) {
            let i = self.find(&w).unwrap();
            self.m[i].1[k] = (self.m[i].1[k] + 0.03).min(1.0);
            return w;
        }
        let mut w = random_word(rng);
        let mut guard = 0;
        while self.find(&w).is_some() && guard < 20 {
            w = random_word(rng);
            guard += 1;
        }
        let mut a = vec![0.0; self.k];
        a[k] = 0.5;
        self.m.push((w.clone(), a));
        self.prune(&w);
        w
    }
    pub fn reinforce(&mut self, w: &str, k: i32, amt: f32) {
        if k < 0 || w.is_empty() {
            return;
        }
        let k = k as usize;
        let i = match self.find(w) {
            Some(i) => i,
            None => {
                self.m.push((w.to_string(), vec![0.0; self.k]));
                self.m.len() - 1
            }
        };
        {
            let a = &mut self.m[i].1;
            a[k] = (a[k] + amt).min(1.0);
            for j in 0..a.len() {
                if j != k {
                    a[j] *= 1.0 - amt * 0.3;
                }
            }
        }
        for (j, (_, q)) in self.m.iter_mut().enumerate() {
            if j != i {
                q[k] *= 1.0 - amt * 0.5;
            }
        }
        self.prune(w);
    }
    pub fn clear_slot(&mut self, k: usize) {
        for (_, a) in self.m.iter_mut() {
            a[k] = 0.0;
        }
    }
    pub fn merge_slot(&mut self, into: usize, from: usize) {
        for (_, a) in self.m.iter_mut() {
            a[into] = a[into].max(a[from]);
            a[from] = 0.0;
        }
    }
    pub fn forget(&mut self, th: f32) {
        self.m.retain(|(_, a)| a.iter().cloned().fold(0.0, f32::max) >= th);
    }
    fn prune(&mut self, keep: &str) {
        while self.m.len() > MAX_WORDS {
            let mut mi = usize::MAX;
            let mut ms = f32::INFINITY;
            for (i, (w, a)) in self.m.iter().enumerate() {
                if w == keep {
                    continue;
                }
                let s: f32 = a.iter().sum();
                if s < ms {
                    ms = s;
                    mi = i;
                }
            }
            if mi == usize::MAX {
                break;
            }
            self.m.remove(mi);
        }
    }
}
