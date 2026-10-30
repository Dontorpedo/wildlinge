# Plimploms: Projektübersicht (Stand 31.10.2026)

Ziel dieses Dokuments: Eine andere KI soll das Projekt vollständig verstehen und Verbesserungen, Ideen und Risiken vorschlagen können. Alle Angaben stammen aus dem Code und den Entscheidungen des Entwicklers. Was nicht gemessen oder geprüft ist, steht ausdrücklich dabei.

## 1. Was ist Plimploms

Ein Browser-Spiel mit künstlichem Leben ("artificial life"). Kreaturen ("Wildlinge", Spielname "Plimploms") entwickeln sich in einer Pixel-Welt über Generationen. Körper, Gehirn und eine eigene einfache Sprache entstehen durch Evolution, nicht durch feste Regeln.

- Live: plimploms.com (Landingpage `index.html`, App `world.html`). Repository: github.com/Dontorpedo/wildlinge, Branch main.
- Zwei Betriebsarten: Server-Version (eine gemeinsame, dauerhaft laufende Welt für alle Besucher) und Standalone (eine einzelne HTML-Datei, Welt lokal im Browser).
- Jeder Besucher hat anonym ein Token, kein Konto. Er kann Kreaturen in sein persönliches Terrarium adoptieren, sie dort pflegen und wieder auswildern.
- Sprachen der Oberfläche: Englisch (Standard), Deutsch.
- Entwickler: Denis, Einzelentwickler. Finanzierung: Buy-me-a-coffee (buymeacoffee.com/denisthedev).

## 2. Architektur

| Teil | Technik | Datei(en) |
|---|---|---|
| Simulationskern | Rust, als WebAssembly im Browser und als native Bibliothek im Server | `core/src/*.rs` (ca. 4300 Zeilen) |
| Server | Rust, tungstenite-WebSockets, ein Prozess | `server/src/main.rs` |
| Oberfläche | Eine HTML-Datei, Vanilla-JS, Canvas | `web/app.js`, `gfx.js`, `critter.js`, `terrarium.js`, `i18n.js`, `worker.js`, `index.html` |
| Build | Node-Skripte, `wasm-opt` | `tools/bundle.mjs` (erzeugt `dist/wildlinge.html`), `tools/pack-server.sh` |
| Hosting | VPS (2 vCore, 2 GB RAM, Ubuntu 24.04), nginx, verwaltet über Ploi | `deploy/install.sh`, `deploy/nginx.conf.template` |

- Der WASM-Kern läuft im Browser in einem Web-Worker. Im Servermodus liefert der Server Frames per WebSocket (Standard 20 Frames pro Sekunde), der Client interpoliert.
- Der Kern ist deterministisch (eigener Zufallsgenerator mit Seed). Spielstände haben eine Versionsnummer (aktuell 8). Alte Weltstände werden verworfen, Terrarium-Kreaturen älterer Versionen werden per Genom-Migration übernommen (`Genome.gv`, `migrate_id`, Test `core/tests/migrate.rs`).
- Server-Konfiguration über Umgebungsvariablen (`WL_BIND`, `WL_DATA`, `WL_SEED`, `WL_RATE`, `WL_ORIGIN`). Besucherzähler als CSV-Dateien.

## 3. Simulation im Detail

**Welt:** Rasterkarte mit Biomen (Tief-/Flachwasser, Wiese, Wald, Wüste, Gebirge), Pflanzen, Fleisch, Detritus (Abfall), Jahreszeiten. Tageslänge 2400 Schritte, Jahr 36000 Schritte. Maximal 550 Kreaturen. Mindestpopulation Pflanzenfresser 40, Fleischfresser 12 (Konstanten `MIN_HERB`, `MIN_CARN`; bei Unterschreitung greift ein Nachschub-Mechanismus, siehe Abschnitt 9).

**Genom:** Körperform-Gene (Länge, Kantigkeit, Segmente, Kopfgröße, Schwanztyp), Farbton, Größe, Geschwindigkeit, Sinnesreichweite, Ernährungsanteil (Pflanze/Fleisch), Lebensdauer, Lernrate, Mutationsrate, bis zu 8 Körperteile. Teiletypen mit Fähigkeiten: Bein, Flosse, Flügel, Waffe, Panzer, Sinnesorgan, Speicher, Isolierung, Signal, Knospe (undifferenziert). Teile können per Mutation dupliziert, verloren oder umgewandelt werden; die Ereignisse werden protokolliert.

**Gehirn:** Neuronales Netz mit evolvierter Topologie (NEAT-artig), bis zu 48 versteckte Neuronen, 73 Eingänge und 10 Ausgänge. Eingänge: Umwelt (Bedrohung, Futter, Beute, Verwandte, Fremde, Wasser, Neues), Körperzustand (Hunger, Schmerz, Kälte), Vorratslager (Richtung, Nähe, Füllstand) und weitere. Ausgänge: Bewegung, Drehung, Sprechen, Fressen, Paarung, Vorratsablage und -abruf. Zusätzlich Triebe/Hormone (Hunger, Sicherheit, Wärme, Gemeinschaft, Fortpflanzung, Neugier, Ansehen) und Lernen zu Lebzeiten.

**Sprache:** Jede Kreatur hat ein Lexikon (maximal 28 Wörter). Wörter sind zufällig aus Silben gebildet und werden an Bedeutungsfelder (Kategorien und Richtungen) gebunden. Kreaturen rufen Wörter, andere in Hörreichweite hören sie und lernen Verknüpfungen. Daraus können Alarmrufe, Futterrufe und gruppenspezifische Dialekte entstehen.
- Grenzen: nur Einzelwörter, keine Kombination oder Grammatik, feste Bedeutungsfelder, nur Bezug auf aktuell Wahrgenommenes, keine Eigennamen.

**Wasser:** Landtiere ohne Flossen und Flügel dürfen Tiefwasser nicht betreten (Wasserbarriere im Kern). Flieger fliegen darüber, Tiere mit Flossen schwimmen.

**Fliegen und Fleischfresser (Balance, zuletzt gemessen):** Konstanten `FLY_MV 3.5`, `WING_UPKEEP 0.02`, `MEAT_GAIN 0.29`. Ziel: Flieger und Fleischfresser sollen vorkommen, aber nicht dominieren. Mittelwerte lagen im Zielbereich, die Streuung zwischen Seeds ist hoch (nur wenige Läufe).

**Vorratslager (Nischenbau):** Kreaturen können Energie an Orten ablegen (Caches) und später abholen. Verlust und Verrottung sind eingebaut (`CACHE_LOSS 0.1`, `CACHE_ROT 0.00005`, maximal 150). Messung: 44 bis 137 Nutzer, 41 bis 78 Prozent der Einlagerungen wurden abgeholt. Ob Lager das Überleben tatsächlich verbessern, ist nicht gemessen.

**Metriken:** `core/src/metrics.rs` und der Forschungs-Tab (Artenbaum, Diagramme mit uPlot und d3-hierarchy), Labor-Tab mit CSV-Export.

## 4. Oberfläche

**Wildnis-Ansicht (Draufsicht):** Karte mit Zoom und Verschieben, Auswahl einer Kreatur, Werkzeuge (Auswählen, Streicheln, Schimpfen, Sagen, Futter, Spiegel, Tragen). Panel mit Genom, Gehirn, Lexikon und Lebenslauf. Statistik, Export und Import der Welt, Screenshot, 10-Sekunden-Clip.

**Terrarium (Seitenansicht, persönlich):** Zimmer mit Futter, Wasser, Lampe, Musik, Rätselbox und Regalen. Bedürfnisse: Futter, Wasser, Wärme, Licht, Spiel, Ruhe, Gesellschaft. Werkzeuge: Streicheln, Bürsten, Kitzeln, Leckerli, Ball, Seifenblasen, Plüschtier, Rufen, Verkleiden, Party, Wort lehren, Regale. Kreaturen wachsen, paaren sich, legen Eier, können sterben oder ausgewildert werden. Nach dem Auswildern bleiben sie verfolgbar. Beim Wort-Lehren wählt der Nutzer die Bedeutung (Bedürfnis) oder lässt sie automatisch aus der aktuellen Tätigkeit ableiten.

**Zeit:** Im Terrarium läuft die Zeit während Abwesenheit mit einem Viertel der Geschwindigkeit weiter, nie unter einem sicheren Minimum.

## 5. Grafik (drei Stile, umschaltbar)

1. **Pixel-Sprites (Standard):** 92 KI-gezeichnete Ganzkörper-Sprites (vier Bildbögen, mit `tools/make-whole.py` zu einem Atlas gepackt), per Genom umgefärbt (Farbton, Akzentfarbe).
2. **Klassisch:** Code-gezeichnete Draufsicht-Körper mit Schattierung.
3. **Gezeichnet:** Zusammensetzung aus handgezeichneten Teile-Atlanten (Köpfe, Körper, Ohren, Schwänze, Beine, Flügel, Kämme, Hörner).

**Auswahl der Figur:** Jeder der 92 Sprites ist getaggt (Flügel, Hörner, Ohren, Schwanz, Flosse, Stacheln, Panzer, Fühler, Kamm, lang, gegliedert, rund). Aus den Körperteilen und Formgenen wird ein Punktwert berechnet, unter den besten Treffern entscheidet ein Hash. Ein Flieger bekommt eine Figur mit Flügeln, ein Tier mit Flosse eine Flossenfigur. Wildnis und Terrarium nutzen dieselbe Auswahl.

**Animation:**
- Echte KI-Frames (Pixellab, Engine PixMiniMax) für alle 92 Sprites: Gehen, Schlafen, Fressen, Angriff, je 8 Frames. Atlas `anim.png` (ca. 530 KB), umgefärbt wie die Basis-Sprites.
- Rechnerische Animation: Atmen, Blinzeln (Augenposition je Sprite erkannt, elf Sprites ohne Augenerkennung), Schwanzwedeln, Ohrenzucken, Hüpfen (Balz, Tanzen), Flügelschlag-Wippen, Rennen.
- Gegen Zittern: Phasen-Akkumulator pro Tier, geglättete Geschwindigkeit, entprellte Zustandswechsel, Spiegelung mit Hysterese.
- Wenn die Figur sehr klein dargestellt wird (weites Herauszoomen), werden nur einfache Standbilder genutzt.

## 6. Weitere Bestandteile

- Landingpage (`web/static/index.html`) mit Hero-Bild, Open-Graph-Metadaten, Impressum und Datenschutz (Platzhalter für persönliche Angaben sind vom Entwickler noch auszufüllen), `robots.txt`, `sitemap.xml`. Die App-Seite ist `noindex,follow`.
- Deploy-Paket: `dist/plimploms-upload.zip` mit `index.html` (Landing), `world.html` (App), Bildern, Rechtstexten. Serverpaket `dist/wildlinge-server.tar.gz` mit `install.sh`. In Ploi muss in nginx eine `location /ws` für den WebSocket ergänzt werden.
- Bundle-Größe der App: ca. 2,5 MB (inklusive 750 KB WASM, Sprite-Atlanten, Frame-Atlas).
- Tests: Browsertest (`tools/browsertest.js`, Playwright), WASM-Test (`tools/wasmtest.js`), Migrationstest (`cargo test --test migrate`). Balance-Läufe über ein Skript mit mehreren Seeds (ca. 5 Minuten für 3 Seeds).

## 7. Entwicklungsverlauf (Kurzfassung)

Erst Einzelplatz-Version "Kreaturen" in JavaScript, dann kompletter Umbau auf Rust-Kern mit WebAssembly. Danach Serverversion mit gemeinsamer Welt, Terrarium, Sprites aus Teile-Atlanten, Landingpage, Wasserbarriere, Fliegen, Vorratslager, Balance-Anpassungen, ganzkörper-Sprites mit Körperteil-Auswahl und echten Animations-Frames.

## 8. Ideen und offene Punkte

**Sprache (wissenschaftlicher Kern):** Zwei-Wort-Rufe, Eigennamen/Rufnamen, Orte als Bedeutung (Vorratslager, Wasserplatz), offene Bedeutungsfelder, Lernen durch Nachahmung (Kultur), Messgrößen im Forschungs-Tab (Wortzahl, Dialekt-Gruppen, Kombinationsanteil).

**Spielbarkeit:** Ziele und Aufträge im Eigenmodus mit Belohnungen, Chronik mit Meilensteinen, Weltereignisse (Dürre, Kälte, Seuche), tiefere Pflege im Terrarium (Krankheiten, Persönlichkeit, Freundschaft), Zusammenfassung "seit Ihrem letzten Besuch", Benachrichtigungen zu ausgewilderten Tieren.

**Welt:** mehr Biome, Jahreszeiten-Folgen (Winterschlaf, Wanderung), Wetter, weitere Nischen (Aasfresser, Bestäuber, Parasiten, Symbiose). Messung, ob Vorratslager Überleben verbessern (Läufe mit 200000 Schritten, mit und ohne Zuwanderung).

**Wachstum:** Auto-Poster auf Bluesky und Mastodon (Ereignisse aus der Simulation, Vorlagentexte, optional KI-Texte; Idee "Tiere auf einer Tastatur" mit echten Tierwörtern), KI-Chronik und KI-Dolmetscher für das Terrarium nur als optionale Zusatzschicht mit Server-Proxy (der KI-Schlüssel darf nicht in den Browser), Konten, Export einzelner Tiere zum Teilen, Besucher-Einfluss sichtbar machen.

**Betrieb:** Moderation (Namen, Wörter), Datensicherung, Mobil-Bedienung im Terrarium, Ton und Musik.

## 9. Bekannte Schwächen und ehrliche Einschränkungen

- **Evolution ist begrenzt:** Neues entsteht nur innerhalb der vorgegebenen Teiletypen, Eingänge, Ausgänge und Bedeutungsfelder. Neue Fähigkeiten außerhalb dieser Kataloge können nicht entstehen. Mehr Offenheit (neue Teiletypen per Mutation, neue Sinne) wäre möglich, ist aber nicht umgesetzt.
- **Mindestpopulationen:** Das Auffüllen bei Unterschreitung ist ein programmierter Eingriff und hält die Welt künstlich stabil. Ob die Welt ohne diese Hilfe langfristig trägt, ist nicht gemessen.
- **Balance:** Wenige Seeds und kurze Läufe. Die Streuung zwischen Seeds ist hoch. In der Frühphase lag die Population im Browsertest teils bei 256 bis 340.
- **Vorratslager:** Nutzung belegt, Überlebensvorteil nicht belegt.
- **Sprache:** Siehe Abschnitt 3, nur Einzelwörter.
- **Animation:** Die KI-Frames sind je Sprite einmal erzeugt, nicht von Hand geprüft. Einzelne Frames können leichte Abweichungen zeigen (beim Angriff verschiebt sich die Figur absichtlich nach vorn). Elf Sprites haben keine Augenerkennung (kein Blinzeln).
- **Rechtliches:** Impressum und Datenschutz enthalten Platzhalter. Ein Namens-Markenrecht für "Plimploms" wurde nicht geprüft. Der frühere Name "Wildlinge" war besetzt.
- **Server:** Ein einzelner Prozess auf kleinem VPS. Skalierung auf viele gleichzeitige Besucher ist nicht getestet.
- **KI-Frames und Sprites:** Alle Sprites und Frames stammen aus KI-Erzeugung (Bildbögen und Pixellab). Nutzungsrechte sollten gegen die Bedingungen des jeweiligen Dienstes geprüft werden.

## 10. Fragen an eine zweite KI

1. Welche der Ideen in Abschnitt 8 bringt für Besucherbindung und wissenschaftliche Glaubwürdigkeit am meisten, und in welcher Reihenfolge?
2. Wie lässt sich offene Evolution (neue Fähigkeiten, neue Sinne) mit überschaubarem Aufwand ermöglichen, ohne dass die Welt instabil wird?
3. Wie sollte Sprachentstehung gemessen werden, damit man echte Syntax von Programmierung unterscheiden kann?
4. Welche Risiken (Moderation, Recht, Kosten, Sicherheit) sehen Sie bei einer öffentlichen gemeinsamen Welt, einem Auto-Poster und optionaler KI-Anbindung?
5. Welche Schwächen aus Abschnitt 9 sollten vor einem öffentlichen Start behoben werden?
