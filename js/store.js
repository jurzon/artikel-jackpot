// Uloženie postupu do localStorage.
(function (root) {
  'use strict';
  const KEY = 'artikel-jackpot-v1';

  function load() {
    const fresh = root.Engine.newState();
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw || raw.v !== fresh.v) return fresh;
      const state = Object.assign(fresh, raw);
      state.stats = Object.assign(root.Engine.newState().stats, raw.stats);
      return state;
    } catch (e) {
      return fresh;
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) { /* súkromné okno a pod. — hra beží ďalej bez ukladania */ }
  }

  function getFlag(name, fallback) {
    try {
      const v = localStorage.getItem(KEY + ':' + name);
      return v === null ? fallback : v === '1';
    } catch (e) {
      return fallback;
    }
  }

  function setFlag(name, value) {
    try {
      localStorage.setItem(KEY + ':' + name, value ? '1' : '0');
    } catch (e) { /* ignorované */ }
  }

  root.Store = { load, save, getFlag, setFlag };
})(window);
