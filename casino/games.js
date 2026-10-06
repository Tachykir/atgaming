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
};

// Moduły z registerHandlers(socket, io, casino)
const HANDLERS = [roulette, crash, coinflip, pachinko, ...Object.values(SLOTS)];

module.exports = { poker, blackjack, roulette, crash, coinflip, pachinko, SLOTS, HANDLERS };
