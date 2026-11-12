// Čistá herná logika bez DOM: kurzy, Leitner boxy, výber slov, výplaty.
(function (root) {
  'use strict';

  const C = {
    START_BANK: 100,
    JACKPOT_SEED: 500,
    JACKPOT_RATE: 0.05,
    MIN_BET: 5,
    BETS: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    MAX_RUNG: 6,
    DRILLING: 2,
    MAX_BOX: 5,
    STREAK_FOR_JOKER: 5,
    MAX_JOKERS: 3,
    PAWN_ROUNDS: 5,
    PAWN_REWARD: 10,
    PAWN_BONUS: 10,
    TOP_N: 10,
  };

  const ARTICLES = ['der', 'die', 'das', '-'];

  function newState() {
    return {
      v: 1,
      bank: C.START_BANK,
      jackpot: C.JACKPOT_SEED,
      spin: 0,
      streak: 0,
      jokers: 1,
      words: {},
      stats: {
        hands: 0,
        won: 0,
        bestWin: 0,
        jackpots: 0,
        byArticle: { der: [0, 0], die: [0, 0], das: [0, 0], '-': [0, 0] },
        top: [],          // Top 10 vyplatených výhier: { amount, bet, words, rungs, jackpot, t }
        today: { d: '', words: 0, right: 0, repaid: 0 },   // dnešná zmena
        streakDays: 0,    // koľko dní po sebe hráč hral
      },
    };
  }

  // ---- kurzy -------------------------------------------------------------

  function tier(state, id) {
    const rec = state.words[id];
    if (!rec) return 'mid';
    if (rec.debt || rec.box === 0) return 'hard';
    if (rec.box <= 2) return 'mid';
    return 'easy';
  }

  function oddsFor(state, id) {
    const rec = state.words[id];
    if (!rec) return 2;
    if (rec.debt || rec.box === 0) return 3;
    if (rec.box <= 2) return 2;
    if (rec.box === 3) return 1.5;
    return 1.2;
  }

  function stars(odds) {
    return odds >= 3 ? 3 : odds >= 2 ? 2 : 1;
  }

  function mult(pot, odds) {
    return Math.ceil(pot * odds - 1e-9);
  }

  // ---- odpoveď -----------------------------------------------------------

  // Otočí dennú zmenu: nový deň vynuluje dnešné počty a posunie sériu dní.
  function touchDay(state, day) {
    const st = state.stats;
    if (!st.today) st.today = { d: '', words: 0, right: 0, repaid: 0 };
    if (st.today.d === day) return;
    st.streakDays = st.today.d && daysBetween(st.today.d, day) === 1 ? (st.streakDays || 0) + 1 : 1;
    st.today = { d: day, words: 0, right: 0, repaid: 0 };
  }

  function daysBetween(a, b) {
    const utc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((utc(b) - utc(a)) / 86400000);
  }

  function record(state, item, answer) {
    const correct = answer === item.a;
    const rec = state.words[item.id] || (state.words[item.id] = { box: 1, right: 0, wrong: 0, debt: false, last: 0 });
    const wasDebt = rec.debt;
    const today = state.stats.today;
    if (today) {
      today.words++;
      if (correct) {
        today.right++;
        if (wasDebt) today.repaid++;
      }
    }
    rec.last = state.spin;
    const by = state.stats.byArticle[item.a];
    by[1]++;
    let jokerAwarded = false;
    if (correct) {
      by[0]++;
      rec.right++;
      rec.debt = false;
      rec.box = Math.min(C.MAX_BOX, rec.box + 1);
      state.streak++;
      if (state.streak % C.STREAK_FOR_JOKER === 0 && state.jokers < C.MAX_JOKERS) {
        state.jokers++;
        jokerAwarded = true;
      }
    } else {
      rec.wrong++;
      rec.debt = true;
      rec.box = 0;
      state.streak = 0;
    }
    return { correct, jokerAwarded };
  }

  // ---- výber slov --------------------------------------------------------

  function weightedPick(list, rng) {
    let total = 0;
    for (const it of list) total += it.kind === 'noun' ? 1 : 2;
    let r = rng() * total;
    for (const it of list) {
      r -= it.kind === 'noun' ? 1 : 2;
      if (r < 0) return it;
    }
    return list[list.length - 1];
  }

  function shuffle(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickByTiers(state, pool, order, taken, rng) {
    for (const t of order) {
      const group = pool.filter((it) => !taken.has(it.id) && tier(state, it.id) === t);
      if (group.length) return weightedPick(group, rng);
    }
    return null;
  }

  // Volá sa po startHand: vynechá slová z aktuálneho a predošlého spinu.
  function pickSpin(state, items, rng) {
    rng = rng || Math.random;
    let pool = items.filter((it) => {
      const rec = state.words[it.id];
      return !rec || rec.last < state.spin - 1;
    });
    if (pool.length < 3) pool = items;
    const taken = new Set();
    const out = [];
    const plans = [
      ['hard', 'mid', 'easy'],
      ['mid', 'hard', 'easy'],
      ['easy', 'mid', 'hard'],
    ];
    for (const order of plans) {
      const it = pickByTiers(state, pool, order, taken, rng);
      if (it) {
        taken.add(it.id);
        out.push(it);
      }
    }
    return shuffle(out, rng);
  }

  function pickLadder(state, items, excludeIds, rng) {
    rng = rng || Math.random;
    const r = rng();
    const order = r < 0.5 ? ['hard', 'mid', 'easy'] : r < 0.85 ? ['mid', 'hard', 'easy'] : ['easy', 'mid', 'hard'];
    const taken = excludeIds || new Set();
    return pickByTiers(state, items, order, taken, rng) || weightedPick(items, rng);
  }

  function debtors(state, items) {
    return items.filter((it) => state.words[it.id] && state.words[it.id].debt);
  }

  function pawnPick(state, items, n, rng) {
    rng = rng || Math.random;
    const debt = shuffle(debtors(state, items), rng);
    const debtIds = new Set(debt.map((it) => it.id));
    const rest = shuffle(items.filter((it) => !debtIds.has(it.id)), rng).sort((x, y) => {
      const bx = state.words[x.id] ? state.words[x.id].box : 1;
      const by = state.words[y.id] ? state.words[y.id].box : 1;
      return bx - by;
    });
    return debt.concat(rest).slice(0, n);
  }

  // ---- peniaze -----------------------------------------------------------

  function isBroke(state) {
    return state.bank < C.MIN_BET;
  }

  function clampBet(state, bet) {
    let best = C.MIN_BET;
    for (const b of C.BETS) if (b <= bet && b <= state.bank) best = b;
    return best;
  }

  function stepBet(state, bet, dir) {
    const allowed = C.BETS.filter((b) => b <= state.bank);
    if (!allowed.length) return C.MIN_BET;
    let i = allowed.indexOf(clampBet(state, bet)) + dir;
    i = Math.max(0, Math.min(allowed.length - 1, i));
    return allowed[i];
  }

  function startHand(state, bet) {
    if (!Number.isInteger(bet) || bet < C.MIN_BET || bet > state.bank) throw new Error('Neplatný vklad: ' + bet);
    state.bank -= bet;
    state.jackpot += Math.max(1, Math.round(bet * C.JACKPOT_RATE));
    state.spin++;
    state.stats.hands++;
  }

  function isDrilling(handItems) {
    return handItems.length === 3 && handItems.every((it) => it.a === handItems[0].a);
  }

  function collect(state, pot) {
    state.bank += pot;
    state.stats.won++;
    if (pot > state.stats.bestWin) state.stats.bestWin = pot;
  }

  // Zapíše výhru do Top 10. Vráti poradie 1..TOP_N, alebo 0, ak sa nedostala.
  // Pri rovnakej sume ostáva skoršia výhra vyššie.
  function recordTop(state, entry) {
    const top = state.stats.top || (state.stats.top = []);
    let i = 0;
    while (i < top.length && top[i].amount >= entry.amount) i++;
    if (i >= C.TOP_N) return 0;
    top.splice(i, 0, entry);
    if (top.length > C.TOP_N) top.length = C.TOP_N;
    return i + 1;
  }

  function winJackpot(state) {
    const amount = state.jackpot;
    state.jackpot = C.JACKPOT_SEED;
    state.stats.jackpots++;
    return amount;
  }

  // ---- pravidlá rodu -----------------------------------------------------

  const TIME_WORDS = new Set(['Montag', 'Sommer', 'Winter', 'Frühling', 'Herbst', 'Morgen', 'Abend', 'Tag', 'Monat']);

  const SUFFIX_RULES = [
    ['ung', 'die', 'vždy'], ['heit', 'die', 'vždy'], ['keit', 'die', 'vždy'], ['schaft', 'die', 'vždy'],
    ['tion', 'die', 'vždy'], ['tät', 'die', 'vždy'], ['ismus', 'der', 'vždy'], ['ling', 'der', 'vždy'],
    ['chen', 'das', 'vždy'], ['lein', 'das', 'vždy'], ['ment', 'das', 'väčšinou'], ['nis', 'das', 'väčšinou'],
    ['um', 'das', 'väčšinou'], ['ei', 'die', 'väčšinou'], ['ie', 'die', 'väčšinou'], ['ik', 'die', 'väčšinou'],
    ['ur', 'die', 'väčšinou'], ['or', 'der', 'väčšinou'], ['ig', 'der', 'väčšinou'], ['ich', 'der', 'väčšinou'],
    ['o', 'das', 'často'], ['er', 'der', 'často'], ['e', 'die', 'väčšinou'],
  ];

  // Pravidlo len vtedy, keď pre dané slovo naozaj platí (výnimky nič nedostanú).
  // Vracia { text, part, at }: part je kus slova, ktorý pravidlo označuje
  // ('ung' na konci, 'Ge' na začiatku), alebo null, keď sa nedá ukázať v slove.
  function ruleMatch(item) {
    if (item.kind !== 'noun') return null;
    if (item.a === 'der' && TIME_WORDS.has(item.text)) return { text: 'dni, mesiace, ročné obdobia → der', part: null, at: null };
    const w = item.text.toLowerCase();
    for (const [suffix, art, how] of SUFFIX_RULES) {
      if (w.length > suffix.length + 1 && w.endsWith(suffix)) {
        if (art === item.a) return { text: `-${suffix} → ${how} ${art}`, part: item.text.slice(-suffix.length), at: 'end' };
        break;
      }
    }
    if (item.a === 'das' && w.length >= 6 && w.startsWith('ge')) return { text: 'Ge- → často das', part: item.text.slice(0, 2), at: 'start' };
    return null;
  }

  function ruleFor(item) {
    const m = ruleMatch(item);
    return m ? m.text : null;
  }

  const Engine = {
    C, ARTICLES, newState, tier, oddsFor, stars, mult, record, pickSpin, pickLadder, debtors, pawnPick,
    isBroke, clampBet, stepBet, startHand, isDrilling, collect, recordTop, winJackpot, ruleFor, ruleMatch, touchDay,
  };

  root.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
