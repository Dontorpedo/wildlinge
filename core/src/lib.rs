#![recursion_limit = "512"]
//! Wildlinge: an open experiment in artificial life.
//! Bodies, brains and language emerge through evolution and learning.
//! The same core runs in the browser (WebAssembly) and natively (server, tests).
pub mod api;
pub mod brain;
pub mod consts;
pub mod creature;
pub mod genome;
pub mod lexicon;
pub mod map;
pub mod metrics;
pub mod sim;
pub mod util;
pub mod world;
