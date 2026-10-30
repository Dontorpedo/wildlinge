//! Wildlinge server: one persistent shared world, WebSocket access, one terrarium per visitor token.
use flate2::{read::GzDecoder, write::GzEncoder, write::ZlibEncoder, Compression};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tungstenite::protocol::WebSocketConfig;
use tungstenite::{Message, WebSocket};
use wildlinge_core::api;
use wildlinge_core::world::World;

const KRAFT_MAX: f32 = 100.0;
const KRAFT_REGEN: f32 = 0.8;
const MAX_CLIENTS: usize = 80;
const MAX_STORES: usize = 4000;
const MIN_WILD: usize = 200;
const FRAME_MS: u64 = 125;
const PANEL_MS: u64 = 450;
const SAVE_S: u64 = 60;

enum Out {
    Text(String),
    Bin(Vec<u8>),
}
enum ToSim {
    Join { cid: u64, tx: mpsc::SyncSender<Out> },
    Msg { cid: u64, text: String },
    Leave { cid: u64 },
}

struct Client {
    tx: mpsc::SyncSender<Out>,
    token: String,
    owner: u64,
    ready: bool,
    hidden: bool,
    view: [f32; 5],
    sel: u32,
    next_frame: Instant,
    next_panel: Instant,
    next_kraft: Instant,
    bucket: f32,
    bucket_t: Instant,
}

struct Keeper {
    kraft: f32,
    t: Instant,
    seen: u64,
}

fn fnv(s: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h | 1
}
fn now_s() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}
fn valid_token(t: &str) -> bool {
    t.len() >= 16 && t.len() <= 64 && t.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
fn zlib(data: &[u8]) -> Vec<u8> {
    let mut e = ZlibEncoder::new(Vec::with_capacity(data.len() / 3 + 64), Compression::new(1));
    let _ = e.write_all(data);
    e.finish().unwrap_or_default()
}
fn read_gz(p: &Path) -> Option<String> {
    let f = std::fs::File::open(p).ok()?;
    let mut s = String::new();
    GzDecoder::new(f).read_to_string(&mut s).ok()?;
    Some(s)
}
fn write_gz(p: &Path, text: &str) -> std::io::Result<()> {
    let tmp = p.with_extension("tmp");
    {
        let f = std::fs::File::create(&tmp)?;
        let mut e = GzEncoder::new(f, Compression::new(3));
        e.write_all(text.as_bytes())?;
        e.finish()?;
    }
    if p.exists() {
        let _ = std::fs::copy(p, p.with_extension("bak"));
    }
    std::fs::rename(&tmp, p)
}
fn num(v: &Value, k: &str, a: f64, b: f64, d: f64) -> f64 {
    v.get(k).and_then(|x| x.as_f64()).filter(|x| x.is_finite()).map(|x| x.clamp(a, b)).unwrap_or(d)
}
fn text_msg(v: Value) -> Out {
    Out::Text(v.to_string())
}
fn zmsg(v: Value) -> Out {
    let body = zlib(v.to_string().as_bytes());
    let mut b = Vec::with_capacity(body.len() + 1);
    b.push(3);
    b.extend_from_slice(&body);
    Out::Bin(b)
}

/* ---------------- sim thread ---------------- */

struct Sim {
    w: World,
    clients: HashMap<u64, Client>,
    keepers: HashMap<String, Keeper>,
    stores: HashMap<String, Vec<wildlinge_core::creature::Creature>>,
    cs: Vec<f32>,
    fd: Vec<f32>,
    step_ms: f32,
    dir: PathBuf,
    saving: Arc<AtomicBool>,
    v_day: u64,
    v_set: HashSet<u64>,
    v_peak: usize,
}

fn ymd(days: u64) -> String {
    let z = days as i64 + 719468;
    let era = z.div_euclid(146097);
    let doe = z.rem_euclid(146097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!("{:04}-{:02}-{:02}", y, m, d)
}

impl Sim {
    fn visit(&mut self, owner: u64) {
        let day = now_s() / 86400;
        if day != self.v_day {
            if self.v_day != 0 {
                if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(self.dir.join("visits.csv")) {
                    let _ = writeln!(f, "{},{},{}", ymd(self.v_day), self.v_set.len(), self.v_peak);
                }
            }
            self.v_day = day;
            self.v_set.clear();
            self.v_peak = 0;
        }
        self.v_set.insert(owner);
        self.v_peak = self.v_peak.max(self.clients.len());
        let _ = std::fs::write(self.dir.join("visits-today.csv"), format!("{},{},{}\n", ymd(day), self.v_set.len(), self.v_peak));
    }

    fn keeper(&mut self, token: &str) -> &mut Keeper {
        let now = Instant::now();
        let k = self.keepers.entry(token.to_string()).or_insert(Keeper { kraft: KRAFT_MAX, t: now, seen: now_s() });
        let dt = now.duration_since(k.t).as_secs_f32();
        k.kraft = (k.kraft + dt * KRAFT_REGEN).min(KRAFT_MAX);
        k.t = now;
        k.seen = now_s();
        k
    }
    fn pay(&mut self, token: &str, cost: f32) -> bool {
        let k = self.keeper(token);
        if k.kraft >= cost {
            k.kraft -= cost;
            true
        } else {
            false
        }
    }
    fn send(&mut self, cid: u64, o: Out, droppable: bool) {
        let mut kill = false;
        if let Some(c) = self.clients.get(&cid) {
            match c.tx.try_send(o) {
                Ok(()) => {}
                Err(mpsc::TrySendError::Full(_)) => kill = !droppable,
                Err(_) => kill = true,
            }
        }
        if kill {
            self.clients.remove(&cid);
        }
    }
    fn toast(&mut self, cid: u64, k: &str, p: Vec<Value>) {
        self.send(cid, text_msg(json!({"type": "toast", "o": {"k": k, "p": p}})), true);
    }
    fn init(&mut self, cid: u64) {
        let (gw, gh, bio) = match self.w.map.as_ref() {
            Some(m) => (m.gw, m.gh, m.bio.clone()),
            None => return,
        };
        let head = json!({"type": "init", "seed": self.w.seed, "fresh": false, "server": true}).to_string();
        let mut b = Vec::with_capacity(bio.len() + head.len() + 16);
        b.push(2);
        b.extend_from_slice(&(head.len() as u32).to_le_bytes());
        b.extend_from_slice(head.as_bytes());
        b.extend_from_slice(&(gw as u16).to_le_bytes());
        b.extend_from_slice(&(gh as u16).to_le_bytes());
        b.extend_from_slice(&bio);
        self.send(cid, Out::Bin(b), false);
    }

    fn handle(&mut self, cid: u64, text: &str) {
        let v: Value = match serde_json::from_str(text) {
            Ok(v) => v,
            Err(_) => return,
        };
        let typ = v.get("type").and_then(|x| x.as_str()).unwrap_or("").to_string();
        let now = Instant::now();
        {
            let c = match self.clients.get_mut(&cid) {
                Some(c) => c,
                None => return,
            };
            c.bucket = (c.bucket + now.duration_since(c.bucket_t).as_secs_f32() * 30.0).min(60.0);
            c.bucket_t = now;
            if c.bucket < 1.0 {
                return;
            }
            c.bucket -= 1.0;
        }
        if typ == "hello" {
            let tok = v.get("token").and_then(|x| x.as_str()).unwrap_or("").to_string();
            if !valid_token(&tok) {
                self.clients.remove(&cid);
                return;
            }
            if self.keepers.len() > 20000 {
                let cut = now_s().saturating_sub(7 * 86400);
                self.keepers.retain(|_, k| k.seen > cut);
            }
            if let Some(c) = self.clients.get_mut(&cid) {
                c.owner = fnv(&tok);
                c.token = tok.clone();
                c.ready = true;
            }
            self.visit(fnv(&tok));
            self.init(cid);
            return;
        }
        let (token, owner, ready) = match self.clients.get(&cid) {
            Some(c) => (c.token.clone(), c.owner, c.ready),
            None => return,
        };
        if !ready {
            return;
        }
        match typ.as_str() {
            "view" => {
                if let Some(c) = self.clients.get_mut(&cid) {
                    c.view = [
                        num(&v, "x0", -1e4, 1e4, 0.0) as f32,
                        num(&v, "y0", -1e4, 1e4, 0.0) as f32,
                        num(&v, "x1", -1e4, 1e4, 1600.0) as f32,
                        num(&v, "y1", -1e4, 1e4, 800.0) as f32,
                        num(&v, "wpp", 0.5, 20.0, 2.5) as f32,
                    ];
                }
            }
            "select" => {
                if let Some(c) = self.clients.get_mut(&cid) {
                    c.sel = num(&v, "id", 0.0, 4.0e9, 0.0) as u32;
                    c.next_panel = now;
                }
            }
            "hidden" => {
                if let Some(c) = self.clients.get_mut(&cid) {
                    c.hidden = v.get("v").and_then(|x| x.as_bool()).unwrap_or(false);
                    c.next_frame = now;
                }
            }
            "pick" => {
                let r = api::command(&mut self.w, &json!({"type": "pick", "x": v["x"], "y": v["y"], "r": v["r"]}));
                let id = r.get("sel").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
                if let Some(c) = self.clients.get_mut(&cid) {
                    c.sel = id;
                    c.next_panel = now;
                }
                self.send(cid, text_msg(json!({"type": "sel", "id": id})), true);
            }
            "action" => {
                let tool = v.get("tool").and_then(|x| x.as_str()).unwrap_or("").to_string();
                let cost = match tool.as_str() {
                    "stroke" => 3.0,
                    "scold" => 5.0,
                    "say" => 4.0,
                    "teach" => 8.0,
                    "food" => 15.0,
                    "mirror" => 30.0,
                    _ => return,
                };
                if !self.pay(&token, cost) {
                    self.toast(cid, "t.kraft", vec![]);
                    return;
                }
                let toks: Vec<Value> = v.get("tokens").and_then(|t| t.as_array()).map(|a| a.iter().take(3).cloned().collect()).unwrap_or_default();
                self.w.viewer = owner;
                let r = api::command(&mut self.w, &json!({"type": "action", "tool": tool, "x": v["x"], "y": v["y"], "r": v["r"], "tokens": toks}));
                self.send(cid, text_msg(json!({"type": "toast", "o": r.get("toast").cloned().unwrap_or(Value::Null)})), true);
            }
            "move" => {
                let id = num(&v, "id", 0.0, 4.0e9, 0.0) as u64;
                let k = self.keeper(&token).kraft;
                if k < 10.0 {
                    self.toast(cid, "t.kraft", vec![]);
                    return;
                }
                let maxd = (k - 10.0) * 60.0;
                self.w.viewer = owner;
                let r = api::command(&mut self.w, &json!({"type": "move", "id": id, "x": v["x"], "y": v["y"], "max": maxd}));
                if r.get("ok").and_then(|x| x.as_bool()) == Some(true) {
                    let d = r.get("d").and_then(|x| x.as_f64()).unwrap_or(0.0) as f32;
                    self.pay(&token, 10.0 + d / 60.0);
                    self.toast(cid, "t.moved", vec![]);
                } else if r.get("far").is_some() {
                    self.toast(cid, "t.moveFar", vec![]);
                } else if r.get("water").is_some() {
                    self.toast(cid, "t.moveWater", vec![]);
                }
            }
            "tcmd" => self.tcmd(cid, &token, owner, &v),
            "series" => {
                let from = num(&v, "from", 0.0, 1e9, 0.0) as usize;
                let from = from.min(self.w.series.len());
                let rows: Vec<Vec<String>> = self.w.series[from..].iter().map(wildlinge_core::metrics::row_values).collect();
                let j = json!({"cols": wildlinge_core::metrics::CSV_COLS, "from": from, "total": self.w.series.len(), "rows": rows}).to_string();
                self.send(cid, zmsg(json!({"type": "series", "json": j})), true);
            }
            _ => {}
        }
    }

    fn tcmd(&mut self, cid: u64, token: &str, owner: u64, v: &Value) {
        let rid = v.get("rid").cloned().unwrap_or(Value::Null);
        let c = v.get("c").cloned().unwrap_or(Value::Null);
        let ct = c.get("type").and_then(|x| x.as_str()).unwrap_or("").to_string();
        if !["take", "tlist", "trename", "tbreed", "release", "tdie", "tteach"].contains(&ct.as_str()) {
            self.send(cid, text_msg(json!({"type": "tres", "rid": rid, "res": {}})), false);
            return;
        }
        if ct == "take" {
            if self.w.creatures.len() < MIN_WILD {
                self.send(cid, text_msg(json!({"type": "tres", "rid": rid, "res": {"ok": false, "low": true}})), false);
                return;
            }
            if self.stores.len() >= MAX_STORES && !self.stores.contains_key(token) {
                self.send(cid, text_msg(json!({"type": "tres", "rid": rid, "res": {"ok": false}})), false);
                return;
            }
            if !self.pay(token, 25.0) {
                self.send(cid, text_msg(json!({"type": "tres", "rid": rid, "res": {"ok": false, "kraft": true}})), false);
                return;
            }
        }
        if ct == "tteach" && !self.pay(token, 5.0) {
            self.send(cid, text_msg(json!({"type": "tres", "rid": rid, "res": {"ok": false, "kraft": true}})), false);
            return;
        }
        let mut mine = self.stores.remove(token).unwrap_or_default();
        std::mem::swap(&mut self.w.terra, &mut mine);
        self.w.viewer = owner;
        let res = api::command(&mut self.w, &c);
        std::mem::swap(&mut self.w.terra, &mut mine);
        if !mine.is_empty() {
            self.stores.insert(token.to_string(), mine);
        }
        self.send(cid, text_msg(json!({"type": "tres", "rid": rid, "res": res})), false);
    }

    fn frame(&mut self, cid: u64) {
        let (view, sel, owner) = match self.clients.get(&cid) {
            Some(c) => (c.view, c.sel, c.owner),
            None => return,
        };
        self.w.viewer = owner;
        let meta = api::frame(&mut self.w, view[0], view[1], view[2], view[3], view[4], sel, &mut self.cs, &mut self.fd);
        let hdr = format!("{{\"type\":\"frame\",\"running\":true,\"stepMs\":{:.3},\"meta\":{}}}", self.step_ms, meta);
        let mut raw = Vec::with_capacity(hdr.len() + (self.cs.len() + self.fd.len()) * 4);
        raw.extend_from_slice(hdr.as_bytes());
        for x in &self.cs {
            raw.extend_from_slice(&x.to_le_bytes());
        }
        for x in &self.fd {
            raw.extend_from_slice(&x.to_le_bytes());
        }
        let z = zlib(&raw);
        let mut b = Vec::with_capacity(z.len() + 13);
        b.push(1);
        b.extend_from_slice(&(hdr.len() as u32).to_le_bytes());
        b.extend_from_slice(&(self.cs.len() as u32).to_le_bytes());
        b.extend_from_slice(&(self.fd.len() as u32).to_le_bytes());
        b.extend_from_slice(&z);
        self.send(cid, Out::Bin(b), true);
    }

    fn panel(&mut self, cid: u64) {
        let (sel, owner) = match self.clients.get(&cid) {
            Some(c) => (c.sel, c.owner),
            None => return,
        };
        self.w.viewer = owner;
        let p = api::panel(&self.w, sel);
        self.send(cid, zmsg(json!({"type": "panel", "json": p})), true);
    }

    fn save(&mut self, wait: bool) {
        if self.saving.swap(true, Ordering::SeqCst) {
            return;
        }
        let text = self.w.to_json(now_s() as f64 * 1000.0);
        let mut map = serde_json::Map::new();
        for (k, v) in self.stores.iter_mut() {
            map.insert(k.clone(), Value::String(World::terra_to_json(v)));
        }
        let ter = Value::Object(map).to_string();
        let dir = self.dir.clone();
        let flag = self.saving.clone();
        let job = move || {
            let a = write_gz(&dir.join("world.json.gz"), &text);
            let b = write_gz(&dir.join("terraria.json.gz"), &ter);
            if let Err(e) = a.and(b) {
                eprintln!("save failed: {}", e);
            }
            flag.store(false, Ordering::SeqCst);
        };
        if wait {
            job();
        } else {
            thread::spawn(job);
        }
    }
}

fn sim_thread(rx: mpsc::Receiver<ToSim>, dir: PathBuf, seed: u32, rate: f32, stop: Arc<AtomicBool>) {
    let world = match read_gz(&dir.join("world.json.gz")).map(|t| World::from_json(&t)) {
        Some(Ok(w)) => {
            eprintln!("world loaded: t={} creatures={}", w.t, w.creatures.len());
            w
        }
        other => {
            if let Some(Err(e)) = other {
                eprintln!("world file unreadable: {} (trying backup)", e);
            }
            match read_gz(&dir.join("world.bak")).map(|t| World::from_json(&t)) {
                Some(Ok(w)) => w,
                _ => {
                    eprintln!("new world, seed {}", seed);
                    World::new(seed)
                }
            }
        }
    };
    let mut sim = Sim {
        w: world,
        clients: HashMap::new(),
        keepers: HashMap::new(),
        stores: HashMap::new(),
        cs: Vec::new(),
        fd: Vec::new(),
        step_ms: 1.0,
        dir: dir.clone(),
        saving: Arc::new(AtomicBool::new(false)),
        v_day: 0,
        v_set: HashSet::new(),
        v_peak: 0,
    };
    if let Some(text) = read_gz(&dir.join("terraria.json.gz")) {
        if let Ok(Value::Object(m)) = serde_json::from_str::<Value>(&text) {
            let mut maxid = 0;
            for (k, v) in m {
                if let Some(s) = v.as_str() {
                    if let Ok(list) = World::terra_from_json(s) {
                        maxid = maxid.max(list.iter().map(|c| c.id).max().unwrap_or(0));
                        if !list.is_empty() && valid_token(&k) {
                            sim.stores.insert(k, list);
                        }
                    }
                }
            }
            sim.w.next_id = sim.w.next_id.max(maxid + 1);
        }
    }
    sim.w.terra.clear();
    let step_dt = Duration::from_secs_f32(1.0 / rate);
    let mut next_step = Instant::now();
    let mut next_save = Instant::now() + Duration::from_secs(SAVE_S);
    loop {
        while let Ok(m) = rx.try_recv() {
            match m {
                ToSim::Join { cid, tx } => {
                    let now = Instant::now();
                    sim.clients.insert(
                        cid,
                        Client {
                            tx,
                            token: String::new(),
                            owner: 0,
                            ready: false,
                            hidden: false,
                            view: [0.0, 0.0, 1600.0, 800.0, 2.5],
                            sel: 0,
                            next_frame: now,
                            next_panel: now,
                            next_kraft: now,
                            bucket: 60.0,
                            bucket_t: now,
                        },
                    );
                }
                ToSim::Msg { cid, text } => sim.handle(cid, &text),
                ToSim::Leave { cid } => {
                    sim.clients.remove(&cid);
                }
            }
        }
        let now = Instant::now();
        let mut n = 0;
        while next_step <= now && n < 4 {
            let t0 = Instant::now();
            sim.w.step();
            sim.step_ms = sim.step_ms * 0.95 + t0.elapsed().as_secs_f32() * 1000.0 * 0.05;
            next_step += step_dt;
            n += 1;
        }
        if next_step + Duration::from_secs(1) < now {
            next_step = now;
        }
        let ids: Vec<u64> = sim.clients.keys().cloned().collect();
        for cid in ids {
            let (ready, hidden, nf, np, nk) = match sim.clients.get(&cid) {
                Some(c) => (c.ready, c.hidden, c.next_frame, c.next_panel, c.next_kraft),
                None => continue,
            };
            if !ready {
                continue;
            }
            if !hidden && now >= nf {
                if let Some(c) = sim.clients.get_mut(&cid) {
                    c.next_frame = now + Duration::from_millis(FRAME_MS);
                }
                sim.frame(cid);
            }
            if !hidden && now >= np {
                if let Some(c) = sim.clients.get_mut(&cid) {
                    c.next_panel = now + Duration::from_millis(PANEL_MS);
                }
                sim.panel(cid);
            }
            if now >= nk {
                let tok = sim.clients.get(&cid).map(|c| c.token.clone()).unwrap_or_default();
                let k = sim.keeper(&tok).kraft;
                let n = sim.clients.len();
                if let Some(c) = sim.clients.get_mut(&cid) {
                    c.next_kraft = now + Duration::from_millis(1000);
                }
                sim.send(cid, text_msg(json!({"type": "kraft", "v": k, "max": KRAFT_MAX, "online": n})), true);
            }
        }
        if now >= next_save {
            next_save = now + Duration::from_secs(SAVE_S);
            sim.save(false);
        }
        if stop.load(Ordering::SeqCst) {
            eprintln!("stopping, saving");
            while sim.saving.load(Ordering::SeqCst) {
                thread::sleep(Duration::from_millis(50));
            }
            sim.save(true);
            return;
        }
        thread::sleep(Duration::from_millis(4));
    }
}

/* ---------------- connections ---------------- */

fn client_thread(stream: TcpStream, cid: u64, to_sim: mpsc::Sender<ToSim>, origin: Option<String>) {
    let _ = stream.set_nodelay(true);
    let _ = stream.set_read_timeout(Some(Duration::from_millis(30)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));
    let cfg = WebSocketConfig::default().max_message_size(Some(64 * 1024)).max_frame_size(Some(64 * 1024));
    let cb = |req: &tungstenite::handshake::server::Request, resp: tungstenite::handshake::server::Response| {
        let got = req.headers().get("origin").and_then(|h| h.to_str().ok()).unwrap_or("");
        let host = |u: &str| u.split("://").last().unwrap_or("").split('/').next().unwrap_or("").rsplit_once(':').filter(|(_, p)| p.chars().all(|c| c.is_ascii_digit())).map(|(h, _)| h).unwrap_or_else(|| u.split("://").last().unwrap_or("").split('/').next().unwrap_or("")).to_ascii_lowercase();
        let hh = req.headers().get("host").and_then(|h| h.to_str().ok()).unwrap_or("");
        let ok = got.is_empty() || origin.as_deref() == Some(got) || host(got) == host(hh);
        if !ok {
            let r = tungstenite::http::Response::builder().status(403).body(Some("origin".to_string())).unwrap();
            return Err(r);
        }
        Ok(resp)
    };
    let mut ws: WebSocket<TcpStream> = match tungstenite::accept_hdr_with_config(stream, cb, Some(cfg)) {
        Ok(w) => w,
        Err(_) => return,
    };
    let (tx, rx) = mpsc::sync_channel::<Out>(12);
    if to_sim.send(ToSim::Join { cid, tx }).is_err() {
        return;
    }
    'outer: loop {
        match ws.read() {
            Ok(Message::Text(t)) => {
                if t.len() <= 16 * 1024 && to_sim.send(ToSim::Msg { cid, text: t.to_string() }).is_err() {
                    break;
                }
            }
            Ok(Message::Close(_)) => break,
            Ok(_) => {}
            Err(tungstenite::Error::Io(e)) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => {}
            Err(tungstenite::Error::ConnectionClosed) | Err(tungstenite::Error::AlreadyClosed) => break,
            Err(_) => break,
        }
        loop {
            match rx.try_recv() {
                Ok(o) => {
                    let m = match o {
                        Out::Text(s) => Message::Text(s.into()),
                        Out::Bin(b) => Message::Binary(b.into()),
                    };
                    if ws.send(m).is_err() {
                        break 'outer;
                    }
                }
                Err(mpsc::TryRecvError::Empty) => break,
                Err(mpsc::TryRecvError::Disconnected) => break 'outer,
            }
        }
        match ws.flush() {
            Ok(()) => {}
            Err(tungstenite::Error::Io(e)) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => {}
            Err(_) => break,
        }
    }
    let _ = to_sim.send(ToSim::Leave { cid });
    let _ = ws.close(None);
}

fn env(k: &str, d: &str) -> String {
    std::env::var(k).unwrap_or_else(|_| d.to_string())
}

fn main() {
    let bind = env("WL_BIND", "127.0.0.1:8787");
    let dir = PathBuf::from(env("WL_DATA", "./data"));
    let seed: u32 = env("WL_SEED", "1").parse().unwrap_or(1);
    let rate: f32 = env("WL_RATE", "20").parse::<f32>().unwrap_or(20.0).clamp(2.0, 60.0);
    let origin = std::env::var("WL_ORIGIN").ok().filter(|s| !s.is_empty());
    std::fs::create_dir_all(&dir).expect("data directory");
    let stop = Arc::new(AtomicBool::new(false));
    {
        let s = stop.clone();
        let _ = ctrlc::set_handler(move || s.store(true, Ordering::SeqCst));
    }
    let (tx, rx) = mpsc::channel::<ToSim>();
    let sim = {
        let (d, s) = (dir.clone(), stop.clone());
        thread::spawn(move || sim_thread(rx, d, seed, rate, s))
    };
    let listener = TcpListener::bind(&bind).expect("bind");
    listener.set_nonblocking(true).expect("nonblocking");
    eprintln!("wildlinge-server listening on {} data {}", bind, dir.display());
    let count = Arc::new(AtomicU64::new(0));
    let next = AtomicU64::new(1);
    while !stop.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((s, _)) => {
                if count.load(Ordering::SeqCst) as usize >= MAX_CLIENTS {
                    continue;
                }
                let _ = s.set_nonblocking(false);
                let cid = next.fetch_add(1, Ordering::SeqCst);
                let (t2, o2, c2) = (tx.clone(), origin.clone(), count.clone());
                c2.fetch_add(1, Ordering::SeqCst);
                thread::spawn(move || {
                    client_thread(s, cid, t2, o2);
                    c2.fetch_sub(1, Ordering::SeqCst);
                });
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(20)),
            Err(_) => thread::sleep(Duration::from_millis(100)),
        }
    }
    let _ = sim.join();
}
