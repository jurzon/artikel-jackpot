// Zvuky syntetizované cez WebAudio, žiadne súbory.
// Farba zvuku ladí so „Spielbank 1926“: vibrafón, cinkot žetónov, šuchot kariet.
(function (root) {
  'use strict';
  let ctx = null;
  let out = null;
  let noiseBuf = null;
  let offline = false;
  let enabled = root.Store.getFlag('sound', true);

  function ac() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      use(new AC());
    }
    if (ctx.state === 'suspended' && !offline) ctx.resume();
    return ctx;
  }

  // Výstup ide cez kompresor, aby sa súzvuky neorezávali.
  function use(context) {
    ctx = context;
    offline = typeof OfflineAudioContext !== 'undefined' && context instanceof OfflineAudioContext;
    noiseBuf = null;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    const master = ctx.createGain();
    master.gain.value = 0.8;
    comp.connect(master).connect(ctx.destination);
    out = comp;
  }

  function envelope(gain, t, peak, attack, decay) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function partial(freq, start, decay, vol, type, glideTo) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + decay);
    envelope(g, t, vol, 0.004, decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  // Tón vibrafónu: základ + ladené alikvóty (4× a 10×), vyššie doznievajú rýchlejšie.
  function bell(freq, start, decay, vol) {
    partial(freq, start, decay, vol);
    partial(freq * 4, start, decay * 0.35, vol * 0.22);
    partial(freq * 10, start, decay * 0.12, vol * 0.06);
  }

  function noise(start, decay, vol, type, freq, q, sweepTo) {
    const c = ac();
    if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + start;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + decay);
    f.Q.value = q || 1;
    const g = c.createGain();
    envelope(g, t, vol, 0.006, decay);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }

  // Cinknutie žetónu: krátky jasný kovový tón.
  function clink(start, vol) {
    const f = 2600 + Math.random() * 1800;
    partial(f, start, 0.09, vol);
    partial(f * 1.48, start, 0.06, vol * 0.5);
    noise(start, 0.02, vol * 0.6, 'highpass', 5000);
  }

  function arpeggio(notes, step, decay, vol, start) {
    notes.forEach((f, i) => bell(f, (start || 0) + i * step, decay, vol));
  }

  const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, D6 = 1174.7, E6 = 1318.5, G6 = 1568, C7 = 2093;

  const sounds = {
    // valec preskočí o políčko
    tick: () => partial(1500 + Math.random() * 300, 0, 0.03, 0.16, 'triangle'),
    // karta dopadne na plsť
    stop: () => {
      noise(0, 0.08, 0.9, 'lowpass', 700);
      partial(140, 0, 0.14, 0.5, 'sine', 70);
    },
    click: () => partial(900, 0, 0.04, 0.22, 'triangle'),
    // otočenie karty
    flip: () => {
      noise(0, 0.18, 0.7, 'bandpass', 1200, 1.2, 4200);
      noise(0.16, 0.06, 0.7, 'lowpass', 600);
    },
    right: () => {
      bell(G5, 0, 0.5, 0.16);
      bell(D6, 0.09, 0.7, 0.14);
    },
    // tlmený pád o malú sekundu
    wrong: () => {
      partial(207.7, 0, 0.3, 0.2, 'triangle');
      partial(196, 0, 0.3, 0.2, 'triangle');
      partial(155.6, 0.17, 0.5, 0.22, 'triangle', 120);
      noise(0, 0.09, 0.2, 'lowpass', 300);
    },
    win: () => {
      arpeggio([C5, E5, G5, C6], 0.09, 0.9, 0.14);
      bell(E6, 0.36, 1.2, 0.1);
    },
    // žetóny sa sypú na kôpku
    cash: () => {
      for (let i = 0; i < 9; i++) clink(i * 0.055 + Math.random() * 0.02, 0.1);
      bell(C6, 0.1, 0.9, 0.1);
      bell(G6, 0.22, 1.1, 0.08);
    },
    jackpot: () => {
      arpeggio([C5, E5, G5, A5, C6, E6, G6, A5 * 2, C7], 0.1, 1.1, 0.12);
      [C5, E5, G5, C6, E6].forEach((f) => bell(f, 1.0, 2.6, 0.1));
      arpeggio([C6, E6, G6, C7], 0.12, 1.4, 0.08, 1.6);
      for (let i = 0; i < 34; i++) clink(0.3 + Math.random() * 3, 0.07);
    },
    // vstup do kasína: rozložený akord ako na harfe
    intro: () => {
      arpeggio([G5 / 2, 493.88, 587.33, G5, D6], 0.07, 1.8, 0.11);
      noise(0, 0.5, 0.05, 'bandpass', 3000, 0.8, 7000);
    },
  };

  const Sfx = {
    isOn: () => enabled,
    toggle() {
      enabled = !enabled;
      root.Store.setFlag('sound', enabled);
      return enabled;
    },
    _use: use,        // pre testy: prehranie do OfflineAudioContext
    _names: Object.keys(sounds),
  };
  for (const name of Object.keys(sounds)) {
    Sfx[name] = () => {
      if (enabled) sounds[name]();
    };
  }
  root.Sfx = Sfx;

  // ---- hlas krupiéra a výslovnosť slov (Web Speech API, hlasy systému) ----
  // Krupiér hovorí po slovensky (náhradne česky), slová číta nemecký hlas.
  // Bez vhodného hlasu sa daná veta ticho preskočí; hra beží ďalej.
  const synth = root.speechSynthesis;
  const voiceCache = {};
  function voiceFor(langs) {
    if (!synth) return null;
    const key = langs.join();
    if (voiceCache[key] && voiceCache[key].list === synth.getVoices().length) return voiceCache[key].voice;
    const all = synth.getVoices();
    let voice = null;
    for (const lang of langs) {
      const hits = all.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang));
      if (!hits.length) continue;
      // prednosť: lokálne a „natural/neural“ hlasy pred ostatnými
      voice = hits.find((v) => /natural|neural/i.test(v.name)) || hits.find((v) => v.localService) || hits[0];
      break;
    }
    voiceCache[key] = { list: all.length, voice };
    return voice;
  }
  function utter(text, langs, rate, pitch) {
    if (!enabled || !synth || !text) return;
    const voice = voiceFor(langs);
    if (!voice) return;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = 0.9;
    synth.speak(u);
  }
  if (synth && typeof synth.getVoices === 'function') synth.getVoices();   // naštartuje načítanie hlasov

  // Slovenský hlas krupiéra je vypnutý: systémové slovenské hlasy znejú mechanicky.
  // Zapnúť, keď budú k dispozícii lepšie (neurálne) hlasy.
  const CROUPIER_SPEAKS = false;

  root.Voice = {
    // nemecké slovo alebo veta, pokojne a zreteľne
    word: (text) => utter(text, ['de'], 0.9, 1),
    // krupiérova hláška; preruší, čo práve hovorí
    croupier: (text) => { if (!CROUPIER_SPEAKS) return; if (synth && enabled) synth.cancel(); utter(text, ['sk', 'cs'], 1.05, 0.9); },
    // krupiérova hláška po slove: nechá slovo dohovoriť
    after: (text) => { if (CROUPIER_SPEAKS) utter(text, ['sk', 'cs'], 1.05, 0.9); },
    croupierSpeaks: () => CROUPIER_SPEAKS,
    stop: () => { if (synth) synth.cancel(); },
    voiceName: (langs) => { const v = voiceFor(langs); return v ? v.name.replace(/Microsoft |Google /, '') : ''; },
  };
})(window);
