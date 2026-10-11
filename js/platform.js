/* Платформенные мелочи: звук окончания отдыха и постоянное хранилище. */
(function (GN) {
  'use strict';

  // iOS разрешает звук только после касания — «разблокируем» AudioContext на первом тапе.
  // В фоне и при заблокированном экране звук не проиграется: это ограничение iOS.
  let audio = null;
  function getAudio() {
    if (audio) return audio;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audio = new Ctor();
    return audio;
  }

  function installAudioUnlock() {
    const unlock = () => {
      const c = getAudio();
      if (c && c.state === 'suspended') c.resume();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
  }

  function playChime() {
    try {
      const c = getAudio();
      if (c && c.state === 'running') {
        const t = c.currentTime;
        [880, 1320].forEach((freq, i) => {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const start = t + i * 0.18;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
          osc.connect(gain).connect(c.destination);
          osc.start(start);
          osc.stop(start + 0.4);
        });
      }
    } catch (e) {
      /* звук не критичен */
    }
    if (navigator.vibrate) navigator.vibrate(200);
  }

  /** Просим браузер не удалять данные при нехватке места. */
  async function requestPersistentStorage() {
    try {
      if (!navigator.storage || !navigator.storage.persist) return false;
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    } catch (e) {
      return false;
    }
  }

  async function isStoragePersisted() {
    try {
      return navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null;
    } catch (e) {
      return null;
    }
  }

  Object.assign(GN, { installAudioUnlock, playChime, requestPersistentStorage, isStoragePersisted });
})((globalThis.GN = globalThis.GN || {}));
