'use strict';
/* Plimploms: user interface texts. English is the main language, German the second.
   The simulation core only emits keys; every visible text is produced here. */
const I18N = {
  en: {
    'app.loading': 'Loading world ...',
    'app.clock': '{0} | {1} | {2} Plimploms | {3} species | {4} ms per step',
    'app.day': 'Year {0}, day {1}',
    'app.saved': 'Saved {0} ({1} MB)',
    'app.saveFail': 'Saving in the browser is not possible: {0}. Please use "Export world".',
    'app.noStorage': 'Browser storage is not available. Please export your progress.',
    'app.away': 'Simulating the time you were away ... {0} %',
    'app.loadFail': 'The saved world could not be loaded ({0}). A new world was started, the old save is kept.',
    'app.importFail': 'Import failed: {0}',
    'app.tooBig': 'File too large',
    'app.newWorld': 'Delete the current world and create a new one? Export it first if you want to keep it.',
    'app.wordFirst': 'Enter a word first',
    'app.mainThread': 'main thread',
    'app.worker': 'worker',
    'app.noWasm': 'This browser does not support WebAssembly. Plimploms needs a current browser.',

    'tool.carry': 'Carry', 't.carryPick': 'Plimplom picked up. Click where to put it down.', 't.moved': 'Put down', 't.moveFar': 'Too far for your guardian power', 't.moveWater': 'It cannot be put into water', 't.kraft': 'Not enough guardian power, wait a moment',
    'd.carried': 'Was picked up and carried elsewhere',
    'srv.down': 'Server not reachable, retrying ...', 'srv.state': 'Shared world on the server', 'srv.lost': 'Connection lost, reconnecting ...', 'srv.kraft': 'Guardian power {0}/{1} | {2} online',
    'sel.fe': 'Free energy (lower = better)',
    'tab.terra': 'Terrarium', 'mode.wild': 'Wilderness', 'mode.terra': 'Terrarium',
    'tz.tool.select': 'Select / move',
    'tz.tool.pet': 'Pet',
    'tz.tool.brush': 'Brush',
    'tz.tool.tickle': 'Tickle',
    'tz.tool.treat': 'Treat',
    'tz.tool.ball': 'Ball',
    'tz.tool.bubbles': 'Bubbles',
    'tz.tool.plush': 'Plush toy',
    'tz.tool.call': 'Call',
    'tz.tool.dress': 'Dress up',
    'tz.tool.party': 'Party',
    'tz.tool.teach': 'Teach word',
    'tz.tool.level': 'Shelves',
    'tz.tip.select': 'Click to select, drag to pick up and drop',
    'tz.tip.pet': 'Click a creature: calms and bonds',
    'tz.tip.brush': 'Click a creature: strong calming, pleasant',
    'tz.tip.tickle': 'Click a creature: laughs, jumps',
    'tz.tip.treat': 'Click: drop a treat',
    'tz.tip.ball': 'Click: drop a ball, creatures kick it',
    'tz.tip.bubbles': 'Click: blow soap bubbles, creatures pop them',
    'tz.tip.plush': 'Click: place a plush toy, comfort for lonely creatures',
    'tz.tip.call': 'Click: creatures come to that spot (they learn to obey)',
    'tz.tip.dress': 'Click a creature: next accessory',
    'tz.tip.party': 'Click: confetti, everyone dances',
    'tz.tip.teach': 'Enter a word, pick its meaning (or leave it on automatic), click a creature: it links the word to that need',
    'tz.tip.level': 'Click empty space: add a shelf, click a shelf: remove it',
    'tz.accs.none': 'none',
    'tz.accs.bow': 'bow',
    'tz.accs.hat': 'hat',
    'tz.accs.glasses': 'glasses',
    'tz.accs.scarf': 'scarf',
    'tz.accs.crown': 'crown',
    'tz.accs.flower': 'flower',
    'tz.wordPh': 'Word to teach',
    'tz.meanAuto': 'Meaning: what it is doing',
    'opt.style': 'Creature style', 'opt.styleSprites': 'Pixel sprites', 'opt.styleClassic': 'Classic', 'opt.styleDrawn': 'Hand-drawn',
    'btn.shot': 'Screenshot', 'btn.clip': 'Clip 10 s', 'clip.rec': 'Recording {0} s', 'clip.na': 'Video recording is not supported in this browser.', 'legal.imp': 'Legal notice', 'legal.priv': 'Privacy',
    'tz.alone': 'This Plimplom is alone and will become lonely and sad. A second one or a plush toy helps.',
    'tz.maxLevels': 'At most 5 additional shelves',
    'tz.levelBlocked': 'A shelf is already there',
    'tz.levelUnreach': 'Creatures could not reach this shelf (too high above the next one)',
    'tz.taught': '{0} now means "{1}" = {2}',
    'tz.noTeach': 'Teaching failed',
    'tz.skill': 'Puzzle skill',
    'tz.obey': 'Obedience',
    'tz.acc': 'Accessory',
    'tz.vocab': 'Own words',
    'tz.levels': 'Extra shelves',
    'tz.puzzleHint': 'Puzzle box: creatures learn to open it and get treats',
    'tz.needs': { food: 'Food', water: 'Water', warmth: 'Warmth', light: 'Light', fun: 'Play', rest: 'Rest', social: 'Company' },
    'tz.help': 'Click bowls, lamp, light, music and puzzle box | Keys 1 to 9 and 0: tool',
    'tz.intro': 'Adopted Plimploms live here. They need food, water, warmth, light, play and rest. Neglect causes stress and death. While you are away, time passes at a quarter of the speed and never below a safe minimum. Happy adults nearby become fond of each other and lay eggs. Release them into the wild and they take everything they learned with them.',
    'tz.inhabitants': 'Inhabitants', 'tz.release': 'Release into the wild', 'tz.room': 'Room', 'tz.memorial': 'In memory',
    'tz.releaseConfirm': 'Release {0} into the wild? It takes everything it has learned with it.',
    'tz.full': 'The terrarium is full (8 places including eggs)', 'tz.noTake': 'This Plimplom could not be adopted',
    'tz.adopted': '{0} moved into the terrarium', 'tz.released': '{0} was released into the wild', 'tz.died': '{0} has died ({1})',
    'tz.low': 'The wilderness has too few Plimploms. Nobody can be adopted right now.', 'tz.hatched': '{0} hatched', 'tz.egg': 'A new egg was laid', 'tz.filled': 'Refilled', 'tz.none': 'Empty. Select a Plimplom in the wilderness and click "Adopt into terrarium".',
    'tz.eggs': '{0} egg(s), next hatches in {1} s', 'tz.baby': 'baby', 'tz.young': 'young', 'tz.adult': 'adult', 'tz.gen': 'Generation',
    'tz.hp': 'Health', 'tz.growth': 'Growth', 'tz.mood': 'Mood', 'tz.stress': 'Stress', 'tz.love': 'Affection', 'tz.kids': 'Children', 'tz.words': 'Known words',
    'tz.bowlFood': 'Food bowl', 'tz.bowlWater': 'Water bowl', 'tz.lamp': 'Heat lamp', 'tz.light': 'Ceiling light',
    'ev.taken': '{0} moved into the terrarium', 'ev.released': '{0} was released from the terrarium',
    'd.toTerrarium': 'Moved into the terrarium', 'd.bornTerrarium': 'Born in the terrarium', 'd.fromTerrarium': 'Released from the terrarium',
    'tab.world': 'World', 'tab.creature': 'Creature', 'tab.research': 'Research', 'tab.lab': 'Lab', 'tab.about': 'About',
    'btn.pause': 'Pause', 'btn.run': 'Run', 'btn.export': 'Export world', 'btn.import': 'Import', 'btn.reset': 'New world',
    'btn.adopt': 'Adopt into terrarium', 'btn.release': 'Release', 'btn.rename': 'Rename', 'btn.csv': 'Measurements as CSV',
    'btn.newick': 'Phylogeny as Newick', 'btn.pyphi': 'Export network for PyPhi', 'btn.labStart': 'Start experiment',
    'btn.labStop': 'Cancel', 'btn.ok': 'Let\'s go', 'btn.continue': 'Continue', 'btn.labCsv': 'Results as CSV',
    'ph.words': 'words, e.g. kalu sefi', 'ph.name': 'New name',
    'tool.select': 'Select', 'tool.stroke': 'Stroke', 'tool.scold': 'Scold', 'tool.teach': 'Show and name',
    'tool.say': 'Say', 'tool.food': 'Food', 'tool.mirror': 'Mirror',
    'help.keys': 'Drag: move map | Wheel or + / -: zoom | Keys 1 to 7: tool | Arrow keys: move',
    'opt.speed': 'Speed', 'opt.follow': 'Camera follows selection', 'opt.sense': 'Show sensing radius',
    'opt.bubbles': 'Speech bubbles and body events', 'opt.meaning': 'Show meanings (simulator knowledge)',
    'box.map': 'Map', 'box.mine': 'My Plimploms', 'box.goals': 'Goals', 'box.stats': 'Statistics',
    'box.lang': 'Language of the population', 'box.species': 'Species and bosses', 'box.events': 'Events',
    'box.log': 'Spoken', 'box.sel': 'Selection', 'box.brain': 'Brain', 'box.charts': 'Measurements over time',
    'box.phylo': 'Family tree of species', 'box.lab': 'Controlled experiment',
    'leg.herb': 'Herbivores', 'leg.carn': 'Carnivores', 'leg.wb': 'Wellbeing',

    'st.herbCarn': 'Herbivores / carnivores', 'st.plants': 'Plants / asleep', 'st.cycle': 'Waste now / fertilized plots', 'st.react': 'Flee after alarm call / control group', 'st.react2': 'Alarm calls evaluated', 'st.cache': 'Food stores | users', 'st.cache2': 'Stored / taken back', 'st.acts': 'Doing now', 'sel.acts': 'Behaviour so far', 'sel.nowDoing': 'Now', 'st.gen': 'Max. generation',
    'st.wb': 'Avg. wellbeing', 'st.neurons': 'Avg. hidden neurons / connections', 'st.cert': 'Avg. body knowledge',
    'st.parts': 'Avg. body parts', 'st.rate': 'Communication success', 'st.sentences': 'Sentences understood',
    'st.words': 'Words in use', 'st.births': 'Births', 'st.deaths1': 'Deaths hunger / age / eaten',
    'st.deaths2': 'Deaths drowned / frozen / heat / injury', 'st.macro': 'Visible mutations / boss changes',
    'st.neuronMut': 'Brain growth events',

    'mine.released': 'Released into the wild (marked with a yellow cross)', 'mine.kids': '{0} children',
    'mine.none': 'None in the wild. Select a Plimplom and click "Adopt into terrarium".', 'mine.memorial': 'In memory',
    'mine.memRow': '{0}, {1}, {2} children', 'mine.asleep': 'asleep',
    'lang.what': 'Words for situations', 'lang.where': 'Words for directions', 'lang.none': 'none yet',
    'lang.click': 'Clicking a word copies it into the input field.', 'lang.you': 'You', 'lang.unclear': 'unclear',
    'sp.head': ['Species', 'Count', 'Boss / points / votes'], 'sp.order': 'word order: {0} {1} %',
    'sp.ordWW': 'what-where', 'sp.ordRW': 'where-what', 'sp.votes': '{0} / {1} of {2}',
    'goal.open': 'open',

    'sel.none': 'No selection. Use the "Select" tool and click a Plimplom.',
    'sel.spType': 'Species / type', 'sel.herb': 'herbivore', 'sel.carn': 'carnivore', 'sel.phaseGen': 'Phase / generation',
    'sel.age': 'Age', 'sel.ageOf': '{0} of {1}', 'sel.energy': 'Energy / health', 'sel.place': 'Place', 'sel.state': 'State',
    'sel.awake': 'awake', 'sel.sleeps': 'asleep', 'sel.dreams': 'asleep, dreams of {0}',
    'sel.drives': 'Drives and goal', 'sel.goal': 'Current goal', 'sel.wbReward': 'Wellbeing / reward',
    'sel.chem': 'Biochemistry', 'sel.adr': 'Adrenaline', 'sel.endo': 'Endorphin', 'sel.cort': 'Cortisol (long-term stress)',
    'sel.tired': 'Tiredness', 'sel.criteria': 'Criteria of life', 'sel.yes': 'yes', 'sel.no': 'no',
    'sel.brainSelf': 'Brain and self-perception', 'sel.neurons': 'Hidden neurons / connections / plasticity',
    'sel.learned': 'Learned (change of connections)', 'sel.cert': 'Body knowledge / surprise',
    'sel.ext': 'External force', 'sel.gut': 'Gut events recognised as own', 'sel.mirror': 'Mirror',
    'sel.mirrorYes': 'recognises itself', 'sel.mirrorT': '{0} steps in front of the mirror',
    'sel.phi': 'Integration (Gaussian Phi, 8 nodes)', 'sel.lz': 'Activity complexity (Lempel-Ziv)',
    'sel.body': 'Body', 'sel.shape': 'Body shape', 'sel.parts': 'Parts', 'sel.abil': 'Abilities', 'sel.fly': 'Flying',
    'sel.size': 'Size now / target', 'sel.speedSense': 'Speed / sensing / diet', 'sel.mut': 'Mutation at birth',
    'sel.kids': 'Children / prey', 'sel.mind': 'Mind and language', 'sel.fear': 'Fear / attention',
    'sel.protos': 'Own categories', 'sel.said': 'Last said', 'sel.heard': 'Last heard',
    'sel.understoodBy': 'Understood by others', 'sel.understands': 'Understands others', 'sel.heardN': '{0} heard',
    'sel.order': 'Word order', 'sel.vocab0': 'no vocabulary yet', 'sel.family': 'Family', 'sel.parents': 'Parents',
    'sel.immigrant': 'immigrated', 'sel.children': 'Children', 'sel.dead': 'dead', 'sel.role': 'Role',
    'sel.bossSince': 'Boss for {0} days', 'sel.member': 'Member', 'sel.bossPts': 'Boss points: {0}',
    'sel.bossTotal': 'Boss points total', 'sel.diary': 'Diary', 'sel.diary0': 'still empty', 'sel.of': '{0} of {1}',
    'sel.brainHint': 'Inputs left, outputs right, hidden neurons in between. Green excites, red inhibits.',
    'boss.aspects': ['experience', 'strength', 'offspring', 'being understood', 'named concepts', 'wellbeing'],

    'res.lifeQ': 'When is life alive?',
    'res.lifeT': 'Share of the population that meets each classic criterion of life. Switch abilities off below and watch which criteria break away.',
    'res.bio': 'Biological criteria', 'res.mind': 'Mental criteria',
    'res.bodyQ': 'How do new body parts arise?',
    'res.bodyT': 'Parts arise from duplication and from buds at places of stress, then use and selection shape them. Avg. parts per Plimplom {0}, shape diversity {1}.',
    'res.noKinds': 'No new parts have arisen yet.',
    'res.selfQ': 'How does self-perception arise?',
    'res.selfT': 'Body knowledge from predicting the own movement, recognising own gut events, the mirror test.',
    'res.cert': 'Avg. body knowledge', 'res.gut': 'Gut events recognised as own', 'res.mirrorPass': 'Mirror test passed',
    'res.mirrors': 'Mirrors placed', 'res.knock': 'Experiments in this world: switch off an ability',
    'res.off': '{0} off', 'res.series': '{0} measurements, every 300 steps', 'res.strokes': 'Strokes: {0} | Words taught: {1}',
    'res.open': 'Open-ended evolution (MODES and Bedau)',
    'res.bedau': 'Diversity {0} | mean activity {1} | new components {2}',
    'res.phyloHint': 'Species that ever had at least 3 members. Grey: extinct.',
    'res.chartPick': 'Show',

    'lab.intro': 'Runs paired copies of a fresh world with the same random seeds: one control, one with the chosen ability switched off. A Welch t-test compares the end values. This runs in its own thread and does not disturb your world.',
    'lab.knock': 'Switch off', 'lab.reps': 'Repetitions', 'lab.steps': 'Steps per world', 'lab.seed': 'Seed',
    'lab.progress': 'Step {0} of {1}', 'lab.metric': 'Measure', 'lab.ctrl': 'Control', 'lab.trt': 'Switched off',
    'lab.p': 'p', 'lab.sig': 'significant', 'lab.ns': 'not significant', 'lab.done': 'Experiment finished: {0} off, {1} pairs, {2} steps.',

    'about.text': 'Plimploms is an open experiment in artificial life. Nobody gave the creatures body parts, behaviour or language. Everything arises through evolution, learning and their own experience. The simulation core is written in Rust. In the shared world it runs on the server, where all visitors live together; in practice mode it runs as WebAssembly in your browser. Only an anonymous token and your actions are sent. No personal data is collected.',
    'about.sci': 'Scientific methods used: NEAT (neuroevolution of augmenting topologies) with reward-modulated Hebbian learning, a Gaussian approximation of integrated information (Phi), Lempel-Ziv complexity, MODES and Bedau-Packard activity statistics for open-ended evolution, entropy, mutual information and topographic similarity of the emerging language, Welch t-tests for controlled experiments. Exports: CSV, Newick, PyPhi.',
    'about.libs': 'Libraries: uPlot (MIT), d3-hierarchy (ISC), Silkscreen font (SIL OFL 1.1), serde and serde_json (MIT/Apache-2.0).',
    'about.coffee': 'If you enjoy the Plimploms, you can buy me a coffee.',
    'bmc.todo': 'Placeholder: the donation link has not been set yet.',
    'res.ownScale': 'Every line has its own scale; hover to read values.',
    'lab.noWorker': 'The laboratory needs Web Workers, which are not available here.',

    'welcome.title': 'Welcome to the Plimploms',
    'welcome.p1': 'The Plimploms are artificial creatures. Nobody gave them body parts, behaviour or language. Everything arises through evolution, learning and their experiences.',
    'welcome.what': 'What you can do:',
    'welcome.l': ['Select and adopt a Plimplom. Its diary shows what it experiences.',
      'Stroking rewards, scolding punishes. That is how they learn what is good.',
      'With "Show and name" you teach them words by clicking on a plant or a creature.',
      'Place a mirror and watch who recognises itself.',
      'In the research and lab tabs you switch off abilities and test: when is life still alive?'],
    'welcome.noteSrv': 'This is one shared world on the server. Everyone sees the same Plimploms, seasons and days. Your anonymous visitor token only identifies your own terrarium; no personal data is collected.',
    'welcome.note': 'The world is stored in your browser and continues on your next visit. The time you were away is simulated.',
    'away.title': 'While you were away',
    'away.p': '{0} Plimplom days have passed. {1} births and {2} deaths.',
    'away.lost': 'Sadly died:', 'away.alive': 'Your Plimploms are still alive:', 'away.events': 'Important events:',

    look: {
      loci: ['accent colour', 'pattern', 'eyes', 'ears', 'cheeks', 'sparkle', 'limbs', 'tail'],
      v: [
        ['coral', 'amber', 'lime', 'green', 'mint', 'teal', 'sky', 'blue', 'indigo', 'violet', 'magenta', 'rose'],
        ['plain', 'spots', 'stripes', 'patches', 'saddle', 'mask'],
        ['black', 'blue', 'green', 'brown', 'purple', 'gold', 'ruby', 'aqua'],
        ['round', 'pointed', 'floppy', 'none'],
        ['pink', 'orange', 'none', 'blue'],
        ['none', 'sparkling'],
        ['paws', 'tentacles', 'eye stalks', 'feathers'],
        ['none', 'nub', 'long', 'curly', 'fluffy', 'fin']
      ]
    },
    'sel.look': 'Look (visible)', 'sel.lookHidden': 'Carries (hidden)', 'sel.rarity': 'Rarity',
    drives: ['Hunger', 'Safety', 'Warmth', 'Company', 'Mating', 'Curiosity', 'Reputation', 'Sleep'],
    goals: ['Find food', 'Get to safety', 'Seek warmth', 'Seek company', 'Find a partner', 'Explore', 'Seek recognition', 'Sleep'],
    acts: ['Wandering', 'Sleeping', 'Fleeing', 'Hunting', 'Eating', 'Giving birth', 'Seeking food', 'Speaking', 'Courting'],
    features: ['threat', 'food', 'prey', 'kin', 'stranger', 'hunger', 'pain', 'cold', 'water', 'novelty'],
    sectors: ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'],
    biomes: ['deep water', 'shallow water', 'meadow', 'forest', 'desert', 'mountains'],
    seasons: { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' },
    phases: { child: 'child', adult: 'adult', elder: 'elder' },
    kinds: { leg: 'leg', fin: 'fin', wing: 'wing', weapon: 'spike', armor: 'plate', sense: 'feeler', storage: 'pouch', insul: 'fur', display: 'crest', bud: 'bud' },
    abil: { leg: 'walking', fin: 'swimming', wing: 'flying', weapon: 'weapon', armor: 'armour', sense: 'feeling', storage: 'storage', insul: 'insulation', display: 'signal' },
    causes: { hunger: 'hunger', drowned: 'drowned', frozen: 'frozen', heat: 'heat', age: 'old age', injury: 'injury', eaten: 'eaten', thirst: 'thirst', cold: 'cold', stress: 'stress', terrarium: 'terrarium', lonely: 'loneliness' },
    stress: { injuries: 'injuries', cold: 'cold', water: 'water', hunger: 'hunger', stress: 'stress', '': 'by chance' },
    shapes: ['elongation', 'boxiness', 'segments', 'head', 'taper'],
    shapeWords: { round: 'round', long: 'long', boxy: 'boxy', seg: '{0} segments', bigHead: 'big head', tail: 'tapered', pear: 'pear-shaped' },
    life: ['Metabolism', 'Homeostasis', 'Growth', 'Response to stimuli', 'Reproduction', 'Heritable variation', 'Organisation'],
    mind: ['Learning', 'Self-model', 'Communication', 'Mirror self-recognition', 'Culture'],
    knocks: { repro: 'Reproduction', mut: 'Mutation', learn: 'Learning during life', self: 'Self-perception (body model)', lang: 'Language', meta: 'Metabolism' },
    milestones: {
      gen10: 'Generation 10 reached', year5: 'Survived year 5', newPart: 'A new body part spreads (over 20 % of a species)',
      swim: 'A species lives in water (avg. swimming over 0.4)', fly: 'A creature can fly', species3: 'Three species live at the same time',
      boss: 'First boss elected', mirror: 'A creature recognises itself in the mirror',
      understand: 'Communication: over 50 % of utterances understood', sentence: 'First two-word sentence understood',
      grammar: 'Fixed word order: over 80 % of a species use the same', culture: 'Culture: a word survives three generations',
      taught: 'A word of yours is used by creatures', answer: 'First answer to your words'
    },
    labMetrics: { pop: 'Population', life: 'Life criteria', mind: 'Mental criteria', certainty: 'Body knowledge', understand: 'Communication',
      parts: 'Body parts', diversity: 'Shape diversity', wellbeing: 'Wellbeing', neurons: 'Hidden neurons', phi: 'Phi', mNovelty: 'Novelty (MODES)', species: 'Species' },
    cols: { t: 'step', pop: 'population', herb: 'herbivores', carn: 'carnivores', species: 'species', parts: 'body parts', kinds: 'part kinds',
      diversity: 'shape diversity', neurons: 'hidden neurons', conns: 'connections', certainty: 'body knowledge', gutOwn: 'gut events own',
      mirror: 'mirror recognition', understand: 'understanding', wellbeing: 'wellbeing', life: 'life criteria', mind: 'mental criteria',
      phi: 'Phi', lz: 'Lempel-Ziv', entropy: 'word entropy', mi: 'mutual information', topo: 'topographic similarity',
      mChange: 'MODES change', mNovelty: 'MODES novelty', mEcology: 'MODES ecology', mComplexity: 'MODES complexity',
      bActivity: 'Bedau activity', bNew: 'Bedau new components', knock: 'knockouts' },
    chartSets: { pop: 'Population', life: 'Life and mind', brain: 'Brain and integration', lang: 'Language', modes: 'Open-endedness (MODES)' },
    ioIn: { bias: 'bias', food: 'food', other: 'other creature', water: 'water here', waterAhead: 'water ahead', growth: 'plants ahead',
      energy: 'energy', health: 'health', age: 'age', temp: 'temperature', drive: 'drive', goal: 'goal', mem: 'memory',
      foodMem: 'remembered food', heard: 'heard', meaning: 'meaning', where: 'heard place', boss: 'boss', isBoss: 'am boss',
      surprise: 'surprise', cert: 'certainty', compass: 'compass', horm: ['adrenaline', 'endorphin', 'cortisol'], night: 'night',
      dir: ['sin', 'cos', 'near', 'size', 'similar', 'weapon', 'display', 'loud'] },
    io: { out: ['turn', 'speed', 'attack', 'speak', 'say where', 'memory 1', 'memory 2', 'memory 3', 'memory 4'] },

    't.stroke': '{0} was stroked', 't.scold': '{0} was scolded', 't.miss': 'No creature hit', 't.say': 'Said "{0}"',
    't.teach': '{0} creatures linked "{1}" to what you showed', 't.teachMiss': 'Nothing hit or nobody within hearing range',
    't.food': 'Food dropped', 't.word': 'Enter a word first',
    't.mirror': { placed: 'Mirror placed', removed: 'Mirror removed', full: 'At most 3 mirrors' },
    'b.gut': 'pfft', 'b.sleep': 'zzz', 'b.like': '<3', 'b.ouch': 'ouch',

    'ev.goal': 'Goal reached: {0}',
    'ev.mut': '{0} is born with a mutation: {2}',
    'ev.firstKind': 'A new body part appears for the first time: {0} (with {1})',
    'ev.fly': '{0} is the first creature that can fly',
    'ev.newSpecies': 'New species: {0} ({1}, {2} members)',
    'ev.extinct': 'The species {0} has died out',
    'ev.pop': 'The population reached {0} creatures',
    'ev.gen': 'The first creature of generation {0} was born',
    'ev.word': 'The word "{0}" is now used by {1} creatures',
    'ev.spread': '{1} spreads in the species {0} ({2} %)',
    'ev.boss': '{1} is the new boss of the {0} ({3} of {4} votes)',
    'ev.bossDied': 'The boss of the {0}, {1}, has died ({2})',
    'ev.mirror': '{0} recognises itself in the mirror',
    'ev.mirrorSet': 'A mirror was placed',
    'ev.knock': 'Experiment: {0} {1}',
    'ev.knockOn': 'switched off', 'ev.knockOff': 'switched on again',
    'ev.adoptedDied': 'Your {0} has died ({1})',
    'ev.herb': 'herbivores', 'ev.carn': 'carnivores',
    'mut.dup': 'duplicated {0}', 'mut.bud': 'new bud ({0})', 'mut.loss': 'lost {0}', 'mut.shape': 'body shape changed ({0})',

    'd.immigrant': 'Immigrated into the world', 'd.born': 'Born, child of {0}{1}', 'd.and': ' and {0}',
    'd.firstKill': 'Caught its first prey: {0}', 'd.firstCache': 'Stored food in a cache for the first time', 'sel.anc': 'Ancestors', 'sel.desc': 'Descendants (total)', 'd.child': 'Had a child: {0}', 'd.parentOf': 'Became a parent: {0}', 'd.firstWord': 'Said its first word: {0}',
    'd.biome': 'Discovered {0} for the first time', 'd.fly': 'Flew for the first time', 'd.hurt': 'Was badly hurt',
    'd.boss': 'Was elected boss', 'd.notBoss': 'Is no longer boss', 'd.mirror': 'Recognised itself in the mirror',
    'd.adopted': 'Was adopted by you', 'd.released': 'Was released by you', 'd.answer': 'Answered you: {0}', 'd.died': 'Died ({0})'
  },
  de: {
    'app.loading': 'Lade Welt ...',
    'app.clock': '{0} | {1} | {2} Plimploms | {3} Arten | {4} ms pro Schritt',
    'app.day': 'Jahr {0}, Tag {1}',
    'app.saved': 'Gespeichert {0} ({1} MB)',
    'app.saveFail': 'Speichern im Browser nicht möglich: {0}. Bitte "Welt exportieren" nutzen.',
    'app.noStorage': 'Browser-Speicher nicht verfügbar. Fortschritt bitte exportieren.',
    'app.away': 'Simuliere die Zeit Ihrer Abwesenheit ... {0} %',
    'app.loadFail': 'Die gespeicherte Welt konnte nicht geladen werden ({0}). Eine neue Welt wurde gestartet, der alte Stand bleibt erhalten.',
    'app.importFail': 'Import fehlgeschlagen: {0}',
    'app.tooBig': 'Datei zu groß',
    'app.newWorld': 'Aktuelle Welt löschen und eine neue erzeugen? Exportieren Sie vorher, wenn Sie sie behalten möchten.',
    'app.wordFirst': 'Erst ein Wort eingeben',
    'app.mainThread': 'Hauptthread',
    'app.worker': 'Worker',
    'app.noWasm': 'Dieser Browser unterstützt kein WebAssembly. Plimploms benötigt einen aktuellen Browser.',

    'tool.carry': 'Tragen', 't.carryPick': 'Plimplom aufgehoben. Klicken Sie dorthin, wo er abgelegt werden soll.', 't.moved': 'Abgelegt', 't.moveFar': 'Zu weit für Ihre Hüterkraft', 't.moveWater': 'Im Wasser kann nichts abgelegt werden', 't.kraft': 'Zu wenig Hüterkraft, bitte kurz warten',
    'd.carried': 'Wurde aufgehoben und woanders abgelegt',
    'srv.down': 'Server nicht erreichbar, neuer Versuch ...', 'srv.state': 'Gemeinsame Welt auf dem Server', 'srv.lost': 'Verbindung verloren, verbinde neu ...', 'srv.kraft': 'Hüterkraft {0}/{1} | {2} online',
    'sel.fe': 'Freie Energie (niedriger = besser)',
    'tab.terra': 'Terrarium', 'mode.wild': 'Wildnis', 'mode.terra': 'Terrarium',
    'tz.tool.select': 'Auswählen / bewegen',
    'tz.tool.pet': 'Streicheln',
    'tz.tool.brush': 'Bürsten',
    'tz.tool.tickle': 'Kitzeln',
    'tz.tool.treat': 'Leckerli',
    'tz.tool.ball': 'Ball',
    'tz.tool.bubbles': 'Seifenblasen',
    'tz.tool.plush': 'Kuscheltier',
    'tz.tool.call': 'Rufen',
    'tz.tool.dress': 'Verkleiden',
    'tz.tool.party': 'Party',
    'tz.tool.teach': 'Wort lehren',
    'tz.tool.level': 'Regalbretter',
    'tz.tip.select': 'Klicken zum Auswählen, ziehen zum Aufheben und Fallenlassen',
    'tz.tip.pet': 'Kreatur anklicken: beruhigt und bindet',
    'tz.tip.brush': 'Kreatur anklicken: stark beruhigend, angenehm',
    'tz.tip.tickle': 'Kreatur anklicken: lacht, hüpft',
    'tz.tip.treat': 'Klicken: Leckerli fallen lassen',
    'tz.tip.ball': 'Klicken: Ball fallen lassen, Kreaturen kicken ihn',
    'tz.tip.bubbles': 'Klicken: Seifenblasen, Kreaturen lassen sie platzen',
    'tz.tip.plush': 'Klicken: Kuscheltier platzieren, Trost für einsame Kreaturen',
    'tz.tip.call': 'Klicken: Kreaturen kommen an diese Stelle (sie lernen zu gehorchen)',
    'tz.tip.dress': 'Kreatur anklicken: nächstes Accessoire',
    'tz.tip.party': 'Klicken: Konfetti, alle tanzen',
    'tz.tip.teach': 'Wort eingeben, Bedeutung wählen (oder automatisch lassen), Kreatur anklicken: sie verknüpft das Wort mit diesem Bedürfnis',
    'tz.tip.level': 'Leeren Platz anklicken: Regalbrett hinzufügen, Brett anklicken: entfernen',
    'tz.accs.none': 'keins',
    'tz.accs.bow': 'Schleife',
    'tz.accs.hat': 'Hut',
    'tz.accs.glasses': 'Brille',
    'tz.accs.scarf': 'Schal',
    'tz.accs.crown': 'Krone',
    'tz.accs.flower': 'Blume',
    'tz.wordPh': 'Wort zum Lehren',
    'tz.meanAuto': 'Bedeutung: was es gerade tut',
    'opt.style': 'Kreaturen-Stil', 'opt.styleSprites': 'Pixel-Sprites', 'opt.styleClassic': 'Klassisch', 'opt.styleDrawn': 'Handgezeichnet',
    'btn.shot': 'Screenshot', 'btn.clip': 'Clip 10 s', 'clip.rec': 'Aufnahme {0} s', 'clip.na': 'Videoaufnahme wird von diesem Browser nicht unterstützt.', 'legal.imp': 'Impressum', 'legal.priv': 'Datenschutz',
    'tz.alone': 'Dieser Plimplom ist allein und wird einsam und traurig. Ein zweiter oder ein Kuscheltier hilft.',
    'tz.maxLevels': 'Höchstens 5 zusätzliche Regalbretter',
    'tz.levelBlocked': 'Dort ist schon ein Brett',
    'tz.levelUnreach': 'Die Kreaturen kämen nicht hinauf (zu hoch über dem nächsten Brett)',
    'tz.taught': '{0} versteht "{1}" jetzt als: {2}',
    'tz.noTeach': 'Lehren fehlgeschlagen',
    'tz.skill': 'Rätselgeschick',
    'tz.obey': 'Gehorsam',
    'tz.acc': 'Accessoire',
    'tz.vocab': 'Eigene Wörter',
    'tz.levels': 'Zusätzliche Bretter',
    'tz.puzzleHint': 'Tüftelbox: Kreaturen lernen sie zu öffnen und bekommen Leckerli',
    'tz.needs': { food: 'Futter', water: 'Wasser', warmth: 'Wärme', light: 'Licht', fun: 'Spiel', rest: 'Ruhe', social: 'Gesellschaft' },
    'tz.help': 'Näpfe, Lampe, Licht, Spieluhr und Tüftelbox anklicken | Tasten 1 bis 9 und 0: Werkzeug',
    'tz.intro': 'Adoptierte Plimploms leben hier. Sie brauchen Futter, Wasser, Wärme, Licht, Spiel und Ruhe. Vernachlässigung führt zu Stress und Tod. Während Ihrer Abwesenheit vergeht die Zeit mit einem Viertel der Geschwindigkeit und nie unter einem sicheren Minimum. Zufriedene Erwachsene in der Nähe werden sich zugetan und legen Eier. Wenn Sie sie auswildern, nehmen sie alles Gelernte mit.',
    'tz.inhabitants': 'Bewohner', 'tz.release': 'In die Wildnis entlassen', 'tz.room': 'Raum', 'tz.memorial': 'In Erinnerung',
    'tz.releaseConfirm': '{0} in die Wildnis entlassen? Alles Gelernte geht mit.',
    'tz.full': 'Das Terrarium ist voll (8 Plätze inklusive Eier)', 'tz.noTake': 'Dieser Plimplom konnte nicht adoptiert werden',
    'tz.adopted': '{0} ist ins Terrarium eingezogen', 'tz.released': '{0} wurde in die Wildnis entlassen', 'tz.died': '{0} ist gestorben ({1})',
    'tz.low': 'In der Wildnis leben zu wenige Plimploms. Derzeit kann niemand adoptiert werden.', 'tz.hatched': '{0} ist geschlüpft', 'tz.egg': 'Ein neues Ei wurde gelegt', 'tz.filled': 'Aufgefüllt', 'tz.none': 'Leer. Wählen Sie in der Wildnis einen Plimplom aus und klicken Sie auf "Ins Terrarium adoptieren".',
    'tz.eggs': '{0} Ei(er), das nächste schlüpft in {1} s', 'tz.baby': 'Baby', 'tz.young': 'jung', 'tz.adult': 'erwachsen', 'tz.gen': 'Generation',
    'tz.hp': 'Gesundheit', 'tz.growth': 'Wachstum', 'tz.mood': 'Stimmung', 'tz.stress': 'Stress', 'tz.love': 'Zuneigung', 'tz.kids': 'Kinder', 'tz.words': 'Bekannte Wörter',
    'tz.bowlFood': 'Futternapf', 'tz.bowlWater': 'Wassernapf', 'tz.lamp': 'Wärmelampe', 'tz.light': 'Deckenlicht',
    'ev.taken': '{0} ist ins Terrarium eingezogen', 'ev.released': '{0} wurde aus dem Terrarium entlassen',
    'd.toTerrarium': 'Ins Terrarium eingezogen', 'd.bornTerrarium': 'Im Terrarium geboren', 'd.fromTerrarium': 'Aus dem Terrarium entlassen',
    'tab.world': 'Welt', 'tab.creature': 'Kreatur', 'tab.research': 'Forschung', 'tab.lab': 'Labor', 'tab.about': 'Info',
    'btn.pause': 'Pause', 'btn.run': 'Start', 'btn.export': 'Welt exportieren', 'btn.import': 'Importieren', 'btn.reset': 'Neue Welt',
    'btn.adopt': 'Ins Terrarium adoptieren', 'btn.release': 'Freigeben', 'btn.rename': 'Umbenennen', 'btn.csv': 'Messreihe als CSV',
    'btn.newick': 'Stammbaum als Newick', 'btn.pyphi': 'Netz für PyPhi exportieren', 'btn.labStart': 'Experiment starten',
    'btn.labStop': 'Abbrechen', 'btn.ok': 'Los geht\'s', 'btn.continue': 'Weiter', 'btn.labCsv': 'Ergebnisse als CSV',
    'ph.words': 'Wörter, z. B. kalu sefi', 'ph.name': 'Neuer Name',
    'tool.select': 'Auswählen', 'tool.stroke': 'Streicheln', 'tool.scold': 'Tadeln', 'tool.teach': 'Zeigen und benennen',
    'tool.say': 'Sagen', 'tool.food': 'Futter', 'tool.mirror': 'Spiegel',
    'help.keys': 'Ziehen: Karte verschieben | Mausrad oder + / -: Zoom | Tasten 1 bis 7: Werkzeug | Pfeiltasten: bewegen',
    'opt.speed': 'Tempo', 'opt.follow': 'Kamera folgt Auswahl', 'opt.sense': 'Sichtradius anzeigen',
    'opt.bubbles': 'Sprechblasen und Körperereignisse', 'opt.meaning': 'Bedeutungen anzeigen (Simulator-Wissen)',
    'box.map': 'Karte', 'box.mine': 'Meine Plimploms', 'box.goals': 'Ziele', 'box.stats': 'Statistik',
    'box.lang': 'Sprache der Population', 'box.species': 'Arten und Bosse', 'box.events': 'Ereignisse',
    'box.log': 'Gesprochenes', 'box.sel': 'Auswahl', 'box.brain': 'Gehirn', 'box.charts': 'Messwerte im Verlauf',
    'box.phylo': 'Stammbaum der Arten', 'box.lab': 'Kontrolliertes Experiment',
    'leg.herb': 'Pflanzenfr.', 'leg.carn': 'Fleischfr.', 'leg.wb': 'Wohlbefinden',

    'st.herbCarn': 'Pflanzenfresser / Fleischfresser', 'st.plants': 'Pflanzen / schlafend', 'st.cycle': 'Abfall aktuell / gedüngte Stellen', 'st.react': 'Flucht nach Warnruf / Kontrollgruppe', 'st.react2': 'Ausgewertete Warnrufe', 'st.cache': 'Vorratslager | Nutzer', 'st.cache2': 'Eingelagert / zurückgeholt', 'st.acts': 'Tut gerade', 'sel.acts': 'Verhalten bisher', 'sel.nowDoing': 'Jetzt', 'st.gen': 'Max. Generation',
    'st.wb': 'Ø Wohlbefinden', 'st.neurons': 'Ø verdeckte Neuronen / Verbindungen', 'st.cert': 'Ø Körperkenntnis',
    'st.parts': 'Ø Körperteile', 'st.rate': 'Verständigungsrate', 'st.sentences': 'Sätze richtig verstanden',
    'st.words': 'Wörter im Umlauf', 'st.births': 'Geburten', 'st.deaths1': 'Tode Hunger / Alter / Gefressen',
    'st.deaths2': 'Tode Ertrunken / Erfroren / Hitze / Verletzung', 'st.macro': 'Sichtbare Mutationen / Bosswechsel',
    'st.neuronMut': 'Gehirnwachstum (Ereignisse)',

    'mine.released': 'In die Wildnis entlassen (gelbes Kreuz markiert)', 'mine.kids': '{0} Kinder',
    'mine.none': 'Keine in der Wildnis. Wählen Sie einen Plimplom aus und klicken Sie auf "Ins Terrarium adoptieren".', 'mine.memorial': 'In Erinnerung',
    'mine.memRow': '{0}, {1}, {2} Kinder', 'mine.asleep': 'schläft',
    'lang.what': 'Wörter für Situationen', 'lang.where': 'Wörter für Richtungen', 'lang.none': 'noch keine',
    'lang.click': 'Ein Klick auf ein Wort übernimmt es in das Eingabefeld.', 'lang.you': 'Sie', 'lang.unclear': 'unklar',
    'sp.head': ['Art', 'Anzahl', 'Boss / Punkte / Stimmen'], 'sp.order': 'Satzbau: {0} {1} %',
    'sp.ordWW': 'Was-Wo', 'sp.ordRW': 'Wo-Was', 'sp.votes': '{0} / {1} von {2}',
    'goal.open': 'offen',

    'sel.none': 'Keine Auswahl. Werkzeug "Auswählen" und auf einen Plimplom klicken.',
    'sel.spType': 'Art / Typ', 'sel.herb': 'Pflanzenfresser', 'sel.carn': 'Fleischfresser', 'sel.phaseGen': 'Phase / Generation',
    'sel.age': 'Alter', 'sel.ageOf': '{0} von {1}', 'sel.energy': 'Energie / Gesundheit', 'sel.place': 'Ort', 'sel.state': 'Zustand',
    'sel.awake': 'wach', 'sel.sleeps': 'schläft', 'sel.dreams': 'schläft, träumt von {0}',
    'sel.drives': 'Antriebe und Ziel', 'sel.goal': 'Aktuelles Ziel', 'sel.wbReward': 'Wohlbefinden / Belohnung',
    'sel.chem': 'Biochemie', 'sel.adr': 'Adrenalin', 'sel.endo': 'Endorphin', 'sel.cort': 'Cortisol (Dauerstress)',
    'sel.tired': 'Müdigkeit', 'sel.criteria': 'Lebenskriterien', 'sel.yes': 'ja', 'sel.no': 'nein',
    'sel.brainSelf': 'Gehirn und Selbstwahrnehmung', 'sel.neurons': 'Verdeckte Neuronen / Verbindungen / Plastizität',
    'sel.learned': 'Gelernt (Änderung der Verbindungen)', 'sel.cert': 'Körperkenntnis / Überraschung',
    'sel.ext': 'Fremdeinwirkung', 'sel.gut': 'Bauchereignisse als eigen erkannt', 'sel.mirror': 'Spiegel',
    'sel.mirrorYes': 'erkennt sich selbst', 'sel.mirrorT': '{0} Schritte vor dem Spiegel',
    'sel.phi': 'Integration (Gauß-Phi, 8 Knoten)', 'sel.lz': 'Aktivitätskomplexität (Lempel-Ziv)',
    'sel.body': 'Körper', 'sel.shape': 'Körperform', 'sel.parts': 'Teile', 'sel.abil': 'Fähigkeiten', 'sel.fly': 'Fliegen',
    'sel.size': 'Größe aktuell / Ziel', 'sel.speedSense': 'Tempo / Sicht / Diät', 'sel.mut': 'Mutation bei Geburt',
    'sel.kids': 'Kinder / Beute', 'sel.mind': 'Geist und Sprache', 'sel.fear': 'Angst / Aufmerksamkeit',
    'sel.protos': 'Eigene Kategorien', 'sel.said': 'Zuletzt gesagt', 'sel.heard': 'Zuletzt gehört',
    'sel.understoodBy': 'Wird verstanden', 'sel.understands': 'Versteht andere', 'sel.heardN': '{0} gehört',
    'sel.order': 'Satzbau', 'sel.vocab0': 'noch kein Wortschatz', 'sel.family': 'Familie', 'sel.parents': 'Eltern',
    'sel.immigrant': 'eingewandert', 'sel.children': 'Kinder', 'sel.dead': 'tot', 'sel.role': 'Rolle',
    'sel.bossSince': 'Boss seit {0} Tagen', 'sel.member': 'Mitglied', 'sel.bossPts': 'Boss-Punkte: {0}',
    'sel.bossTotal': 'Boss-Punkte gesamt', 'sel.diary': 'Tagebuch', 'sel.diary0': 'noch leer', 'sel.of': '{0} von {1}',
    'sel.brainHint': 'Eingänge links, Ausgänge rechts, verdeckte Neuronen dazwischen. Grün erregt, rot hemmt.',
    'boss.aspects': ['Erfahrung', 'Stärke', 'Nachkommen', 'Verstanden werden', 'Benannte Begriffe', 'Wohlbefinden'],

    'res.lifeQ': 'Ab wann ist Leben Leben?',
    'res.lifeT': 'Anteil der Population, der jedes klassische Lebenskriterium erfüllt. Schalten Sie unten Fähigkeiten ab und beobachten Sie, welche Kriterien wegbrechen.',
    'res.bio': 'Biologische Kriterien', 'res.mind': 'Geistige Kriterien',
    'res.bodyQ': 'Wie entstehen neue Körperteile?',
    'res.bodyT': 'Teile entstehen durch Verdopplung und durch Knospen an Stellen von Belastung, danach formen Gebrauch und Auslese sie. Ø Teile pro Plimplom {0}, Formenvielfalt {1}.',
    'res.noKinds': 'Noch keine neuen Teile entstanden.',
    'res.selfQ': 'Wie entsteht Selbstwahrnehmung?',
    'res.selfT': 'Körperkenntnis aus Vorhersage der eigenen Bewegung, eigene Bauchereignisse erkennen, Spiegeltest.',
    'res.cert': 'Ø Körperkenntnis', 'res.gut': 'Bauchereignisse als eigen erkannt', 'res.mirrorPass': 'Spiegeltest bestanden',
    'res.mirrors': 'Aufgestellte Spiegel', 'res.knock': 'Experimente in dieser Welt: Fähigkeit ausschalten',
    'res.off': '{0} aus', 'res.series': '{0} Messpunkte, alle 300 Schritte', 'res.strokes': 'Streicheln: {0} | Wörter beigebracht: {1}',
    'res.open': 'Offene Evolution (MODES und Bedau)',
    'res.bedau': 'Vielfalt {0} | Ø Aktivität {1} | neue Komponenten {2}',
    'res.phyloHint': 'Arten, die jemals mindestens 3 Mitglieder hatten. Grau: ausgestorben.',
    'res.chartPick': 'Anzeigen',

    'lab.intro': 'Lässt gepaarte Kopien einer neuen Welt mit denselben Zufallswerten laufen: eine Kontrolle, eine mit abgeschalteter Fähigkeit. Ein Welch-t-Test vergleicht die Endwerte. Das läuft in einem eigenen Thread und stört Ihre Welt nicht.',
    'lab.knock': 'Ausschalten', 'lab.reps': 'Wiederholungen', 'lab.steps': 'Schritte pro Welt', 'lab.seed': 'Startwert',
    'lab.progress': 'Schritt {0} von {1}', 'lab.metric': 'Messgröße', 'lab.ctrl': 'Kontrolle', 'lab.trt': 'Abgeschaltet',
    'lab.p': 'p', 'lab.sig': 'signifikant', 'lab.ns': 'nicht signifikant', 'lab.done': 'Experiment fertig: {0} aus, {1} Paare, {2} Schritte.',

    'about.text': 'Plimploms ist ein offenes Experiment zu künstlichem Leben. Niemand hat den Kreaturen Körperteile, Verhalten oder Sprache vorgegeben. Alles entsteht durch Evolution, Lernen und ihre eigenen Erfahrungen. Der Simulationskern ist in Rust geschrieben. In der gemeinsamen Welt läuft er auf dem Server, auf dem alle Besucher zusammenleben; im Übungsmodus läuft er als WebAssembly in Ihrem Browser. Gesendet werden nur ein anonymes Token und Ihre Aktionen. Personenbezogene Daten werden nicht erhoben.',
    'about.sci': 'Verwendete wissenschaftliche Methoden: NEAT (Neuroevolution wachsender Topologien) mit belohnungsmoduliertem Hebb-Lernen, eine Gauß-Näherung der integrierten Information (Phi), Lempel-Ziv-Komplexität, MODES- und Bedau-Packard-Statistiken für offene Evolution, Entropie, Transinformation und topographische Ähnlichkeit der entstehenden Sprache, Welch-t-Tests für kontrollierte Experimente. Exporte: CSV, Newick, PyPhi.',
    'about.libs': 'Bibliotheken: uPlot (MIT), d3-hierarchy (ISC), Schrift Silkscreen (SIL OFL 1.1), serde und serde_json (MIT/Apache-2.0).',
    'about.coffee': 'Wenn Ihnen die Plimploms gefallen, können Sie mir einen Kaffee spendieren.',
    'bmc.todo': 'Platzhalter: Der Spenden-Link ist noch nicht eingetragen.',
    'res.ownScale': 'Jede Linie hat ihre eigene Skala; Werte beim Darüberfahren.',
    'lab.noWorker': 'Das Labor braucht Web Worker, die hier nicht verfügbar sind.',

    'welcome.title': 'Willkommen bei den Plimploms',
    'welcome.p1': 'Die Plimploms sind künstliche Lebewesen. Niemand hat ihnen Körperteile, Verhalten oder Sprache vorgegeben. Alles entsteht durch Evolution, Lernen und ihre Erfahrungen.',
    'welcome.what': 'Was Sie tun können:',
    'welcome.l': ['Einen Plimplom auswählen und adoptieren. Sein Tagebuch zeigt, was er erlebt.',
      'Streicheln belohnt, Tadeln bestraft. So lernen sie, was gut ist.',
      'Mit "Zeigen und benennen" bringen Sie ihnen Wörter bei, indem Sie auf eine Pflanze oder Kreatur klicken.',
      'Einen Spiegel aufstellen und beobachten, wer sich selbst erkennt.',
      'In Forschung und Labor einzelne Fähigkeiten abschalten und prüfen: Ab wann ist Leben noch Leben?'],
    'welcome.noteSrv': 'Dies ist eine gemeinsame Welt auf dem Server. Alle sehen dieselben Plimploms, Jahreszeiten und Tage. Ihr anonymes Besucher-Token ordnet nur Ihr eigenes Terrarium zu; es werden keine personenbezogenen Daten erhoben.',
    'welcome.note': 'Die Welt wird in Ihrem Browser gespeichert und läuft beim nächsten Besuch weiter. Die verstrichene Zeit wird nachsimuliert.',
    'away.title': 'Während Sie weg waren',
    'away.p': 'Es sind {0} Plimplom-Tage vergangen. {1} Geburten und {2} Todesfälle.',
    'away.lost': 'Leider gestorben:', 'away.alive': 'Ihre Plimploms leben noch:', 'away.events': 'Wichtige Ereignisse:',

    look: {
      loci: ['Akzentfarbe', 'Muster', 'Augen', 'Ohren', 'Wangen', 'Glitzer', 'Gliedmaßen', 'Schwanz'],
      v: [
        ['Koralle', 'Bernstein', 'Limette', 'Grün', 'Minze', 'Petrol', 'Himmel', 'Blau', 'Indigo', 'Violett', 'Magenta', 'Rosé'],
        ['einfarbig', 'Tupfen', 'Streifen', 'Flecken', 'Sattel', 'Maske'],
        ['schwarz', 'blau', 'grün', 'braun', 'lila', 'gold', 'rubin', 'aqua'],
        ['rund', 'spitz', 'hängend', 'keine'],
        ['rosa', 'orange', 'keine', 'blau'],
        ['keins', 'glitzernd'],
        ['Pfoten', 'Tentakel', 'Augenstiele', 'Federn'],
        ['keiner', 'Stummel', 'lang', 'geringelt', 'flauschig', 'Flosse']
      ]
    },
    'sel.look': 'Aussehen (sichtbar)', 'sel.lookHidden': 'Trägt (verborgen)', 'sel.rarity': 'Seltenheit',
    drives: ['Hunger', 'Sicherheit', 'Wärme', 'Gemeinschaft', 'Fortpflanzung', 'Neugier', 'Ansehen', 'Schlaf'],
    goals: ['Nahrung finden', 'In Sicherheit bringen', 'Wärme suchen', 'Gemeinschaft suchen', 'Partner finden', 'Erkunden', 'Anerkennung suchen', 'Schlafen'],
    acts: ['Umherziehen', 'Schlafen', 'Fliehen', 'Jagen', 'Fressen', 'Gebären', 'Nahrung suchen', 'Sprechen', 'Werben'],
    features: ['Bedrohung', 'Futter', 'Beute', 'Verwandte', 'Fremde', 'Hunger', 'Schmerz', 'Kälte', 'Wasser', 'Neues'],
    sectors: ['Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten', 'Norden', 'Nordosten'],
    biomes: ['Tiefwasser', 'Flachwasser', 'Wiese', 'Wald', 'Wüste', 'Gebirge'],
    seasons: { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' },
    phases: { child: 'Kind', adult: 'erwachsen', elder: 'alt' },
    kinds: { leg: 'Bein', fin: 'Flosse', wing: 'Flügel', weapon: 'Stachel', armor: 'Platte', sense: 'Fühler', storage: 'Beutel', insul: 'Fell', display: 'Kamm', bud: 'Knospe' },
    abil: { leg: 'Laufen', fin: 'Schwimmen', wing: 'Fliegen', weapon: 'Waffe', armor: 'Panzer', sense: 'Fühlen', storage: 'Speicher', insul: 'Isolierung', display: 'Signal' },
    causes: { hunger: 'Hunger', drowned: 'ertrunken', frozen: 'erfroren', heat: 'Hitze', age: 'Alter', injury: 'Verletzung', eaten: 'gefressen', thirst: 'Durst', cold: 'Kälte', stress: 'Stress', terrarium: 'Terrarium', lonely: 'Einsamkeit' },
    stress: { injuries: 'Verletzungen', cold: 'Kälte', water: 'Wasser', hunger: 'Hunger', stress: 'Stress', '': 'zufällig' },
    shapes: ['Streckung', 'Eckigkeit', 'Segmente', 'Kopf', 'Verjüngung'],
    shapeWords: { round: 'rund', long: 'lang', boxy: 'eckig', seg: '{0} Segmente', bigHead: 'großer Kopf', tail: 'verjüngt', pear: 'birnenförmig' },
    life: ['Stoffwechsel', 'Homöostase', 'Wachstum', 'Reizbarkeit', 'Fortpflanzung', 'Veränderliches Erbgut', 'Organisation'],
    mind: ['Lernen', 'Selbstmodell', 'Kommunikation', 'Selbsterkennung im Spiegel', 'Kultur'],
    knocks: { repro: 'Fortpflanzung', mut: 'Mutation', learn: 'Lernen im Leben', self: 'Selbstwahrnehmung (Körpermodell)', lang: 'Sprache', meta: 'Stoffwechsel' },
    milestones: {
      gen10: 'Generation 10 erreicht', year5: 'Jahr 5 überlebt', newPart: 'Ein neues Körperteil verbreitet sich (über 20 % einer Art)',
      swim: 'Eine Art lebt im Wasser (Ø Schwimmen über 0,4)', fly: 'Eine Kreatur kann fliegen', species3: 'Drei Arten leben gleichzeitig',
      boss: 'Erster Boss gewählt', mirror: 'Eine Kreatur erkennt sich im Spiegel',
      understand: 'Verständigung: über 50 % der Äußerungen richtig verstanden', sentence: 'Erster Zwei-Wort-Satz richtig verstanden',
      grammar: 'Feste Wortstellung: über 80 % einer Art nutzen dieselbe', culture: 'Kultur: ein Wort überdauert drei Generationen',
      taught: 'Ein Wort von Ihnen wird von Kreaturen verwendet', answer: 'Erste Antwort auf Ihre Worte'
    },
    labMetrics: { pop: 'Population', life: 'Lebenskriterien', mind: 'Geistige Kriterien', certainty: 'Körperkenntnis', understand: 'Verständigung',
      parts: 'Körperteile', diversity: 'Formenvielfalt', wellbeing: 'Wohlbefinden', neurons: 'Verdeckte Neuronen', phi: 'Phi', mNovelty: 'Neuheit (MODES)', species: 'Arten' },
    cols: { t: 'Schritt', pop: 'Population', herb: 'Pflanzenfresser', carn: 'Fleischfresser', species: 'Arten', parts: 'Körperteile', kinds: 'Teilarten',
      diversity: 'Formenvielfalt', neurons: 'verdeckte Neuronen', conns: 'Verbindungen', certainty: 'Körperkenntnis', gutOwn: 'Bauch als eigen',
      mirror: 'Spiegelerkennung', understand: 'Verständigung', wellbeing: 'Wohlbefinden', life: 'Lebenskriterien', mind: 'geistige Kriterien',
      phi: 'Phi', lz: 'Lempel-Ziv', entropy: 'Wort-Entropie', mi: 'Transinformation', topo: 'topographische Ähnlichkeit',
      mChange: 'MODES Wandel', mNovelty: 'MODES Neuheit', mEcology: 'MODES Ökologie', mComplexity: 'MODES Komplexität',
      bActivity: 'Bedau Aktivität', bNew: 'Bedau neue Komponenten', knock: 'Abschaltungen' },
    chartSets: { pop: 'Population', life: 'Leben und Geist', brain: 'Gehirn und Integration', lang: 'Sprache', modes: 'Offenheit (MODES)' },
    ioIn: { bias: 'Grundwert', food: 'Futter', other: 'andere Kreatur', water: 'Wasser hier', waterAhead: 'Wasser voraus', growth: 'Pflanzen voraus',
      energy: 'Energie', health: 'Gesundheit', age: 'Alter', temp: 'Temperatur', drive: 'Antrieb', goal: 'Ziel', mem: 'Gedächtnis',
      foodMem: 'erinnertes Futter', heard: 'gehört', meaning: 'Bedeutung', where: 'gehörter Ort', boss: 'Boss', isBoss: 'bin Boss',
      surprise: 'Überraschung', cert: 'Gewissheit', compass: 'Kompass', horm: ['Adrenalin', 'Endorphin', 'Cortisol'], night: 'Nacht',
      dir: ['sin', 'cos', 'nah', 'Größe', 'ähnlich', 'Waffe', 'Signal', 'laut'] },
    io: { out: ['drehen', 'Tempo', 'angreifen', 'sprechen', 'Ort nennen', 'Gedächtnis 1', 'Gedächtnis 2', 'Gedächtnis 3', 'Gedächtnis 4'] },

    't.stroke': '{0} wurde gestreichelt', 't.scold': '{0} wurde getadelt', 't.miss': 'Keine Kreatur getroffen', 't.say': '"{0}" gesagt',
    't.teach': '{0} Kreaturen haben "{1}" mit dem Gezeigten verknüpft', 't.teachMiss': 'Nichts getroffen oder niemand in Hörweite',
    't.food': 'Futter abgeworfen', 't.word': 'Erst ein Wort eingeben',
    't.mirror': { placed: 'Spiegel aufgestellt', removed: 'Spiegel entfernt', full: 'Höchstens 3 Spiegel' },
    'b.gut': 'pfft', 'b.sleep': 'zzz', 'b.like': '<3', 'b.ouch': 'autsch',

    'ev.goal': 'Ziel erreicht: {0}',
    'ev.mut': '{0} kommt mit einer Mutation zur Welt: {2}',
    'ev.firstKind': 'Erstmals entsteht ein neues Körperteil: {0} (bei {1})',
    'ev.fly': '{0} kann als erste Kreatur fliegen',
    'ev.newSpecies': 'Neue Art: {0} ({1}, {2} Mitglieder)',
    'ev.extinct': 'Die Art {0} ist ausgestorben',
    'ev.pop': 'Die Bevölkerung hat {0} Kreaturen erreicht',
    'ev.gen': 'Die erste Kreatur der Generation {0} wurde geboren',
    'ev.word': 'Das Wort "{0}" wird jetzt von {1} Kreaturen benutzt',
    'ev.spread': '{1} verbreitet sich in der Art {0} ({2} %)',
    'ev.boss': '{1} ist neuer Boss der {0} ({3} von {4} Stimmen)',
    'ev.bossDied': 'Der Boss der {0}, {1}, ist gestorben ({2})',
    'ev.mirror': '{0} erkennt sich im Spiegel',
    'ev.mirrorSet': 'Ein Spiegel wurde aufgestellt',
    'ev.knock': 'Experiment: {0} {1}',
    'ev.knockOn': 'ausgeschaltet', 'ev.knockOff': 'wieder eingeschaltet',
    'ev.adoptedDied': 'Ihr {0} ist gestorben ({1})',
    'ev.herb': 'Pflanzenfresser', 'ev.carn': 'Fleischfresser',
    'mut.dup': '{0} verdoppelt', 'mut.bud': 'neue Knospe ({0})', 'mut.loss': '{0} verloren', 'mut.shape': 'Körperform verändert ({0})',

    'd.immigrant': 'In die Welt eingewandert', 'd.born': 'Geboren, Kind von {0}{1}', 'd.and': ' und {0}',
    'd.firstKill': 'Hat die erste Beute gefangen: {0}', 'd.firstCache': 'Hat zum ersten Mal Futter in einem Lager abgelegt', 'sel.anc': 'Vorfahren', 'sel.desc': 'Nachkommen (gesamt)', 'd.child': 'Hat ein Kind bekommen: {0}', 'd.parentOf': 'Ist Elternteil geworden: {0}', 'd.firstWord': 'Hat das erste Wort gesagt: {0}',
    'd.biome': 'Hat zum ersten Mal {0} entdeckt', 'd.fly': 'Ist zum ersten Mal geflogen', 'd.hurt': 'Wurde schwer verletzt',
    'd.boss': 'Wurde zum Boss gewählt', 'd.notBoss': 'Ist nicht mehr Boss', 'd.mirror': 'Hat sich im Spiegel erkannt',
    'd.adopted': 'Wurde von Ihnen adoptiert', 'd.released': 'Wurde von Ihnen freigegeben', 'd.answer': 'Hat Ihnen geantwortet: {0}', 'd.died': 'Gestorben ({0})'
  }
};

let LANG = 'en';
(function pickLang() {
  let saved = null;
  try { saved = localStorage.getItem('wildlinge-lang'); } catch (e) { /* storage may be blocked */ }
  if (saved === 'en' || saved === 'de') LANG = saved;
})();

function setLang(l) {
  LANG = l === 'de' ? 'de' : 'en';
  try { localStorage.setItem('wildlinge-lang', LANG); } catch (e) { /* ignore */ }
}
/* raw entry (string, array or object) */
function tr(key) {
  const d = I18N[LANG], v = d[key];
  return v !== undefined ? v : I18N.en[key] !== undefined ? I18N.en[key] : key;
}
/* string with {0} {1} parameters */
function t(key, ...p) {
  const s = tr(key);
  if (typeof s !== 'string') return key;
  return s.replace(/\{(\d)\}/g, (m, i) => p[+i] === undefined || p[+i] === null ? '' : String(p[+i]));
}
const tKind = k => tr('kinds')[k] || k;
const tAbil = k => tr('abil')[k] || k;
const tCause = k => tr('causes')[k] || k;
const tStress = k => { const s = tr('stress'); return s[k] !== undefined ? s[k] : k; };
const tSeason = k => tr('seasons')[k] || k;
const tPhase = k => tr('phases')[k] || k;
const tBiome = i => tr('biomes')[i] || '?';
const tSector = i => tr('sectors')[i] || '';
const tDay = d => Array.isArray(d) ? t('app.day', d[0], d[1]) : '';

function describeVec(v) {
  if (!v || !v.length) return tr('lang.unclear');
  const f = tr('features');
  const top = Array.from(v).map((x, i) => [x, i]).filter(q => q[0] > 0.3).sort((a, b) => b[0] - a[0]).slice(0, 2);
  return top.length ? top.map(q => f[q[1]]).join(' + ') : t('lang.unclear');
}
function tMutList(enc) {
  return String(enc || '').split('|').filter(Boolean).map(part => {
    const i = part.indexOf(':'), k = i < 0 ? part : part.slice(0, i), p = i < 0 ? '' : part.slice(i + 1);
    if (k === 'mut.shape') return t(k, tr('shapes')[+p] || p);
    if (k === 'mut.bud') return t(k, tStress(p));
    return t(k, tKind(p));
  }).join(', ');
}
/* events: [[year, day], key, params] */
function tEvent(k, p) {
  p = p || [];
  switch (k) {
    case 'ev.goal': return t(k, tr('milestones')[p[0]] || p[0]);
    case 'ev.mut': return t(k, p[0], p[1], tMutList(p[2]));
    case 'ev.firstKind': return t(k, tKind(p[0]), p[1]);
    case 'ev.newSpecies': return t(k, p[0], p[1] === '1' ? t('ev.carn') : t('ev.herb'), p[2]);
    case 'ev.spread': return t(k, p[0], tKind(p[1]), p[2]);
    case 'ev.bossDied': return t(k, p[0], p[1], tCause(p[2]));
    case 'ev.knock': return t(k, tr('knocks')[p[0]] || p[0], p[1] === '1' ? t('ev.knockOn') : t('ev.knockOff'));
    case 'ev.adoptedDied': return t(k, p[0], tCause(p[1]));
    default: return t(k, ...p);
  }
}
/* diary: key and one parameter string */
function tDiary(k, p) {
  switch (k) {
    case 'd.born': {
      const [a, b] = String(p || '').split('|');
      return t(k, a, b ? t('d.and', b) : '');
    }
    case 'd.biome': return t(k, tBiome(+p));
    case 'd.died': return t(k, tCause(p));
    default: return t(k, p);
  }
}
function tToast(o) {
  if (!o || !o.k) return '';
  if (o.k === 't.mirror') return (tr('t.mirror') || {})[o.p[0]] || '';
  return t(o.k, ...(o.p || []));
}
function tBody(k) { const s = tr(k); return typeof s === 'string' ? s : k; }
function tShape(s) {
  if (!s) return '-';
  const w = tr('shapeWords'), out = [];
  out.push(s[0] > 0.55 ? w.long : w.round);
  if (s[1] > 0.55) out.push(w.boxy);
  const seg = Math.floor(s[2]);
  if (seg > 1) out.push(w.seg.replace('{0}', seg));
  if (s[3] > 0.6) out.push(w.bigHead);
  if (s[4] > 0.4) out.push(w.tail); else if (s[4] < -0.4) out.push(w.pear);
  return out.join(', ');
}
function inName(i) {
  const g = tr('ioIn'), d = g.dir;
  if (i === 0) return g.bias;
  if (i <= 3) return g.food + ' ' + [d[0], d[1], d[2]][i - 1];
  if (i <= 10) return g.other + ' ' + d[i - 4];
  if (i === 11) return g.water;
  if (i === 12) return g.waterAhead;
  if (i === 13) return g.growth;
  if (i <= 17) return [g.energy, g.health, g.age, g.temp][i - 14];
  if (i <= 25) return g.drive + ': ' + tr('drives')[i - 18];
  if (i <= 33) return g.goal + ': ' + tr('goals')[i - 26];
  if (i <= 37) return g.mem + ' ' + (i - 33);
  if (i <= 40) return g.foodMem + ' ' + [d[0], d[1], d[2]][i - 38];
  if (i <= 43) return g.heard + ' ' + [d[0], d[1], d[7]][i - 41];
  if (i <= 53) return g.meaning + ': ' + tr('features')[i - 44];
  if (i <= 56) return g.where + ' ' + [d[0], d[1], ''][i - 54];
  if (i <= 59) return g.boss + ' ' + [d[0], d[1], d[2]][i - 57];
  if (i === 60) return g.isBoss;
  if (i === 61) return g.surprise;
  if (i === 62) return g.cert;
  if (i <= 64) return g.compass + ' ' + [d[0], d[1]][i - 63];
  if (i <= 67) return g.horm[i - 65];
  if (i === 68) return g.night;
  const o = tr('io').out;
  if (i < 78) return o[i - 69];
  return 'H' + (i - 78);
}
