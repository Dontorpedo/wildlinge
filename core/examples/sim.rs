//! Native test run: cargo run --release --example sim -- [steps] [seed]
use std::time::Instant;
use wildlinge_core::api;
use wildlinge_core::metrics;
use wildlinge_core::world::World;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let steps: u32 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(12000);
    let seed: u32 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(42);
    let t0 = Instant::now();
    let mut w = World::new(seed);
    w.mirrors.push([2000.0, 1200.0]);
    w.mirrors.push([1000.0, 800.0]);
    println!("init {:.0} ms, pop {}", t0.elapsed().as_secs_f64() * 1000.0, w.creatures.len());
    let t1 = Instant::now();
    let mut pop_sum = 0usize;
    for i in 1..=steps {
        w.step();
        pop_sum += w.creatures.len();
        if i == 1500 {
            let id = w.creatures[0].id;
            w.adopt(id, Some(true), Some("Testling"));
            let (x, y) = (w.creatures[0].x, w.creatures[0].y);
            w.teach(&["kalu".to_string()], x, y);
            w.stroke(0, 1.0);
        }
        if i % 3000 == 0 {
            let mut now = [0usize; 9];
            let mut life = [0u64; 9];
            for c in &w.creatures {
                now[c.actv as usize] += 1;
                for k in 0..9 {
                    life[k] += c.actc[k] as u64;
                }
            }
            let mut bio = [0usize; 3];
            let mut fl = 0usize;
            for c in &w.creatures {
                if c.fly { fl += 1; continue; }
                bio[wildlinge_core::consts::BIOMES[w.bio_at(c.x, c.y)].water as usize] += 1;
            }
            let nf = w.creatures.iter().filter(|c| !c.fly && c.ab.ab[wildlinge_core::consts::A_FIN] < 0.15 && wildlinge_core::consts::BIOMES[w.bio_at(c.x, c.y)].water == 2).count();
            println!("  caches {} dep {} ret {} users {}", w.caches.len(), w.cache_dep, w.cache_ret, w.creatures.iter().filter(|c| c.cdep > 0).count());
            println!("  walkers land/shallow/deep {:?} fly {} deep-without-fins {}", bio, fl, nf);
            let tl = life.iter().sum::<u64>().max(1) as f64;
            let tn = now.iter().sum::<usize>().max(1) as f64;
            println!(
                "  act now% {:?} | life% {:?}",
                now.iter().map(|&v| (100.0 * v as f64 / tn).round() as u32).collect::<Vec<_>>(),
                life.iter().map(|&v| (100.0 * v as f64 / tl).round() as u32).collect::<Vec<_>>()
            );
            let r = w.series.last().unwrap();
            let el = t1.elapsed().as_secs_f64() * 1000.0;
            println!(
                "{:>6} pop {:>3} carn {:>3} sp {:>2} gen {:>3} | neur {:.1} conns {:.0} cert {:.2} wb {:.2} | rate {:.2} sent {} H {:.2} MI {:.2} topo {:.2} | phi {:.3} lz {:.2} | parts {:.1} kinds {} | modes c{} n{} e{:.2} x{} | {:.2} ms/step {:.1} us/cr",
                i, r.pop, r.carn, r.species, w.max_gen, r.neurons, r.conns, r.certainty, r.wellbeing, r.understand, w.sentences, r.entropy, r.mi, r.topo,
                r.phi, r.lz, r.parts, r.kinds, r.m_change, r.m_novelty, r.m_ecology, r.m_complexity, el / i as f64, el * 1000.0 / pop_sum as f64
            );
        }
    }
    let json = w.to_json(0.0);
    let w2 = World::from_json(&json);
    match w2 {
        Ok(mut w2) => {
            w2.step();
            for e in w.events.iter().filter(|e| e.k == "ev.pop" || e.k == "ev.gen" || e.k == "ev.word").take(12) { println!("  event day {:?} {} {:?}", World::day_of(e.t), e.k, e.p); }
    if w.rx_n > 0 && w.rc_n > 0 { println!("  react n {} hit {:.3} | control n {} hit {:.3}", w.rx_n, w.rx_hit as f32 / w.rx_n as f32, w.rc_n, w.rc_hit as f32 / w.rc_n as f32); }
    println!("  tri say {} heard {} ok {:.3} sentences {} understood {}/{}", w.tri_say, w.tri_n, w.tri_ok as f32 / w.tri_n.max(1) as f32, w.sentences, w.uw, w.hw);
    println!("  weltereignisse {} aktiv {} tote {:?}", w.wev_n, w.wev, w.deaths);
    if let Some(d) = &w.wod { println!("  wod {} n {} speakers {} spread {:.3}", d.word, d.n, d.speakers, d.spread); }
    println!("save {:.2} MB, restore ok pop {}", json.len() as f64 / 1048576.0, w2.creatures.len());
        }
        Err(e) => println!("RESTORE FAILED {}", e),
    }
    let mut a = World::new(7);
    let mut b = World::new(7);
    for _ in 0..600 {
        a.step();
        b.step();
    }
    let same = a.creatures.len() == b.creatures.len() && a.creatures.iter().zip(b.creatures.iter()).all(|(x, y)| x.x == y.x && x.y == y.y && x.energy == y.energy);
    println!("deterministic (same seed, 600 steps): {}", same);
    println!("milestones: {:?}", w.milestones.keys().collect::<Vec<_>>());
    println!("newick: {}...", &metrics::newick(&w).chars().take(160).collect::<String>());
    let p = api::panel(&w, w.creatures[0].id);
    println!("panel bytes {}", p.len());
    for e in w.events.iter().rev().take(8) {
        println!("  ev {} {:?}", e.k, e.p);
    }
}
