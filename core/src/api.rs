//! Interface for the web worker (WebAssembly exports with a small C ABI) and for native use.
//! Text goes in and out as UTF-8 JSON, frame data as f32 buffers.
use crate::consts::*;
use crate::metrics::{self, Lab};
use crate::util::*;
use crate::world::*;
use serde_json::{json, Value};
use std::cell::RefCell;

pub const CS_STRIDE: usize = 91;
pub const FOOD_STRIDE: usize = 6;

#[derive(Default)]
struct State {
    world: Option<World>,
    lab: Option<Lab>,
    out: Vec<u8>,
    buf: [Vec<f32>; 2],
    away: Option<(u32, u32, u32, usize, usize)>,
}

thread_local! {
    static ST: RefCell<State> = RefCell::new(State::default());
}

fn deaths_total(w: &World) -> u32 {
    w.deaths.values().sum()
}

/* ---------------- frame ---------------- */

pub fn frame(w: &mut World, x0: f32, y0: f32, x1: f32, y1: f32, wpp: f32, sel: u32, cs: &mut Vec<f32>, fd: &mut Vec<f32>) -> String {
    cs.clear();
    fd.clear();
    let m = 60.0;
    let detail = wpp < 5.0;
    let bosses: Vec<u32> = w.species.iter().map(|s| s.boss_id).filter(|&b| b != 0).collect();
    let mut sel_found = false;
    for c in &w.creatures {
        let vis = c.x > x0 - m && c.x < x1 + m && c.y > y0 - m && c.y < y1 + m;
        if !vis && c.id != sel {
            continue;
        }
        if c.id == sel {
            sel_found = true;
        }
        let start = cs.len();
        cs.resize(start + CS_STRIDE, 0.0);
        fill_rec(c, &bosses, detail, &mut cs[start..start + CS_STRIDE]);
    }
    for f in &w.foods {
        if f.e > 0.0 && f.x > x0 - 10.0 && f.x < x1 + 10.0 && f.y > y0 - 10.0 && f.y < y1 + 10.0 {
            fd.extend_from_slice(&[f.x, f.y, f.e, if f.det { 2.0 } else if f.meat { 1.0 } else { 0.0 }, f.k as f32, (w.t - f.born) as f32]);
        }
    }
    for k in &w.caches {
        if k.x > x0 - 10.0 && k.x < x1 + 10.0 && k.y > y0 - 10.0 && k.y < y1 + 10.0 {
            fd.extend_from_slice(&[k.x, k.y, k.e, 3.0, 0.0, 0.0]);
        }
    }
    let bub: Vec<Value> = w
        .bubbles
        .iter()
        .filter(|b| b.x > x0 - 100.0 && b.x < x1 + 100.0 && b.y > y0 - 100.0 && b.y < y1 + 100.0)
        .rev()
        .take(40)
        .map(|b| json!({"x": b.x, "y": b.y, "text": b.text, "kind": b.kind}))
        .collect();
    w.bubbles.clear();
    json!({"t": w.t, "sf": w.sf, "night": w.night, "frozen": w.frozen, "mirrors": w.mirrors, "bub": bub, "sel": sel_found}).to_string()
}

pub const TERRA_MAX: usize = 8;

pub fn terra_json(c: &crate::creature::Creature) -> Value {
    let mut r = vec![0.0f32; CS_STRIDE];
    fill_rec(c, &[], true, &mut r);
    let rv: Vec<f32> = r.iter().map(|x| if x.is_finite() { *x } else { 0.0 }).collect();
    let (l, ch) = (c.g.tr[T_LIFE], c.g.tr[T_CHILD]);
    json!({"ok": true, "id": c.id, "name": c.name, "gen": c.gen, "children": c.children, "p1": c.p1, "p2": c.p2, "rec": rv, "growth": (c.age as f32 / (l * ch)).min(1.0), "words": c.lex.m.len(), "learn": c.g.tr[T_LEARN], "cur": c.g.tr[T_CUR], "soc": c.g.soc})
}

pub fn fill_rec(c: &crate::creature::Creature, bosses: &[u32], detail: bool, r: &mut [f32]) {
    r[0] = c.id as f32;
    r[1] = c.x;
    r[2] = c.y;
    r[3] = c.dir;
    r[4] = c.size();
    r[5] = c.g.hue;
    r[6] = if c.carn() { 1.0 } else { 0.0 };
    r[7] = c.health;
    r[8] = c.g.tr[T_PAT].floor();
    r[9] = if c.fly { 1.0 } else { 0.0 };
    r[10] = c.fear;
    r[11] = if c.speak_cool + 8 > SPEAK_COOL { 1.0 } else { 0.0 };
    r[12] = if c.asleep { 1.0 } else { 0.0 };
    r[13] = c.wellbeing;
    r[14] = if bosses.contains(&c.id) { 1.0 } else { 0.0 };
    r[15] = if c.mature() { 0.0 } else { 1.0 - (c.age as f32 / (c.g.tr[T_LIFE] * c.g.tr[T_CHILD])).min(1.0) };
    r[16] = c.sense_r;
    r[17] = if c.adopted { 1.0 } else { 0.0 };
    r[18] = c.v;
    r[20..25].copy_from_slice(&c.g.shape);
    r[25] = if c.mature() { 0.0 } else { 1.0 };
    r[90] = c.actv as f32;
    for (i, v) in crate::genome::look_pheno(&c.g).iter().enumerate() {
        r[82 + i] = *v as f32;
    }
    if detail {
        let n = c.pp.len().min(MAX_PARTS);
        r[19] = n as f32;
        for (i, q) in c.pp.iter().take(n).enumerate() {
            let b = 26 + i * 7;
            r[b] = q.a;
            r[b + 1] = if q.sym { 1.0 } else { 0.0 };
            r[b + 2] = q.p[P_LEN];
            r[b + 3] = q.p[P_WID];
            r[b + 4] = q.p[P_MOT];
            r[b + 5] = c.kinds[i] as f32;
            r[b + 6] = q.p[P_COL];
        }
    }
}

/* ---------------- panel ---------------- */

fn lang_stats(w: &World) -> (Vec<Value>, Vec<Value>, usize) {
    let pop = w.creatures.len().max(1) as f32;
    let mut what: Vec<(String, u32, [f32; FD])> = Vec::new();
    let mut whr: Vec<(String, u32, [u32; 8])> = Vec::new();
    for c in &w.creatures {
        for (word, _) in &c.lex.m {
            let (k, s) = c.lex.top(word);
            if s < 0.3 || k < 0 {
                continue;
            }
            if let Some(p) = &c.protos[k as usize] {
                match what.iter_mut().find(|e| e.0 == *word) {
                    Some(e) => {
                        e.1 += 1;
                        for i in 0..FD {
                            e.2[i] += p.v[i];
                        }
                    }
                    None => what.push((word.clone(), 1, p.v)),
                }
            }
        }
        for (word, _) in &c.dlex.m {
            let (k, s) = c.dlex.top(word);
            if s < 0.3 || k < 0 {
                continue;
            }
            match whr.iter_mut().find(|e| e.0 == *word) {
                Some(e) => {
                    e.1 += 1;
                    e.2[k as usize] += 1;
                }
                None => {
                    let mut sec = [0u32; 8];
                    sec[k as usize] = 1;
                    whr.push((word.clone(), 1, sec));
                }
            }
        }
    }
    let total = what.len() + whr.len();
    what.sort_by(|a, b| b.1.cmp(&a.1));
    whr.sort_by(|a, b| b.1.cmp(&a.1));
    let wv = what
        .iter()
        .take(10)
        .map(|(word, n, v)| {
            let avg: Vec<f32> = v.iter().map(|x| r3(x / *n as f32)).collect();
            json!([word, *n as f32 / pop, avg])
        })
        .collect();
    let dv = whr
        .iter()
        .take(8)
        .map(|(word, n, sec)| {
            let mut k = 0;
            for i in 1..8 {
                if sec[i] > sec[k] {
                    k = i;
                }
            }
            json!([word, *n as f32 / pop, k])
        })
        .collect();
    (wv, dv, total)
}

fn lang_map(w: &World) -> Value {
    const GC: usize = 8;
    const GR: usize = 5;
    let mut cells: Vec<Vec<(String, u32)>> = vec![Vec::new(); GC * GR];
    for c in &w.creatures {
        let mut best: Option<(f32, String)> = None;
        for (word, _) in &c.lex.m {
            let (k, s) = c.lex.top(word);
            if s < 0.3 || k < 0 {
                continue;
            }
            if let Some(p) = &c.protos[k as usize] {
                if p.v[0] > 0.4 && best.as_ref().map(|b| p.v[0] > b.0).unwrap_or(true) {
                    best = Some((p.v[0], word.clone()));
                }
            }
        }
        if let Some((_, word)) = best {
            let cx = ((c.x / WORLD_W * GC as f32) as usize).min(GC - 1);
            let cy = ((c.y / WORLD_H * GR as f32) as usize).min(GR - 1);
            let cell = &mut cells[cy * GC + cx];
            match cell.iter_mut().find(|e| e.0 == word) {
                Some(e) => e.1 += 1,
                None => cell.push((word, 1)),
            }
        }
    }
    let out: Vec<Value> = cells
        .iter()
        .map(|cell| {
            let n: u32 = cell.iter().map(|e| e.1).sum();
            if n < 3 {
                return Value::Null;
            }
            let top = cell.iter().max_by(|a, b| a.1.cmp(&b.1).then(b.0.cmp(&a.0))).unwrap();
            json!([top.0, r3(top.1 as f32 / n as f32), n])
        })
        .collect();
    json!({"cols": GC, "rows": GR, "cells": out})
}

fn brain_graph(c: &crate::creature::Creature) -> Value {
    let net = &c.net;
    let mut used = vec![false; net.n];
    for (oi, &node) in net.order.iter().enumerate() {
        let (a, b) = (net.start[oi] as usize, net.start[oi + 1] as usize);
        if b > a {
            used[node as usize] = true;
        }
        for ci in a..b {
            used[net.src[ci] as usize] = true;
        }
    }
    let base = NIN + NOUT;
    let mut nodes = Vec::new();
    for i in 0..net.n {
        if !used[i] && i < base {
            continue;
        }
        let kind = if i < NIN { "in" } else if i < base { "out" } else { "hid" };
        let d = if i < NIN { 0.0 } else if i < base { 1.0 } else { c.g.nodes.get(i - base).map(|q| q.d).unwrap_or(0.5) };
        nodes.push(json!({"i": i, "k": kind, "d": d, "v": r3(net.vals[i])}));
    }
    let mut conns = Vec::new();
    for (oi, &node) in net.order.iter().enumerate() {
        for ci in net.start[oi] as usize..net.start[oi + 1] as usize {
            conns.push(json!([net.src[ci], node, r3(net.w[ci])]));
        }
    }
    json!({"nodes": nodes, "conns": conns})
}

pub fn panel(w: &World, sel: u32) -> String {
    let cs = &w.creatures;
    let n = cs.len().max(1) as f32;
    let carn = cs.iter().filter(|c| c.carn()).count();
    let avg = |f: &dyn Fn(&crate::creature::Creature) -> f32| cs.iter().map(f).sum::<f32>() / n;
    let (what, whr, words) = lang_stats(w);
    let (year, day) = World::day_of(w.t);
    let goals: Vec<Value> = MILESTONES.iter().map(|k| json!([k, w.milestones.get(*k)])).collect();
    let species: Vec<Value> = {
        let mut v: Vec<&Species> = w.species.iter().filter(|s| s.n >= 3).collect();
        v.sort_by(|a, b| b.n.cmp(&a.n));
        v.iter()
            .take(10)
            .map(|s| {
                let boss = w.id_idx_get(s.boss_id).map(|i| json!({"id": cs[i].id, "name": cs[i].name}));
                let kinds: Vec<Value> = s.kinds.iter().filter(|q| q.1 >= 0.2 && q.0 as usize != K_BUD).take(4).map(|q| json!([KIND_KEYS[q.0 as usize], q.1])).collect();
                json!({"id": s.id, "name": s.name, "n": s.n, "hue": s.hue, "carn": s.carn, "boss": boss, "why": s.boss_why, "trig": s.boss_trig, "score": s.score, "votes": s.votes, "voters": s.voters, "kinds": kinds, "ord": s.ord_share})
            })
            .collect()
    };
    let phylo: Vec<Value> = w.phylo.iter().filter(|r| r.max_n >= 3).map(|r| json!({"id": r.id, "name": r.name, "parent": r.parent, "born": r.born, "died": r.died, "carn": r.carn, "hue": r.hue, "maxN": r.max_n})).collect();
    let events: Vec<Value> = w.events.iter().rev().take(40).map(|e| json!([World::day_of(e.t), e.k, e.p, e.t])).collect();
    let log: Vec<Value> = w.log.iter().rev().take(16).map(|e| json!({"words": e.words, "id": e.id, "name": e.name, "carn": e.carn, "vec": e.vec, "sector": e.sector})).collect();
    let adopted: Vec<Value> = cs.iter().filter(|c| c.adopted).map(|c| json!({"id": c.id, "name": c.name, "phase": c.phase(), "wb": c.wellbeing, "goal": c.goal, "asleep": c.asleep})).collect();
    let released: Vec<Value> = cs.iter().filter(|c| c.released && !c.adopted && c.owner == w.viewer).map(|c| json!({"id": c.id, "name": c.name, "phase": c.phase(), "wb": c.wellbeing, "goal": c.goal, "asleep": c.asleep, "kids": c.children, "gen": c.gen})).collect();
    let memorial: Vec<Value> = w.memorial.iter().rev().take(8).map(|m| json!({"name": m.name, "cause": m.cause, "died": World::day_of(m.died), "children": m.children})).collect();
    let mut mini: Vec<f32> = Vec::with_capacity(cs.len() * 3);
    let bosses: Vec<u32> = w.species.iter().map(|s| s.boss_id).collect();
    for c in cs {
        let tp = if bosses.contains(&c.id) { 3.0 } else if c.adopted { 4.0 } else if c.carn() { 1.0 } else if c.fly { 2.0 } else { 0.0 };
        mini.extend_from_slice(&[c.x.round(), c.y.round(), tp]);
    }
    let gut: Vec<&crate::creature::Creature> = cs.iter().filter(|c| c.gut_events >= 3).collect();
    let gut_own = if gut.is_empty() { 0.0 } else { gut.iter().map(|c| c.gut_own).sum::<f32>() / gut.len() as f32 };
    let research = json!({
        "life": w.life_share.as_ref().map(|l| l.0.clone()), "mind": w.life_share.as_ref().map(|l| l.1.clone()),
        "knock": w.knock, "firstKinds": w.first_kinds.iter().map(|(k, t)| json!([KIND_KEYS[*k as usize], World::day_of(*t)])).collect::<Vec<_>>(),
        "mirrorTests": w.mirror_tests, "mirrorPass": w.mirror_pass, "mirrors": w.mirrors.len(), "last": w.series.last(),
        "nSeries": w.series.len(), "gutOwn": gut_own, "strokes": w.strokes, "taught": w.taught_n,
        "bedau": {"diversity": w.bedau.diversity, "mean": w.bedau.mean, "new": w.bedau.new_n}
    });
    let sel_v = match w.id_idx_get(sel) {
        None => Value::Null,
        Some(i) => sel_json(w, i),
    };
    json!({
        "t": w.t, "day": [year, day], "season": w.season_key(), "frozen": w.frozen, "night": w.night > 0.5, "seed": w.seed, "wev": [w.wev, w.wev_end.saturating_sub(w.t), cs.iter().filter(|c| c.sick > 0).count()],
        "pop": cs.len(), "spCount": w.species.iter().filter(|s| s.n >= 5).count(),
        "goals": goals,
        "stats": {"herb": cs.len() - carn, "carn": carn, "plants": w.plants, "dets": w.dets, "fert": w.fert, "gen": w.max_gen, "wb": avg(&|c| c.wellbeing),
            "neurons": avg(&|c| c.net.hidden as f32), "conns": avg(&|c| c.net.w.len() as f32), "cert": avg(&|c| c.certainty()),
            "parts": avg(&|c| c.pp.len() as f32), "rate": w.rate, "sentences": w.sentences, "births": w.births, "deaths": w.deaths,
            "macro": w.macro_n, "neuronsN": w.neurons_n, "bossChanges": w.boss_changes, "asleep": cs.iter().filter(|c| c.asleep).count(), "words": words,
            "cache": [w.caches.len(), w.cache_dep, w.cache_ret, cs.iter().filter(|c| c.cdep > 0).count()],
            "react": [w.rx_n, w.rx_hit, w.rc_n, w.rc_hit],
            "speaker": w.id_idx_get(w.spk_id).map(|i| json!({"id": cs[i].id, "name": cs[i].name, "why": w.spk_why, "since": World::day_of(w.spk_since), "last": w.spk_log.last().map(|x| x.1.clone())})),
            "tri": [w.tri_say, w.tri_n, w.tri_ok],
            "acts": (0..9usize).map(|k| cs.iter().filter(|c| c.actv as usize == k).count()).collect::<Vec<_>>()},
        "hist": &w.hist[w.hist.len().saturating_sub(170)..],
        "lang": {"what": what, "where": whr, "map": lang_map(w),
            "wod": w.wod.as_ref().map(|d| json!({"word": d.word, "day": d.day, "n": d.n, "speakers": d.speakers, "cert": r3((1.0 - d.spread / 0.5).clamp(0.0, 1.0)), "vec": d.vec.iter().map(|x| r3(*x)).collect::<Vec<_>>()}))},
        "species": species, "phylo": phylo, "events": events, "log": log, "adopted": adopted, "released": released, "memorial": memorial,
        "research": research, "mini": mini, "sel": sel_v
    })
    .to_string()
}

fn sel_json(w: &World, i: usize) -> Value {
    let s = &w.creatures[i];
    let g = &s.g;
    let sp = w.species.iter().find(|q| q.id == s.sp);
    let (lc, mc, learned) = life_criteria(s, w);
    let (btotal, bparts) = boss_score(s);
    let mut kc: Vec<(usize, u32)> = Vec::new();
    for (j, q) in s.pp.iter().enumerate() {
        let k = s.kinds[j] as usize;
        let add = if q.sym { 2 } else { 1 };
        match kc.iter_mut().find(|e| e.0 == k) {
            Some(e) => e.1 += add,
            None => kc.push((k, add)),
        }
    }
    let vocab: Vec<Value> = (0..MAX_PROTO)
        .filter_map(|k| {
            let p = s.protos[k].as_ref()?;
            let word = s.lex.best(k)?;
            Some(json!([word, p.v.iter().map(|x| r3(*x)).collect::<Vec<_>>()]))
        })
        .collect();
    let fam = |id: u32| -> Value {
        if id == 0 {
            return Value::Null;
        }
        match w.id_idx_get(id) {
            Some(j) => json!({"id": id, "name": w.creatures[j].name, "alive": true}),
            None => match w.lineage_get(id) {
                Some(r) => json!({"id": id, "name": r.n, "alive": false, "cause": r.c}),
                None => Value::Null,
            },
        }
    };
    fn anc(w: &World, id: u32, d: u32) -> Value {
        if id == 0 || d == 0 {
            return Value::Null;
        }
        if let Some(j) = w.id_idx_get(id) {
            let c = &w.creatures[j];
            return json!({"id": id, "name": c.name, "alive": true, "p": [anc(w, c.p1, d - 1), anc(w, c.p2, d - 1)]});
        }
        match w.lineage_get(id) {
            Some(r) => json!({"id": id, "name": r.n, "alive": false, "p": [anc(w, r.p1, d - 1), anc(w, r.p2, d - 1)]}),
            None => Value::Null,
        }
    }
    let desc_n = {
        let mut seen: std::collections::HashSet<u32> = std::collections::HashSet::new();
        let mut front = vec![s.id];
        for _ in 0..8 {
            let mut next = Vec::new();
            for r in &w.lineage {
                if (front.contains(&r.p1) || front.contains(&r.p2)) && seen.insert(r.id) {
                    next.push(r.id);
                }
            }
            if next.is_empty() {
                break;
            }
            front = next;
        }
        seen.len()
    };
    let kids: Vec<Value> = w.lineage.iter().filter(|r| r.p1 == s.id || r.p2 == s.id).take(14).map(|r| json!({"id": r.id, "name": r.n, "alive": w.id_idx_get(r.id).is_some()})).collect();
    let abil: Vec<Value> = (0..NABIL).filter(|&k| s.ab.ab[k] > 0.05).map(|k| json!([KIND_KEYS[k], s.ab.ab[k]])).collect();
    let heard = s.heard.as_ref().map(|h| json!({"words": h.words, "vec": h.vec, "where": h.wa.map(sector_of)}));
    let phi = metrics::phi_gauss(s, 8);
    let lz = metrics::lz_complexity(s);
    let sp_boss_since = sp.map(|q| q.boss_since).unwrap_or(0);
    json!({
        "id": s.id, "name": s.name, "adopted": s.adopted, "sp": sp.map(|q| q.name.clone()), "carn": s.carn(), "phase": s.phase(), "gen": s.gen,
        "age": s.age, "life": g.tr[T_LIFE].round(), "energy": s.energy, "maxE": s.max_e(), "health": s.health, "biome": w.bio_at(s.x, s.y),
        "asleep": s.asleep, "dream": s.last_dream, "goal": s.goal, "D": s.d, "dw": g.dw, "wb": s.wellbeing, "reward": s.reward_avg,
        "horm": s.horm, "tired": s.tired, "hidden": s.net.hidden, "conns": s.net.w.len(), "plast": g.tr[T_PLAST], "cert": s.certainty(),
        "surprise": s.surprise.min(1.0), "ext": s.ext_force, "gutEvents": s.gut_events, "gutOwn": s.gut_own, "learned": learned,
        "phi": phi, "lz": lz, "brain": brain_graph(s),
        "parts": kc.iter().map(|(k, n)| json!([KIND_KEYS[*k], n])).collect::<Vec<_>>(), "abil": abil, "fly": s.fly, "shape": g.shape,
        "look": {"ph": crate::genome::look_pheno(g), "al": g.look, "rarity": r3(crate::genome::look_rarity(g))},
        "size": s.size(), "sizeG": g.tr[T_SIZE], "speed": g.tr[T_SPEED], "sense": s.sense_r, "diet": g.tr[T_DIET], "mutation": s.mutation,
        "children": s.children, "kills": s.kills, "fear": s.fear, "focus": s.focus_f, "act": s.actv, "actc": s.actc, "protos": s.protos.iter().filter(|p| p.is_some()).count(),
        "lastSaid": s.last_said.as_ref().map(|l| json!({"tokens": l.tokens, "vec": l.vec, "sector": l.sector})), "heard": heard,
        "echoes": s.echoes, "spoken": s.spoken, "understood": s.understood, "heardN": s.heard_n, "order": s.order(), "vocab": vocab,
        "selfRecog": s.self_recog, "fe": r3(s.fe), "mirrorT": s.mirror_t, "isBoss": w.species.iter().any(|q| q.boss_id == s.id), "bossSince": sp_boss_since, "t": w.t,
        "boss": {"total": btotal, "parts": bparts}, "lifeC": lc, "mindC": mc,
        "parents": [fam(s.p1), fam(s.p2)], "kids": kids, "anc": [anc(w, s.p1, 3), anc(w, s.p2, 3)], "descN": desc_n,
        "diary": s.diary.iter().rev().take(30).map(|d| json!([World::day_of(d.t), d.k, d.p])).collect::<Vec<_>>()
    })
}

/* ---------------- commands ---------------- */

fn f(v: &Value, k: &str, a: f32, b: f32, def: f32) -> f32 {
    v.get(k).and_then(|x| x.as_f64()).map(|x| clamp(x as f32, a, b)).unwrap_or(def)
}

pub fn command(w: &mut World, v: &Value) -> Value {
    let typ = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
    match typ {
        "pick" => {
            let r = w.find_creature(f(v, "x", 0.0, WORLD_W, 0.0), f(v, "y", 0.0, WORLD_H, 0.0), f(v, "r", 4.0, 80.0, 10.0));
            json!({"sel": r.map(|i| w.creatures[i].id).unwrap_or(0)})
        }
        "action" => {
            let (x, y, r) = (f(v, "x", 0.0, WORLD_W, 0.0), f(v, "y", 0.0, WORLD_H, 0.0), f(v, "r", 4.0, 80.0, 10.0));
            let tokens: Vec<String> = v
                .get("tokens")
                .and_then(|t| t.as_array())
                .map(|a| a.iter().take(3).filter_map(|s| s.as_str()).map(clean_word).filter(|s| !s.is_empty()).collect())
                .unwrap_or_default();
            let tool = v.get("tool").and_then(|x| x.as_str()).unwrap_or("");
            let toast = match tool {
                "stroke" | "scold" => match w.find_creature(x, y, r) {
                    Some(i) => {
                        let name = w.creatures[i].name.clone();
                        w.stroke(i, if tool == "stroke" { 1.0 } else { -1.0 });
                        json!({"k": if tool == "stroke" { "t.stroke" } else { "t.scold" }, "p": [name]})
                    }
                    None => json!({"k": "t.miss", "p": []}),
                },
                "say" if !tokens.is_empty() => {
                    let u = Utt { x, y, tokens: tokens.clone(), sector: -1, mag: -1, ..Default::default() };
                    w.say(u, None);
                    json!({"k": "t.say", "p": [tokens.join(" ")]})
                }
                "teach" if !tokens.is_empty() => {
                    let n = w.teach(&tokens, x, y);
                    if n > 0 {
                        json!({"k": "t.teach", "p": [n, tokens[0]]})
                    } else {
                        json!({"k": "t.teachMiss", "p": []})
                    }
                }
                "food" => {
                    w.drop_food(x, y);
                    json!({"k": "t.food", "p": []})
                }
                "mirror" => {
                    let r = w.toggle_mirror(x, y);
                    json!({"k": "t.mirror", "p": [r]})
                }
                _ => json!({"k": "t.word", "p": []}),
            };
            json!({"toast": toast})
        }
        "adopt" => {
            let id = v.get("id").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            let on = v.get("on").and_then(|x| x.as_bool());
            let name = v.get("name").and_then(|x| x.as_str());
            w.adopt(id, on, name);
            json!({})
        }
        "take" => {
            let id = v.get("id").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            if w.terra.len() >= TERRA_MAX {
                return json!({"ok": false, "full": true});
            }
            match w.creatures.iter().position(|c| c.id == id) {
                Some(i) => {
                    let mut c = w.creatures.remove(i);
                    w.reindex();
                    if let Ok(li) = w.lineage.binary_search_by_key(&id, |r| r.id) {
                        w.lineage[li].c = "terrarium".to_string();
                    }
                    c.adopted = false;
                    c.asleep = false;
                    c.note(w.t, "d.toTerrarium", "");
                    let out = terra_json(&c);
                    w.terra.push(c);
                    w.event("ev.taken", vec![out["name"].as_str().unwrap_or("").to_string()]);
                    out
                }
                None => json!({"ok": false}),
            }
        }
        "move" => {
            let id = v.get("id").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            let (x, y) = (f(v, "x", 20.0, WORLD_W - 20.0, 0.0), f(v, "y", 20.0, WORLD_H - 20.0, 0.0));
            let maxd = f(v, "max", 0.0, 1.0e6, 1.0e6);
            let b = w.bio_at(x, y);
            if BIOMES[b].water != 0 {
                return json!({"ok": false, "water": true});
            }
            match w.creatures.iter().position(|c| c.id == id) {
                Some(i) => {
                    let (dx, dy) = (x - w.creatures[i].x, y - w.creatures[i].y);
                    let d = (dx * dx + dy * dy).sqrt();
                    if d > maxd {
                        return json!({"ok": false, "far": true, "d": d});
                    }
                    let t = w.t;
                    let c = &mut w.creatures[i];
                    c.x = x;
                    c.y = y;
                    c.fear = (c.fear + 0.2 + d / 4000.0).min(1.0);
                    c.cf = -1;
                    c.note(t, "d.carried", "");
                    w.reindex();
                    json!({"ok": true, "d": d})
                }
                None => json!({"ok": false}),
            }
        }
        "tlist" => json!({"list": w.terra.iter().map(terra_json).collect::<Vec<Value>>()}),
        "trename" => {
            let id = v.get("id").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            let n = clean_name(v.get("name").and_then(|x| x.as_str()).unwrap_or(""));
            if let (false, Some(c)) = (n.is_empty(), w.terra.iter_mut().find(|c| c.id == id)) {
                c.name = n;
            }
            json!({})
        }
        "tbreed" => {
            let ia = v.get("a").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            let ib = v.get("b").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            let pa = w.terra.iter().position(|c| c.id == ia);
            let pb = w.terra.iter().position(|c| c.id == ib);
            match (pa, pb) {
                (Some(i), Some(j)) if i != j && w.terra.len() < TERRA_MAX => {
                    let base = crate::genome::crossover(&w.terra[i].inherit_genome(), &w.terra[j].g, &mut w.rng);
                    let st = w.terra[i].stress_info();
                    let off = w.knock[K_MUT];
                    let (g, _) = crate::genome::mutate(&base, &st, off, &mut w.rng, &mut w.innov);
                    let culture = w.fresh_culture_of(&w.terra[i]);
                    let gen = w.terra[i].gen.max(w.terra[j].gen) + 1;
                    let id = w.next_id;
                    w.next_id += 1;
                    let mut c = crate::creature::Creature::new(id, 0.0, 0.0, g, gen, Some(culture), (ia, ib), &mut w.rng);
                    c.sp = w.terra[i].sp;
                    c.age = 0;
                    c.note(w.t, "d.bornTerrarium", "");
                    w.terra[i].children += 1;
                    w.terra[j].children += 1;
                    w.lineage.push(Lin { id, n: c.name.clone(), p1: ia, p2: ib, b: w.t, d: -1, c: String::new(), g: gen });
                    let out = terra_json(&c);
                    w.terra.push(c);
                    out
                }
                _ => json!({"ok": false}),
            }
        }
        "release" => {
            let id = v.get("id").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            match w.terra.iter().position(|c| c.id == id) {
                Some(i) => {
                    let mut c = w.terra.remove(i);
                    let growth = f(v, "growth", 0.0, 1.0, 1.0);
                    let full = c.g.tr[T_LIFE] * c.g.tr[T_CHILD];
                    c.age = if growth >= 0.999 { full as u32 + 2 } else { (growth * full) as u32 };
                    let (x, y) = w.random_land();
                    c.x = x;
                    c.y = y;
                    c.health = f(v, "hp", 20.0, 100.0, 100.0);
                    c.adopted = false;
                    c.released = true;
                    c.owner = w.viewer;
                    c.energy = c.max_e() * 0.8;
                    c.note(w.t, "d.fromTerrarium", "");
                    let nm = c.name.clone();
                    w.creatures.push(c);
                    w.reindex();
                    w.event("ev.released", vec![nm]);
                    json!({"ok": true, "id": id, "x": x, "y": y})
                }
                None => json!({"ok": false}),
            }
        }
        "tteach" => {
            let id = v.get("id").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            let word = clean_word(v.get("word").and_then(|x| x.as_str()).unwrap_or(""));
            let feat = v.get("feat").and_then(|x| x.as_u64()).unwrap_or(9).min(FD as u64 - 1) as usize;
            if word.is_empty() || w.knock[K_LANG] {
                return json!({"ok": false});
            }
            match w.terra.iter_mut().find(|c| c.id == id) {
                Some(c) => {
                    let mut f = [0.0; FD];
                    f[feat] = 0.9;
                    let k = c.categorize(&f, true);
                    if k >= 0 {
                        c.lex.reinforce(&word, k, 0.3);
                    }
                    w.taught_n += 1;
                    json!({"ok": k >= 0, "word": word, "words": c.lex.m.len()})
                }
                None => json!({"ok": false}),
            }
        }
        "tdie" => {
            let id = v.get("id").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            if let Some(i) = w.terra.iter().position(|c| c.id == id) {
                let c = w.terra.remove(i);
                if let Ok(li) = w.lineage.binary_search_by_key(&id, |r| r.id) {
                    w.lineage[li].d = w.t as i64;
                    w.lineage[li].c = v.get("cause").and_then(|x| x.as_str()).unwrap_or("terrarium").chars().take(16).collect();
                }
                w.archive_pub(&c);
            }
            json!({})
        }
        "knock" => {
            let key = v.get("key").and_then(|x| x.as_str()).unwrap_or("");
            if let Some(i) = KNOCKS.iter().position(|k| *k == key) {
                let on = v.get("v").and_then(|x| x.as_bool()).unwrap_or(false);
                w.knock[i] = on;
                w.event("ev.knock", vec![key.to_string(), if on { "1".into() } else { "0".into() }]);
            }
            json!({})
        }
        _ => json!({}),
    }
}

impl World {
    pub fn reindex(&mut self) {
        self.id_idx.clear();
        for (i, c) in self.creatures.iter().enumerate() {
            self.id_idx.insert(c.id, i);
        }
    }
    pub fn id_idx_get(&self, id: u32) -> Option<usize> {
        if id == 0 {
            return None;
        }
        match self.id_idx.get(&id) {
            Some(&i) if i < self.creatures.len() && self.creatures[i].id == id => Some(i),
            _ => self.creatures.iter().position(|c| c.id == id),
        }
    }
}

/* ---------------- WebAssembly exports ---------------- */

fn set_out(st: &mut State, s: String) {
    st.out = s.into_bytes();
}

fn read_str(p: *const u8, n: usize) -> String {
    if p.is_null() || n == 0 {
        return String::new();
    }
    let s = unsafe { std::slice::from_raw_parts(p, n) };
    String::from_utf8_lossy(s).into_owned()
}

#[no_mangle]
pub extern "C" fn wl_alloc(n: usize) -> *mut u8 {
    let mut v: Vec<u8> = Vec::with_capacity(n.max(1));
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

/// # Safety
/// `p` must come from `wl_alloc` with the same `n`.
#[no_mangle]
pub unsafe extern "C" fn wl_dealloc(p: *mut u8, n: usize) {
    if !p.is_null() {
        drop(Vec::from_raw_parts(p, 0, n.max(1)));
    }
}

#[no_mangle]
pub extern "C" fn wl_out_ptr() -> *const u8 {
    ST.with(|s| s.borrow().out.as_ptr())
}

#[no_mangle]
pub extern "C" fn wl_out_len() -> usize {
    ST.with(|s| s.borrow().out.len())
}

#[no_mangle]
pub extern "C" fn wl_buf_ptr(k: usize) -> *const f32 {
    ST.with(|s| s.borrow().buf[k.min(1)].as_ptr())
}

#[no_mangle]
pub extern "C" fn wl_buf_len(k: usize) -> usize {
    ST.with(|s| s.borrow().buf[k.min(1)].len())
}

#[no_mangle]
pub extern "C" fn wl_new(seed: u32) -> u32 {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        st.world = Some(World::new(seed));
        seed
    })
}

#[no_mangle]
pub extern "C" fn wl_load(p: *const u8, n: usize) -> i32 {
    let text = read_str(p, n);
    ST.with(|s| {
        let mut st = s.borrow_mut();
        match World::from_json(&text) {
            Ok(w) => {
                let info = json!({"seed": w.seed, "t": w.t, "savedAt": w.saved_at}).to_string();
                st.world = Some(w);
                set_out(&mut st, info);
                0
            }
            Err(e) => {
                set_out(&mut st, e);
                1
            }
        }
    })
}

/// Biome grid as raw bytes: width (u16 LE), height (u16 LE), then one byte per cell.
#[no_mangle]
pub extern "C" fn wl_map() {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let bytes = match st.world.as_ref().and_then(|w| w.map.as_ref()) {
            Some(m) => {
                let mut v = Vec::with_capacity(4 + m.bio.len());
                v.extend_from_slice(&(m.gw as u16).to_le_bytes());
                v.extend_from_slice(&(m.gh as u16).to_le_bytes());
                v.extend_from_slice(&m.bio);
                v
            }
            None => Vec::new(),
        };
        st.out = bytes;
    })
}

#[no_mangle]
pub extern "C" fn wl_seed() -> u32 {
    ST.with(|s| s.borrow().world.as_ref().map(|w| w.seed).unwrap_or(0))
}

#[no_mangle]
pub extern "C" fn wl_save(now: f64) {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let txt = st.world.as_mut().map(|w| w.to_json(now)).unwrap_or_default();
        set_out(&mut st, txt);
    })
}

#[no_mangle]
pub extern "C" fn wl_step(n: u32) -> u32 {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        match st.world.as_mut() {
            Some(w) => {
                for _ in 0..n {
                    w.step();
                }
                w.t
            }
            None => 0,
        }
    })
}

#[no_mangle]
pub extern "C" fn wl_cmd(p: *const u8, n: usize) {
    let text = read_str(p, n);
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        let res = match st.world.as_mut() {
            Some(w) => command(w, &v),
            None => json!({}),
        };
        set_out(&mut st, res.to_string());
    })
}

#[no_mangle]
pub extern "C" fn wl_frame(x0: f32, y0: f32, x1: f32, y1: f32, wpp: f32, sel: u32) {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let st = &mut *st;
        let mut cs = std::mem::take(&mut st.buf[0]);
        let mut fd = std::mem::take(&mut st.buf[1]);
        let meta = match st.world.as_mut() {
            Some(w) => frame(w, x0, y0, x1, y1, wpp, sel, &mut cs, &mut fd),
            None => "{}".into(),
        };
        st.buf[0] = cs;
        st.buf[1] = fd;
        set_out(st, meta);
    })
}

#[no_mangle]
pub extern "C" fn wl_panel(sel: u32) {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let txt = st.world.as_ref().map(|w| panel(w, sel)).unwrap_or_else(|| "{}".into());
        set_out(&mut st, txt);
    })
}

#[no_mangle]
pub extern "C" fn wl_series(from: u32) {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let txt = st
            .world
            .as_ref()
            .map(|w| {
                let from = (from as usize).min(w.series.len());
                let rows: Vec<Vec<String>> = w.series[from..].iter().map(metrics::row_values).collect();
                json!({"cols": metrics::CSV_COLS, "from": from, "total": w.series.len(), "rows": rows}).to_string()
            })
            .unwrap_or_else(|| "{}".into());
        set_out(&mut st, txt);
    })
}

#[no_mangle]
pub extern "C" fn wl_csv() {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let txt = st.world.as_ref().map(metrics::series_csv).unwrap_or_default();
        set_out(&mut st, txt);
    })
}

#[no_mangle]
pub extern "C" fn wl_newick() {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let txt = st.world.as_ref().map(metrics::newick).unwrap_or_default();
        set_out(&mut st, txt);
    })
}

#[no_mangle]
pub extern "C" fn wl_pyphi(sel: u32) {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let txt = st
            .world
            .as_ref()
            .and_then(|w| w.id_idx_get(sel).map(|i| metrics::pyphi_export(&w.creatures[i]).to_string()))
            .unwrap_or_else(|| "{}".into());
        set_out(&mut st, txt);
    })
}

#[no_mangle]
pub extern "C" fn wl_away_begin() {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let base = st.world.as_ref().map(|w| (w.t, w.births, deaths_total(w), w.events.len(), w.memorial.len()));
        st.away = base;
    })
}

#[no_mangle]
pub extern "C" fn wl_away_report() {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let rep = match (st.world.as_ref(), st.away) {
            (Some(w), Some((t0, b0, d0, _e0, m0))) => {
                let evs: Vec<Value> = w.events.iter().filter(|e| e.t > t0).rev().take(30).map(|e| json!([World::day_of(e.t), e.k, e.p, e.t])).collect();
                let lost: Vec<Value> = w.memorial.iter().skip(m0.min(w.memorial.len())).map(|m| json!({"name": m.name, "cause": m.cause})).collect();
                let adopted: Vec<Value> = w.creatures.iter().filter(|c| c.adopted).map(|c| json!({"id": c.id, "name": c.name})).collect();
                json!({"days": (w.t - t0) / DAY_LEN, "births": w.births - b0, "deaths": deaths_total(w).saturating_sub(d0), "events": evs, "lost": lost, "adopted": adopted}).to_string()
            }
            _ => "{}".into(),
        };
        set_out(&mut st, rep);
    })
}

#[no_mangle]
pub extern "C" fn wl_lab_start(p: *const u8, n: usize) {
    let text = read_str(p, n);
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        let key = v.get("knock").and_then(|x| x.as_str()).unwrap_or("self");
        let knock = KNOCKS.iter().position(|k| *k == key).unwrap_or(K_SELF);
        let reps = v.get("reps").and_then(|x| x.as_u64()).unwrap_or(3).clamp(2, 8) as usize;
        let steps = v.get("steps").and_then(|x| x.as_u64()).unwrap_or(3000).clamp(300, 30000) as u32;
        let seed = v.get("seed").and_then(|x| x.as_u64()).unwrap_or(1) as u32;
        st.lab = Some(Lab::new(seed, reps, steps, knock));
    })
}

#[no_mangle]
pub extern "C" fn wl_lab_step(n: u32) -> i32 {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        match st.lab.as_mut() {
            Some(l) => {
                let done = l.run(n);
                let prog = json!({"done": l.done, "steps": l.steps}).to_string();
                set_out(&mut st, prog);
                i32::from(done)
            }
            None => -1,
        }
    })
}

#[no_mangle]
pub extern "C" fn wl_lab_result() {
    ST.with(|s| {
        let mut st = s.borrow_mut();
        let txt = st.lab.as_mut().map(|l| l.result().to_string()).unwrap_or_else(|| "{}".into());
        st.lab = None;
        set_out(&mut st, txt);
    })
}
