use wildlinge_core::api;
use wildlinge_core::world::World;
fn main() {
    let mut w = World::new(1);
    for _ in 0..20000 { w.step(); }
    let id = w.creatures[0].id;
    let p = api::panel(&w, id);
    let v: serde_json::Value = serde_json::from_str(&p).unwrap();
    println!("total {}", p.len());
    let mut ks: Vec<(String, usize)> = v.as_object().unwrap().iter().map(|(k, x)| (k.clone(), x.to_string().len())).collect();
    ks.sort_by(|a, b| b.1.cmp(&a.1));
    for (k, n) in ks.iter().take(12) { println!("{} {}", k, n); }
    if let Some(sel) = v.get("sel") { let mut ks: Vec<(String, usize)> = sel.as_object().map(|o| o.iter().map(|(k, x)| (k.clone(), x.to_string().len())).collect()).unwrap_or_default(); ks.sort_by(|a, b| b.1.cmp(&a.1)); for (k, n) in ks.iter().take(8) { println!("  sel.{} {}", k, n); } }
}
