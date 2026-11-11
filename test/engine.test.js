const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const ITEMS = require('../js/words.js');

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const byId = (id) => ITEMS.find((it) => it.id === id);

test('dáta: platné členy, preklady, žiadne duplicity', () => {
  const ids = new Set();
  for (const it of ITEMS) {
    assert.ok(E.ARTICLES.includes(it.a), `člen: ${it.id}`);
    assert.ok(it.text && it.sk, `text/preklad: ${it.id}`);
    assert.ok(!ids.has(it.id), `duplicita: ${it.id}`);
    ids.add(it.id);
    if (it.kind === 'phrase') assert.ok(it.text.includes('___'), `medzera: ${it.id}`);
    if (it.kind !== 'noun') assert.ok(it.note, `poznámka: ${it.id}`);
  }
  assert.ok(ITEMS.length >= 300);
  assert.ok(ITEMS.filter((it) => it.a === '-').length >= 30);
});

test('kurzy sledujú osobnú históriu', () => {
  const s = E.newState();
  const w = byId('Tisch');
  assert.equal(E.oddsFor(s, w.id), 2);
  E.record(s, w, 'die');
  assert.equal(E.oddsFor(s, w.id), 3);
  assert.equal(E.tier(s, w.id), 'hard');
  E.record(s, w, 'der'); // box 1
  assert.equal(E.oddsFor(s, w.id), 2);
  E.record(s, w, 'der'); // box 2
  E.record(s, w, 'der'); // box 3
  assert.equal(E.oddsFor(s, w.id), 1.5);
  E.record(s, w, 'der'); // box 4
  assert.equal(E.oddsFor(s, w.id), 1.2);
  assert.equal(E.tier(s, w.id), 'easy');
  assert.deepEqual(s.stats.byArticle.der, [4, 5]);
});

test('startHand strhne vklad a plní jackpot', () => {
  const s = E.newState();
  E.startHand(s, 25);
  assert.equal(s.bank, 75);
  assert.equal(s.jackpot, E.C.JACKPOT_SEED + 1);
  assert.equal(s.spin, 1);
  assert.throws(() => E.startHand(s, 100));
  assert.throws(() => E.startHand(s, 1));
});

test('pickSpin: 3 rôzne slová, žiadne z predošlého spinu', () => {
  const s = E.newState();
  const rng = lcg(7);
  let prev = [];
  for (let i = 0; i < 200; i++) {
    E.startHand(s, 5);
    s.bank += 5;
    const hand = E.pickSpin(s, ITEMS, rng);
    assert.equal(hand.length, 3);
    assert.equal(new Set(hand.map((h) => h.id)).size, 3);
    for (const h of hand) assert.ok(!prev.includes(h.id), `opakovanie ${h.id}`);
    for (const h of hand) E.record(s, h, rng() < 0.6 ? h.a : 'x');
    prev = hand.map((h) => h.id);
  }
});

test('pickSpin mieša ťažké, neisté a ľahké', () => {
  const s = E.newState();
  s.spin = 10;
  s.words.Tisch = { box: 0, right: 0, wrong: 1, debt: true, last: 1 };
  s.words.Frau = { box: 5, right: 5, wrong: 0, debt: false, last: 1 };
  const tiers = E.pickSpin(s, ITEMS, lcg(3)).map((it) => E.tier(s, it.id)).sort();
  assert.deepEqual(tiers, ['easy', 'hard', 'mid']);
});

test('pickLadder rešpektuje vylúčené slová', () => {
  const s = E.newState();
  const rng = lcg(11);
  const used = new Set(ITEMS.slice(0, 300).map((it) => it.id));
  for (let i = 0; i < 50; i++) assert.ok(!used.has(E.pickLadder(s, ITEMS, used, rng).id));
});

test('drilling, násobenie, jackpot, výber výhry', () => {
  assert.ok(E.isDrilling([byId('Tisch'), byId('Hund'), byId('Mann')]));
  assert.ok(!E.isDrilling([byId('Tisch'), byId('Frau'), byId('Mann')]));
  assert.equal(E.mult(5, 1.2), 6);
  assert.equal(E.mult(10, 1.5), 15);
  assert.equal(E.mult(7, 1.2), 9);
  const s = E.newState();
  s.jackpot = 777;
  assert.equal(E.winJackpot(s), 777);
  assert.equal(s.jackpot, E.C.JACKPOT_SEED);
  E.collect(s, 40);
  assert.equal(s.bank, 140);
  assert.equal(s.stats.bestWin, 40);
});

test('joker za sériu 5 správnych, max 3', () => {
  const s = E.newState();
  const w = byId('Haus');
  let awarded = 0;
  for (let i = 0; i < 25; i++) if (E.record(s, w, 'das').jokerAwarded) awarded++;
  assert.equal(awarded, 2);
  assert.equal(s.jokers, 3);
  E.record(s, w, 'der');
  assert.equal(s.streak, 0);
});

test('stávky sa držia v rámci banku', () => {
  const s = E.newState();
  assert.equal(E.clampBet(s, 5000), 100);
  assert.equal(E.stepBet(s, 5, 1), 10);
  assert.equal(E.stepBet(s, 100, 1), 100);
  assert.equal(E.stepBet(s, 5, -1), 5);
  s.bank = 3;
  assert.ok(E.isBroke(s));
});

test('Pfandhaus berie najprv dlžníkov', () => {
  const s = E.newState();
  E.record(s, byId('Tisch'), 'die');
  E.record(s, byId('Frau'), 'der');
  const list = E.pawnPick(s, ITEMS, 5, lcg(5));
  assert.equal(list.length, 5);
  assert.deepEqual(list.slice(0, 2).map((it) => it.id).sort(), ['Frau', 'Tisch']);
});

test('pravidlá sa ukážu len tam, kde platia', () => {
  assert.match(E.ruleFor(byId('Zeitung')), /-ung → vždy die/);
  assert.match(E.ruleFor(byId('Mädchen')), /-chen/);
  assert.match(E.ruleFor(byId('Sommer')), /ročné obdobia/);
  assert.match(E.ruleFor(byId('Gebäude')), /Ge-/);
  assert.equal(E.ruleFor(byId('Raum')), null); // -um, ale der
  assert.equal(E.ruleFor(byId('Name')), null); // -e, ale der
  assert.equal(E.ruleFor(byId('Zimmer')), null); // -er, ale das
  assert.equal(E.ruleFor(byId('Ei')), null);
  assert.equal(E.ruleFor(byId('geo:Schweiz')), null);
  for (const it of ITEMS) {
    const r = E.ruleFor(it);
    if (r) assert.ok(r.endsWith(it.a), `${it.id}: ${r}`);
  }
});
