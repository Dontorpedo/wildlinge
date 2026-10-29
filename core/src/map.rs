//! Terrain: deterministic biome map from a seed (identical to the JavaScript graphics).
use crate::consts::*;
use crate::util::{Mulberry, Noise};

pub struct Map {
    pub gw: usize,
    pub gh: usize,
    pub bio: Vec<u8>,
}

impl Map {
    pub fn new(seed: u32) -> Map {
        let mut rng = Mulberry::new(seed);
        let (w, h) = (WORLD_W as f64, WORLD_H as f64);
        let e1 = Noise::new(&mut rng, 560.0, w, h);
        let e2 = Noise::new(&mut rng, 180.0, w, h);
        let m1 = Noise::new(&mut rng, 480.0, w, h);
        let m2 = Noise::new(&mut rng, 140.0, w, h);
        let gw = (WORLD_W / TC) as usize;
        let gh = (WORLD_H / TC) as usize;
        let mut bio = vec![0u8; gw * gh];
        for y in 0..gh {
            for x in 0..gw {
                let wx = (x as f64 + 0.5) * TC as f64;
                let wy = (y as f64 + 0.5) * TC as f64;
                let nx = wx / w * 2.0 - 1.0;
                let ny = wy / h * 2.0 - 1.0;
                let fall = nx.abs().max(ny.abs());
                let e = (e1.at(wx, wy) * 0.7 + e2.at(wx, wy) * 0.3 - 0.5) * 1.9 + 0.5 - (fall - 0.78).max(0.0) * 1.6;
                let m = (m1.at(wx, wy) * 0.7 + m2.at(wx, wy) * 0.3 - 0.5) * 1.9 + 0.5;
                bio[y * gw + x] = if e < 0.24 {
                    0
                } else if e < 0.32 {
                    1
                } else if e > 0.76 {
                    5
                } else if m < 0.33 {
                    4
                } else if m > 0.6 {
                    3
                } else {
                    2
                };
            }
        }
        Map { gw, gh, bio }
    }
    #[inline]
    pub fn at(&self, x: f32, y: f32) -> usize {
        let cx = ((x / TC) as i32).clamp(0, self.gw as i32 - 1) as usize;
        let cy = ((y / TC) as i32).clamp(0, self.gh as i32 - 1) as usize;
        self.bio[cy * self.gw + cx] as usize
    }
}
