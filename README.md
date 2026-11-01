# Plimploms

An open experiment in artificial life that runs entirely in your browser. Nobody gives the creatures body parts, behaviour or language: bodies, brains and words emerge through evolution and learning. Eine deutsche Beschreibung folgt weiter unten.

(Product name: Plimploms, plimploms.com. The creatures are called Wildlinge / Wildlings. Internal file and service names keep the old working title.)

## What is inside

- **Bodies:** seven continuous properties per part give nine abilities (leg, fin, wing, weapon, armour, feeler, pouch, fur, crest). New parts arise by duplication and by buds at places of stress. Body shape is mutable too: elongation, boxiness, 1 to 3 segments, head size, taper.
- **Brains:** NEAT (neuroevolution of augmenting topologies) with reward-modulated Hebbian learning, eight drives, hormones, sleep and dreams.
- **Self-perception:** a forward model learned by motor babbling, recognition of own gut events, a mirror test.
- **Language:** open meanings as prototype categories, separate words for "what" and "where", emergent word order, prestige of bosses.
- **Society:** species by morphological distance, bosses elected from six aspects.
- **Open world:** reserved brain channels (three scent channels, dig, build, signal) with an observable novelty counter; soil layer (fertility, burrows); plants with an inherited seed-spread gene; structures (shelter, barrier) built by creatures or placed by guardians; slow climate drift.
- **Terrarium gallery:** a sixth room with photo frames of your current and past Plimploms (taken from the terrarium) and a short life story: moved in, words taught, children, released, died.
- **Terrarium lab (workshop room):** items with numeric properties (hard, heavy, long, flammable, shell, food), general handles (pick up, put down, strike, combine, eat), fire as physics (sparks from stone on stone, ignition, burning items as torches, warmth, cooking, burn damage). Pets learn per-pet action values by reward (epsilon-greedy, optimistic start), copy successful actions of nearby pets, and log discoveries (also in the gallery). Client-side only (`web/lab.js`), stored with the terrarium.
- **Fire in the wild:** world objects (`fires`) that spread over plants (ash fertilizes the soil), damage structures and creatures, warm creatures nearby, cook meat (+50% energy) and die out in frost. Sources: rare lightning in the dry season, the guardian tool 'Fire' (cost 30) and creatures themselves: output o[14] below -0.6 strikes a spark that can ignite flammable things within reach (no new brain I/O). Fire state is part of the frame meta (`fr`).
- **Tools in the wild:** items (stone, stick, nut, combinations) with properties (hard, heavy, long, flammable, shell). Brain I/O extended to 95 inputs / 19 outputs: nearest item (direction, proximity, hardness), holding flag and held power; outputs grab/drop, strike, combine (genome version 3, older genomes are migrated). Striking a nut with enough force cracks it (food), two stones strike sparks, a flammable held item lit at a fire becomes a torch, stone plus stick makes a hammer. Fire counts as a threat feature, so existing words and direction words can warn about it. 25 % of new genomes start with weak grab/strike wiring; use is not scripted and may stay rare.
- **Science:** Gaussian approximation of integrated information (Phi), Lempel-Ziv complexity, MODES and Bedau activity for open-ended evolution, language entropy, mutual information and topographic similarity, controlled experiments with Welch t-tests, exports to CSV, Newick and PyPhi.

## Build

Requirements: Node 20+, Rust nightly with the `wasm32-unknown-unknown` target.

```
npm ci
bash tools/build.sh      # produces dist/wildlinge.html (one self-contained file)
node tools/wasmtest.js dist/wildlinge_core.wasm 3000
node tools/browsertest.js dist/wildlinge.html
```

Without the wasm target installed, set `WL_BUILD_STD=1` and install the `rust-src` component. GitHub Actions builds and tests everything on each push (see `.github/workflows/build.yml`).

Open `dist/wildlinge.html` in a current browser. The world is stored in your browser (IndexedDB); the time you were away is simulated on your next visit. Nothing is sent to any server.

## PyPhi

In the creature tab, "Export network for PyPhi" saves the 8-node network of the selected creature. Then: `pip install pyphi numpy` and `python tools/pyphi_phi.py wildlinge-pyphi-<id>.json`.

## Repository layout

- `core/` Rust simulation core (WebAssembly and native)
- `web/` user interface (worker, rendering, texts in English and German)
- `tools/` build, bundling and tests

License: MIT. Libraries: uPlot (MIT), d3-hierarchy (ISC), Silkscreen font (SIL OFL 1.1), serde and serde_json (MIT/Apache-2.0).

---

# Deutsch

Plimploms ist ein offenes Experiment zu künstlichem Leben, das komplett im Browser läuft. Körperteile, Gehirne und Sprache entstehen durch Evolution und Lernen, nichts davon ist vorgegeben.

**Bauen:** `npm ci`, dann `bash tools/build.sh`. Ergebnis ist die einzelne Datei `dist/wildlinge.html`. Voraussetzungen: Node 20+ und Rust nightly mit dem Ziel `wasm32-unknown-unknown`.

**Speichern:** Die Welt liegt im Browser (IndexedDB). Beim nächsten Besuch wird die Abwesenheit nachsimuliert. Es wird nichts an einen Server gesendet.

**Offene Welt:** Reservierte Gehirnkanäle (Duft A/B/C, Graben, Bauen, Signal) mit Neuheitszähler, Bodenschicht (Fruchtbarkeit, Baue), Pflanzen mit vererbtem Samenstreuungs-Gen, Bauwerke (Unterschlupf, Barriere) sowie langsame Klimadrift. Hüter können düngen und Bauwerke setzen.

**Forschung:** Die Oberfläche bietet Messreihen als CSV, den Stammbaum als Newick, ein Labor für kontrollierte Experimente (mit und ohne eine Fähigkeit, Welch-Test) und den Export für PyPhi.

## Shared server

`server/` runs one persistent world (Rust, WebSocket) with one terrarium per visitor token. The browser page connects to `/ws` of the same host and falls back to the single-player mode if no server answers. Install on Ubuntu 24.04: `tools/pack-server.sh`, upload `dist/wildlinge-server.tar.gz`, unpack, run `sudo ./install.sh`. Web server, domain and SSL are handled by Ploi (static files from `dist/plimploms-upload.zip`, `/ws` proxied to 127.0.0.1:8787).
Visitors act as guardians with limited guardian power: stroke, scold, speak, teach, feed, mirror, carry (pick up and put down), adopt into their own terrarium and release.
