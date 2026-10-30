use wildlinge_core::consts::*;
use wildlinge_core::world::World;

#[test]
fn legacy_genome_loads() {
    let w = World::new(5);
    let mut v = serde_json::to_value(&w.creatures[0]).unwrap();
    let g = v.get_mut("g").unwrap();
    g.as_object_mut().unwrap().remove("gv");
    let back = |id: u64| -> u64 {
        let (nin, nout) = (NIN as u64, NOUT as u64);
        if id < NIN_LEGACY as u64 {
            id
        } else if id < nin + nout {
            id - (nin - NIN_LEGACY as u64)
        } else {
            id - (nin - NIN_LEGACY as u64) - (nout - NOUT_LEGACY as u64)
        }
    };
    let mut ok_conns = 0;
    let conns = g.get_mut("conns").unwrap().as_array_mut().unwrap();
    conns.retain(|c| c["t"].as_u64().unwrap() != NIN as u64 + 9);
    for c in conns.iter_mut() {
        let (s, t) = (back(c["s"].as_u64().unwrap()), back(c["t"].as_u64().unwrap()));
        c["s"] = s.into();
        c["t"] = t.into();
        ok_conns += 1;
    }
    for n in g.get_mut("nodes").unwrap().as_array_mut().unwrap() {
        n["id"] = back(n["id"].as_u64().unwrap()).into();
    }
    let text = serde_json::to_string(&vec![v]).unwrap();
    let list = World::terra_from_json(&text).unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].g.gv, 1);
    assert_eq!(list[0].g.conns.len(), ok_conns);
    let mut c = list[0].clone();
    c.rebuild();
    c.net.run(&vec![0.5; NIN]);
    assert!(c.net.out(0).is_finite());
}
