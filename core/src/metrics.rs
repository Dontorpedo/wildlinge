//! Scientific measurements.
//! - Integrated information (Gaussian approximation, after Barrett and Seth 2011) and Lempel-Ziv complexity of brain activity
//! - MODES open-endedness metrics (Dolson, Lalejini, Jorgensen, Ofria 2019): change, novelty, ecology, complexity
//! - Bedau-Packard evolutionary activity statistics
//! - Language metrics: word entropy, mutual information word/meaning, topographic similarity
use crate::consts::*;
use crate::creature::*;
use crate::util::*;
use crate::world::*;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/* ---------- linear algebra helpers ---------- */

fn logdet(m: &mut [f64], n: usize) -> f64 {
    let mut tr = 0.0;
    for i in 0..n {
        tr += m[i * n + i];
    }
    let ridge = 1e-6 + 1e-4 * tr / n.max(1) as f64;
    for i in 0..n {
        m[i * n + i] += ridge;
    }
    let mut ld = 0.0;
    for j in 0..n {
        let mut s = m[j * n + j];
        for k in 0..j {
            s -= m[j * n + k] * m[j * n + k];
        }
        if s <= 1e-300 {
            return -690.0 * n as f64;
        }
        let l = s.sqrt();
        m[j * n + j] = l;
        ld += 2.0 * l.ln();
        for i in (j + 1)..n {
            let mut s2 = m[i * n + j];
            for k in 0..j {
                s2 -= m[i * n + k] * m[j * n + k];
            }
            m[i * n + j] = s2 / l;
        }
    }
    ld
}

fn sub_logdet(cov: &[f64], dim: usize, idx: &[usize]) -> f64 {
    let n = idx.len();
    let mut m = vec![0.0; n * n];
    for (a, &i) in idx.iter().enumerate() {
        for (b, &j) in idx.iter().enumerate() {
            m[a * n + b] = cov[i * dim + j];
        }
    }
    logdet(&mut m, n)
}

/// Rows of activity (oldest first) from the ring buffer, with the active (non constant) columns.
fn activity_rows(c: &Creature) -> Option<(Vec<Vec<f64>>, Vec<usize>)> {
    if c.act_n < ACT_T {
        return None;
    }
    let start = c.act_n % ACT_T;
    let rows: Vec<Vec<f64>> = (0..ACT_T)
        .map(|i| {
            let r = (start + i) % ACT_T;
            (0..ACT_K).map(|k| c.act[r * ACT_K + k] as f64).collect()
        })
        .collect();
    let mut cols = Vec::new();
    for k in 0..ACT_K {
        let mean = rows.iter().map(|r| r[k]).sum::<f64>() / ACT_T as f64;
        let var = rows.iter().map(|r| (r[k] - mean).powi(2)).sum::<f64>() / ACT_T as f64;
        if var > 1e-5 {
            cols.push(k);
        }
    }
    Some((rows, cols))
}

/// Gaussian integrated information: minimum over bipartitions of
/// I(X_past; X_now) - I(A_past; A_now) - I(B_past; B_now), normalized by min(|A|,|B|) to find the partition.
pub fn phi_gauss(c: &Creature, max_nodes: usize) -> Option<f32> {
    let (rows, mut cols) = activity_rows(c)?;
    cols.truncate(max_nodes);
    let n = cols.len();
    if n < 2 {
        return Some(0.0);
    }
    let dim = 2 * n;
    let samples = rows.len() - 1;
    let mut mean = vec![0.0; dim];
    let mut data = vec![0.0; samples * dim];
    for s in 0..samples {
        for (a, &k) in cols.iter().enumerate() {
            data[s * dim + a] = rows[s][k];
            data[s * dim + n + a] = rows[s + 1][k];
        }
    }
    for s in 0..samples {
        for d in 0..dim {
            mean[d] += data[s * dim + d];
        }
    }
    for m in mean.iter_mut() {
        *m /= samples as f64;
    }
    let mut cov = vec![0.0; dim * dim];
    for s in 0..samples {
        for i in 0..dim {
            let di = data[s * dim + i] - mean[i];
            for j in i..dim {
                cov[i * dim + j] += di * (data[s * dim + j] - mean[j]);
            }
        }
    }
    for i in 0..dim {
        for j in i..dim {
            cov[i * dim + j] /= (samples - 1) as f64;
            cov[j * dim + i] = cov[i * dim + j];
        }
    }
    let mi = |set: &[usize]| -> f64 {
        let past: Vec<usize> = set.to_vec();
        let now: Vec<usize> = set.iter().map(|&i| i + n).collect();
        let joint: Vec<usize> = past.iter().chain(now.iter()).copied().collect();
        (0.5 * (sub_logdet(&cov, dim, &past) + sub_logdet(&cov, dim, &now) - sub_logdet(&cov, dim, &joint))).max(0.0)
    };
    let all: Vec<usize> = (0..n).collect();
    let whole = mi(&all);
    let mut best_norm = f64::INFINITY;
    let mut best_raw = 0.0;
    for mask in 1u32..(1u32 << (n - 1)) {
        let a: Vec<usize> = (0..n).filter(|&i| mask & (1 << i) != 0).collect();
        let b: Vec<usize> = (0..n).filter(|&i| mask & (1 << i) == 0).collect();
        let raw = (whole - mi(&a) - mi(&b)).max(0.0);
        let norm = raw / a.len().min(b.len()) as f64;
        if norm < best_norm {
            best_norm = norm;
            best_raw = raw;
        }
    }
    Some(best_raw as f32)
}

/// Lempel-Ziv (1976) complexity of median-binarized activity, normalized.
pub fn lz_complexity(c: &Creature) -> Option<f32> {
    let (rows, cols) = activity_rows(c)?;
    if cols.is_empty() {
        return Some(0.0);
    }
    let mut bits: Vec<u8> = Vec::with_capacity(rows.len() * cols.len());
    let mut med = vec![0.0; cols.len()];
    for (a, &k) in cols.iter().enumerate() {
        let mut v: Vec<f64> = rows.iter().map(|r| r[k]).collect();
        v.sort_by(|x, y| x.partial_cmp(y).unwrap_or(std::cmp::Ordering::Equal));
        med[a] = v[v.len() / 2];
    }
    for r in &rows {
        for (a, &k) in cols.iter().enumerate() {
            bits.push(u8::from(r[k] > med[a]));
        }
    }
    let n = bits.len();
    let (mut i, mut k, mut l, mut kmax, mut comp) = (0usize, 1usize, 1usize, 1usize, 1usize);
    loop {
        if bits[i + k - 1] == bits[l + k - 1] {
            k += 1;
            if l + k > n {
                comp += 1;
                break;
            }
        } else {
            if k > kmax {
                kmax = k;
            }
            i += 1;
            if i == l {
                comp += 1;
                l += kmax;
                if l + 1 > n {
                    break;
                }
                i = 0;
                k = 1;
                kmax = 1;
            } else {
                k = 1;
            }
        }
    }
    let nf = n as f64;
    Some((comp as f64 / (nf / nf.log2())) as f32)
}

/* ---------- open-endedness ---------- */

fn bin(v: f32) -> u64 {
    if v < 0.05 {
        0
    } else if v < 0.25 {
        1
    } else if v < 0.6 {
        2
    } else {
        3
    }
}

pub fn phenotype_key(c: &Creature) -> u64 {
    let mut k = 0u64;
    for i in 0..NABIL {
        k = k * 4 + bin(c.ab.ab[i]);
    }
    k = k * 2 + u64::from(c.carn());
    k = k * 3 + (c.g.shape[S_SEG] as u64).min(3).saturating_sub(1);
    k
}

fn key_complexity(k: u64) -> u32 {
    let mut k = k / 6;
    let mut n = 0;
    for _ in 0..NABIL {
        if k % 4 >= 1 {
            n += 1;
        }
        k /= 4;
    }
    n
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Modes {
    pub snaps: Vec<Vec<u64>>,
    pub prev_persist: Vec<u64>,
    pub ever: Vec<u64>,
    pub change: u32,
    pub novelty: u32,
    pub ecology: f32,
    pub complexity: u32,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Bedau {
    pub act: BTreeMap<u64, (u64, u32)>,
    pub total: f32,
    pub mean: f32,
    pub new_n: u32,
    pub diversity: u32,
}

fn update_modes(w: &mut World) {
    let mut counts: BTreeMap<u64, u32> = BTreeMap::new();
    for c in &w.creatures {
        *counts.entry(phenotype_key(c)).or_insert(0) += 1;
    }
    let present: Vec<u64> = counts.keys().copied().collect();
    let m = &mut w.modes;
    m.snaps.push(present.clone());
    if m.snaps.len() > 3 {
        m.snaps.remove(0);
    }
    if m.snaps.len() < 3 {
        return;
    }
    let old = &m.snaps[0];
    let persist: Vec<u64> = present.iter().filter(|k| old.binary_search(k).is_ok()).copied().collect();
    m.change = persist.iter().filter(|k| m.prev_persist.binary_search(k).is_err()).count() as u32;
    m.novelty = persist.iter().filter(|k| m.ever.binary_search(k).is_err()).count() as u32;
    for k in &persist {
        if let Err(pos) = m.ever.binary_search(k) {
            m.ever.insert(pos, *k);
        }
    }
    if m.ever.len() > 20000 {
        m.ever.drain(0..5000);
    }
    let tot: u32 = persist.iter().map(|k| counts[k]).sum();
    m.ecology = if tot > 0 {
        -persist
            .iter()
            .map(|k| {
                let p = counts[k] as f32 / tot as f32;
                p * p.ln()
            })
            .sum::<f32>()
    } else {
        0.0
    };
    m.complexity = persist.iter().map(|&k| key_complexity(k)).max().unwrap_or(0);
    m.prev_persist = persist;
}

fn update_bedau(w: &mut World) {
    let mut counts: BTreeMap<u64, u32> = BTreeMap::new();
    for c in &w.creatures {
        *counts.entry(phenotype_key(c)).or_insert(0) += 1;
    }
    let t = w.t;
    let b = &mut w.bedau;
    let th = 2000u64;
    b.new_n = 0;
    for (k, n) in &counts {
        let e = b.act.entry(*k).or_insert((0, t));
        let before = e.0;
        e.0 += *n as u64;
        e.1 = t;
        if before < th && e.0 >= th {
            b.new_n += 1;
        }
    }
    b.act.retain(|_, v| t - v.1 < 30000);
    let extant: Vec<u64> = counts.keys().filter_map(|k| b.act.get(k).map(|v| v.0)).collect();
    b.diversity = extant.len() as u32;
    b.total = extant.iter().sum::<u64>() as f32;
    b.mean = if extant.is_empty() { 0.0 } else { b.total / extant.len() as f32 };
}

/* ---------- language ---------- */

pub fn language_metrics(w: &World) -> (f32, f32, f32) {
    let buf = &w.lang_buf;
    if buf.len() < 20 {
        return (0.0, 0.0, 0.0);
    }
    let mut wc: BTreeMap<&str, u32> = BTreeMap::new();
    let mut mc = [0u32; FD];
    let mut joint: BTreeMap<(&str, usize), u32> = BTreeMap::new();
    for u in buf {
        let mut mi = 0;
        for i in 1..FD {
            if u.vec[i] > u.vec[mi] {
                mi = i;
            }
        }
        *wc.entry(u.word.as_str()).or_insert(0) += 1;
        mc[mi] += 1;
        *joint.entry((u.word.as_str(), mi)).or_insert(0) += 1;
    }
    let n = buf.len() as f32;
    let h: f32 = -wc.values().map(|&v| {
        let p = v as f32 / n;
        p * p.log2()
    }).sum::<f32>();
    let mut mi = 0.0;
    for ((wd, m), &v) in &joint {
        let pj = v as f32 / n;
        let pw = wc[wd] as f32 / n;
        let pm = mc[*m] as f32 / n;
        mi += pj * (pj / (pw * pm)).log2();
    }
    let mut rng = Rng::new(w.t as u64 + 99);
    let pairs = 300.min(buf.len() * (buf.len() - 1) / 2);
    let mut md = Vec::with_capacity(pairs);
    let mut fd = Vec::with_capacity(pairs);
    for _ in 0..pairs {
        let a = rng.below(buf.len());
        let b = rng.below(buf.len());
        if a == b {
            continue;
        }
        md.push(vdist(&buf[a].vec, &buf[b].vec));
        fd.push(levenshtein(&buf[a].word, &buf[b].word) as f32);
    }
    (h, mi.max(0.0), spearman(&md, &fd))
}

pub fn spearman(a: &[f32], b: &[f32]) -> f32 {
    if a.len() < 3 {
        return 0.0;
    }
    let rank = |v: &[f32]| -> Vec<f32> {
        let mut idx: Vec<usize> = (0..v.len()).collect();
        idx.sort_by(|&i, &j| v[i].partial_cmp(&v[j]).unwrap_or(std::cmp::Ordering::Equal));
        let mut r = vec![0.0; v.len()];
        let mut i = 0;
        while i < idx.len() {
            let mut j = i;
            while j + 1 < idx.len() && v[idx[j + 1]] == v[idx[i]] {
                j += 1;
            }
            let avg = (i + j) as f32 / 2.0;
            for k in i..=j {
                r[idx[k]] = avg;
            }
            i = j + 1;
        }
        r
    };
    let (ra, rb) = (rank(a), rank(b));
    let n = ra.len() as f32;
    let (ma, mb) = (ra.iter().sum::<f32>() / n, rb.iter().sum::<f32>() / n);
    let (mut sab, mut saa, mut sbb) = (0.0, 0.0, 0.0);
    for i in 0..ra.len() {
        sab += (ra[i] - ma) * (rb[i] - mb);
        saa += (ra[i] - ma).powi(2);
        sbb += (rb[i] - mb).powi(2);
    }
    if saa <= 0.0 || sbb <= 0.0 {
        0.0
    } else {
        sab / (saa * sbb).sqrt()
    }
}

/* ---------- time series ---------- */

pub fn record_series(w: &mut World) {
    if w.t % 1500 == 0 {
        update_modes(w);
    }
    update_bedau(w);
    let n = w.creatures.len().max(1) as f32;
    let mut life_s = [0.0f32; 7];
    let mut mind_s = [0.0f32; 5];
    let (mut parts, mut cert, mut gut, mut gutn, mut wb, mut neur, mut conns) = (0.0, 0.0, 0.0, 0, 0.0, 0.0, 0.0);
    let mut kinds = [false; 10];
    let mut adults = 0;
    let mut adults_kids = 0;
    for c in &w.creatures {
        let (l, m, _) = life_criteria(c, w);
        for i in 0..7 {
            if l[i] {
                life_s[i] += 1.0;
            }
        }
        for i in 0..5 {
            if m[i] {
                mind_s[i] += 1.0;
            }
        }
        if c.mature() {
            adults += 1;
            if c.children > 0 {
                adults_kids += 1;
            }
        }
        parts += c.pp.len() as f32;
        cert += c.certainty();
        wb += c.wellbeing;
        neur += c.net.hidden as f32;
        conns += c.net.w.len() as f32;
        if c.gut_events >= 3 {
            gut += c.gut_own;
            gutn += 1;
        }
        for &k in &c.kinds {
            if (k as usize) != K_BUD {
                kinds[k as usize] = true;
            }
        }
    }
    for v in life_s.iter_mut() {
        *v /= n;
    }
    life_s[4] = if adults > 0 { adults_kids as f32 / adults as f32 } else { 0.0 };
    for v in mind_s.iter_mut() {
        *v /= n;
    }
    let mut rng = Rng::new(w.t as u64 * 31 + 5);
    let (mut div, mut dn) = (0.0, 0);
    if w.creatures.len() > 1 {
        for _ in 0..120 {
            let a = rng.below(w.creatures.len());
            let b = rng.below(w.creatures.len());
            if a != b {
                div += crate::genome::morph_dist(&w.creatures[a].morph, &w.creatures[b].morph);
                dn += 1;
            }
        }
    }
    let (mut phi, mut lz, mut pn) = (0.0, 0.0, 0);
    let mut idx: Vec<usize> = (0..w.creatures.len()).filter(|&i| w.creatures[i].act_n >= ACT_T).collect();
    if idx.len() > 12 {
        let mut pick = Vec::new();
        for _ in 0..12 {
            pick.push(idx[rng.below(idx.len())]);
        }
        idx = pick;
    }
    for &i in &idx {
        if let (Some(p), Some(l)) = (phi_gauss(&w.creatures[i], 8), lz_complexity(&w.creatures[i])) {
            phi += p;
            lz += l;
            pn += 1;
        }
    }
    let (ent, mi, topo) = language_metrics(w);
    let knock = KNOCKS.iter().enumerate().filter(|(i, _)| w.knock[*i]).map(|(_, k)| *k).collect::<Vec<_>>().join("+");
    w.life_share = Some((life_s.to_vec(), mind_s.to_vec()));
    let carn = w.creatures.iter().filter(|c| c.carn()).count() as u32;
    let row = Row {
        t: w.t,
        pop: w.creatures.len() as u32,
        herb: w.creatures.len() as u32 - carn,
        carn,
        species: w.species.iter().filter(|s| s.n >= 5).count() as u32,
        parts: r2(parts / n),
        kinds: kinds.iter().filter(|&&b| b).count() as u32,
        diversity: r3(if dn > 0 { div / dn as f32 } else { 0.0 }),
        neurons: r2(neur / n),
        conns: r2(conns / n),
        certainty: r3(cert / n),
        gut_own: r3(if gutn > 0 { gut / gutn as f32 } else { 0.0 }),
        mirror: r3(if w.mirror_tests > 0 { w.mirror_pass as f32 / w.mirror_tests as f32 } else { 0.0 }),
        understand: r3(w.rate),
        wellbeing: r3(wb / n),
        life: r3(life_s.iter().sum::<f32>() / 7.0),
        mind: r3(mind_s.iter().sum::<f32>() / 5.0),
        phi: r3(if pn > 0 { phi / pn as f32 } else { 0.0 }),
        lz: r3(if pn > 0 { lz / pn as f32 } else { 0.0 }),
        entropy: r3(ent),
        mi: r3(mi),
        topo: r3(topo),
        m_change: w.modes.change,
        m_novelty: w.modes.novelty,
        m_ecology: r3(w.modes.ecology),
        m_complexity: w.modes.complexity,
        b_activity: r2(w.bedau.mean),
        b_new: w.bedau.new_n,
        knock,
    };
    w.series.push(row);
    if w.series.len() > 2000 {
        let k = w.series.len() - 2000;
        w.series.drain(0..k);
    }
}

pub const CSV_COLS: [&str; 29] = [
    "t", "pop", "herb", "carn", "species", "parts", "kinds", "diversity", "neurons", "conns", "certainty", "gutOwn", "mirror",
    "understand", "wellbeing", "life", "mind", "phi", "lz", "entropy", "mi", "topo", "mChange", "mNovelty", "mEcology",
    "mComplexity", "bActivity", "bNew", "knock",
];

pub fn row_values(r: &Row) -> Vec<String> {
    vec![
        r.t.to_string(),
        r.pop.to_string(),
        r.herb.to_string(),
        r.carn.to_string(),
        r.species.to_string(),
        r.parts.to_string(),
        r.kinds.to_string(),
        r.diversity.to_string(),
        r.neurons.to_string(),
        r.conns.to_string(),
        r.certainty.to_string(),
        r.gut_own.to_string(),
        r.mirror.to_string(),
        r.understand.to_string(),
        r.wellbeing.to_string(),
        r.life.to_string(),
        r.mind.to_string(),
        r.phi.to_string(),
        r.lz.to_string(),
        r.entropy.to_string(),
        r.mi.to_string(),
        r.topo.to_string(),
        r.m_change.to_string(),
        r.m_novelty.to_string(),
        r.m_ecology.to_string(),
        r.m_complexity.to_string(),
        r.b_activity.to_string(),
        r.b_new.to_string(),
        r.knock.clone(),
    ]
}

pub fn series_csv(w: &World) -> String {
    let mut s = CSV_COLS.join(";");
    for r in &w.series {
        s.push('\n');
        s.push_str(&row_values(r).join(";"));
    }
    s.push('\n');
    s
}

/* ---------- phylogeny ---------- */

fn newick_name(r: &SpeciesRec) -> String {
    let n: String = r.name.chars().filter(|c| c.is_alphanumeric()).collect();
    format!("{}_{}", n, r.id)
}

pub fn newick(w: &World) -> String {
    let recs = &w.phylo;
    let ids: Vec<i32> = recs.iter().map(|r| r.id).collect();
    let mut kids: BTreeMap<i32, Vec<usize>> = BTreeMap::new();
    for (i, r) in recs.iter().enumerate() {
        let p = if ids.contains(&r.parent) { r.parent } else { -1 };
        kids.entry(p).or_default().push(i);
    }
    fn node(i: usize, recs: &[SpeciesRec], kids: &BTreeMap<i32, Vec<usize>>, now: u32, depth: usize) -> String {
        let r = &recs[i];
        let end = if r.died >= 0 { r.died as u32 } else { now };
        let len = end.saturating_sub(r.born) as f32 / YEAR_LEN as f32;
        let mut s = String::new();
        if let Some(ch) = kids.get(&r.id) {
            if depth < 200 {
                let parts: Vec<String> = ch.iter().map(|&c| node(c, recs, kids, now, depth + 1)).collect();
                s.push('(');
                s.push_str(&parts.join(","));
                s.push(')');
            }
        }
        s.push_str(&newick_name(r));
        s.push_str(&format!(":{:.3}", len.max(0.001)));
        s
    }
    let roots = kids.get(&-1).cloned().unwrap_or_default();
    let parts: Vec<String> = roots.iter().map(|&i| node(i, recs, &kids, w.t, 0)).collect();
    format!("({})Ursprung;", parts.join(","))
}

/* ---------- export for exact IIT with PyPhi ---------- */

pub fn pyphi_export(c: &Creature) -> serde_json::Value {
    let net = &c.net;
    let base = NIN + NOUT;
    let mut nodes: Vec<usize> = (base..base + net.hidden.min(8)).collect();
    let mut o = 0;
    while nodes.len() < 8 && o < NOUT {
        nodes.push(NIN + o);
        o += 1;
    }
    let n = nodes.len();
    let pos = |node: usize| nodes.iter().position(|&x| x == node);
    let mut wm = vec![vec![0.0f32; n]; n];
    let mut bias = vec![0.0f32; n];
    for (oi, &node) in net.order.iter().enumerate() {
        let ti = match pos(node as usize) {
            Some(p) => p,
            None => continue,
        };
        for ci in net.start[oi] as usize..net.start[oi + 1] as usize {
            let s = net.src[ci] as usize;
            match pos(s) {
                Some(si) => wm[ti][si] += net.w[ci],
                None => bias[ti] += net.w[ci] * net.vals[s],
            }
        }
    }
    let state: Vec<u8> = nodes.iter().map(|&i| u8::from(net.vals[i] > 0.0)).collect();
    let labels: Vec<String> = nodes.iter().map(|&i| if i >= base { format!("H{}", i - base) } else { format!("O{}", i - NIN) }).collect();
    serde_json::json!({
        "creature": c.id, "name": c.name, "labels": labels, "weights": wm, "bias": bias, "state": state,
        "note": "weights[i][j] = influence of node j on node i; node i is on in the next step if sum_j weights[i][j]*s_j + bias[i] > 0"
    })
}

/* ---------- statistics ---------- */

fn ln_gamma(x: f64) -> f64 {
    let c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let mut y = x;
    let tmp = x + 5.5 - (x + 0.5) * (x + 5.5).ln();
    let mut ser = 1.000000000190015;
    for &cj in &c {
        y += 1.0;
        ser += cj / y;
    }
    -tmp + (2.5066282746310005 * ser / x).ln()
}

fn betacf(a: f64, b: f64, x: f64) -> f64 {
    let (qab, qap, qam) = (a + b, a + 1.0, a - 1.0);
    let mut c = 1.0;
    let mut d = 1.0 - qab * x / qap;
    if d.abs() < 1e-30 {
        d = 1e-30;
    }
    d = 1.0 / d;
    let mut h = d;
    for m in 1..200 {
        let m = m as f64;
        let m2 = 2.0 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1.0 + aa * d;
        if d.abs() < 1e-30 {
            d = 1e-30;
        }
        c = 1.0 + aa / c;
        if c.abs() < 1e-30 {
            c = 1e-30;
        }
        d = 1.0 / d;
        h *= d * c;
        let aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1.0 + aa * d;
        if d.abs() < 1e-30 {
            d = 1e-30;
        }
        c = 1.0 + aa / c;
        if c.abs() < 1e-30 {
            c = 1e-30;
        }
        d = 1.0 / d;
        let del = d * c;
        h *= del;
        if (del - 1.0).abs() < 3e-12 {
            break;
        }
    }
    h
}

fn inc_beta(a: f64, b: f64, x: f64) -> f64 {
    if x <= 0.0 {
        return 0.0;
    }
    if x >= 1.0 {
        return 1.0;
    }
    let bt = (ln_gamma(a + b) - ln_gamma(a) - ln_gamma(b) + a * x.ln() + b * (1.0 - x).ln()).exp();
    if x < (a + 1.0) / (a + b + 2.0) {
        bt * betacf(a, b, x) / a
    } else {
        1.0 - bt * betacf(b, a, 1.0 - x) / b
    }
}

/// Welch two-sample t-test: returns (t, degrees of freedom, two-sided p-value).
pub fn welch(a: &[f64], b: &[f64]) -> (f64, f64, f64) {
    let (na, nb) = (a.len() as f64, b.len() as f64);
    if na < 2.0 || nb < 2.0 {
        return (0.0, 0.0, 1.0);
    }
    let ma = a.iter().sum::<f64>() / na;
    let mb = b.iter().sum::<f64>() / nb;
    let va = a.iter().map(|x| (x - ma).powi(2)).sum::<f64>() / (na - 1.0);
    let vb = b.iter().map(|x| (x - mb).powi(2)).sum::<f64>() / (nb - 1.0);
    let se2 = va / na + vb / nb;
    if se2 <= 1e-300 {
        return (0.0, na + nb - 2.0, if (ma - mb).abs() < 1e-12 { 1.0 } else { 0.0 });
    }
    let t = (ma - mb) / se2.sqrt();
    let df = se2 * se2 / ((va / na).powi(2) / (na - 1.0) + (vb / nb).powi(2) / (nb - 1.0));
    let p = inc_beta(df / 2.0, 0.5, df / (df + t * t));
    (t, df, p.clamp(0.0, 1.0))
}

/* ---------- replicated experiments ---------- */

pub const LAB_METRICS: [&str; 12] =
    ["pop", "life", "mind", "certainty", "understand", "parts", "diversity", "wellbeing", "neurons", "phi", "mNovelty", "species"];

fn lab_value(r: &Row, k: &str) -> f64 {
    (match k {
        "pop" => r.pop as f32,
        "life" => r.life,
        "mind" => r.mind,
        "certainty" => r.certainty,
        "understand" => r.understand,
        "parts" => r.parts,
        "diversity" => r.diversity,
        "wellbeing" => r.wellbeing,
        "neurons" => r.neurons,
        "phi" => r.phi,
        "mNovelty" => r.m_novelty as f32,
        "species" => r.species as f32,
        _ => 0.0,
    }) as f64
}

pub struct Lab {
    pub worlds: Vec<(World, bool)>,
    pub steps: u32,
    pub done: u32,
    pub knock: usize,
    pub seed: u32,
}

impl Lab {
    pub fn new(seed: u32, reps: usize, steps: u32, knock: usize) -> Lab {
        let mut worlds = Vec::new();
        for i in 0..reps {
            let s = seed.wrapping_add(i as u32 * 7919);
            for &treated in &[false, true] {
                let mut w = World::new(s);
                if treated {
                    w.knock[knock] = true;
                }
                worlds.push((w, treated));
            }
        }
        Lab { worlds, steps, done: 0, knock, seed }
    }
    /// Advance all worlds by up to `n` steps each; returns true when finished.
    pub fn run(&mut self, n: u32) -> bool {
        let todo = n.min(self.steps - self.done);
        for (w, _) in self.worlds.iter_mut() {
            for _ in 0..todo {
                w.step();
            }
        }
        self.done += todo;
        self.done >= self.steps
    }
    pub fn result(&mut self) -> serde_json::Value {
        for (w, _) in self.worlds.iter_mut() {
            record_series(w);
        }
        let mut out = Vec::new();
        for k in LAB_METRICS.iter() {
            let ctrl: Vec<f64> = self.worlds.iter().filter(|x| !x.1).filter_map(|x| x.0.series.last()).map(|r| lab_value(r, k)).collect();
            let trt: Vec<f64> = self.worlds.iter().filter(|x| x.1).filter_map(|x| x.0.series.last()).map(|r| lab_value(r, k)).collect();
            let (t, df, p) = welch(&ctrl, &trt);
            let mean = |v: &[f64]| v.iter().sum::<f64>() / v.len().max(1) as f64;
            let sd = |v: &[f64]| {
                let m = mean(v);
                (v.iter().map(|x| (x - m).powi(2)).sum::<f64>() / (v.len().max(2) - 1) as f64).sqrt()
            };
            out.push(serde_json::json!({ "metric": k, "control": ctrl, "treated": trt, "meanC": mean(&ctrl), "meanT": mean(&trt),
                "sdC": sd(&ctrl), "sdT": sd(&trt), "t": t, "df": df, "p": p }));
        }
        serde_json::json!({ "knock": KNOCKS[self.knock], "steps": self.steps, "reps": self.worlds.len() / 2, "seed": self.seed, "results": out })
    }
}
