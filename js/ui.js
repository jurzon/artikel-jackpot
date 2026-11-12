// Obrazovka a stavový automat hry: bet → spinning → answer → offer → flip → lanswer → bet
(function () {
  'use strict';
  const E = window.Engine;
  const ITEMS = window.ITEMS;
  const Store = window.Store;
  const Sfx = window.Sfx;
  const Voice = window.Voice;

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
  let ladderWords = [];   // správne zodpovedané karty rebríka (pre Top 10)
  let introPlayed = false;
  let pawn = null;
  let dockGroup = 'ctl-bet';
  let dockLockUntil = 0;
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

  // Slovo po odhalení: člen vo farbe rodu a zvýraznená koncovka/predpona, ak platí pravidlo.
  function richWord(it) {
    const frag = document.createDocumentFragment();
    const art = (txt) => {
      const b = document.createElement('b');
      b.className = 'art ' + CCLASS[it.a];
      b.textContent = txt;
      return b;
    };
    if (it.kind === 'phrase') {
      if (it.a === '-') { frag.append(it.text.replace('___ ', '')); return frag; }
      const [pre, post] = it.text.split('___');
      frag.append(pre, art(pre === '' ? cap(it.a) : it.a), post);
      return frag;
    }
    if (it.a !== '-') frag.append(art(it.a), ' ');
    const m = E.ruleMatch(it);
    if (m && m.part) {
      const mark = document.createElement('mark');
      mark.className = 'ending ' + CCLASS[it.a];
      mark.textContent = m.part;
      if (m.at === 'end') frag.append(it.text.slice(0, -m.part.length), mark);
      else frag.append(mark, it.text.slice(m.part.length));
    } else {
      frag.append(it.text);
    }
    return frag;
  }

  function setRichWord(el, it) {
    el.replaceChildren(richWord(it));
    el.classList.toggle('long', filled(it).length > 16);
  }

  // Preklad a krupiérov tip (pravidlo alebo poznámka) ako dva oddelené kusy.
  function setInfo(el, it) {
    el.replaceChildren();
    if (it.sk) el.append(it.sk);
    const tip = E.ruleFor(it) || it.note;
    if (tip) {
      const i = document.createElement('i');
      i.className = 'tip';
      i.textContent = tip;
      el.append(it.sk ? ' ' : '', i);
    }
  }

  // Štítok úrovne slova podľa osobnej histórie (to isté, čo určuje kurz).
  function tierLabel(id) {
    const rec = S.words[id];
    if (!rec) return 'nové';
    if (rec.debt || rec.box === 0) return 'dlžník';
    if (rec.box <= 2) return 'neisté';
    return 'istota';
  }

  // ---- krupiér -----------------------------------------------------------
  // Krátke hlášky s charakterom; nikdy dvakrát tá istá za sebou.
  const VOICE = {
    spin: ['Faites vos jeux… valce sa točia.', 'Krupiér točí.', 'Valce sa točia…', 'Les jeux sont faits.'],
    ask: ['Aký člen patrí k označenému slovu?', 'Krupiér čaká. Der, die, das, alebo nič?', 'Tvoj ťah. Ktorý člen?', 'Slovo je na stole. Člen?'],
    right: ['Sauber.', 'Krupiér kývne.', 'Pokračuj.', 'Presne tak.', 'Bez zaváhania.'],
    line: ['Línia!', 'Tri z troch!', 'Čistá línia!', 'Krupiér tlieska.'],
    wrong: ['Dom ďakuje.', 'Au weia.', 'Krupiér zhrabne žetóny.', 'Dnes nie.', 'Tak to v kasíne chodí.'],
    cash: ['Rozumné.', 'Žetóny sú tvoje.', 'Krupiér vypláca.', 'Odchádzaš bohatší.'],
    risk: ['Odvaha sa cení.', 'Karta je na stole.', 'Krupiér zdvihne obočie.', 'Všetko, alebo nič.'],
    ladderRight: ['Vyššie.', 'Ešte raz?', 'Rebrík drží.', 'Nervy zo železa.'],
    ladderWrong: ['Tak blízko.', 'Rebrík sa zlomil.', 'Dom si to berie späť.', 'Risiko je Risiko.'],
  };
  const lastLine = {};
  const SPOKEN_AFTER_WORD = new Set(['right', 'line', 'wrong', 'ladderRight', 'ladderWrong']);
  function say(pool) {
    const arr = VOICE[pool];
    let i;
    do i = Math.floor(Math.random() * arr.length); while (arr.length > 1 && i === lastLine[pool]);
    lastLine[pool] = i;
    const line = arr[i];
    if (SPOKEN_AFTER_WORD.has(pool)) Voice.after(line); else Voice.croupier(line);
    return line;
  }

  // Po odhalení prečíta slovo s členom nemeckým hlasom (preruší predošlú reč).
  function pronounce(it) {
    Voice.stop();
    Voice.word(filled(it));
  }

  // Osobná pamäť: koľkokrát ťa slovo zhodilo, alebo že si splatil dlh.
  function memoryNote(it, res, wasDebt) {
    const rec = S.words[it.id];
    if (!rec) return '';
    let note = '';
    if (!res.correct && rec.wrong >= 2) note = `${it.text} ťa zhodil už ${rec.wrong}. raz.`;
    else if (res.correct && wasDebt) note = `${it.text} splatený, Kniha dlžníkov je ľahšia.`;
    if (note) Voice.after(note);
    return note ? ' ' + note : '';
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
    el.dataset.len = String(target).length;
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
    row.querySelector('.odds').removeAttribute('data-label');
  }

  function revealRow(i, mode) {
    const row = rows[i];
    const it = hand[i].it;
    row.classList.add(...mode.split(' '));
    const slot = row.querySelector('.slot');
    slot.textContent = LABEL[it.a];
    slot.classList.add(GCLASS[it.a]);
    setRichWord(row.querySelector('.word'), it);
    setInfo(row.querySelector('.info'), it);
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
      b.classList.toggle('tip', testMode && !!current && b.dataset.a === current.a);
    });
    const pawnItem = pawn && !pawn.answered ? pawn.list[pawn.i] : null;
    document.querySelectorAll('#pawn-answers .ans').forEach((b) => {
      b.classList.toggle('tip', testMode && !!pawnItem && b.dataset.a === pawnItem.a);
    });
    $('#testbar').hidden = !testMode;
    $('#t-broke').disabled = !idle;
    $('#btn-menu').disabled = !idle;
    $('#btn-joker').disabled = !answering || jokerUsed || S.jokers < 1;

    // Akčný panel ukazuje jedinú skupinu: vklad+SPIN, členy, alebo Kassieren/Risiko.
    const group = answering ? 'answers' : inLadder ? 'ctl-offer' : 'ctl-bet';
    dockGroup = group;
    for (const id of ['ctl-bet', 'answers', 'ctl-offer']) $('#' + id).hidden = id !== group;
    $('#btn-spin').disabled = !idle;
    const face = idle && broke ? 'pawn' : 'spin';
    if ($('#btn-spin').dataset.face !== face) {
      $('#btn-spin').dataset.face = face;
      if (face === 'pawn') $('#btn-spin').innerHTML = '<svg class="btn-ico"><use href="#i-pawn"/></svg>PFANDHAUS';
      else $('#btn-spin').textContent = 'SPIN';
    }
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
    ladderWords = [];
    Store.save(S);

    phase = 'spinning';
    showPanel('reels');
    Voice.stop();
    setMsg(say('spin'));
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
        row.querySelector('.odds').dataset.label = tierLabel(hand[i].it.id);
        row.dataset.stars = E.stars(hand[i].odds);
        Sfx.stop();
        if (i === 2) {
          phase = 'answer';
          setMsg(say('ask'));
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
    const wasDebt = !!(S.words[it.id] && S.words[it.id].debt);
    const res = E.record(S, it, a);
    struck = new Set();
    jokerUsed = false;
    revealRow(idx, res.correct ? 'ok' : 'bad');
    pronounce(it);
    const memo = memoryNote(it, res, wasDebt);

    if (res.correct) {
      pot = E.mult(pot, odds);
      idx++;
      if (idx < hand.length) {
        Sfx.right();
        setMsg(`Richtig! ${fmtOdds(odds)} → ${fmt(pot)}.${memo || ' ' + say('right')}${jokerNote(res)}`, 'ok');
      } else {
        let text = `${say('line')} Výhra ${fmt(pot)}.`;
        if (E.isDrilling(hand.map((h) => h.it))) {
          pot *= E.C.DRILLING;
          text = `DRILLING! 3× ${LABEL[it.a]} → výhra ×2 = ${fmt(pot)}.`;
        }
        Sfx.win();
        flash('win');
        offer(text + memo + jokerNote(res) + ' Kassieren alebo Risiko?');
      }
    } else {
      Sfx.wrong();
      flash('lose', 500);
      // Lekcia zadarmo: zvyšné slová sa otočia po jednom, aby si ich hráč všimol.
      const rest = [];
      for (let i = idx + 1; i < hand.length; i++) rest.push(i);
      rest.forEach((i, k) => later(calm ? 0 : 420 + k * 380, () => {
        if (hand[i] && rows[i].classList.contains('spinning') === false) revealRow(i, 'dim lesson');
      }));
      pot = 0;
      endHand(`Falsch! Správne: ${filled(it)}. Vklad ${fmt(bet)} je preč.${memo || ' ' + say('wrong')}`, 'bad');
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

  // Zapíše výhru do Top 10 a vráti dovetok do tickera.
  function recordWin(amount, jackpot) {
    const words = hand.map((h) => filled(h.it)).concat(ladderWords);
    const rank = E.recordTop(S, { amount, bet, words, rungs: rung, jackpot, t: Date.now() });
    return rank ? ` Top 10: #${rank}!` : '';
  }

  function cash() {
    if (phase !== 'offer') return;
    E.collect(S, pot);
    const note = recordWin(pot, false);
    Sfx.cash();
    flash('win');
    const won = pot;
    pot = 0;
    endHand(`Kassiert! +${fmt(won)} žetónov. ${say('cash')}${note}`, 'ok');
    if (note) Voice.after(`Top 10, miesto ${note.match(/#(\d+)/)[1]}.`);
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
    $('#card-odds').dataset.label = tierLabel(card.it.id);
    $('#card-back-odds').replaceChildren(pips(card.odds), fmtOdds(card.odds));
    $('#card-back-odds').dataset.label = tierLabel(card.it.id);
    showPanel('ladder');
    setMsg(`Risiko! V hre je ${fmt(pot)}. ${say('risk')}`);
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
    const wasDebt = !!(S.words[it.id] && S.words[it.id].debt);
    const res = E.record(S, it, a);
    pronounce(it);
    const memo = memoryNote(it, res, wasDebt);
    struck = new Set();
    jokerUsed = false;
    $('#card-front').classList.add(res.correct ? 'ok' : 'bad', CCLASS[it.a]);
    setRichWord($('#card-word'), it);
    setInfo($('#card-info'), it);

    if (res.correct) {
      pot = E.mult(pot, odds);
      rung++;
      ladderWords.push(filled(it));
      if (rung >= E.C.MAX_RUNG) {
        const jp = E.winJackpot(S);
        pot += jp;
        E.collect(S, pot);
        const note = recordWin(pot, true);
        Sfx.jackpot();
        flash('jackpot', 4000);
        const won = pot;
        pot = 0;
        endHand(`JACKPOT! +${fmt(jp)} navyše, spolu +${fmt(won)} žetónov!${note}`, 'jackpot');
      } else {
        Sfx.right();
        offer(`Richtig! ${fmtOdds(odds)} → ${fmt(pot)}. Priečka ${rung}/${E.C.MAX_RUNG}.${memo || ' ' + say('ladderRight')}${jokerNote(res)}`);
      }
    } else {
      Sfx.wrong();
      flash('lose', 500);
      const lost = pot;
      pot = 0;
      endHand(`Falsch! Správne: ${filled(it)}. Prehral si ${fmt(lost)}.${memo || ' ' + say('ladderWrong')}`, 'bad');
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
    pronounce(it);
    setRichWord($('#pawn-word'), it);
    setInfo($('#pawn-info'), it);
    $('#pawn-info').prepend(res.correct ? `Richtig! +${E.C.PAWN_REWARD} · ` : 'Falsch · ');
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

  // Čistý stav hry; Top 10 sa zachová, ak ho volajúci podá.
  function applyReset(keepTop) {
    S = E.newState();
    if (keepTop) S.stats.top = keepTop;
    Store.save(S);
    phase = 'bet';
    bet = E.C.MIN_BET;
    pot = 0;
    rung = 0;
    hand = [];
    card = next = null;
    used = new Set();
    struck = new Set();
    jokerUsed = false;
    ladderWords = [];
    rows.forEach(resetRow);
    showPanel('reels');
    setMsg('Nová hra. Vsaď a stlač SPIN.');
    renderLobby();
    render();
  }

  // Kniha dlžníkov: vymaže naozaj všetko, aj Top 10.
  function resetAll() {
    if (!confirm('Naozaj vymazať celý postup, bank, štatistiky aj Top 10?')) return;
    applyReset(null);
    $('#dlg-book').close();
  }

  // Lobby: nová hra zachová Top 10 (ako na automate).
  function newGame() {
    if (!confirm('Začať odznova? Bank, jackpot aj pamäť slov sa vynulujú. Top 10 ostane.')) return;
    applyReset(S.stats.top || []);
    Sfx.click();
    enter();
  }

  // ---- lobby -------------------------------------------------------------

  function hasProgress() {
    return S.stats.hands > 0 || S.bank !== E.C.START_BANK;
  }

  function renderLobby() {
    const progress = hasProgress();
    $('#btn-enter').textContent = progress ? 'Pokračovať' : 'Hrať';
    $('#btn-new').hidden = !progress;
    const sub = $('#lobby-sub');
    sub.hidden = !progress;
    if (progress) sub.textContent = `Bank ${fmt(S.bank)} · Jackpot ${fmt(S.jackpot)}`;
  }

  function toMenu() {
    if (phase !== 'bet' || document.querySelector('dialog[open]')) return;
    const splash = $('#splash');
    if (!splash.classList.contains('out')) return;
    Store.save(S);
    renderLobby();
    Sfx.click();
    // Úvodná kaskáda nech sa prehrá znova.
    if (!calm) {
      const parts = splash.querySelectorAll('.splash-in > *, .mark i');
      parts.forEach((el) => { el.style.animation = 'none'; });
      void splash.offsetWidth;
      parts.forEach((el) => { el.style.animation = ''; });
    }
    splash.classList.remove('out');
    later(50, () => $('#btn-enter').focus({ preventScroll: true }));
  }

  function openTop() {
    const list = $('#top-list');
    list.replaceChildren();
    const top = S.stats.top || [];
    if (!top.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Zatiaľ prázdne. Prvá vyplatená výhra sa sem zapíše.';
      list.appendChild(li);
    }
    top.forEach((e, i) => {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = i + 1;
      const body = document.createElement('div');
      const amount = document.createElement('b');
      amount.className = 'amount';
      amount.textContent = fmt(e.amount);
      if (e.jackpot) amount.insertAdjacentHTML('beforeend', '<svg><use href="#i-crown"/></svg>');
      const words = document.createElement('span');
      words.className = 'words';
      words.textContent = (e.words || []).join(' · ');
      body.append(amount, words);
      const when = document.createElement('small');
      when.className = 'when';
      when.append(new Date(e.t).toLocaleDateString('sk-SK'), document.createElement('br'), `vklad ${fmt(e.bet || 0)}`);
      li.append(rank, body, when);
      list.appendChild(li);
    });
    Sfx.click();
    $('#dlg-top').showModal();
  }

  function openAbout() {
    Sfx.click();
    const d = $('#dlg-about');
    d.showModal();
    d.focus();   // fokus na dialóg, nie na prvý odkaz v texte
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
    if (splash.classList.contains('out')) return;
    splash.classList.add('out');
    if (introPlayed) Sfx.click(); else Sfx.intro();
    introPlayed = true;
    $('#btn-enter').blur();
    if (S.stats.hands === 0) later(450, () => $('#dlg-help').showModal());
  }

  // Ktoré hlasy systém ponúka (krupiér: sk/cs, slová: de).
  function showVoiceStatus() {
    const el = $('#voice-status');
    const de = Voice.voiceName(['de']);
    el.replaceChildren('Výslovnosť slov: ', de ? `${de} (po odhalení sa slovo prečíta s členom).` : 'žiadny nemecký hlas. V Chrome a Edge býva online, inak ho doinštaluj v systéme (Windows → Jazyk → Nemčina → Reč).');
    if (Voice.croupierSpeaks()) el.append(' Hlas krupiéra: ', Voice.voiceName(['sk', 'cs']) || 'žiadny slovenský hlas.');
  }

  function setTestMode(on) {
    testMode = on;
    Store.setFlag('test', on);
    render();
  }

  function wire() {
    $('#btn-enter').addEventListener('click', enter);
    $('#btn-new').addEventListener('click', newGame);
    $('#btn-top').addEventListener('click', openTop);
    $('#btn-about').addEventListener('click', openAbout);
    $('#btn-menu').addEventListener('click', toMenu);
    $('#splash').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) b.blur();
    });
    // Ak ťuknutie vymenilo obsah panela, panel chvíľu ignoruje ďalšie ťuknutia,
    // aby dvojité ťuknutie nespustilo tlačidlo, ktoré sa práve objavilo pod prstom.
    $('#dock').addEventListener('click', (e) => {
      if (performance.now() < dockLockUntil) return e.stopPropagation();
      const before = dockGroup;
      setTimeout(() => {
        if (dockGroup !== before) dockLockUntil = performance.now() + 400;
      }, 0);
    }, true);
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
    $('#btn-help').addEventListener('click', () => {
      showVoiceStatus();
      $('#dlg-help').showModal();
    });
    $('#btn-sound').addEventListener('click', () => {
      Sfx.toggle();
      Voice.stop();
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
      dockLockUntil = 0;   // klávesnica je vždy úmyselná
      const splash = $('#splash');
      if (!splash.classList.contains('out')) {
        // Dialóg nad lobby a tlačidlá menu si Enter/medzerník obslúžia samy.
        if (document.querySelector('dialog[open]') || e.target.closest('.lobby')) return;
        if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          enter();
        }
        return;
      }
      if (k === 'Escape' && !document.querySelector('dialog[open]')) return toMenu();
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
  renderLobby();
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
