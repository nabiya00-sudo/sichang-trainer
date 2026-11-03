const KEY = 'sichang.v1';

const DEFAULTS = {
  range: { low: 45, high: 64 }, // comfortable singing range (MIDI), replaced by the range test
  rangeMeasured: false,
  level: 1,
  streak: 0,
  tempo: 60,
  latency: 0.15, // seconds between a sung sound and the mic frame that reports it
  degree: {}, // { '도': { n, h } } hit statistics per solfege syllable
  history: [], // { t, level, rate }
  seenLevels: [1],
};

export function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: the app still works for this visit */
  }
}

export function exportJson(state) {
  return JSON.stringify(state, null, 2);
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (typeof data !== 'object' || data === null || typeof data.level !== 'number') {
    throw new Error('형식이 올바르지 않은 백업 파일입니다.');
  }
  return { ...DEFAULTS, ...data };
}
