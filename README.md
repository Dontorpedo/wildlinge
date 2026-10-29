# Wildlinge

An open experiment in artificial life that runs entirely in your browser. Nobody gives the creatures body parts, behaviour or language: bodies, brains and words emerge through evolution and learning. Eine deutsche Beschreibung folgt weiter unten.

(The working title "Wildlinge" will be replaced by an international name.)

## What is inside

- **Bodies:** seven continuous properties per part give nine abilities (leg, fin, wing, weapon, armour, feeler, pouch, fur, crest). New parts arise by duplication and by buds at places of stress. Body shape is mutable too: elongation, boxiness, 1 to 3 segments, head size, taper.
- **Brains:** NEAT (neuroevolution of augmenting topologies) with reward-modulated Hebbian learning, eight drives, hormones, sleep and dreams.
- **Self-perception:** a forward model learned by motor babbling, recognition of own gut events, a mirror test.
- **Language:** open meanings as prototype categories, separate words for "what" and "where", emergent word order, prestige of bosses.
- **Society:** species by morphological distance, bosses elected from six aspects.
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

Wildlinge ist ein offenes Experiment zu künstlichem Leben, das komplett im Browser läuft. Körperteile, Gehirne und Sprache entstehen durch Evolution und Lernen, nichts davon ist vorgegeben.

**Bauen:** `npm ci`, dann `bash tools/build.sh`. Ergebnis ist die einzelne Datei `dist/wildlinge.html`. Voraussetzungen: Node 20+ und Rust nightly mit dem Ziel `wasm32-unknown-unknown`.

**Speichern:** Die Welt liegt im Browser (IndexedDB). Beim nächsten Besuch wird die Abwesenheit nachsimuliert. Es wird nichts an einen Server gesendet.

**Forschung:** Die Oberfläche bietet Messreihen als CSV, den Stammbaum als Newick, ein Labor für kontrollierte Experimente (mit und ohne eine Fähigkeit, Welch-Test) und den Export für PyPhi.
