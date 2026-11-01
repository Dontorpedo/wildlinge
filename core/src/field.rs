//! Scent field: three channels on a coarse grid. Creatures write into it, it spreads and fades.
use crate::consts::*;

pub const PH_CELL: f32 = 40.0;
pub const PH_CH: usize = 3;

pub struct Field {
    pub gw: usize,
    pub gh: usize,
    pub v: Vec<f32>,
    tmp: Vec<f32>,
}

impl Default for Field {
    fn default() -> Self {
        Field::new()
    }
}

impl Field {
    pub fn new() -> Field {
        let gw = (WORLD_W / PH_CELL) as usize;
        let gh = (WORLD_H / PH_CELL) as usize;
        Field { gw, gh, v: vec![0.0; gw * gh * PH_CH], tmp: vec![0.0; gw * gh] }
    }
    #[inline]
    fn idx(&self, ch: usize, x: f32, y: f32) -> usize {
        let cx = ((x / PH_CELL) as i32).clamp(0, self.gw as i32 - 1) as usize;
        let cy = ((y / PH_CELL) as i32).clamp(0, self.gh as i32 - 1) as usize;
        ch * self.gw * self.gh + cy * self.gw + cx
    }
    #[inline]
    pub fn at(&self, ch: usize, x: f32, y: f32) -> f32 {
        self.v[self.idx(ch, x, y)]
    }
    #[inline]
    pub fn add(&mut self, ch: usize, x: f32, y: f32, amt: f32) {
        let i = self.idx(ch, x, y);
        self.v[i] = (self.v[i] + amt).min(1.0);
    }
    /// One diffusion and decay step (called every few ticks).
    pub fn step(&mut self) {
        let (gw, gh) = (self.gw, self.gh);
        let n = gw * gh;
        for ch in 0..PH_CH {
            let base = ch * n;
            let src = &self.v[base..base + n];
            for y in 0..gh {
                for x in 0..gw {
                    let i = y * gw + x;
                    let c = src[i];
                    let l = if x > 0 { src[i - 1] } else { c };
                    let r = if x + 1 < gw { src[i + 1] } else { c };
                    let u = if y > 0 { src[i - gw] } else { c };
                    let d = if y + 1 < gh { src[i + gw] } else { c };
                    let v = (c * 0.6 + (l + r + u + d) * 0.1) * 0.975;
                    self.tmp[i] = if v < 0.002 { 0.0 } else { v };
                }
            }
            self.v[base..base + n].copy_from_slice(&self.tmp);
        }
    }
}
