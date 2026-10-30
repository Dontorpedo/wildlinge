//! The world: terrain, plants, all Wildlings, species, language, events and measurements.
use crate::brain::Innov;
use crate::consts::*;
use crate::creature::*;
use crate::genome::*;
use crate::map::Map;
use crate::metrics;
use crate::util::*;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Food {
    pub x: f32,
    pub y: f32,
    pub e: f32,
    pub meat: bool,
    pub born: u32,
    pub k: u8,
    #[serde(default)]
    pub det: bool,
}

#[derive(Clone, Default)]
pub struct Grid {
    pub cols: usize,
    pub rows: usize,
    pub start: Vec<u32>,
    pub items: Vec<u32>,
    cnt: Vec<u32>,
}

impl Grid {
    pub fn new() -> Grid {
        let cols = (WORLD_W / CELL).ceil() as usize;
        let rows = (WORLD_H / CELL).ceil() as usize;
        Grid { cols, rows, start: vec![0; cols * rows + 1], items: Vec::new(), cnt: vec![0; cols * rows] }
    }
    #[inline]
    pub fn cell(&self, x: f32, y: f32) -> usize {
        let c = ((x / CELL) as i32).clamp(0, self.cols as i32 - 1) as usize;
        let r = ((y / CELL) as i32).clamp(0, self.rows as i32 - 1) as usize;
        r * self.cols + c
    }
    pub fn build<I: Iterator<Item = (f32, f32)> + Clone>(&mut self, pts: I) {
        self.cnt.iter_mut().for_each(|v| *v = 0);
        let mut n = 0;
        for (x, y) in pts.clone() {
            let c = self.cell(x, y);
            self.cnt[c] += 1;
            n += 1;
        }
        self.start[0] = 0;
        for i in 0..self.cnt.len() {
            self.start[i + 1] = self.start[i] + self.cnt[i];
        }
        for i in 0..self.cnt.len() {
            self.cnt[i] = self.start[i];
        }
        self.items.resize(n, 0);
        for (i, (x, y)) in pts.enumerate() {
            let c = self.cell(x, y);
            self.items[self.cnt[c] as usize] = i as u32;
            self.cnt[c] += 1;
        }
    }
    #[inline]
    pub fn range(&self, x: f32, y: f32, r: f32) -> (usize, usize, usize, usize) {
        let c0 = ((x - r) / CELL).max(0.0) as usize;
        let c1 = (((x + r) / CELL) as i32).clamp(0, self.cols as i32 - 1) as usize;
        let r0 = ((y - r) / CELL).max(0.0) as usize;
        let r1 = (((y + r) / CELL) as i32).clamp(0, self.rows as i32 - 1) as usize;
        (c0.min(self.cols - 1), c1, r0.min(self.rows - 1), r1)
    }
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Utt {
    pub x: f32,
    pub y: f32,
    pub tokens: Vec<String>,
    pub sid: u32,
    pub diet: f32,
    pub sp: i32,
    pub cat_vec: Option<[f32; FD]>,
    pub sector: i32,
    pub cgen: Vec<(String, u32)>,
    pub what: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct LogEntry {
    pub words: String,
    pub id: u32,
    pub name: String,
    pub carn: bool,
    pub t: u32,
    pub vec: Option<[f32; FD]>,
    pub sector: i32,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Event {
    pub t: u32,
    pub k: String,
    pub p: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Species {
    pub id: i32,
    pub name: String,
    pub rep: Morph,
    pub hue: f32,
    pub carn: bool,
    pub boss_id: u32,
    pub boss_since: u32,
    pub score: f32,
    pub votes: u32,
    pub voters: u32,
    pub born: u32,
    pub n: u32,
    pub named: bool,
    pub announced: Vec<u8>,
    pub kinds: Vec<(u8, f32)>,
    pub fin: f32,
    pub ord_share: f32,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct SpeciesRec {
    pub id: i32,
    pub name: String,
    pub parent: i32,
    pub born: u32,
    pub died: i64,
    pub carn: bool,
    pub hue: f32,
    pub max_n: u32,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Lin {
    pub id: u32,
    pub n: String,
    pub p1: u32,
    pub p2: u32,
    pub b: u32,
    pub d: i64,
    pub c: String,
    pub g: u32,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Memorial {
    pub id: u32,
    pub name: String,
    pub born: u32,
    pub died: u32,
    pub cause: String,
    pub gen: u32,
    pub children: u32,
    pub diary: Vec<Diary>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Hof {
    pub g: Genome,
    pub fit: f32,
    pub gen: u32,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Bubble {
    pub x: f32,
    pub y: f32,
    pub text: String,
    pub kind: u8,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Row {
    pub t: u32,
    pub pop: u32,
    pub herb: u32,
    pub carn: u32,
    pub species: u32,
    pub parts: f32,
    pub kinds: u32,
    pub diversity: f32,
    pub neurons: f32,
    pub conns: f32,
    pub certainty: f32,
    pub gut_own: f32,
    pub mirror: f32,
    pub understand: f32,
    pub wellbeing: f32,
    pub life: f32,
    pub mind: f32,
    pub phi: f32,
    pub lz: f32,
    pub entropy: f32,
    pub mi: f32,
    pub topo: f32,
    pub m_change: u32,
    pub m_novelty: u32,
    pub m_ecology: f32,
    pub m_complexity: u32,
    pub b_activity: f32,
    pub b_new: u32,
    pub knock: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct UttRec {
    pub word: String,
    pub vec: [f32; FD],
}

pub struct Seen {
    pub idx: Option<usize>,
    pub x: f32,
    pub y: f32,
    pub d: f32,
    pub size: f32,
    pub carn: bool,
    pub weapon: f32,
    pub armor: f32,
    pub display: f32,
    pub mature: bool,
    pub md: f32,
    pub sp: i32,
}

#[derive(Serialize, Deserialize, Default)]
pub struct World {
    pub v: u32,
    pub seed: u32,
    pub t: u32,
    pub saved_at: f64,
    pub rng: Rng,
    pub innov: Innov,
    pub next_id: u32,
    pub creatures: Vec<Creature>,
    pub foods: Vec<Food>,
    pub births: u32,
    pub deaths: BTreeMap<String, u32>,
    pub hof: Vec<Hof>,
    pub max_gen: u32,
    pub hist: Vec<[f32; 3]>,
    pub log: Vec<LogEntry>,
    pub utterances: u32,
    pub milestones: BTreeMap<String, u32>,
    pub user_words: Vec<String>,
    pub species: Vec<Species>,
    pub next_sp: i32,
    pub events: Vec<Event>,
    pub macro_n: u32,
    pub neurons_n: u32,
    pub boss_changes: u32,
    pub rate: f32,
    pub sentences: u32,
    pub flyer: bool,
    pub knock: [bool; 6],
    pub mirrors: Vec<[f32; 2]>,
    pub lineage: Vec<Lin>,
    pub memorial: Vec<Memorial>,
    pub series: Vec<Row>,
    pub first_kinds: Vec<(u8, u32)>,
    pub mirror_tests: u32,
    pub mirror_pass: u32,
    pub strokes: u32,
    pub taught_n: u32,
    pub life_share: Option<(Vec<f32>, Vec<f32>)>,
    pub phylo: Vec<SpeciesRec>,
    pub modes: metrics::Modes,
    pub bedau: metrics::Bedau,
    pub lang_buf: Vec<UttRec>,
    #[serde(default)]
    pub terra: Vec<Creature>,
    #[serde(skip)]
    pub newborn: Vec<Creature>,
    #[serde(skip)]
    pub plants: usize,
    #[serde(skip)]
    pub viewer: u64,
    #[serde(skip)]
    pub dets: usize,
    #[serde(default)]
    pub fert: u32,
    #[serde(skip)]
    pub speech: Vec<Utt>,
    #[serde(skip)]
    pub speech_next: Vec<Utt>,
    #[serde(skip)]
    pub last_user: Option<(Vec<String>, f32, f32, u32)>,
    #[serde(skip)]
    pub sf: f32,
    #[serde(skip)]
    pub frozen: bool,
    #[serde(skip)]
    pub night: f32,
    #[serde(skip)]
    pub hw: u32,
    #[serde(skip)]
    pub uw: u32,
    #[serde(skip)]
    pub map: Option<Map>,
    #[serde(skip)]
    pub grid: Grid,
    #[serde(skip)]
    pub fgrid: Grid,
    #[serde(skip)]
    pub id_idx: HashMap<u32, usize>,
    #[serde(skip)]
    pub boss_of: BTreeMap<i32, u32>,
    #[serde(skip)]
    pub bubbles: Vec<Bubble>,
}

pub const SAVE_VERSION: u32 = 7;

fn fresh_culture(c: &Creature) -> Culture {
    Culture {
        protos: c.protos.iter().map(|p| p.map(|q| Proto { v: q.v, n: q.n.div_ceil(2) })).collect(),
        lex: c.lex.clone_scaled(0.7),
        dlex: c.dlex.clone_scaled(0.7),
        ord: [c.ord[0].div_ceil(2), c.ord[1].div_ceil(2)],
        cgen: c.cgen.clone(),
    }
}

impl World {
    pub fn new(seed: u32) -> World {
        let mut w = World { v: SAVE_VERSION, seed, rng: Rng::new(seed as u64 * 7919 + 17), next_id: 1, next_sp: 1, ..Default::default() };
        w.setup_derived();
        let mut tries = 0;
        while w.plants < PLANT_MAX / 2 && tries < 60000 {
            w.grow_plant(true);
            tries += 1;
        }
        for _ in 0..START_HERB {
            w.spawn(false);
        }
        for _ in 0..START_CARN {
            w.spawn(true);
        }
        w.flush();
        w.rebuild_food_grid();
        w.classify();
        w
    }

    pub fn setup_derived(&mut self) {
        self.map = Some(Map::new(self.seed));
        self.grid = Grid::new();
        self.fgrid = Grid::new();
        self.plants = self.foods.iter().filter(|f| !f.meat && !f.det).count();
        self.dets = self.foods.iter().filter(|f| f.det).count();
        self.update_season();
    }

    pub fn from_json(text: &str) -> Result<World, String> {
        let mut w: World = serde_json::from_str(text).map_err(|e| format!("{}", e))?;
        if w.v != SAVE_VERSION {
            return Err(format!("unsupported version {}", w.v));
        }
        w.setup_derived();
        for c in w.creatures.iter_mut() {
            sanitize(&mut c.g);
            c.lex.sanitize(MAX_PROTO);
            c.dlex.sanitize(8);
            c.name = clean_name(&c.name);
            if c.name.is_empty() {
                c.name = "Wildling".into();
            }
            c.rebuild();
        }
        for c in w.terra.iter_mut() {
            Self::sanitize_creature(c);
        }
        w.terra.truncate(crate::api::TERRA_MAX);
        for h in w.hof.iter_mut() {
            sanitize(&mut h.g);
        }
        for s in w.species.iter_mut() {
            s.name = clean_name(&s.name);
        }
        w.mirrors.truncate(MAX_MIRRORS);
        w.user_words = w.user_words.iter().map(|s| clean_word(s)).filter(|s| !s.is_empty()).take(200).collect();
        w.foods.retain(|f| f.x.is_finite() && f.y.is_finite() && f.e.is_finite());
        for f in w.foods.iter_mut() {
            f.x = clamp(f.x, 0.0, WORLD_W);
            f.y = clamp(f.y, 0.0, WORLD_H);
            f.k = f.k.min(5);
        }
        for c in w.creatures.iter_mut() {
            c.x = if c.x.is_finite() { clamp(c.x, 0.0, WORLD_W) } else { WORLD_W / 2.0 };
            c.y = if c.y.is_finite() { clamp(c.y, 0.0, WORLD_H) } else { WORLD_H / 2.0 };
        }
        let max_id = w.creatures.iter().chain(w.terra.iter()).map(|c| c.id).max().unwrap_or(0);
        w.next_id = w.next_id.max(max_id + 1);
        w.plants = w.foods.iter().filter(|f| !f.meat && !f.det).count();
        w.dets = w.foods.iter().filter(|f| f.det).count();
        w.rebuild_food_grid();
        Ok(w)
    }

    pub fn sanitize_creature(c: &mut Creature) {
        sanitize(&mut c.g);
        c.lex.sanitize(MAX_PROTO);
        c.dlex.sanitize(8);
        c.name = clean_name(&c.name);
        if c.name.is_empty() {
            c.name = "Wildling".into();
        }
        c.rebuild();
    }

    pub fn terra_to_json(v: &mut [Creature]) -> String {
        for c in v.iter_mut() {
            c.save_prepare();
        }
        serde_json::to_string(&*v).unwrap_or_default()
    }

    pub fn terra_from_json(text: &str) -> Result<Vec<Creature>, String> {
        let mut v: Vec<Creature> = serde_json::from_str(text).map_err(|e| format!("{}", e))?;
        v.truncate(crate::api::TERRA_MAX);
        for c in v.iter_mut() {
            Self::sanitize_creature(c);
        }
        Ok(v)
    }

    pub fn to_json(&mut self, now: f64) -> String {
        self.saved_at = now;
        for c in self.creatures.iter_mut().chain(self.terra.iter_mut()) {
            c.save_prepare();
        }
        serde_json::to_string(self).unwrap_or_default()
    }

    #[inline]
    pub fn bio_at(&self, x: f32, y: f32) -> usize {
        self.map.as_ref().map(|m| m.at(x, y)).unwrap_or(2)
    }

    pub fn random_land(&mut self) -> (f32, f32) {
        for _ in 0..400 {
            let x = self.rng.range(30.0, WORLD_W - 30.0);
            let y = self.rng.range(30.0, WORLD_H - 30.0);
            let b = self.bio_at(x, y);
            if b == 2 || b == 3 {
                return (x, y);
            }
        }
        (WORLD_W / 2.0, WORLD_H / 2.0)
    }

    pub fn update_season(&mut self) {
        self.sf = 0.5 + 0.5 * (TAU * self.t as f32 / YEAR_LEN as f32).sin();
        self.frozen = self.sf < 0.12;
        let light = 0.5 - 0.5 * (TAU * ((self.t % DAY_LEN) as f32 / DAY_LEN as f32)).cos();
        self.night = clamp((0.45 - light) / 0.45, 0.0, 1.0);
    }

    pub fn event(&mut self, k: &str, p: Vec<String>) {
        self.events.push(Event { t: self.t, k: k.to_string(), p });
        if self.events.len() > 60 {
            self.events.remove(0);
        }
    }

    pub fn achieve(&mut self, key: &str) {
        if self.milestones.contains_key(key) {
            return;
        }
        self.milestones.insert(key.to_string(), self.t);
        self.event("ev.goal", vec![key.to_string()]);
    }

    pub fn add_food(&mut self, x: f32, y: f32, e: f32, meat: bool, k: u8) {
        self.foods.push(Food { x, y, e, meat, born: self.t, k, det: false });
        if !meat {
            self.plants += 1;
        }
    }

    pub fn add_det(&mut self, x: f32, y: f32, e: f32) {
        if self.dets >= DET_MAX {
            return;
        }
        self.foods.push(Food { x, y, e, meat: false, born: self.t, k: 0, det: true });
        self.dets += 1;
    }

    pub fn grow_plant(&mut self, initial: bool) {
        let (mut x, mut y);
        let use_src = !initial && !self.foods.is_empty() && self.rng.chance(0.7);
        if use_src {
            let i = self.rng.below(self.foods.len());
            let f = &self.foods[i];
            if f.meat {
                return;
            }
            let (fx, fy) = (f.x, f.y);
            x = fx + self.rng.gauss() * 35.0;
            y = fy + self.rng.gauss() * 35.0;
        } else {
            x = self.rng.range(0.0, WORLD_W);
            y = self.rng.range(0.0, WORLD_H);
        }
        x = clamp(x, 2.0, WORLD_W - 2.0);
        y = clamp(y, 2.0, WORLD_H - 2.0);
        let b = self.bio_at(x, y);
        let bm = &BIOMES[b];
        let season = if initial {
            1.0
        } else if bm.water > 0 {
            0.6 + 0.4 * self.sf
        } else {
            0.15 + 0.85 * self.sf
        };
        let (growth, food) = (bm.growth, bm.food);
        if self.rng.f() > growth / 1.3 * season {
            return;
        }
        self.add_food(x, y, food, false, b as u8);
    }

    pub fn rebuild_food_grid(&mut self) {
        let mut g = std::mem::take(&mut self.fgrid);
        g.build(self.foods.iter().map(|f| (f.x, f.y)));
        self.fgrid = g;
    }

    pub fn add_creature(&mut self, mut c: Creature) {
        c.born = self.t;
        if c.gen > self.max_gen {
            self.max_gen = c.gen;
        }
        self.lineage.push(Lin { id: c.id, n: c.name.clone(), p1: c.p1, p2: c.p2, b: self.t, d: -1, c: String::new(), g: c.gen });
        if self.lineage.len() > 6000 {
            self.prune_lineage();
        }
        self.newborn.push(c);
    }

    fn prune_lineage(&mut self) {
        let mut keep: Vec<u32> = Vec::new();
        for c in self.creatures.iter().filter(|c| c.adopted) {
            keep.extend([c.id, c.p1, c.p2]);
        }
        keep.extend(self.memorial.iter().map(|m| m.id));
        let mut remove = self.lineage.len().saturating_sub(5000);
        self.lineage.retain(|r| {
            if remove > 0 && r.d >= 0 && !keep.contains(&r.id) {
                remove -= 1;
                false
            } else {
                true
            }
        });
    }

    pub fn lineage_get(&self, id: u32) -> Option<&Lin> {
        self.lineage.binary_search_by_key(&id, |r| r.id).ok().map(|i| &self.lineage[i])
    }

    pub fn flush(&mut self) {
        if !self.newborn.is_empty() {
            let nb = std::mem::take(&mut self.newborn);
            self.creatures.extend(nb);
        }
    }

    pub fn count(&self) -> usize {
        self.creatures.len() + self.newborn.len()
    }

    pub fn spawn(&mut self, carn: bool) {
        let pool: Vec<usize> = (0..self.hof.len()).filter(|&i| (self.hof[i].g.tr[T_DIET] >= 0.5) == carn).collect();
        let (g, gen) = if !pool.is_empty() && self.rng.chance(0.7) {
            let h = pool[self.rng.below(pool.len())];
            let st = Stress { total: 0.0, angle: None, cause: "" };
            let src = self.hof[h].g.clone();
            let gen = self.hof[h].gen + 1;
            let off = self.knock[K_MUT];
            let (g, _) = mutate(&src, &st, off, &mut self.rng, &mut self.innov);
            (g, gen)
        } else {
            (random_genome(carn, &mut self.rng, &mut self.innov), 0)
        };
        let (x, y) = self.random_land();
        let id = self.next_id;
        self.next_id += 1;
        let mut c = Creature::new(id, x, y, g, gen, None, (0, 0), &mut self.rng);
        c.note(self.t, "d.immigrant", "");
        self.add_creature(c);
    }

    pub fn archive_pub(&mut self, c: &Creature) {
        self.archive(c);
    }

    fn archive(&mut self, c: &Creature) {
        let fit = c.children as f32 * 3.0 + c.kills as f32 + c.age as f32 / 1000.0;
        if fit < 0.5 {
            return;
        }
        self.hof.push(Hof { g: c.g.clone(), fit, gen: c.gen });
        self.hof.sort_by(|a, b| b.fit.partial_cmp(&a.fit).unwrap_or(std::cmp::Ordering::Equal));
        self.hof.truncate(30);
    }

    pub fn die(&mut self, c: &mut Creature, cause: &str) {
        if c.dead {
            return;
        }
        c.dead = true;
        c.cause = cause.to_string();
        *self.deaths.entry(cause.to_string()).or_insert(0) += 1;
        let s = c.size();
        self.add_food(c.x, c.y, s * s * 1.2 + c.energy * 0.5, true, 2);
        self.archive(c);
        c.note(self.t, "d.died", cause);
        if let Ok(i) = self.lineage.binary_search_by_key(&c.id, |r| r.id) {
            self.lineage[i].d = self.t as i64;
            self.lineage[i].c = cause.to_string();
        }
        if c.adopted {
            let n = c.diary.len();
            self.memorial.push(Memorial {
                id: c.id,
                name: c.name.clone(),
                born: c.born,
                died: self.t,
                cause: cause.to_string(),
                gen: c.gen,
                children: c.children,
                diary: c.diary[n.saturating_sub(30)..].to_vec(),
            });
            if self.memorial.len() > 30 {
                self.memorial.remove(0);
            }
            self.event("ev.adoptedDied", vec![c.name.clone(), cause.to_string()]);
        }
    }

    pub fn say(&mut self, u: Utt, speaker: Option<&mut Creature>) {
        self.utterances += 1;
        let (name, carn, id) = match &speaker {
            Some(c) => (c.name.clone(), c.carn(), c.id),
            None => (String::new(), false, 0),
        };
        if u.sid == 0 {
            for w in &u.tokens {
                if !self.user_words.contains(w) {
                    self.user_words.push(w.clone());
                }
            }
            if self.user_words.len() > 200 {
                self.user_words.remove(0);
            }
            self.last_user = Some((u.tokens.clone(), u.x, u.y, self.t));
        } else {
            if u.tokens.iter().any(|w| self.user_words.contains(w)) {
                self.achieve("taught");
            }
            if let Some((lt, lx, ly, ltt)) = self.last_user.clone() {
                if self.t - ltt < 80 && ((lx - u.x).powi(2) + (ly - u.y).powi(2)).sqrt() < HEAR * 1.5 && u.tokens.iter().any(|w| lt.contains(w)) {
                    self.achieve("answer");
                    if let Some(c) = speaker {
                        if c.adopted {
                            c.note(self.t, "d.answer", &u.tokens.join(" "));
                        }
                    }
                }
            }
            if let Some(v) = u.cat_vec {
                if !u.what.is_empty() {
                    self.lang_buf.push(UttRec { word: u.what.clone(), vec: v });
                    if self.lang_buf.len() > 400 {
                        self.lang_buf.remove(0);
                    }
                }
            }
        }
        self.log.push(LogEntry { words: u.tokens.join(" "), id, name, carn, t: self.t, vec: u.cat_vec, sector: u.sector });
        if self.log.len() > 40 {
            self.log.remove(0);
        }
        self.bubbles.push(Bubble { x: u.x, y: u.y, text: u.tokens.join(" "), kind: if u.sid == 0 { 1 } else { 0 } });
        self.speech_next.push(u);
    }

    pub fn body_bubble(&mut self, x: f32, y: f32, key: &str) {
        self.bubbles.push(Bubble { x, y, text: key.to_string(), kind: 2 });
    }

    /* ---------------- species and bosses ---------------- */

    pub fn classify(&mut self) {
        for s in self.species.iter_mut() {
            s.n = 0;
        }
        let mut new_species: Vec<Species> = Vec::new();
        let mut events: Vec<(&str, Vec<String>)> = Vec::new();
        let t = self.t;
        for ci in 0..self.creatures.len() {
            let (morph, sp, carn, hue, fly, name, id, kinds) = {
                let c = &self.creatures[ci];
                (c.morph.clone(), c.sp, c.carn(), c.g.hue, c.fly, c.name.clone(), c.id, c.kinds.clone())
            };
            let mut best: Option<(bool, usize)> = None;
            if let Some(oi) = self.species.iter().position(|s| s.id == sp) {
                if morph_dist(&morph, &self.species[oi].rep) < SPECIES_TH * 1.2 {
                    best = Some((false, oi));
                }
            }
            if best.is_none() {
                let mut bd = SPECIES_TH;
                for (i, s) in self.species.iter().enumerate() {
                    let d = morph_dist(&morph, &s.rep);
                    if d < bd {
                        bd = d;
                        best = Some((false, i));
                    }
                }
                for (i, s) in new_species.iter().enumerate() {
                    let d = morph_dist(&morph, &s.rep);
                    if d < bd {
                        bd = d;
                        best = Some((true, i));
                    }
                }
            }
            let (is_new, i) = match best {
                Some(b) => b,
                None => {
                    let sid = self.next_sp;
                    self.next_sp += 1;
                    let name = nice_name(&mut self.rng);
                    self.phylo.push(SpeciesRec { id: sid, name: name.clone(), parent: sp, born: t, died: -1, carn, hue, max_n: 0 });
                    new_species.push(Species { id: sid, name, rep: morph.clone(), hue, carn, born: t, ..Default::default() });
                    (true, new_species.len() - 1)
                }
            };
            let s = if is_new { &mut new_species[i] } else { &mut self.species[i] };
            s.n += 1;
            self.creatures[ci].sp = s.id;
            if fly && !self.flyer {
                self.flyer = true;
                events.push(("ev.fly", vec![name.clone(), id.to_string()]));
                self.milestones.entry("fly".into()).or_insert(t);
            }
            for &k in &kinds {
                if !START_KINDS.contains(&(k as usize)) && !self.first_kinds.iter().any(|q| q.0 == k) {
                    self.first_kinds.push((k, t));
                    events.push(("ev.firstKind", vec![KIND_KEYS[k as usize].to_string(), name.clone(), id.to_string()]));
                }
            }
        }
        self.species.extend(new_species);
        for (k, p) in events {
            self.event(k, p);
        }
        let mut gone: Vec<(String, bool)> = Vec::new();
        for s in &self.species {
            if s.n == 0 {
                gone.push((s.name.clone(), s.named));
                if let Some(r) = self.phylo.iter_mut().find(|r| r.id == s.id) {
                    r.died = t as i64;
                }
            }
        }
        for (name, named) in gone {
            if named {
                self.event("ev.extinct", vec![name]);
            }
        }
        self.species.retain(|s| s.n > 0);
        let mut named_events = Vec::new();
        for s in self.species.iter_mut() {
            if let Some(r) = self.phylo.iter_mut().find(|r| r.id == s.id) {
                r.max_n = r.max_n.max(s.n);
            }
            if !s.named && s.n >= 5 {
                s.named = true;
                if t > 0 {
                    named_events.push(vec![s.name.clone(), if s.carn { "1".into() } else { "0".into() }, s.n.to_string()]);
                }
            }
        }
        for p in named_events {
            self.event("ev.newSpecies", p);
        }
        if self.species.iter().filter(|s| s.n >= 5).count() >= 3 {
            self.achieve("species3");
        }
        if self.milestones.get("fly") == Some(&t) && !self.events.iter().any(|e| e.k == "ev.goal" && e.p[0] == "fly") {
            self.milestones.remove("fly");
            self.achieve("fly");
        }
        let nsp = self.species.len();
        let mut spread_ev = Vec::new();
        let mut ach: Vec<&str> = Vec::new();
        for si in 0..nsp {
            let sid = self.species[si].id;
            let mut kc = [0u32; 10];
            let (mut fin, mut ord_a, mut n) = (0.0, 0u32, 0u32);
            for c in self.creatures.iter().filter(|c| c.sp == sid) {
                let mut seen = [false; 10];
                for &k in &c.kinds {
                    if !seen[k as usize] {
                        seen[k as usize] = true;
                        kc[k as usize] += 1;
                    }
                }
                fin += c.ab.ab[A_FIN];
                if c.order() == 0 {
                    ord_a += 1;
                }
                n += 1;
            }
            if n == 0 {
                continue;
            }
            let s = &mut self.species[si];
            let mut kinds: Vec<(u8, f32)> = (0..10).filter(|&k| kc[k] > 0).map(|k| (k as u8, kc[k] as f32 / n as f32)).collect();
            kinds.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
            s.kinds = kinds;
            s.fin = fin / n as f32;
            s.ord_share = ord_a as f32 / n as f32;
            if n >= 10 {
                for &(k, sh) in &s.kinds {
                    if NEW_KINDS.contains(&(k as usize)) && sh >= 0.2 {
                        if !s.announced.contains(&k) {
                            s.announced.push(k);
                            spread_ev.push(vec![s.name.clone(), KIND_KEYS[k as usize].to_string(), ((sh * 100.0).round() as u32).to_string()]);
                        }
                        ach.push("newPart");
                    }
                }
                if s.fin > 0.4 {
                    ach.push("swim");
                }
                if s.ord_share.max(1.0 - s.ord_share) > 0.8 && self.sentences > 20 {
                    ach.push("grammar");
                }
            }
        }
        for p in spread_ev {
            self.event("ev.spread", p);
        }
        for a in ach {
            self.achieve(a);
        }
    }

    pub fn elect(&mut self, si: usize) {
        let sid = self.species[si].id;
        let members: Vec<usize> = (0..self.creatures.len()).filter(|&i| self.creatures[i].sp == sid && !self.creatures[i].dead).collect();
        let mut cand: Vec<(usize, f32)> = members
            .iter()
            .copied()
            .filter(|&i| {
                let c = &self.creatures[i];
                c.mature() && (c.age as f32) < c.g.tr[T_LIFE]
            })
            .map(|i| (i, boss_score(&self.creatures[i]).0))
            .collect();
        cand.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        cand.truncate(5);
        if cand.is_empty() {
            self.species[si].boss_id = 0;
            return;
        }
        let mut votes = vec![0u32; cand.len()];
        for &m in &members {
            let mc = &self.creatures[m];
            let mut best = 0;
            let mut bv = -1.0;
            for (k, &(ci, total)) in cand.iter().enumerate() {
                let c = &self.creatures[ci];
                let d = ((c.x - mc.x).powi(2) + (c.y - mc.y).powi(2)).sqrt();
                let v = total / (1.0 + d / 500.0) * (1.0 - morph_dist(&mc.morph, &c.morph));
                if v > bv {
                    bv = v;
                    best = k;
                }
            }
            votes[best] += 1;
        }
        let mut win = 0;
        for k in 1..cand.len() {
            if votes[k] > votes[win] || (votes[k] == votes[win] && cand[k].1 > cand[win].1) {
                win = k;
            }
        }
        let (wi, total) = cand[win];
        let (wid, wname, wmorph, whue) = {
            let c = &self.creatures[wi];
            (c.id, c.name.clone(), c.morph.clone(), c.g.hue)
        };
        let n_members = members.len() as u32;
        if self.species[si].boss_id != wid {
            self.species[si].boss_since = self.t;
            self.boss_changes += 1;
            self.achieve("boss");
            if n_members >= 5 {
                let p = vec![self.species[si].name.clone(), wname, wid.to_string(), votes[win].to_string(), n_members.to_string()];
                self.event("ev.boss", p);
            }
        }
        let s = &mut self.species[si];
        s.boss_id = wid;
        s.score = total;
        s.votes = votes[win];
        s.voters = n_members;
        s.rep = wmorph;
        s.hue = whue;
    }

    /* ---------------- actions by people ---------------- */

    pub fn find_creature(&self, x: f32, y: f32, r: f32) -> Option<usize> {
        let mut best = None;
        let mut bd = f32::INFINITY;
        for (i, c) in self.creatures.iter().enumerate() {
            let d = ((c.x - x).powi(2) + (c.y - y).powi(2)).sqrt();
            if d < c.size() + r && d < bd {
                bd = d;
                best = Some(i);
            }
        }
        best
    }

    pub fn stroke(&mut self, i: usize, sign: f32) {
        let t = self.t;
        let c = &mut self.creatures[i];
        c.ext_reward += if sign > 0.0 { 1.5 } else { -1.5 };
        if sign > 0.0 {
            c.horm[1] = (c.horm[1] + 0.4).min(1.0);
            c.d[3] = (c.d[3] - 0.1).max(0.0);
        } else {
            c.horm[2] = (c.horm[2] + 0.08).min(1.0);
            c.fear = c.fear.max(0.3);
            c.asleep = false;
        }
        let _ = t;
        let (x, y) = (c.x, c.y);
        self.strokes += 1;
        self.body_bubble(x, y, if sign > 0.0 { "b.like" } else { "b.ouch" });
    }

    pub fn teach(&mut self, tokens: &[String], x: f32, y: f32) -> u32 {
        if tokens.is_empty() {
            return 0;
        }
        let target_c = self.find_creature(x, y, 14.0);
        let mut kind = 0u8;
        let (tx, ty, tsize, tcarn, tmorph, tweap) = if let Some(i) = target_c {
            let c = &self.creatures[i];
            (c.x, c.y, c.size(), c.carn(), Some(c.morph.clone()), c.ab.ab[A_WEAPON])
        } else {
            let mut td = 30.0;
            let mut found = None;
            for f in &self.foods {
                if f.e <= 0.0 {
                    continue;
                }
                let d = ((f.x - x).powi(2) + (f.y - y).powi(2)).sqrt();
                if d < td {
                    td = d;
                    found = Some((f.x, f.y, f.meat));
                }
            }
            match found {
                None => return 0,
                Some((fx, fy, meat)) => {
                    kind = if meat { 2 } else { 1 };
                    (fx, fy, 0.0, false, None, 0.0)
                }
            }
        };
        let word = tokens[0].clone();
        let mut n = 0;
        let water = BIOMES[self.bio_at(tx, ty)].water > 0;
        for (li, l) in self.creatures.iter_mut().enumerate() {
            if Some(li) == target_c || l.asleep || self.knock[K_LANG] {
                continue;
            }
            if ((l.x - tx).powi(2) + (l.y - ty).powi(2)).sqrt() > HEAR {
                continue;
            }
            let mut f = [0.0; FD];
            match kind {
                1 => f[1] = 0.9 * (1.0 - l.g.tr[T_DIET]),
                2 => f[1] = 0.9 * l.g.tr[T_DIET],
                _ => {
                    let md = morph_dist(&l.morph, tmorph.as_ref().unwrap());
                    let threat = (tcarn && if l.carn() { tsize > l.size() * 1.2 } else { tsize > l.size() * 0.6 }) || tweap > l.ab.ab[A_WEAPON] + 0.3;
                    if threat {
                        f[0] = 0.9;
                    } else if l.carn() && !tcarn {
                        f[2] = 0.9;
                    } else if md < MATE_TH {
                        f[3] = 0.9;
                    } else {
                        f[4] = 0.9;
                    }
                }
            }
            if water {
                f[8] = f[8].max(0.6);
            }
            if f.iter().cloned().fold(0.0, f32::max) < 0.3 {
                continue;
            }
            let k = l.categorize(&f, true);
            if k >= 0 {
                l.lex.reinforce(&word, k, 0.25);
                n += 1;
            }
        }
        self.taught_n += 1;
        let u = Utt { x: tx, y: ty, tokens: tokens.to_vec(), sector: -1, ..Default::default() };
        self.say(u, None);
        n
    }

    pub fn drop_food(&mut self, x: f32, y: f32) {
        let b = self.bio_at(x, y);
        for _ in 0..8 {
            let fx = clamp(x + self.rng.gauss() * 15.0, 2.0, WORLD_W - 2.0);
            let fy = clamp(y + self.rng.gauss() * 15.0, 2.0, WORLD_H - 2.0);
            self.add_food(fx, fy, BIOMES[b].food, false, b as u8);
        }
        self.rebuild_food_grid();
    }

    pub fn toggle_mirror(&mut self, x: f32, y: f32) -> &'static str {
        if let Some(i) = self.mirrors.iter().position(|m| ((m[0] - x).powi(2) + (m[1] - y).powi(2)).sqrt() < 50.0) {
            self.mirrors.remove(i);
            return "removed";
        }
        if self.mirrors.len() >= MAX_MIRRORS {
            return "full";
        }
        self.mirrors.push([x, y]);
        self.event("ev.mirrorSet", vec![]);
        "placed"
    }

    pub fn adopt(&mut self, id: u32, on: Option<bool>, name: Option<&str>) {
        let t = self.t;
        let count = self.creatures.iter().filter(|c| c.adopted).count();
        let i = match self.creatures.iter().position(|c| c.id == id) {
            Some(i) => i,
            None => return,
        };
        if let Some(n) = name {
            let n = clean_name(n);
            if !n.is_empty() {
                self.creatures[i].name = n.clone();
                if let Ok(li) = self.lineage.binary_search_by_key(&id, |r| r.id) {
                    self.lineage[li].n = n;
                }
            }
        }
        if let Some(on) = on {
            let c = &mut self.creatures[i];
            if on && !c.adopted && count >= 10 {
                return;
            }
            if on != c.adopted {
                c.adopted = on;
                c.note(t, if on { "d.adopted" } else { "d.released" }, "");
            }
        }
    }

    /* ---------------- the step ---------------- */

    pub fn step(&mut self) {
        self.t += 1;
        self.update_season();
        self.speech = std::mem::take(&mut self.speech_next);
        for _ in 0..PLANT_TRIES {
            if self.plants < PLANT_MAX {
                self.grow_plant(false);
            }
        }
        {
            let mut g = std::mem::take(&mut self.grid);
            g.build(self.creatures.iter().map(|c| (c.x, c.y)));
            self.grid = g;
        }
        self.id_idx.clear();
        for (i, c) in self.creatures.iter().enumerate() {
            self.id_idx.insert(c.id, i);
        }
        self.boss_of.clear();
        for s in &self.species {
            if s.boss_id != 0 {
                self.boss_of.insert(s.id, s.boss_id);
            }
        }
        for i in 0..self.creatures.len() {
            if self.creatures[i].dead {
                continue;
            }
            let mut c = std::mem::take(&mut self.creatures[i]);
            self.creatures[i].dead = true;
            crate::sim::update(self, &mut c, i);
            self.creatures[i] = c;
        }
        self.creatures.retain(|c| !c.dead);
        self.flush();
        self.id_idx.clear();
        for (i, c) in self.creatures.iter().enumerate() {
            self.id_idx.insert(c.id, i);
        }
        let mut lost = Vec::new();
        for (si, s) in self.species.iter().enumerate() {
            if s.boss_id != 0 && !self.id_idx.contains_key(&s.boss_id) {
                lost.push((si, s.boss_id));
            }
        }
        for (si, bid) in lost {
            let (sname, n) = (self.species[si].name.clone(), self.species[si].n);
            let rec = self.lineage_get(bid).map(|r| (r.n.clone(), r.c.clone()));
            if n >= 5 {
                if let Some((bn, cause)) = rec {
                    self.event("ev.bossDied", vec![sname, bn, cause]);
                }
            }
            self.species[si].boss_id = 0;
            self.elect(si);
        }
        if self.t % 5 == 0 {
            let t = self.t;
            let mut rot: Vec<(f32, f32, f32)> = Vec::new();
            let mut fert: Vec<(f32, f32)> = Vec::new();
            for f in self.foods.iter_mut() {
                if f.meat && t - f.born > MEAT_DECAY && f.e > 0.5 {
                    rot.push((f.x, f.y, f.e * 0.5));
                    f.e = 0.0;
                } else if f.det && t - f.born > DET_DECAY && f.e > 0.5 {
                    fert.push((f.x, f.y));
                    f.e = 0.0;
                }
            }
            self.foods.retain(|f| f.e > 0.5);
            self.plants = self.foods.iter().filter(|f| !f.meat && !f.det).count();
            self.dets = self.foods.iter().filter(|f| f.det).count();
            for (x, y, e) in rot {
                self.add_det(x, y, e);
            }
            for (x, y) in fert {
                let b = self.bio_at(x, y);
                if BIOMES[b].growth > 0.0 && BIOMES[b].water == 0 {
                    for _ in 0..2 {
                        let px = clamp(x + self.rng.gauss() * 6.0, 2.0, WORLD_W - 2.0);
                        let py = clamp(y + self.rng.gauss() * 6.0, 2.0, WORLD_H - 2.0);
                        self.add_food(px, py, BIOMES[b].food * 1.4, false, b as u8);
                    }
                    self.fert += 1;
                }
            }
            self.rebuild_food_grid();
            for c in self.creatures.iter_mut() {
                c.cf = -1;
            }
        }
        let carn = self.creatures.iter().filter(|c| c.carn()).count();
        let herb = self.creatures.len() - carn;
        if herb < MIN_HERB {
            self.spawn(false);
        }
        if carn < MIN_CARN {
            self.spawn(true);
        }
        self.flush();
        if self.t % 300 == 0 {
            self.classify();
            for si in 0..self.species.len() {
                self.elect(si);
            }
            metrics::record_series(self);
        }
        if self.t % 600 == 0 {
            self.rate = if self.hw > 0 { self.uw as f32 / self.hw as f32 } else { 0.0 };
            if self.rate > 0.5 && self.hw > 50 {
                self.achieve("understand");
            }
            self.hw = 0;
            self.uw = 0;
        }
        if self.max_gen >= 10 {
            self.achieve("gen10");
        }
        if self.t >= 5 * YEAR_LEN {
            self.achieve("year5");
        }
        if self.t % 30 == 0 {
            let wb: f32 = self.creatures.iter().map(|c| c.wellbeing).sum();
            let n = self.creatures.len().max(1) as f32;
            self.hist.push([herb as f32, carn as f32, wb / n]);
            if self.hist.len() > 300 {
                self.hist.remove(0);
            }
        }
        if self.bubbles.len() > 200 {
            let n = self.bubbles.len() - 200;
            self.bubbles.drain(0..n);
        }
    }

    pub fn fresh_culture_of(&self, c: &Creature) -> Culture {
        fresh_culture(c)
    }

    pub fn day_of(t: u32) -> (u32, u32) {
        (t / YEAR_LEN + 1, (t % YEAR_LEN) / DAY_LEN + 1)
    }

    pub fn season_key(&self) -> &'static str {
        let p = (self.t % YEAR_LEN) as f32 / YEAR_LEN as f32;
        ["spring", "summer", "autumn", "winter"][(((p + 0.125) % 1.0) * 4.0) as usize % 4]
    }
}

pub fn boss_score(c: &Creature) -> (f32, [f32; 6]) {
    let g = &c.g;
    let named = (0..MAX_PROTO).filter(|&k| c.protos[k].is_some() && c.lex.best(k).is_some()).count();
    let parts = [
        (c.age as f32 / (g.tr[T_LIFE] * 0.6)).min(1.0),
        clamp((c.size() / 12.0) * (c.health / 100.0) * (1.0 + c.ab.ab[A_WEAPON] + c.ab.ab[A_ARMOR]), 0.0, 1.5) / 1.5,
        (c.children as f32 / 8.0).min(1.0),
        if c.spoken > 0 { (2.0 * c.echoes as f32 / (c.spoken.max(5)) as f32).min(1.0) } else { 0.0 },
        named as f32 / MAX_PROTO as f32,
        c.wb_avg,
    ];
    let w = [0.2, 0.2, 0.18, 0.17, 0.13, 0.12];
    (parts.iter().zip(w.iter()).map(|(a, b)| a * b).sum(), parts)
}

pub fn life_criteria(c: &Creature, w: &World) -> ([bool; 7], [bool; 5], f32) {
    let k = &w.knock;
    let learned = c.net.learned();
    let mut kinds = [false; 10];
    for &q in &c.kinds {
        if (q as usize) != K_BUD {
            kinds[q as usize] = true;
        }
    }
    let nk = kinds.iter().filter(|&&b| b).count();
    let life = [
        !k[K_META] && (w.t as i64 - c.last_ate) < 3000,
        c.wb_avg > 0.55,
        c.age > 30 && !k[K_META],
        c.reacts > 0,
        c.children > 0,
        c.g.mutated,
        nk >= 2 && c.net.hidden >= 2,
    ];
    let mind = [
        !k[K_LEARN] && learned > 1.0,
        !k[K_SELF] && c.certainty() > 0.65 && (c.gut_events < 3 || c.gut_own > 0.5),
        c.heard_n >= 10 && c.understood as f32 / c.heard_n as f32 > 0.3,
        c.self_recog,
        c.cultural_use,
    ];
    (life, mind, learned)
}

pub fn new_child(w: &mut World, parent: &mut Creature, mate: Option<usize>) -> Creature {
    let pg = parent.inherit_genome();
    let base = match mate {
        Some(mi) => {
            let mg = w.creatures[mi].g.clone();
            crossover(&pg, &mg, &mut w.rng)
        }
        None => pg,
    };
    let st = parent.stress_info();
    let off = w.knock[K_MUT];
    let (cg, ev) = mutate(&base, &st, off, &mut w.rng, &mut w.innov);
    let mate_gen = mate.map(|m| w.creatures[m].gen).unwrap_or(0);
    let mate_id = mate.map(|m| w.creatures[m].id).unwrap_or(0);
    let id = w.next_id;
    w.next_id += 1;
    let x = clamp(parent.x + w.rng.range(-5.0, 5.0), 5.0, WORLD_W - 5.0);
    let y = clamp(parent.y + w.rng.range(-5.0, 5.0), 5.0, WORLD_H - 5.0);
    let culture = fresh_culture(parent);
    let mut child = Creature::new(id, x, y, cg, parent.gen.max(mate_gen) + 1, Some(culture), (parent.id, mate_id), &mut w.rng);
    child.sp = parent.sp;
    let visible: Vec<(String, String)> = ev.iter().filter(|e| e.0 != "mut.neuron").map(|e| (e.0.to_string(), e.1.clone())).collect();
    if ev.iter().any(|e| e.0 == "mut.neuron") {
        w.neurons_n += 1;
    }
    if !visible.is_empty() {
        child.mutation = visible.clone();
        w.macro_n += 1;
        let enc: Vec<String> = visible.iter().map(|(k, p)| format!("{}:{}", k, p)).collect();
        w.event("ev.mut", vec![child.name.clone(), child.id.to_string(), enc.join("|")]);
    }
    child
}
