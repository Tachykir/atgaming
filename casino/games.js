/**
 * Rejestr modułów gier kasyna — jedno miejsce, w którym dopisuje się nową grę.
 */
'use strict';

const poker    = require('../games/casino/poker');
const blackjack = require('../games/casino/blackjack');
const roulette = require('../games/casino/roulette');
const crash    = require('../games/casino/crash');
const coinflip = require('../games/casino/coinflip');
const pachinko = require('../games/casino/pachinko');

// Automaty (wspólny slot_engine) — klucz = table.game
const SLOTS = {
  slots:            require('../games/casino/slots'),
  path_of_gambling: require('../games/casino/path_of_gambling'),
  jackpot_frenzy:   require('../games/casino/jackpot_frenzy'),
  dragon_hoard:     require('../games/casino/dragon_hoard'),
  arcane_academy:   require('../games/casino/arcane_academy'),
  dual_blades:      require('../games/casino/dual_blades'),
  neon_racer:       require('../games/casino/neon_racer'),
  candy_tumble:     require('../games/casino/candy_tumble'),
  book_pharaoh:     require('../games/casino/book_pharaoh'),
  hot_777:          require('../games/casino/hot_777'),
  olympus_ways: require('../games/casino/olympus_ways'),
  wild_duel: require('../games/casino/wild_duel'),
  cosmic_infinity: require('../games/casino/cosmic_infinity'),
  deep_sea: require('../games/casino/deep_sea'),
  sugar_cells: require('../games/casino/sugar_cells'),
  pandora_mystery: require('../games/casino/pandora_mystery'),
  titan_colossus: require('../games/casino/titan_colossus'),
  ninja_walk: require('../games/casino/ninja_walk'),
  mega_wheel: require('../games/casino/mega_wheel'),
  alchemy_lab: require('../games/casino/alchemy_lab'),
};

// Moduły z registerHandlers(socket, io, casino)
const HANDLERS = [roulette, crash, coinflip, pachinko, ...Object.values(SLOTS)];

module.exports = { poker, blackjack, roulette, crash, coinflip, pachinko, SLOTS, HANDLERS };
