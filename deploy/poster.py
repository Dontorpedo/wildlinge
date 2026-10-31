#!/usr/bin/env python3
"""Plimploms auto poster for X (Twitter). Reads events from the saved world, posts a few per day.
Config via environment (see /etc/wildlinge-poster.env). Without all four X keys it only prints (dry run)."""
import base64, gzip, hashlib, hmac, json, os, secrets, sys, time, urllib.parse, urllib.request

DATA = os.environ.get("WL_DATA", "/var/lib/wildlinge")
LANG = os.environ.get("POSTER_LANG", "en")
MAX_DAY = int(os.environ.get("POSTER_MAX_PER_DAY", "6"))
MIN_GAP = int(os.environ.get("POSTER_MIN_GAP_MIN", "90")) * 60
URL = os.environ.get("POSTER_URL", "https://plimploms.com")
TAG = os.environ.get("POSTER_TAGS", "#ArtificialLife #Plimploms")
KEYS = [os.environ.get(k, "") for k in ("X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET")]
DRY = os.environ.get("POSTER_DRY", "") == "1" or not all(KEYS)
STATE = os.path.join(DATA, "poster-state.json")

GOALS = {
    "en": {"gen10": "Generation 10 reached", "year5": "Survived year 5", "newPart": "A new body part is spreading through a species",
           "swim": "A species now lives in water", "fly": "A creature learned to fly", "species3": "Three species live side by side",
           "boss": "The first boss was elected", "mirror": "A creature recognised itself in the mirror",
           "understand": "Over 50 percent of all calls are now understood", "sentence": "The first two-word sentence was understood",
           "grammar": "A fixed word order emerged", "culture": "A word survived three generations"},
    "de": {"gen10": "Generation 10 erreicht", "year5": "Jahr 5 überlebt", "newPart": "Ein neues Körperteil verbreitet sich in einer Art",
           "swim": "Eine Art lebt jetzt im Wasser", "fly": "Eine Kreatur hat fliegen gelernt", "species3": "Drei Arten leben nebeneinander",
           "boss": "Der erste Boss wurde gewählt", "mirror": "Eine Kreatur hat sich im Spiegel erkannt",
           "understand": "Über 50 Prozent aller Rufe werden verstanden", "sentence": "Der erste Zwei-Wort-Satz wurde verstanden",
           "grammar": "Eine feste Wortstellung ist entstanden", "culture": "Ein Wort hat drei Generationen überdauert"},
}
WEV = {"en": {"drought": "drought", "frost": "cold wave", "disease": "disease outbreak"},
       "de": {"drought": "Dürre", "frost": "Kältewelle", "disease": "Seuche"}}
T = {
    "en": {"ev.pop": "The population reached {0} Plimploms.", "ev.gen": "The first Plimplom of generation {0} was born.",
           "ev.word": 'The word "{0}" is now used by {1} Plimploms. Nobody gave it to them.',
           "ev.wev": "World event: a {0} begins. It lasts about {1} day(s).", "ev.wevEnd": "The {0} is over. Deaths during it: {1}.",
           "ev.speaker": "{0} is now the speaker of the Plimploms and talks to the outside world.",
           "spk": '{0} says: {1}',
           "wod": 'Word of the day: "{0}". Said {1} times by {2} speakers.'},
    "de": {"ev.pop": "Die Population hat {0} Plimploms erreicht.", "ev.gen": "Das erste Plimplom der Generation {0} wurde geboren.",
           "ev.word": 'Das Wort "{0}" wird jetzt von {1} Plimploms benutzt. Niemand hat es ihnen beigebracht.',
           "ev.wev": "Weltereignis: {0} beginnt. Dauer etwa {1} Tag(e).", "ev.wevEnd": "{0} ist vorbei. Tode währenddessen: {1}.",
           "ev.speaker": "{0} ist jetzt Sprecher der Plimploms und spricht nach außen.",
           "spk": '{0} sagt: {1}',
           "wod": 'Wort des Tages: "{0}". {1}x gesagt, {2} Sprecher.'},
}
POSTED_KINDS = ("ev.pop", "ev.gen", "ev.word", "ev.goal", "ev.wev", "ev.wevEnd", "ev.speaker")
PER_KIND_DAY = {"ev.word": 2, "ev.gen": 1, "ev.pop": 2, "ev.goal": 2, "ev.wev": 1, "ev.wevEnd": 1, "ev.speaker": 1, "spk": 3}


def load_world():
    p = os.path.join(DATA, "world.json.gz")
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return json.load(f)


def load_state():
    try:
        with open(STATE) as f:
            return json.load(f)
    except Exception:
        return {"last_t": None, "last_wod": -1, "posts": []}


def save_state(s):
    s["posts"] = s["posts"][-200:]
    tmp = STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(s, f)
    os.replace(tmp, STATE)


def compose(k, p, lang):
    tt = T[lang]
    p = list(p)
    if k == "ev.goal":
        text = GOALS[lang].get(p[0])
        if not text:
            return None
        return text + "."
    if k in ("ev.wev", "ev.wevEnd"):
        p[0] = WEV[lang].get(p[0], p[0])
    if k == "ev.speaker":
        return tt[k].format(p[0])
    if k not in tt:
        return None
    try:
        return tt[k].format(*p)
    except Exception:
        return None


def candidates(w, st, lang):
    out = []
    last_t = st["last_t"]
    ev = w.get("events", [])
    if last_t is None:
        st["last_t"] = ev[-1]["t"] if ev else 0
        last_t = st["last_t"]
    for e in ev:
        if e["t"] > last_t and e["t"] >= w["t"] - 4800 and e["k"] in POSTED_KINDS:
            txt = compose(e["k"], e["p"], lang)
            if txt:
                out.append((e["t"], e["k"], txt))
    wod = w.get("wod")
    if wod and wod["day"] > st["last_wod"] and wod["n"] >= 20:
        out.append((w["t"], "wod", T[lang]["wod"].format(wod["word"], wod["n"], wod["speakers"])))
    spk = speaker_line(w, st, lang)
    if spk:
        out.append(spk)
    return out


def speaker_line(w, st, lang):
    sid = w.get("spk_id", 0)
    log = [x for x in w.get("spk_log", []) if x[0] > st.get("last_spk", 0)]
    if not sid or len(log) < 4:
        return None
    name = next((c["name"] for c in w.get("creatures", []) if c["id"] == sid), None)
    if not name:
        return None
    seen, words = set(), []
    for _, txt in reversed(log):
        if txt not in seen:
            seen.add(txt)
            words.append('"' + txt + '"')
        if len(words) >= 4:
            break
    return (log[-1][0], "spk", T[lang]["spk"].format(name, " ".join(reversed(words))))


def oauth_header(method, url):
    ck, cs, tk, ts = KEYS
    o = {"oauth_consumer_key": ck, "oauth_nonce": secrets.token_hex(16), "oauth_signature_method": "HMAC-SHA1",
         "oauth_timestamp": str(int(time.time())), "oauth_token": tk, "oauth_version": "1.0"}
    q = lambda s: urllib.parse.quote(str(s), safe="~")
    base = "&".join([method, q(url), q("&".join(f"{q(k)}={q(v)}" for k, v in sorted(o.items())))])
    key = f"{q(cs)}&{q(ts)}"
    o["oauth_signature"] = base64.b64encode(hmac.new(key.encode(), base.encode(), hashlib.sha1).digest()).decode()
    return "OAuth " + ", ".join(f'{q(k)}="{q(v)}"' for k, v in sorted(o.items()))


def post(text):
    url = "https://api.x.com/2/tweets"
    req = urllib.request.Request(url, data=json.dumps({"text": text}).encode(), method="POST")
    req.add_header("Authorization", oauth_header("POST", url))
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    lang = LANG if LANG in T else "en"
    st = load_state()
    try:
        w = load_world()
    except Exception as e:
        print("world not readable:", e)
        return 0
    cands = candidates(w, st, lang)
    now = time.time()
    day = time.strftime("%Y-%m-%d", time.gmtime(now))
    today = [x for x in st["posts"] if x["day"] == day]
    if st["posts"] and now - st["posts"][-1]["ts"] < MIN_GAP:
        save_state(st)
        return 0
    if len(today) >= MAX_DAY:
        return 0
    chosen = None
    for t, k, txt in cands:
        if sum(1 for x in today if x["k"] == k) >= PER_KIND_DAY.get(k, 1):
            continue
        chosen = (t, k, txt)
        break
    if not chosen:
        save_state(st)
        return 0
    t, k, txt = chosen
    text = f"{txt}\n\n{TAG} {URL}"
    if len(text) > 270:
        text = f"{txt[:200]}...\n\n{TAG} {URL}"
    if DRY:
        print("[dry]", text.replace("\n", " | "))
    else:
        try:
            post(text)
        except Exception as e:
            print("post failed:", e, getattr(e, "read", lambda: b"")()[:300])
            return 1
    if k == "wod":
        st["last_wod"] = w["wod"]["day"]
    elif k == "spk":
        st["last_spk"] = t
    else:
        st["last_t"] = t
    st["posts"].append({"ts": now, "day": day, "k": k, "text": text, "dry": DRY})
    save_state(st)
    return 0


if __name__ == "__main__":
    sys.exit(main())
