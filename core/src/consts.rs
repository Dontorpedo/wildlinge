//! Constants of the simulation. Names shown to people are keys, the web interface translates them.

pub const WORLD_W: f32 = 4000.0;
pub const WORLD_H: f32 = 2400.0;
pub const PLANT_MAX: usize = 5000;
pub const PLANT_TRIES: usize = 40;
pub const MEAT_DECAY: u32 = 1500;
pub const YEAR_LEN: u32 = 6000;
pub const DAY_LEN: u32 = 400;
pub const START_HERB: usize = 240;
pub const START_CARN: usize = 40;
pub const MIN_HERB: usize = 40;
pub const MIN_CARN: usize = 12;
pub const MAX_POP: usize = 550;
pub const CELL: f32 = 50.0;
pub const HEAR: f32 = 170.0;
pub const SPEAK_COST: f32 = 0.3;
pub const SPEAK_COOL: u32 = 24;
pub const MAX_WORDS: usize = 28;
pub const NIN: usize = 69;
pub const NOUT: usize = 9;
pub const NF: usize = 5;
pub const FD: usize = 10;
pub const MAX_PROTO: usize = 10;
pub const MAX_PARTS: usize = 8;
pub const TC: f32 = 20.0;
pub const SPECIES_TH: f32 = 0.3;
pub const MATE_TH: f32 = 0.25;
pub const STRANGER_TH: f32 = 0.35;
pub const MAX_MIRRORS: usize = 3;
pub const MAX_SENSE: f32 = 240.0;
pub const MAX_HIDDEN: usize = 48;
pub const MAX_CONNS: usize = 400;
pub const ND: usize = 8;
pub const NABIL: usize = 9;
pub const NSHAPE: usize = 5;
/// Cosmetic gene loci (two alleles each, low allele index = dominant and common):
/// accent colour (12), pattern (6), eye colour (8), ear style (4), cheek colour (4), sparkle (2).
pub const NLOCI: usize = 6;
pub const LOCUS_N: [u8; NLOCI] = [12, 6, 8, 4, 4, 2];

// trait indices
pub const T_SIZE: usize = 0;
pub const T_SPEED: usize = 1;
pub const T_SENSE: usize = 2;
pub const T_DIET: usize = 3;
pub const T_MUT: usize = 4;
pub const T_LIFE: usize = 5;
pub const T_LEARN: usize = 6;
pub const T_CUR: usize = 7;
pub const T_CHILD: usize = 8;
pub const T_PAT: usize = 9;
pub const T_PLAST: usize = 10;
pub const T_DISC: usize = 11;
pub const NT: usize = 12;
pub const RANGES: [(f32, f32); NT] = [
    (3.0, 18.0),
    (0.4, 3.2),
    (30.0, 240.0),
    (0.0, 1.0),
    (0.01, 0.3),
    (1500.0, 10000.0),
    (0.005, 0.25),
    (0.0, 1.0),
    (0.05, 0.3),
    (0.0, 2.99),
    (0.001, 0.05),
    (0.12, 0.45),
];

// body shape genes: elongation, boxiness, segments (1..3), head size, taper
pub const S_ELONG: usize = 0;
pub const S_BOX: usize = 1;
pub const S_SEG: usize = 2;
pub const S_HEAD: usize = 3;
pub const S_TAPER: usize = 4;
pub const SHAPE_RANGES: [(f32, f32); NSHAPE] = [(0.0, 1.0), (0.0, 1.0), (1.0, 3.49), (0.0, 1.0), (-1.0, 1.0)];

// abilities of body parts
pub const A_LEG: usize = 0;
pub const A_FIN: usize = 1;
pub const A_WING: usize = 2;
pub const A_WEAPON: usize = 3;
pub const A_ARMOR: usize = 4;
pub const A_SENSE: usize = 5;
pub const A_STORAGE: usize = 6;
pub const A_INSUL: usize = 7;
pub const A_DISPLAY: usize = 8;
pub const K_BUD: usize = 9;
pub const KIND_KEYS: [&str; 10] = ["leg", "fin", "wing", "weapon", "armor", "sense", "storage", "insul", "display", "bud"];
pub const NEW_KINDS: [usize; 7] = [A_FIN, A_WING, A_ARMOR, A_SENSE, A_STORAGE, A_INSUL, A_DISPLAY];
pub const START_KINDS: [usize; 3] = [A_LEG, A_WEAPON, K_BUD];

// part parameter indices
pub const P_LEN: usize = 0;
pub const P_WID: usize = 1;
pub const P_STIFF: usize = 2;
pub const P_MOT: usize = 3;
pub const P_SEN: usize = 4;
pub const P_HOL: usize = 5;
pub const P_COL: usize = 6;
pub const NP: usize = 7;

pub struct Biome {
    pub growth: f32,
    pub food: f32,
    pub temp: f32,
    pub water: u8,
    pub slow: f32,
}
pub const BIOMES: [Biome; 6] = [
    Biome { growth: 0.45, food: 18.0, temp: 10.0, water: 2, slow: 1.0 },
    Biome { growth: 0.9, food: 18.0, temp: 13.0, water: 1, slow: 1.0 },
    Biome { growth: 1.0, food: 22.0, temp: 16.0, water: 0, slow: 1.0 },
    Biome { growth: 1.3, food: 26.0, temp: 14.0, water: 0, slow: 1.0 },
    Biome { growth: 0.15, food: 45.0, temp: 31.0, water: 0, slow: 1.0 },
    Biome { growth: 0.25, food: 20.0, temp: 1.0, water: 0, slow: 0.7 },
];

pub const KNOCKS: [&str; 6] = ["repro", "mut", "learn", "self", "lang", "meta"];
pub const K_REPRO: usize = 0;
pub const K_MUT: usize = 1;
pub const K_LEARN: usize = 2;
pub const K_SELF: usize = 3;
pub const K_LANG: usize = 4;
pub const K_META: usize = 5;

pub const MILESTONES: [&str; 14] = [
    "gen10", "year5", "newPart", "swim", "fly", "species3", "boss", "mirror", "understand", "sentence", "grammar", "culture",
    "taught", "answer",
];
