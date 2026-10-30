//! One tick in the life of a Wildling: perception, drives, hormones, sleep, language, brain, body.
use crate::consts::*;
use crate::creature::*;
use crate::genome::morph_dist;
use crate::util::*;
use crate::world::*;

fn hear(w: &mut World, c: &mut Creature, u: &Utt, same_kind: bool, prestige: f32) -> (Option<[f32; FD]>, Option<f32>) {
    let toks = &u.tokens;
    let mut roles: Vec<Option<bool>> = toks
        .iter()
        .map(|t| {
            let (_, sa) = c.lex.top(t);
            let (_, sd) = c.dlex.top(t);
            if sa >= sd && sa > 0.15 {
                Some(true)
            } else if sd > 0.15 {
                Some(false)
            } else {
                None
            }
        })
        .collect();
    if toks.len() >= 2 {
        let o = c.order();
        match (roles[0], roles[1]) {
            (Some(a), Some(b)) if a != b => c.ord[if a { 0 } else { 1 }] += 1,
            _ => {}
        }
        match (roles[0], roles[1]) {
            (Some(a), None) => roles[1] = Some(!a),
            (None, Some(b)) => roles[0] = Some(!b),
            (None, None) => {
                roles[0] = Some(o == 0);
                roles[1] = Some(o != 0);
            }
            (Some(a), Some(b)) if a == b => roles[1] = Some(!a),
            _ => {}
        }
    } else if roles.first().map(|r| r.is_none()).unwrap_or(false) {
        roles[0] = Some(true);
    }
    let mut what: Option<String> = None;
    let mut where_: Option<String> = None;
    for i in 0..toks.len().min(2) {
        if roles[i] == Some(true) {
            what = Some(toks[i].clone());
        } else {
            where_ = Some(toks[i].clone());
        }
    }
    let mut evoked = None;
    let mut where_abs = None;
    let mut kd = -1;
    if let Some(wt) = &what {
        let (k, s) = c.lex.top(wt);
        if s > 0.15 && k >= 0 {
            if let Some(p) = &c.protos[k as usize] {
                evoked = Some(p.v);
            }
        }
    }
    if let Some(wt) = &where_ {
        let (k, s) = c.dlex.top(wt);
        if s > 0.15 && k >= 0 {
            where_abs = Some(k as f32 * PI / 4.0);
            kd = k;
        }
    }
    if same_kind {
        if let Some(wt) = &what {
            if c.sal > 0.3 {
                let f = c.f;
                let k = c.categorize(&f, true);
                c.lex.reinforce(wt, k, 0.08 * c.sal * prestige);
            } else {
                c.buf.push((wt.clone(), c.age));
                if c.buf.len() > 6 {
                    c.buf.remove(0);
                }
            }
            if let Some((_, g0)) = u.cgen.iter().find(|(x, _)| x == wt) {
                if !c.cgen.iter().any(|(x, _)| x == wt) && c.cgen.len() < 40 {
                    c.cgen.push((wt.clone(), *g0));
                }
            }
        }
        if let (Some(wt), Some((fx, fy))) = (&where_, c.fo) {
            c.dlex.reinforce(wt, sector_of((fy - u.y).atan2(fx - u.x)), 0.06 * prestige);
        }
    }
    if u.sid != 0 && same_kind {
        c.heard_n += 1;
        w.hw += 1;
        if let (Some(e), Some(cv)) = (&evoked, &u.cat_vec) {
            if vdist(e, cv) < 0.3 {
                c.understood += 1;
                w.uw += 1;
                if toks.len() >= 2 && u.sector >= 0 && kd == u.sector {
                    w.sentences += 1;
                    w.achieve("sentence");
                }
            }
        }
    }
    (evoked, where_abs)
}

/// Returns true if the creature died.
fn metabolize(w: &mut World, c: &mut Creature, water: u8, sleep: f32, drown: f32) -> bool {
    let size = c.size();
    let a = &c.ab;
    let knock_meta = w.knock[K_META];
    let thermal = 1.0 + c.cold * 0.8 + c.hot * 0.6;
    if !knock_meta {
        let basal = 0.012 * size.powf(0.75) * thermal * (1.0 + 0.25 * a.mass) * sleep + 0.0006 * c.net.hidden as f32 + 0.00004 * c.net.w.len() as f32;
        let swim = if water == 2 && !c.fly { 1.6 - a.ab[A_FIN].min(1.0) } else { 1.0 };
        let mv = 0.0035 * size * c.v * c.v * (1.0 + 0.5 * a.mass_mot) * if c.fly { FLY_MV } else { 1.0 } * swim * (1.0 + 0.5 * c.horm[0]);
        c.energy -= basal + mv + 0.00025 * c.sense_r * sleep + 0.004 + WING_UPKEEP * a.ab[A_WING].min(1.5) * sleep;
    } else {
        c.energy = c.energy.max(c.max_e() * 0.6);
    }
    if c.energy <= 0.0 {
        c.energy = 0.0;
        c.health -= 0.5;
    } else if c.health < 100.0 {
        let hh = (0.2 * (1.0 - 0.5 * c.horm[2]) * if sleep < 1.0 { 2.0 } else { 1.0 }).min(100.0 - c.health);
        c.health += hh;
        c.energy -= hh * 0.3;
    }
    if drown > 0.0 {
        c.health -= drown;
    }
    if c.cold > 0.8 || c.hot > 0.8 {
        c.health -= 0.1;
    }
    let life = c.g.tr[T_LIFE];
    if c.age as f32 > life {
        c.health -= 0.3;
    }
    if c.health < 30.0 && !c.hurt {
        c.hurt = true;
        c.note(w.t, "d.hurt", "");
    }
    if c.health > 70.0 {
        c.hurt = false;
    }
    if c.health <= 0.0 {
        let cause = if c.energy <= 0.0 {
            "hunger"
        } else if drown > 0.0 {
            "drowned"
        } else if c.cold > 0.8 {
            "frozen"
        } else if c.hot > 0.8 {
            "heat"
        } else if c.age as f32 > life {
            "age"
        } else {
            "injury"
        };
        w.die(c, cause);
        return true;
    }
    false
}

pub fn update(w: &mut World, c: &mut Creature, _idx: usize) {
    let t = w.t;
    let size = c.size();
    c.age += 1;
    if c.cool > 0 {
        c.cool -= 1;
    }
    if c.speak_cool > 0 {
        c.speak_cool -= 1;
    }
    if c.age % 60 == 0 {
        c.update_body();
        if c.fly && !c.flew_once {
            c.flew_once = true;
            c.note(t, "d.fly", "");
        }
    }
    let diet = c.g.tr[T_DIET];
    let (plant_eff, meat_eff) = (1.0 - diet, diet);
    let det_eff = (1.0 - (diet - 0.5).abs() * 3.5).clamp(0.0, 1.0) * 0.8;
    let sense_r = (c.sense_r * (1.0 - 0.4 * w.night)).min(MAX_SENSE);
    let b = w.bio_at(c.x, c.y);
    let bm = &BIOMES[b];
    let (bwater, btemp, bslow) = (bm.water, bm.temp, bm.slow);
    let frozen = w.frozen && bwater == 1;
    let wet = bwater > 0 && !frozen;
    if c.bio_seen & (1 << b) == 0 {
        c.bio_seen |= 1 << b;
        if c.age > 5 {
            c.note(t, "d.biome", &b.to_string());
        }
    }
    let rescan = (c.age + c.id) & 1 == 0;

    // food
    let mut food: Option<usize> = None;
    let mut food_score = 0.0;
    let mut food_d = 0.0;
    if !rescan && c.cf >= 0 && (c.cf as usize) < w.foods.len() && w.foods[c.cf as usize].e > 0.0 {
        let f = &w.foods[c.cf as usize];
        let d = ((f.x - c.x).powi(2) + (f.y - c.y).powi(2)).sqrt();
        if d <= sense_r {
            food = Some(c.cf as usize);
            food_d = d;
            food_score = (if f.det { det_eff } else if f.meat { meat_eff } else { plant_eff }) * (1.0 - d / sense_r);
        }
    } else {
        let g = &w.fgrid;
        let (c0, c1, r0, r1) = g.range(c.x, c.y, sense_r);
        let sr2 = sense_r * sense_r;
        for r in r0..=r1 {
            for cc in c0..=c1 {
                let cell = r * g.cols + cc;
                for k in g.start[cell]..g.start[cell + 1] {
                    let fi = g.items[k as usize] as usize;
                    if fi >= w.foods.len() {
                        continue;
                    }
                    let f = &w.foods[fi];
                    if f.e <= 0.0 {
                        continue;
                    }
                    let dx = f.x - c.x;
                    let dy = f.y - c.y;
                    let d2 = dx * dx + dy * dy;
                    if d2 > sr2 {
                        continue;
                    }
                    let d = d2.sqrt();
                    let s = (if f.det { det_eff } else if f.meat { meat_eff } else { plant_eff }) * (1.0 - d / sense_r);
                    if s > food_score {
                        food_score = s;
                        food = Some(fi);
                        food_d = d;
                    }
                }
            }
        }
        c.cf = food.map(|f| f as i32).unwrap_or(-1);
    }

    // other creatures
    let mut other: Option<Seen> = None;
    let seen_of = |o: &Creature, oi: usize, d: f32| Seen {
        idx: Some(oi),
        x: o.x,
        y: o.y,
        d,
        size: o.size(),
        carn: o.carn(),
        weapon: o.ab.ab[A_WEAPON],
        armor: o.ab.ab[A_ARMOR],
        display: o.ab.ab[A_DISPLAY],
        mature: o.mature(),
        md: 0.0,
        sp: o.sp,
    };
    let cached = if !rescan && c.co != 0 { w.id_idx.get(&c.co).copied() } else { None };
    if let Some(oi) = cached {
        let o = &w.creatures[oi];
        if !o.dead {
            let d = ((o.x - c.x).powi(2) + (o.y - c.y).powi(2)).sqrt();
            if d <= sense_r {
                other = Some(seen_of(o, oi, d));
            }
        }
    } else {
        let g = &w.grid;
        let (c0, c1, r0, r1) = g.range(c.x, c.y, sense_r);
        let mut od = f32::INFINITY;
        let mut oidx = None;
        for r in r0..=r1 {
            for cc in c0..=c1 {
                let cell = r * g.cols + cc;
                for k in g.start[cell]..g.start[cell + 1] {
                    let oi = g.items[k as usize] as usize;
                    if oi >= w.creatures.len() {
                        continue;
                    }
                    let o = &w.creatures[oi];
                    if o.dead {
                        continue;
                    }
                    let dx = o.x - c.x;
                    let dy = o.y - c.y;
                    let d = (dx * dx + dy * dy).sqrt();
                    if d >= od {
                        continue;
                    }
                    let vis = sense_r * (1.0 - o.camo() + o.ab.ab[A_DISPLAY] * 0.3) * if w.bio_at(o.x, o.y) == 3 { 0.65 } else { 1.0 };
                    if d <= vis {
                        od = d;
                        oidx = Some(oi);
                    }
                }
            }
        }
        if let Some(oi) = oidx {
            other = Some(seen_of(&w.creatures[oi], oi, od));
            c.co = w.creatures[oi].id;
        } else {
            c.co = 0;
        }
    }

    // mirrors
    let mut mirror = false;
    let mut mir_x = 0.0f32;
    if !c.self_recog && !w.mirrors.is_empty() {
        let od = other.as_ref().map(|o| o.d).unwrap_or(f32::INFINITY);
        for m in &w.mirrors {
            if (c.y - m[1]).abs() > 50.0 {
                continue;
            }
            let d = (c.x - m[0]).abs() * 2.0;
            if d < 4.0 || d > sense_r * 0.8 || d >= od {
                continue;
            }
            other = Some(Seen {
                idx: None,
                x: 2.0 * m[0] - c.x,
                y: c.y,
                d,
                size,
                carn: c.carn(),
                weapon: c.ab.ab[A_WEAPON],
                armor: c.ab.ab[A_ARMOR],
                display: c.ab.ab[A_DISPLAY],
                mature: c.mature(),
                md: 0.0,
                sp: c.sp,
            });
            mirror = true;
            mir_x = m[0];
        }
    }
    {
        // contingency: does the other's motion follow my own motion? (own displacement vs observed displacement)
        let img = 2.0 * mir_x - c.x;
        let ax = c.x - c.mp[0];
        if mirror && c.mo[1] > 0.5 {
            let bx = img - c.mo[0];
            for v in c.mc.iter_mut() {
                *v *= 0.97;
            }
            c.mc[0] += 1.0;
            c.mc[1] += ax;
            c.mc[2] += bx;
            c.mc[3] += ax * ax;
            c.mc[4] += bx * bx;
            c.mc[5] += ax * bx;
        } else if !mirror {
            for v in c.mc.iter_mut() {
                *v *= 0.995;
            }
        }
        c.mp = [c.x, c.y];
        c.mo = if mirror { [img, 1.0] } else { [0.0, 0.0] };
    }
    if let Some(o) = other.as_mut() {
        if let Some(oi) = o.idx {
            o.md = morph_dist(&c.morph, &w.creatures[oi].morph);
        }
    }
    let mut prey = false;
    if c.carn() {
        if let Some(o) = &other {
            if o.idx.is_some() && !o.carn && o.size < size * 1.3 {
                let s = meat_eff * (1.0 - o.d / sense_r) * 0.95;
                if s > food_score {
                    food_score = s;
                    food = None;
                    food_d = o.d;
                    prey = true;
                }
            }
        }
    }
    let food_pos: Option<(f32, f32, bool)> = if prey {
        other.as_ref().map(|o| (o.x, o.y, true))
    } else {
        food.map(|fi| (w.foods[fi].x, w.foods[fi].y, w.foods[fi].meat))
    };

    // features of the situation
    let mut f = [0.0f32; FD];
    let ef = c.energy / c.max_e().max(1e-3);
    let mut md = 0.0;
    let mut kin_near = false;
    if let Some(o) = &other {
        md = o.md;
        let cl = 1.0 - o.d / sense_r;
        let threat = (o.carn && if c.carn() { o.size > size * 1.2 } else { o.size > size * 0.6 }) || o.weapon > c.ab.ab[A_WEAPON] + 0.3;
        if threat {
            f[0] = (cl * 1.2 + 0.2).min(1.0);
        }
        if c.carn() && !o.carn && o.size < size * 1.3 {
            f[2] = cl * 0.8 + 0.2;
        }
        if md < MATE_TH {
            f[3] = cl * 0.6 + 0.2;
            if o.d < 80.0 {
                kin_near = true;
            }
        } else if md > STRANGER_TH && !threat {
            f[4] = cl * 0.6 + 0.2;
        }
    }
    f[1] = food_score;
    f[5] = if c.d[0] > 0.6 { (c.d[0] - 0.6) / 0.4 } else { 0.0 };
    f[6] = (100.0 - c.health) / 100.0;
    f[7] = (c.cold * 1.5).min(1.0);
    f[8] = match bwater {
        2 => 1.0,
        1 => 0.6,
        _ => 0.0,
    };
    f[9] = (c.surprise * 1.5).min(1.0);
    let mut sk: i32 = -1;
    let mut sal = 0.0;
    for (i, &v) in f.iter().enumerate() {
        if v > sal {
            sal = v;
            sk = i as i32;
        }
    }
    c.f = f;
    c.sal = sal;
    c.focus_f = if sal > 0.25 { sk } else { -1 };
    c.fo = if sk == 1 {
        food_pos.map(|p| (p.0, p.1))
    } else if matches!(sk, 0 | 2 | 3 | 4) {
        other.as_ref().map(|o| (o.x, o.y))
    } else {
        None
    };

    if mirror {
        c.mirror_t += 1;
        if c.mirror_t >= 80 && !c.mirror_tested {
            c.mirror_tested = true;
            w.mirror_tests += 1;
        }
        if c.mirror_t >= 40 && c.mirror_t % 10 == 0 && !c.self_recog && !w.knock[K_SELF] && c.certainty() > 0.55 && {
            let m = &c.mc;
            let n = m[0].max(1e-6);
            let (va, vb) = (m[3] / n - (m[1] / n).powi(2), m[4] / n - (m[2] / n).powi(2));
            let cov = m[5] / n - (m[1] / n) * (m[2] / n);
            n >= 20.0 && va > 0.004 && vb > 0.004 && (cov / (va * vb).sqrt()).abs() > 0.85
        } {
            c.self_recog = true;
            w.mirror_pass += 1;
            w.achieve("mirror");
            w.event("ev.mirror", vec![c.name.clone(), c.id.to_string()]);
            c.note(t, "d.mirror", "");
        }
    }

    // temperature, body shape matters: long thin bodies lose heat, compact ones keep it
    let shp = c.g.shape;
    let temp = btemp + (w.sf - 0.5) * 24.0 - if frozen { 2.0 } else { 0.0 } - w.night * 3.0;
    let felt = temp + c.ab.ab[A_INSUL] * 14.0 + c.ab.ab[A_STORAGE] * 4.0 + size * 0.3 - shp[S_ELONG] * 3.0 - (shp[S_SEG].floor() - 1.0) * 1.0;
    c.cold = clamp((10.0 - felt) / 20.0, 0.0, 1.0);
    c.hot = clamp((felt - 27.0) / 18.0, 0.0, 1.0);
    let drown = if !c.fly && bwater == 2 && c.ab.ab[A_FIN] < 0.15 { 0.25 * (1.0 - c.ab.ab[A_FIN] / 0.15) } else { 0.0 };

    c.horm[0] = (c.horm[0] * 0.97 + f[0] * 0.08).min(1.0);
    c.horm[1] *= 0.98;
    c.horm[2] = (c.horm[2] * 0.999 + (1.0 - c.wellbeing) * 0.0015).min(1.0);

    // sleep
    if c.asleep {
        c.tired = (c.tired - 0.004).max(0.0);
        c.v *= 0.8;
        c.d[7] = c.tired;
        if c.age % 60 == 0 {
            let ps: Vec<usize> = (0..MAX_PROTO).filter(|&k| c.protos[k].is_some()).collect();
            if !ps.is_empty() {
                let p = c.protos[ps[w.rng.below(ps.len())]].unwrap();
                let mut bi = 0;
                for i in 1..FD {
                    if p.v[i] > p.v[bi] {
                        bi = i;
                    }
                }
                c.last_dream = bi as i32;
            }
            w.body_bubble(c.x, c.y, "b.sleep");
        }
        if c.tired < 0.12 || f[0] > 0.5 || c.health < 40.0 || drown > 0.0 || (w.night < 0.2 && c.tired < 0.35) {
            c.asleep = false;
            c.consolidate();
        }
        c.actv = 1;
        c.actc[1] += 1;
        metabolize(w, c, bwater, 0.5, drown);
        return;
    }
    c.tired = (c.tired + 0.00045 + 0.0003 * c.v / c.g.tr[T_SPEED].max(0.3)).min(1.0);
    if drown == 0.0 && (c.tired > 0.92 || (w.night > 0.6 && c.tired > 0.45 && f[0] < 0.2 && c.d[1] < 0.3)) {
        c.asleep = true;
        c.v = 0.0;
    }

    // hearing
    let mut heard_u: Option<usize> = None;
    let mut bl = 0.0;
    if !w.knock[K_LANG] {
        for (ui, u) in w.speech.iter().enumerate() {
            if u.sid == c.id {
                continue;
            }
            let ux = u.x - c.x;
            let uy = u.y - c.y;
            if ux.abs() > HEAR || uy.abs() > HEAR {
                continue;
            }
            let d = (ux * ux + uy * uy).sqrt();
            if d > HEAR {
                continue;
            }
            let l = 1.0 - d / HEAR;
            if l > bl {
                bl = l;
                heard_u = Some(ui);
            }
        }
    }
    let mut social_gain = 0.0;
    let mut status_gain = 0.0;
    if let Some(ui) = heard_u {
        let u = w.speech[ui].clone();
        let same_kind = u.sid == 0 || (u.diet - diet).abs() < 0.4;
        let prestige = if u.sid != 0 && w.boss_of.get(&c.sp) == Some(&u.sid) { 2.0 } else { 1.0 };
        let (ev, wa) = hear(w, c, &u, same_kind, prestige);
        let ang = (u.y - c.y).atan2(u.x - c.x) - c.dir;
        c.heard = Some(Heard { s: ang.sin(), c: ang.cos(), loud: bl, vec: ev, wa, words: u.tokens.join(" "), from: u.sid });
        if u.sid != 0 && u.sp == c.sp {
            social_gain += 0.01;
        }
        if let Some(ls) = c.last_said.clone() {
            if t - ls.t < 40 && u.tokens.contains(&ls.word) {
                c.echoes += 1;
                social_gain += 0.15;
                status_gain += 0.05;
                c.lex.reinforce(&ls.word, ls.cat, 0.05);
            }
        }
    } else if let Some(h) = c.heard.as_mut() {
        h.loud *= 0.85;
        if h.loud < 0.02 {
            c.heard = None;
        }
    }
    if !c.buf.is_empty() {
        if sal > 0.4 && sk != 9 {
            let ff = c.f;
            let k = c.categorize(&ff, true);
            let words: Vec<String> = c.buf.drain(..).map(|q| q.0).collect();
            for wd in words {
                c.lex.reinforce(&wd, k, 0.05 * sal);
            }
        } else if c.age % 10 == 0 {
            let age = c.age;
            c.buf.retain(|q| age - q.1 < 60);
        }
    }

    let hv = c.heard.as_ref().and_then(|h| h.vec.map(|v| v[0] * h.loud)).unwrap_or(0.0);
    c.fear = (c.fear * 0.98).max(f[0]).max(hv * 0.8);
    if f[0] > 0.5 && c.v > 0.3 * c.g.tr[T_SPEED] {
        c.reacts += 1;
    }
    let mut fm_new = None;
    if let Some((fx, fy, _)) = food_pos {
        if food_score > 0.3 && !prey {
            fm_new = Some((fx, fy));
        }
    }

    match fm_new {
        Some((fx, fy)) => c.fm = Some((fx, fy, t)),
        None => {
            if let Some((mx, my, mt)) = c.fm {
                if t - mt > 600 || ((mx - c.x).powi(2) + (my - c.y).powi(2)).sqrt() < 8.0 {
                    c.fm = None;
                }
            }
        }
    }

    // novelty
    let mut novelty = 0.0;
    let cell = ((c.y / 100.0) as u16).min(23) * 40 + ((c.x / 100.0) as u16).min(39);
    if c.visit(cell) {
        novelty = 0.06;
    }
    let boss_id = w.boss_of.get(&c.sp).copied().unwrap_or(0);
    let is_boss = boss_id == c.id;
    if is_boss && !c.was_boss {
        c.was_boss = true;
        c.note(t, "d.boss", "");
    }
    if !is_boss && c.was_boss {
        c.was_boss = false;
        c.note(t, "d.notBoss", "");
    }

    // drives and reward (drive reduction)
    let dp = c.d;
    let h = c.horm;
    c.d[0] = if w.knock[K_META] { 0.0 } else { (1.0 - ef) * (1.0 - 0.4 * h[0]) };
    c.d[1] = clamp(c.fear * 0.8 + (100.0 - c.health) / 200.0 * (1.0 - 0.6 * h[1]), 0.0, 1.0);
    c.d[2] = clamp(c.cold + c.hot, 0.0, 1.0);
    c.d[3] = clamp(c.d[3] + 0.0012 - if kin_near && !(mirror && c.self_recog) { 0.02 } else { 0.0 } - social_gain, 0.0, 1.0);
    c.d[4] = if c.mature() && !w.knock[K_REPRO] { clamp(c.d[4] + 0.0006 * ef, 0.0, 1.0) } else { 0.0 };
    c.d[5] = clamp(c.d[5] + 0.0008 - novelty - c.surprise * 0.005, 0.0, 1.0);
    c.d[6] = if is_boss { 0.0 } else { clamp(c.d[6] + 0.0004 - status_gain, 0.0, 1.0) };
    c.d[7] = c.tired;
    // active inference: free energy = precision-weighted deviation from preferred states (drives) + prediction error of the own body model
    let mut fe = 0.4 * c.surprise;
    let (mut num, mut den, mut gk, mut gv) = (0.0, 0.0, 0usize, -1.0);
    for i in 0..ND {
        let wt = c.g.dw[i];
        fe += 0.5 * wt * c.d[i] * c.d[i];
        num += wt * c.d[i];
        den += wt;
        if wt * c.d[i] > gv {
            gv = wt * c.d[i];
            gk = i;
        }
    }
    let r = c.fe - fe;
    c.fe = fe;
    let _ = dp;
    c.goal = gk as u8;
    c.wellbeing = clamp(1.0 - num / den + 0.1 * h[1], 0.0, 1.0);
    c.wb_avg = c.wb_avg * 0.995 + c.wellbeing * 0.005;
    let tick_reward = r * 20.0 + c.ext_reward;
    c.ext_reward = 0.0;
    if tick_reward > 0.0 {
        c.horm[1] = (c.horm[1] + tick_reward * 0.02).min(1.0);
    }
    c.racc += tick_reward;

    if rescan {
        let reward = c.racc;
        c.racc = 0.0;
        let delta = reward - c.rbar;
        c.rbar += 0.01 * delta;
        c.reward_avg = c.reward_avg * 0.99 + reward * 0.01;
        if (delta > 0.02 || delta < -0.02) && !w.knock[K_LEARN] {
            let lr = c.g.tr[T_PLAST] * (1.0 - 0.5 * c.horm[2]) * delta;
            c.net.learn(lr);
        }
        let mut inp = std::mem::take(&mut c.inp);
        inp.iter_mut().for_each(|v| *v = 0.0);
        inp[0] = 1.0;
        if let Some((fx, fy, _)) = food_pos {
            let a = (fy - c.y).atan2(fx - c.x) - c.dir;
            inp[1] = a.sin();
            inp[2] = a.cos();
            inp[3] = 1.0 - food_d / sense_r;
        }
        if let Some(o) = &other {
            let a = (o.y - c.y).atan2(o.x - c.x) - c.dir;
            inp[4] = a.sin();
            inp[5] = a.cos();
            inp[6] = 1.0 - o.d / sense_r;
            inp[7] = clamp(o.size / size - 1.0, -1.0, 1.0);
            inp[8] = 1.0 - md;
            inp[9] = o.weapon.min(1.0);
            inp[10] = o.display.min(1.0);
        }
        let ahead = &BIOMES[w.bio_at(c.x + c.dir.cos() * 40.0, c.y + c.dir.sin() * 40.0)];
        inp[11] = bwater as f32 / 2.0;
        inp[12] = ahead.water as f32 / 2.0;
        inp[13] = ahead.growth / 1.3;
        inp[14] = ef;
        inp[15] = c.health / 100.0;
        inp[16] = (c.age as f32 / c.g.tr[T_LIFE]).min(1.5);
        inp[17] = c.hot - c.cold;
        for i in 0..ND {
            inp[18 + i] = c.d[i];
        }
        inp[26 + gk] = 1.0;
        for i in 0..4 {
            inp[34 + i] = c.mem[i];
        }
        if let Some((mx, my, mt)) = c.fm {
            let a = (my - c.y).atan2(mx - c.x) - c.dir;
            inp[38] = a.sin();
            inp[39] = a.cos();
            inp[40] = 1.0 - (t - mt) as f32 / 600.0;
        }
        if let Some(hd) = &c.heard {
            inp[41] = hd.s;
            inp[42] = hd.c;
            inp[43] = hd.loud;
            if let Some(v) = hd.vec {
                inp[44..44 + FD].copy_from_slice(&v);
            }
            if let Some(wa) = hd.wa {
                let ra = wa - c.dir;
                inp[54] = ra.sin();
                inp[55] = ra.cos();
                inp[56] = 1.0;
            }
        }
        if boss_id != 0 && !is_boss {
            if let Some(&bi) = w.id_idx.get(&boss_id) {
                let bc = &w.creatures[bi];
                if !bc.dead {
                    let bd = ((bc.x - c.x).powi(2) + (bc.y - c.y).powi(2)).sqrt();
                    let a = (bc.y - c.y).atan2(bc.x - c.x) - c.dir;
                    inp[57] = a.sin();
                    inp[58] = a.cos();
                    inp[59] = (1.0 - bd / 500.0).max(0.0);
                }
            }
        }
        inp[60] = if is_boss { 1.0 } else { 0.0 };
        inp[61] = c.surprise.min(1.0);
        inp[62] = c.certainty();
        inp[63] = c.dir.sin();
        inp[64] = c.dir.cos();
        inp[65] = c.horm[0];
        inp[66] = c.horm[1];
        inp[67] = c.horm[2];
        inp[68] = w.night;
        {
            let mut best: Option<(usize, f32)> = None;
            let mut bd = sense_r * sense_r;
            for (i, k) in w.caches.iter().enumerate() {
                let d2 = (k.x - c.x) * (k.x - c.x) + (k.y - c.y) * (k.y - c.y);
                if d2 < bd {
                    bd = d2;
                    best = Some((i, d2.sqrt()));
                }
            }
            if let Some((i, d)) = best {
                let k = &w.caches[i];
                let a = (k.y - c.y).atan2(k.x - c.x) - c.dir;
                inp[69] = a.sin();
                inp[70] = a.cos();
                inp[71] = 1.0 - d / sense_r.max(1.0);
                inp[72] = (k.e / 30.0).min(1.0);
            }
        }
        c.net.run(&inp);
        c.inp = inp;
        let sig = 0.05 + 0.25 * c.g.tr[T_CUR] * (1.0 - 0.5 * c.certainty());
        for o in 0..5 {
            let xi = w.rng.gauss() * sig;
            c.xi[o] = xi;
            let v = clamp(c.net.out(o) + xi, -1.0, 1.0);
            c.net.set_out(o, v);
        }
        let xi = c.xi;
        c.net.trace(&xi);
        for o in 0..NOUT {
            c.outv[o] = c.net.out(o);
        }
        for i in 0..4 {
            c.mem[i] = c.outv[5 + i];
        }
        c.record_activity();
    }
    let o = c.outv;

    // speaking
    if !w.knock[K_LANG] && o[3] > 0.3 && c.speak_cool == 0 && sal > 0.3 && c.energy > SPEAK_COST {
        let ff = c.f;
        let k = c.categorize(&ff, true);
        if k >= 0 {
            let word = c.lex.produce(k as usize, &mut w.rng);
            let mut tokens = vec![word.clone()];
            let mut sector = -1;
            if o[4] > 0.0 {
                if let Some((fx, fy)) = c.fo {
                    sector = sector_of((fy - c.y).atan2(fx - c.x));
                    let dw = c.dlex.produce(sector as usize, &mut w.rng);
                    if dw != word {
                        if c.order() == 0 {
                            tokens.push(dw);
                        } else {
                            tokens.insert(0, dw);
                        }
                    }
                }
            }
            match c.cgen.iter().find(|(x, _)| *x == word) {
                None => {
                    if c.cgen.len() < 40 {
                        c.cgen.push((word.clone(), c.gen));
                    }
                }
                Some((_, g0)) => {
                    if c.gen >= g0 + 3 {
                        w.achieve("culture");
                    }
                }
            }
            if c.inherited.contains(&word) {
                c.cultural_use = true;
            }
            let pv = c.protos[k as usize].unwrap().v;
            let cg: Vec<(String, u32)> = c.cgen.iter().filter(|(x, _)| tokens.contains(x)).cloned().collect();
            let u = Utt { x: c.x, y: c.y, tokens: tokens.clone(), sid: c.id, diet, sp: c.sp, cat_vec: Some(pv), sector, cgen: cg, what: word.clone() };
            if !c.first_word {
                c.first_word = true;
                c.note(t, "d.firstWord", &tokens.join(" "));
            }
            w.say(u, Some(c));
            c.energy -= SPEAK_COST;
            c.speak_cool = SPEAK_COOL;
            c.spoken += 1;
            c.last_said = Some(LastSaid { word, cat: k, t, tokens: tokens.join(" "), sector, vec: pv });
        }
    }

    // movement: the body plan and shape decide how fast and where one can move
    let a = &c.ab;
    let loc = if c.fly {
        1.0 + a.ab[A_WING] * 0.4
    } else if bwater == 2 {
        c.water_loc
    } else if wet {
        (c.land_loc * 0.5).max(c.water_loc)
    } else {
        c.land_loc * bslow
    };
    let shape_speed = 1.0 + 0.15 * shp[S_ELONG] - 0.08 * shp[S_BOX];
    let ms = (c.g.tr[T_SPEED] * loc.min(1.9) * (1.0 + 0.4 * c.horm[0]) * shape_speed).max(0.05);
    let fw = &c.fw;
    let bmat = c.bm;
    c.fv[2] = if c.urge { 1.0 } else { 0.0 };
    c.fv[3] = c.v / ms;
    c.fv[4] = 1.0;
    let (mut m0, mut m1);
    if w.knock[K_SELF] {
        m0 = clamp(w.rng.gauss() * 0.7, -1.0, 1.0);
        m1 = clamp(w.rng.gauss() * 0.7, -1.0, 1.0);
    } else {
        let f_ = &c.fv;
        let dt = o[0];
        let vf_des = 0.8 * f_[3] + 0.2 * (o[1] + 1.0) / 2.0;
        let r0 = dt - (fw[2] * f_[2] + fw[3] * f_[3] + fw[4]);
        let r1 = vf_des - (fw[7] * f_[2] + fw[8] * f_[3] + fw[9]);
        let (da, db, dc, dd) = (fw[0], fw[1], fw[5], fw[6]);
        let det = da * dd - db * dc;
        m0 = 0.0;
        m1 = 0.0;
        if det.abs() > 0.003 {
            m0 = (dd * r0 - db * r1) / det;
            m1 = (da * r1 - dc * r0) / det;
        }
        let amp = 0.05 + c.g.tr[T_CUR] * (1.0 - c.certainty());
        m0 = clamp(m0 + w.rng.gauss() * amp, -1.0, 1.0);
        m1 = clamp(m1 + w.rng.gauss() * amp, -1.0, 1.0);
    }
    c.fv[0] = m0;
    c.fv[1] = m1;
    let turn_max = 0.3 / (size / 6.0).sqrt() * (1.0 + 0.3 * (a.ab[A_LEG] + a.ab[A_FIN] + a.ab[A_WING]).min(1.0)) * (1.0 - 0.3 * shp[S_ELONG]);
    let turn_cmd = clamp(bmat[0] * m0 + bmat[1] * m1, -1.0, 1.0);
    let thrust_cmd = clamp(bmat[2] * m0 + bmat[3] * m1, -1.0, 1.0);
    c.dir += turn_cmd * turn_max;
    c.v += ((thrust_cmd + 1.0) / 2.0 * ms - c.v) * 0.2;
    let wx = 0.25 * (c.y / 180.0 + t as f32 / 900.0).sin();
    let wy = 0.25 * (c.x / 220.0 - t as f32 / 1100.0).cos();
    let wm = if c.fly { 2.0 } else { 1.0 };
    let mut dx = c.dir.cos() * c.v + wx * wm + c.push[0];
    let mut dy = c.dir.sin() * c.v + wy * wm + c.push[1];
    c.push = [0.0, 0.0];
    let mut gut_fire = false;
    let mut dung: Option<(f32, f32, f32)> = None;
    if c.urge {
        gut_fire = true;
        c.urge = false;
        dx -= c.dir.cos() * 0.8;
        dy -= c.dir.sin() * 0.8;
        c.gut_events += 1;
        dung = Some((c.x, c.y, 1.5 + size * 1.2));
        w.body_bubble(c.x, c.y, "b.gut");
    }
    if let Some((dx0, dy0, de)) = dung {
        w.add_det(dx0, dy0, de);
    }
    let mut nx = clamp(c.x + dx, size, WORLD_W - size);
    let mut ny = clamp(c.y + dy, size, WORLD_H - size);
    let mut blocked = false;
    if !c.fly && bwater != 2 && c.ab.ab[A_FIN] < 0.15 && BIOMES[w.bio_at(nx, ny)].water == 2 {
        nx = c.x;
        ny = c.y;
        blocked = true;
        c.dir += PI * 0.7 + w.rng.gauss() * 0.4;
    }
    let (ax, ay) = (nx - c.x, ny - c.y);
    let (ca, sa) = (c.dir.cos(), c.dir.sin());
    let y0 = turn_cmd;
    let y1 = (ax * ca + ay * sa) / ms;
    let y2 = (-ax * sa + ay * ca) / ms;
    if !blocked && nx != c.x + dx {
        c.dir = PI - c.dir;
    }
    if !blocked && ny != c.y + dy {
        c.dir = -c.dir;
    }
    c.x = nx;
    c.y = ny;

    // learning the body: a forward model predicts the result of one's own motor commands
    if w.knock[K_SELF] {
        c.err = c.err * 0.99 + 0.015;
        c.surprise = c.surprise * 0.8 + 0.3;
    } else {
        let fv = c.fv;
        let mut p = [0.0f32; 3];
        for (q, pq) in p.iter_mut().enumerate() {
            let mut s = 0.0;
            for k in 0..NF {
                s += c.fw[q * NF + k] * fv[k];
            }
            *pq = s;
        }
        let (e0, e1, e2) = (y0 - p[0], y1 - p[1], y2 - p[2]);
        let lr = c.g.tr[T_LEARN];
        for k in 0..NF {
            c.fw[k] += lr * e0 * fv[k];
            c.fw[NF + k] += lr * e1 * fv[k];
            c.fw[2 * NF + k] += lr * e2 * fv[k];
        }
        let e = (e0.abs() + e1.abs()).min(3.0);
        c.err = c.err * 0.99 + e * 0.01;
        c.surprise = c.surprise * 0.8 + (e + e2.abs()).min(3.0) * 0.2;
        c.ext_force = c.ext_force * 0.95 + e2.abs().min(3.0) * 0.05;
        if gut_fire {
            let own = if e1.abs() < 0.5 * (0.8 / ms) { 1.0 } else { 0.0 };
            c.gut_own = if c.gut_events == 1 { own } else { c.gut_own * 0.8 + own * 0.2 };
        }
    }

    // use makes body parts grow (plasticity)
    if c.age % 5 == 0 {
        let fly = c.fly;
        let cold = c.cold;
        let v = c.v;
        for i in 0..c.acq.len().min(c.pf.len()) {
            let pf = c.pf[i];
            let aq = &mut c.acq[i];
            if !wet && !fly && pf[A_LEG] > 0.03 {
                aq[0] += 1e-4 * v;
            }
            if wet && pf[A_FIN] > 0.02 {
                aq[1] += 1e-4 * v;
            }
            if fly && pf[A_WING] > 0.03 {
                aq[1] += 5e-5;
            }
            if cold > 0.2 && pf[A_INSUL] > 0.02 {
                aq[1] += 1.5e-4 * cold;
            }
            for q in aq.iter_mut() {
                *q = clamp(*q * 0.9997, -0.25, 0.25);
            }
        }
    }
    c.stress[1] += c.cold * 0.0005;
    if drown > 0.0 {
        c.stress[2] += 0.003;
    }
    if c.d[0] > 0.85 {
        c.stress[3] += 0.0004;
    }

    // collisions
    if let Some(oth) = &other {
        if let Some(oi) = oth.idx {
            if oth.d < size + oth.size && oth.d > 0.01 {
                let ov = ((size + oth.size - oth.d) * 0.3).min(1.0);
                let ux = (oth.x - c.x) / oth.d;
                let uy = (oth.y - c.y) / oth.d;
                let oc = &mut w.creatures[oi];
                oc.push[0] += ux * ov;
                oc.push[1] += uy * ov;
                c.push[0] -= ux * ov;
                c.push[1] -= uy * ov;
            }
        }
    }

    // eating
    if let Some(fi) = food {
        if !prey && food_d < size + 4.0 {
            let fd = &mut w.foods[fi];
            let eff = if fd.det { det_eff } else if fd.meat { meat_eff } else { plant_eff };
            if eff > 0.15 {
                let bite = fd.e.min(size * 2.0);
                fd.e -= bite;
                c.energy = (c.energy + bite * eff * if fd.det { 0.6 } else { 1.0 }).min(c.max_e());
                c.gut += bite * 0.015;
                c.last_ate = t as i64;
                if c.eaten == 0 {
                    c.reacts += 1;
                }
                c.eaten += 1;
            }
        }
    }
    c.gut *= 0.9995;
    if c.gut > 1.0 && !c.urge {
        c.urge = true;
        c.gut = 0.0;
    }

    // attacking
    if o[2] > 0.0 && meat_eff > 0.3 {
        if let Some(oth) = &other {
            if let Some(oi) = oth.idx {
                if oth.d < size + oth.size + 2.0 && !w.creatures[oi].dead {
                    let dmg = o[2] * 3.0 * meat_eff * (size / oth.size.max(0.5)) * (1.0 + 1.5 * c.ab.ab[A_WEAPON]) * (1.0 - (oth.armor * 1.2).min(0.75));
                    let gain = dmg * oth.size * MEAT_GAIN * meat_eff;
                    let killed;
                    {
                        let oc = &mut w.creatures[oi];
                        oc.health -= dmg;
                        oc.stress[0] += dmg;
                        let ra = (c.y - oc.y).atan2(c.x - oc.x) - oc.dir;
                        oc.stress[4] += ra.cos();
                        oc.stress[5] += ra.sin();
                        oc.asleep = false;
                        for i in 0..oc.acq.len().min(oc.pf.len()) {
                            if oc.pf[i][A_ARMOR] > 0.02 {
                                oc.acq[i][1] = (oc.acq[i][1] + 0.001 * dmg).min(0.25);
                            }
                        }
                        killed = oc.health <= 0.0;
                    }
                    for i in 0..c.acq.len().min(c.pf.len()) {
                        if c.pf[i][A_WEAPON] > 0.02 {
                            c.acq[i][2] = (c.acq[i][2] + 0.002).min(0.25);
                        }
                    }
                    if oth.weapon > 0.15 {
                        c.health -= oth.weapon * 2.0;
                    }
                    c.energy -= 0.05 * size;
                    c.energy = (c.energy + gain).min(c.max_e());
                    c.last_ate = t as i64;
                    c.last_atk = t as i64;
                    if killed {
                        let mut oc = std::mem::take(&mut w.creatures[oi]);
                        w.die(&mut oc, "eaten");
                        w.creatures[oi] = oc;
                        c.kills += 1;
                    }
                }
            }
        }
    }

    // caches: the net may store surplus energy at a spot (o[9] > 0) or take it back when hungry (o[9] < 0)
    if !c.asleep && (o[9] > 0.55 || o[9] < -0.4) {
        let mut near: Option<usize> = None;
        let mut bd = CACHE_REACH * CACHE_REACH;
        for (i, k) in w.caches.iter().enumerate() {
            let d2 = (k.x - c.x) * (k.x - c.x) + (k.y - c.y) * (k.y - c.y);
            if d2 < bd {
                bd = d2;
                near = Some(i);
            }
        }
        if o[9] > 0.55 && c.energy > c.max_e() * 0.8 {
            let amt = (c.energy - c.max_e() * 0.5).min(CACHE_STEP);
            let gain = amt * (1.0 - CACHE_LOSS);
            let ok = if let Some(i) = near {
                w.caches[i].e += gain;
                true
            } else if w.caches.len() < MAX_CACHE {
                w.caches.push(Cache { x: c.x, y: c.y, e: gain });
                true
            } else {
                false
            };
            if ok {
                c.energy -= amt;
                c.cdep += 1;
                w.cache_dep += 1;
            }
        } else if o[9] < -0.4 && c.energy < c.max_e() * 0.5 {
            if let Some(i) = near {
                let take = w.caches[i].e.min(CACHE_STEP).min(c.max_e() - c.energy);
                if take > 0.0 {
                    w.caches[i].e -= take;
                    c.energy += take;
                    c.cret += 1;
                    w.cache_ret += 1;
                }
            }
        }
    }

    // current activity for display and statistics
    {
        let ti = t as i64;
        c.actv = if c.fear > 0.35 || c.focus_f == 0 {
            2
        } else if ti - c.last_atk < 10 {
            3
        } else if ti - c.last_ate < 10 {
            4
        } else if ti - c.last_birth < 40 {
            5
        } else if c.speak_cool + 8 > SPEAK_COOL {
            7
        } else if c.focus_f == 1 {
            6
        } else if c.focus_f == 3 {
            8
        } else if c.focus_f == 2 {
            3
        } else {
            0
        };
        c.actc[c.actv as usize] += 1;
    }
    if metabolize(w, c, bwater, 1.0, drown) {
        return;
    }

    // reproduction
    if !w.knock[K_REPRO] && c.cool == 0 && c.mature() && c.energy > c.max_e() * 0.65 && w.count() < MAX_POP {
        let mate = other.as_ref().and_then(|o| {
            let oi = o.idx?;
            let oc = &w.creatures[oi];
            if !oc.dead && oc.mature() && o.md < MATE_TH && o.d < sense_r * 0.5 {
                Some(oi)
            } else {
                None
            }
        });
        let mut child = new_child(w, c, mate);
        let give = c.energy * 0.4;
        c.energy -= give + c.energy * 0.1;
        child.energy = give.min(child.max_e());
        c.cool = (150.0 + c.g.tr[T_SIZE] * 20.0).round() as u32;
        c.last_birth = t as i64;
        c.children += 1;
        c.d[4] = 0.0;
        if let Some(mi) = mate {
            let cname = child.name.clone();
            let mc = &mut w.creatures[mi];
            mc.children += 1;
            mc.d[4] = 0.0;
            mc.note(t, "d.parentOf", &cname);
        }
        let mate_name = mate.map(|mi| w.creatures[mi].name.clone()).unwrap_or_default();
        for s in c.stress.iter_mut() {
            *s *= 0.5;
        }
        c.note(t, "d.child", &child.name);
        child.note(t, "d.born", &format!("{}|{}", c.name, mate_name));
        w.add_creature(child);
        w.births += 1;
    }
}
