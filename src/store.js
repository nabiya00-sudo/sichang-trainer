const KEY = 'sichang.v1';

const DEFAULTS = {
  range: { low: 45, high: 64 }, // comfortable singing range (MIDI), replaced by the range test
  rangeMeasured: false,
  level: 1,
  streak: 0,
  tempo: 60,
  octaveStrict: true, // 시창은 내 음역의 옥타브에서 불러야 정답
  latency: 0.15, // seconds between a sung sound and the mic frame that reports it
  degree: {}, // { '도': { n, h } } hit statistics per solfege syllable
  history: [], // { t, level, rate }
  seenLevels: [1],
  // v0.2: 기술별 레벨(시창은 level/streak 를 그대로 사용)
  match: { level: 1, streak: 0 },
  interval: { level: 1, streak: 0 },
  placed: false, // 레벨 진단을 마쳤는지
  lastCheck: 0,
  sinceCheck: 0, // 마지막 점검 이후 연습 횟수
  checks: [], // 점검 기록
  intro: 'scale', // 시창 도입: 'scale'(음계) | 'cadence'(화음 진행)
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
