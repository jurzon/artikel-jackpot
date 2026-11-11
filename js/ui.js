// Obrazovka a stavový automat hry: bet → spinning → answer → offer → flip → lanswer → bet
(function () {
  'use strict';
  const E = window.Engine;
  const ITEMS = window.ITEMS;
  const Store = window.Store;
  const Sfx = window.Sfx;

  const $ = (s) => document.querySelector(s);
  const LABEL = { der: 'der', die: 'die', das: 'das', '-': '—' };
  const GCLASS = { der: 'g-der', die: 'g-die', das: 'g-das', '-': 'g-none' };
  const CCLASS = { der: 'c-der', die: 'c-die', das: 'c-das', '-': 'c-none' };
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => n.toLocaleString('sk-SK');
  const fmtOdds = (o) => '×' + String(o).replace('.', ',');
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const later = (ms, fn) => setTimeout(fn, ms);

  let S = Store.load();
  let phase = 'bet';
  let bet = E.C.MIN_BET;
  let pot = 0;
  let hand = [];      // [{ it, odds }]
  let idx = 0;        // aktívny valec
  let rung = 0;       // priečka Risikoleiter
  let card = null;    // karta, na ktorú sa práve odpovedá
  let next = null;    // ďalšia karta lícom dole (známy je len kurz)
  let used = new Set();
  let struck = new Set();
  let jokerUsed = false;
  let pawn = null;
  // Testovací mód: klávesa T alebo ?test v adrese. Zvýrazní správnu odpoveď.
  let testMode = Store.getFlag('test', false) || /[?&]test\b/.test(location.search);

  const cabinet = $('#cabinet');
  const rows = [];

  // ---- texty -------------------------------------------------------------

  function filled(it) {
    if (it.kind === 'phrase') {
      if (it.a === '-') return it.text.replace('___ ', '');
      return it.text.replace('___', it.text.startsWith('___') ? cap(it.a) : it.a);
    }
    return it.a === '-' ? it.text : it.a + ' ' + it.text;
  }

  function infoText(it) {
    return [it.sk, E.ruleFor(it) || it.note].filter(Boolean).join(' · ');
  }

  function setMsg(text, cls) {
    const el = $('#msg');
    el.textContent = text;
    el.className = 'ticker' + (cls ? ' ' + cls : '');
  }

  function flash(cls, ms) {
    cabinet.classList.add(cls);
    later(ms || 1200, () => cabinet.classList.remove(cls));
    if (cls === 'win') shower(16);
    if (cls === 'jackpot') shower(70);
  }

  // Spŕška zlatých žetónov.
  function shower(count) {
    if (calm) return;
    const layer = $('#fx');
    for (let i = 0; i < count; i++) {
      const c = document.createElement('i');
      const delay = Math.random() * (count > 30 ? 2.2 : 0.5);
      const dur = 1.1 + Math.random() * 0.9;
      c.style.left = Math.random() * 100 + '%';
      c.style.setProperty('--s', 10 + Math.random() * 12 + 'px');
      c.style.setProperty('--x', Math.random() * 80 - 40 + 'px');
      c.style.setProperty('--r', Math.random() * 900 - 450 + 'deg');
      c.style.setProperty('--d', dur + 's');
      c.style.setProperty('--delay', delay + 's');
      layer.appendChild(c);
      later((delay + dur) * 1000 + 100, () => c.remove());
    }
  }

  // Číslo na displeji plynulo dopočíta na novú hodnotu.
  function setNum(el, target) {
    if (el._target === target) return;
    const from = el._shown;
    el._target = target;
    cancelAnimationFrame(el._raf);
    if (from === undefined || calm) {
      el._shown = target;
      el.textContent = fmt(target);
      return;
    }
    const t0 = performance.now();
    const dur = Math.min(900, 250 + Math.abs(target - from) * 3);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el._shown = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      el.textContent = fmt(el._shown);
      if (k < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }

  function pips(odds) {
    const el = document.createElement('span');
    el.className = 'pips';
    for (let i = 0; i < E.stars(odds); i++) el.appendChild(document.createElement('i'));
    return el;
  }

  function setSoundIcon() {
    $('#sound-use').setAttribute('href', Sfx.isOn() ? '#i-sound' : '#i-mute');
  }

  // ---- stavba ------------------------------------------------------------

  function build() {
    const reels = $('#reels');
    for (let i = 0; i < 3; i++) {
      const r = document.createElement('div');
      r.className = 'reel';
      r.innerHTML = '<div class="slot">?</div><div class="face"><div class="word"></div><div class="info"></div></div><div class="odds"></div>';
      reels.appendChild(r);
      rows.push(r);
    }
    const rungs = $('#rungs');
    for (let i = 0; i < E.C.MAX_RUNG; i++) rungs.appendChild(document.createElement('i'));
    const crown = document.createElement('span');
    crown.className = 'crown';
    crown.innerHTML = '<svg><use href="#i-crown"/></svg>';
    rungs.appendChild(crown);
    setSoundIcon();
  }

  function showPanel(name) {
    $('#reels').hidden = name !== 'reels';
    $('#ladder').hidden = name !== 'ladder';
  }

  function setWord(el, text) {
    el.textContent = text;
    el.classList.toggle('long', text.length > 16);
  }

  function resetRow(row) {
    row.className = 'reel';
    const slot = row.querySelector('.slot');
    slot.className = 'slot';
    slot.textContent = '?';
    row.querySelector('.word').textContent = '';
    row.querySelector('.info').textContent = '';
    row.querySelector('.odds').textContent = '';
  }

  function revealRow(i, mode) {
    const row = rows[i];
    const it = hand[i].it;
    row.classList.add(mode);
    const slot = row.querySelector('.slot');
    slot.textContent = LABEL[it.a];
    slot.classList.add(GCLASS[it.a]);
    if (it.kind === 'phrase') setWord(row.querySelector('.word'), filled(it));
    row.querySelector('.info').textContent = infoText(it);
  }

  function render() {
    const broke = E.isBroke(S);
    const idle = phase === 'bet';
    const answering = phase === 'answer' || phase === 'lanswer';
    const inLadder = phase === 'offer' || phase === 'flip' || phase === 'lanswer';

    if (idle && !broke) bet = E.clampBet(S, bet);
    setNum($('#bank'), S.bank);
    setNum($('#pot'), pot);
    setNum($('#jackpot'), S.jackpot);
    $('#jokers').textContent = S.jokers;
    $('#bet').textContent = fmt(bet);

    const current = phase === 'answer' ? hand[idx].it : phase === 'lanswer' ? card.it : null;
    document.querySelectorAll('#answers .ans').forEach((b) => {
      const out = struck.has(b.dataset.a);
      b.disabled = !answering || out;
      b.classList.toggle('struck', out);
      b.classList.toggle('hint', testMode && !!current && b.dataset.a === current.a);
    });
    const pawnItem = pawn && !pawn.answered ? pawn.list[pawn.i] : null;
    document.querySelectorAll('#pawn-answers .ans').forEach((b) => {
      b.classList.toggle('hint', testMode && !!pawnItem && b.dataset.a === pawnItem.a);
    });
    $('#testbar').hidden = !testMode;
    $('#t-broke').disabled = !idle;
    $('#btn-joker').disabled = !answering || jokerUsed || S.jokers < 1;

    $('#ctl-bet').hidden = inLadder;
    $('#ctl-offer').hidden = !inLadder;
    $('#btn-spin').disabled = !idle;
    $('#btn-spin').textContent = idle && broke ? 'PFANDHAUS' : 'SPIN';
    $('#btn-spin').classList.toggle('wide', idle && broke);
    $('#bet-minus').disabled = $('#bet-plus').disabled = !idle || broke;
    $('#btn-cash').disabled = $('#btn-risk').disabled = phase !== 'offer';
    if (phase === 'offer' && next) {
      $('#cash-sub').textContent = '+' + fmt(pot);
      $('#risk-sub').replaceChildren(pips(next.odds), `${fmtOdds(next.odds)} → ${fmt(E.mult(pot, next.odds))}`);
    }

    rows.forEach((r, i) => r.classList.toggle('active', phase === 'answer' && i === idx));
    [...$('#rungs').children].forEach((el, i) => {
      el.classList.toggle('on', i < rung);
      el.classList.toggle('next', inLadder && i === rung);
    });
  }

  // ---- základná hra ------------------------------------------------------

  function spin() {
    if (phase !== 'bet') return;
    if (E.isBroke(S)) return openPawn();
    bet = E.clampBet(S, bet);
    E.startHand(S, bet);
    hand = E.pickSpin(S, ITEMS).map((it) => ({ it, odds: E.oddsFor(S, it.id) }));
    used = new Set(hand.map((h) => h.it.id));
    pot = bet;
    idx = 0;
    rung = 0;
    card = next = null;
    struck = new Set();
    jokerUsed = false;
    Store.save(S);

    phase = 'spinning';
    showPanel('reels');
    setMsg('Valce sa točia…');
    render();

    rows.forEach((row, i) => {
      resetRow(row);
      row.classList.add('spinning');
      const word = row.querySelector('.word');
      const timer = setInterval(() => {
        setWord(word, ITEMS[Math.floor(Math.random() * ITEMS.length)].text);
        if (i === 2) Sfx.tick();
      }, 70);
      later(650 + i * 450, () => {
        clearInterval(timer);
        row.classList.remove('spinning');
        setWord(word, hand[i].it.text);
        row.querySelector('.odds').textContent = fmtOdds(hand[i].odds);
        row.dataset.stars = E.stars(hand[i].odds);
        Sfx.stop();
        if (i === 2) {
          phase = 'answer';
          setMsg('Aký člen patrí k označenému slovu?');
          render();
        }
      });
    });
  }

  function answer(a) {
    if (struck.has(a)) return;
    if (phase === 'answer') answerReel(a);
    else if (phase === 'lanswer') answerCard(a);
  }

  function jokerNote(res) {
    return res.jokerAwarded ? ' 🃏 +1 Joker!' : '';
  }

  function answerReel(a) {
    const { it, odds } = hand[idx];
    const res = E.record(S, it, a);
    struck = new Set();
    jokerUsed = false;
    revealRow(idx, res.correct ? 'ok' : 'bad');

    if (res.correct) {
      pot = E.mult(pot, odds);
      idx++;
      if (idx < hand.length) {
        Sfx.right();
        setMsg(`Richtig! ${fmtOdds(odds)} → ${fmt(pot)}.${jokerNote(res)}`, 'ok');
      } else {
        let text = `Línia! Výhra ${fmt(pot)}.`;
        if (E.isDrilling(hand.map((h) => h.it))) {
          pot *= E.C.DRILLING;
          text = `DRILLING! 3× ${LABEL[it.a]} → výhra ×2 = ${fmt(pot)}.`;
        }
        Sfx.win();
        flash('win');
        offer(text + jokerNote(res) + ' Kassieren alebo Risiko?');
      }
    } else {
      Sfx.wrong();
      flash('lose', 500);
      for (let i = idx + 1; i < hand.length; i++) revealRow(i, 'dim');
      pot = 0;
      endHand(`Falsch! Správne: ${filled(it)}. Vklad ${fmt(bet)} je preč.`, 'bad');
    }
    Store.save(S);
    render();
  }

  function endHand(text, cls) {
    phase = 'bet';
    rung = cls === 'jackpot' ? rung : 0;
    if (E.isBroke(S)) text += ' Si na mizine — choď do Pfandhausu.';
    setMsg(text, cls);
  }

  // ---- Risikoleiter ------------------------------------------------------

  function offer(text) {
    const it = E.pickLadder(S, ITEMS, used);
    used.add(it.id);
    next = { it, odds: E.oddsFor(S, it.id) };
    phase = 'offer';
    setMsg(text, 'ok');
  }

  function cash() {
    if (phase !== 'offer') return;
    E.collect(S, pot);
    Sfx.cash();
    flash('win');
    const won = pot;
    pot = 0;
    endHand(`Kassiert! +${fmt(won)} žetónov.`, 'ok');
    Store.save(S);
    render();
  }

  function risk() {
    if (phase !== 'offer') return;
    card = next;
    next = null;
    phase = 'flip';
    // Karta sa najprv ukáže rubom, potom sa otočí.
    const el = $('#card');
    el.className = 'flip down instant';
    $('#card-front').className = 'bigcard card-front';
    setWord($('#card-word'), card.it.text);
    $('#card-info').textContent = '';
    $('#card-odds').textContent = fmtOdds(card.odds);
    $('#card-odds').dataset.stars = E.stars(card.odds);
    $('#card-back-odds').replaceChildren(pips(card.odds), fmtOdds(card.odds));
    showPanel('ladder');
    setMsg(`Risiko! V hre je ${fmt(pot)}.`);
    render();
    void el.offsetWidth;
    el.classList.remove('instant');
    later(calm ? 0 : 380, () => {
      Sfx.flip();
      el.classList.remove('down');
    });
    later(calm ? 20 : 900, () => {
      phase = 'lanswer';
      render();
    });
  }

  function answerCard(a) {
    const { it, odds } = card;
    const res = E.record(S, it, a);
    struck = new Set();
    jokerUsed = false;
    $('#card-front').classList.add(res.correct ? 'ok' : 'bad', CCLASS[it.a]);
    setWord($('#card-word'), filled(it));
    $('#card-info').textContent = infoText(it);

    if (res.correct) {
      pot = E.mult(pot, odds);
      rung++;
      if (rung >= E.C.MAX_RUNG) {
        const jp = E.winJackpot(S);
        pot += jp;
        E.collect(S, pot);
        Sfx.jackpot();
        flash('jackpot', 4000);
        const won = pot;
        pot = 0;
        endHand(`JACKPOT! +${fmt(jp)} navyše, spolu +${fmt(won)} žetónov!`, 'jackpot');
      } else {
        Sfx.right();
        offer(`Richtig! ${fmtOdds(odds)} → ${fmt(pot)}. Priečka ${rung}/${E.C.MAX_RUNG}.${jokerNote(res)}`);
      }
    } else {
      Sfx.wrong();
      flash('lose', 500);
      const lost = pot;
      pot = 0;
      endHand(`Falsch! Správne: ${filled(it)}. Prehral si ${fmt(lost)}.`, 'bad');
    }
    Store.save(S);
    render();
  }

  function joker() {
    const answering = phase === 'answer' || phase === 'lanswer';
    if (!answering || jokerUsed || S.jokers < 1) return;
    const it = phase === 'answer' ? hand[idx].it : card.it;
    const wrong = E.ARTICLES.filter((a) => a !== it.a);
    wrong.splice(Math.floor(Math.random() * wrong.length), 1);
    struck = new Set(wrong);
    S.jokers--;
    jokerUsed = true;
    Sfx.flip();
    Store.save(S);
    render();
  }

  // ---- Pfandhaus ---------------------------------------------------------

  function openPawn() {
    pawn = { list: E.pawnPick(S, ITEMS, E.C.PAWN_ROUNDS), i: 0, earned: 0, answered: false };
    pawnShow();
    $('#dlg-pawn').showModal();
  }

  function pawnShow() {
    const it = pawn.list[pawn.i];
    pawn.answered = false;
    $('#pawn-card').className = 'bigcard';
    setWord($('#pawn-word'), it.text);
    $('#pawn-info').textContent = '';
    $('#pawn-progress').textContent = `${pawn.i + 1} / ${pawn.list.length} · zarobené ${pawn.earned}`;
    document.querySelectorAll('#pawn-answers .ans').forEach((b) => (b.disabled = false));
    $('#pawn-next').hidden = true;
    render();
  }

  function pawnAnswer(a) {
    if (!pawn || pawn.answered) return;
    const it = pawn.list[pawn.i];
    const res = E.record(S, it, a);
    pawn.answered = true;
    if (res.correct) {
      S.bank += E.C.PAWN_REWARD;
      pawn.earned += E.C.PAWN_REWARD;
      Sfx.right();
    } else {
      Sfx.wrong();
    }
    $('#pawn-card').classList.add(res.correct ? 'ok' : 'bad', CCLASS[it.a]);
    setWord($('#pawn-word'), filled(it));
    $('#pawn-info').textContent = (res.correct ? `Richtig! +${E.C.PAWN_REWARD} · ` : 'Falsch · ') + infoText(it);
    $('#pawn-progress').textContent = `${pawn.i + 1} / ${pawn.list.length} · zarobené ${pawn.earned}`;
    document.querySelectorAll('#pawn-answers .ans').forEach((b) => (b.disabled = true));
    const btn = $('#pawn-next');
    btn.textContent = pawn.i + 1 >= pawn.list.length ? `Hotovo (+${E.C.PAWN_BONUS} bonus)` : 'Ďalej';
    btn.hidden = false;
    btn.focus();
    Store.save(S);
    render();
  }

  function pawnNext() {
    if (!pawn || !pawn.answered) return;
    pawn.i++;
    if (pawn.i < pawn.list.length) return pawnShow();
    S.bank += E.C.PAWN_BONUS;
    const total = pawn.earned + E.C.PAWN_BONUS;
    Store.save(S);
    $('#dlg-pawn').close();
    setMsg(`Pfandhaus vyplatil ${fmt(total)} žetónov. Späť do hry!`, 'ok');
    render();
  }

  // ---- Kniha dlžníkov ----------------------------------------------------

  function openBook() {
    const recs = Object.values(S.words);
    const stats = [
      ['Hry', S.stats.hands],
      ['Vyplatené výhry', S.stats.won],
      ['Najväčšia výhra', S.stats.bestWin],
      ['Jackpoty', S.stats.jackpots],
      ['Videné slová', `${recs.length} / ${ITEMS.length}`],
      ['Naučené (kurz ×1,2)', recs.filter((r) => r.box >= 4).length],
    ];
    $('#book-stats').replaceChildren(...stats.map(([k, v]) => {
      const d = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = typeof v === 'number' ? fmt(v) : v;
      d.append(b, k);
      return d;
    }));

    $('#book-bars').replaceChildren(...E.ARTICLES.map((a) => {
      const [right, total] = S.stats.byArticle[a];
      const pct = total ? Math.round((right / total) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'bar';
      const label = document.createElement('span');
      label.className = 'bar-label ' + GCLASS[a];
      label.textContent = LABEL[a];
      const track = document.createElement('span');
      track.className = 'bar-track';
      const fill = document.createElement('span');
      fill.className = 'bar-fill ' + GCLASS[a];
      fill.style.width = pct + '%';
      track.appendChild(fill);
      const num = document.createElement('span');
      num.className = 'bar-num';
      num.textContent = total ? `${pct} % (${right}/${total})` : '—';
      row.append(label, track, num);
      return row;
    }));

    const debt = E.debtors(S, ITEMS).sort((x, y) => x.text.localeCompare(y.text, 'de'));
    $('#book-count').textContent = `(${debt.length})`;
    const list = $('#book-list');
    if (!debt.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Nikto ti nič nedlží. Zatiaľ.';
      list.replaceChildren(li);
    } else {
      list.replaceChildren(...debt.map((it) => {
        const li = document.createElement('li');
        const tag = document.createElement('span');
        tag.className = 'tag ' + GCLASS[it.a];
        tag.textContent = LABEL[it.a];
        const w = document.createElement('b');
        w.textContent = it.kind === 'phrase' ? filled(it) : it.text;
        const sk = document.createElement('small');
        sk.textContent = it.sk;
        li.append(tag, w, sk);
        return li;
      }));
    }
    $('#dlg-book').showModal();
  }

  function resetAll() {
    if (!confirm('Naozaj vymazať celý postup, bank aj štatistiky?')) return;
    S = E.newState();
    Store.save(S);
    phase = 'bet';
    bet = E.C.MIN_BET;
    pot = 0;
    rung = 0;
    hand = [];
    rows.forEach(resetRow);
    showPanel('reels');
    $('#dlg-book').close();
    setMsg('Nová hra. Vsaď a stlač SPIN.');
    render();
  }

  // ---- vstupy ------------------------------------------------------------

  function changeBet(dir) {
    if (phase !== 'bet' || E.isBroke(S)) return;
    bet = E.stepBet(S, bet, dir);
    Sfx.click();
    render();
  }

  // Úvodná obrazovka. Kliknutie zároveň odomkne zvuk v prehliadači.
  function enter() {
    const splash = $('#splash');
    if (!splash || splash.classList.contains('out')) return;
    splash.classList.add('out');
    Sfx.intro();
    later(650, () => splash.remove());
    if (S.stats.hands === 0) later(450, () => $('#dlg-help').showModal());
  }

  function setTestMode(on) {
    testMode = on;
    Store.setFlag('test', on);
    render();
  }

  function wire() {
    $('#btn-enter').addEventListener('click', enter);
    $('#t-off').addEventListener('click', () => setTestMode(false));
    $('#t-add').addEventListener('click', () => {
      S.bank += 1000;
      Store.save(S);
      render();
    });
    $('#t-broke').addEventListener('click', () => {
      if (phase !== 'bet') return;
      S.bank = 0;
      Store.save(S);
      setMsg('Test: bank vynulovaný — choď do Pfandhausu.');
      render();
    });
    $('#btn-spin').addEventListener('click', spin);
    $('#btn-cash').addEventListener('click', cash);
    $('#btn-risk').addEventListener('click', risk);
    $('#btn-joker').addEventListener('click', joker);
    $('#bet-minus').addEventListener('click', () => changeBet(-1));
    $('#bet-plus').addEventListener('click', () => changeBet(1));
    $('#answers').addEventListener('click', (e) => {
      const b = e.target.closest('.ans');
      if (b && !b.disabled) answer(b.dataset.a);
    });
    $('#pawn-answers').addEventListener('click', (e) => {
      const b = e.target.closest('.ans');
      if (b && !b.disabled) pawnAnswer(b.dataset.a);
    });
    $('#pawn-next').addEventListener('click', pawnNext);
    $('#dlg-pawn').addEventListener('close', () => {
      pawn = null;
      render();
    });
    $('#btn-book').addEventListener('click', openBook);
    $('#btn-reset').addEventListener('click', resetAll);
    $('#btn-help').addEventListener('click', () => $('#dlg-help').showModal());
    $('#btn-sound').addEventListener('click', () => {
      Sfx.toggle();
      setSoundIcon();
    });
    // Po kliknutí pustiť fokus, aby medzerník nespúšťal naposledy stlačené tlačidlo.
    cabinet.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) b.blur();
    });

    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      const splash = $('#splash');
      if (splash && !splash.classList.contains('out')) {
        if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          enter();
        }
        return;
      }
      const digit = k.length === 1 && k >= '1' && k <= '4' ? E.ARTICLES[Number(k) - 1] : null;
      if (k === 't' || k === 'T') return setTestMode(!testMode);
      if ($('#dlg-pawn').open) {
        if (digit) pawnAnswer(digit);
        return;
      }
      if (document.querySelector('dialog[open]')) return;
      if (digit) answer(digit);
      else if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        spin();
      } else if (k === 'k' || k === 'K') cash();
      else if (k === 'r' || k === 'R') risk();
      else if (k === 'j' || k === 'J') joker();
      else if (k === 'ArrowLeft') changeBet(-1);
      else if (k === 'ArrowRight') changeBet(1);
    });
  }

  build();
  wire();
  setMsg(E.isBroke(S) ? 'Si na mizine — choď do Pfandhausu.' : 'Vsaď a stlač SPIN.');
  render();

  // PWA: offline režim. Service worker funguje len cez http(s), nie cez file://.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hra beží aj bez neho */ });
  }

  // Pre ladenie a automatické testy.
  window.__game = {
    get state() { return S; },
    get phase() { return phase; },
    get pot() { return pot; },
    get current() { return phase === 'answer' ? hand[idx].it : phase === 'lanswer' ? card.it : null; },
    get pawnItem() { return pawn && !pawn.answered ? pawn.list[pawn.i] : null; },
  };
})();
