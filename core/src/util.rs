//! Basic helpers: deterministic random numbers, math, terrain noise, text cleaning.
use serde::{Deserialize, Serialize};

pub const TAU: f32 = std::f32::consts::TAU;
pub const PI: f32 = std::f32::consts::PI;

#[inline]
pub fn clamp(v: f32, a: f32, b: f32) -> f32 {
    if v < a {
        a
    } else if v > b {
        b
    } else {
        v
    }
}

/// Fast rational tanh approximation (max error about 0.02), identical on all platforms.
#[inline]
pub fn ftanh(x: f32) -> f32 {
    if x > 4.97 {
        1.0
    } else if x < -4.97 {
        -1.0
    } else {
        let x2 = x * x;
        x * (27.0 + x2) / (27.0 + 9.0 * x2)
    }
}

#[inline]
pub fn wrap_a(a: f32) -> f32 {
    let mut a = a % TAU;
    if a > PI {
        a -= TAU;
    } else if a < -PI {
        a += TAU;
    }
    a
}

#[inline]
pub fn sector_of(a: f32) -> i32 {
    (((a / (PI / 4.0)).round() as i32 % 8) + 8) % 8
}

#[inline]
pub fn r3(v: f32) -> f32 {
    (v * 1000.0).round() / 1000.0
}

#[inline]
pub fn r2(v: f32) -> f32 {
    (v * 100.0).round() / 100.0
}

/// SplitMix64: small, fast, deterministic. Every random decision of a world uses its own Rng.
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Rng {
    s: u64,
}

impl Rng {
    pub fn new(seed: u64) -> Self {
        let mut r = Rng { s: seed ^ 0x9E37_79B9_7F4A_7C15 };
        r.next_u64();
        r
    }
    #[inline]
    pub fn next_u64(&mut self) -> u64 {
        self.s = self.s.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.s;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    #[inline]
    pub fn f(&mut self) -> f32 {
        (self.next_u64() >> 40) as f32 / 16_777_216.0
    }
    #[inline]
    pub fn range(&mut self, a: f32, b: f32) -> f32 {
        a + self.f() * (b - a)
    }
    #[inline]
    pub fn gauss(&mut self) -> f32 {
        let u = self.f().max(1e-7);
        let v = self.f();
        (-2.0 * u.ln()).sqrt() * (TAU * v).cos()
    }
    #[inline]
    pub fn below(&mut self, n: usize) -> usize {
        if n == 0 {
            0
        } else {
            (self.next_u64() % n as u64) as usize
        }
    }
    #[inline]
    pub fn chance(&mut self, p: f32) -> bool {
        self.f() < p
    }
}

/// Mulberry32, bit-identical to the JavaScript version used for terrain graphics.
pub struct Mulberry(u32);
impl Mulberry {
    pub fn new(seed: u32) -> Self {
        Mulberry(seed)
    }
    pub fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6D2B_79F5);
        let a = self.0;
        let mut t = (a ^ (a >> 15)).wrapping_mul(1 | a);
        t = (t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t))) ^ t;
        ((t ^ (t >> 14)) as f64) / 4_294_967_296.0
    }
}

/// Value noise identical to the JavaScript makeNoise (grid stored as f32, math in f64).
pub struct Noise {
    cell: f64,
    gw: usize,
    g: Vec<f32>,
}
impl Noise {
    pub fn new(rng: &mut Mulberry, cell: f64, w: f64, h: f64) -> Self {
        let gw = (w / cell).ceil() as usize + 2;
        let gh = (h / cell).ceil() as usize + 2;
        let g = (0..gw * gh).map(|_| rng.next() as f32).collect();
        Noise { cell, gw, g }
    }
    pub fn at(&self, x: f64, y: f64) -> f64 {
        let fx = x / self.cell;
        let fy = y / self.cell;
        let ix = fx as usize;
        let iy = fy as usize;
        let tx = fx - ix as f64;
        let ty = fy - iy as f64;
        let sx = tx * tx * (3.0 - 2.0 * tx);
        let sy = ty * ty * (3.0 - 2.0 * ty);
        let gw = self.gw;
        let a = self.g[iy * gw + ix] as f64;
        let q = self.g[iy * gw + ix + 1] as f64;
        let c = self.g[(iy + 1) * gw + ix] as f64;
        let d = self.g[(iy + 1) * gw + ix + 1] as f64;
        a + (q - a) * sx + (c - a) * sy + (a - q - c + d) * sx * sy
    }
}

pub const SYL: [&str; 20] = [
    "ka", "lu", "mi", "to", "ra", "se", "no", "vi", "pa", "du", "ke", "zo", "ri", "ma", "fu", "ti", "be", "go", "na", "si",
];

pub fn random_word(rng: &mut Rng) -> String {
    let n = 1 + usize::from(rng.f() < 0.65) + usize::from(rng.f() < 0.2);
    let mut w = String::new();
    for _ in 0..n {
        w.push_str(SYL[rng.below(SYL.len())]);
    }
    w
}

pub fn nice_name(rng: &mut Rng) -> String {
    let w = random_word(rng);
    let mut c = w.chars();
    match c.next() {
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
        None => w,
    }
}

/// Words: lowercase letters a-z and German umlauts, at most 12 characters.
pub fn clean_word(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_lowercase() || matches!(c, 'ä' | 'ö' | 'ü'))
        .take(12)
        .collect()
}

/// Names: letters, digits, space and dash, at most 16 characters.
pub fn clean_name(s: &str) -> String {
    let t: String = s
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-')
        .take(16)
        .collect();
    t.trim().to_string()
}

pub fn levenshtein(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    let mut cur = vec![0; b.len() + 1];
    for i in 1..=a.len() {
        cur[0] = i;
        for j in 1..=b.len() {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            cur[j] = (prev[j] + 1).min(cur[j - 1] + 1).min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut cur);
    }
    prev[b.len()]
}

#[inline]
pub fn vdist(a: &[f32], b: &[f32]) -> f32 {
    let mut s = 0.0;
    for i in 0..a.len().min(b.len()) {
        let d = a[i] - b[i];
        s += d * d;
    }
    (s / a.len().max(1) as f32).sqrt()
}
