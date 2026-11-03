export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const SOLFEGE = ['도', '레', '미', '파', '솔', '라', '시'];

// degree 0 = 도, 7 = 한 옥타브 위 도, -3 = 아래 솔
export const degSemi = (d) => MAJOR[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
export const degName = (d) => SOLFEGE[((d % 7) + 7) % 7];

export const LEVELS = [
  { name: '도·미·솔', lo: 0, hi: 4, pool: [0, 2, 4], maxLeap: 4, bars: 1, half: false },
  { name: '도·레·미 (계단)', lo: 0, hi: 2, pool: [0, 1, 2], maxLeap: 1, bars: 1, half: false },
  { name: '도~솔 (계단과 도약)', lo: 0, hi: 4, pool: [0, 1, 2, 3, 4], maxLeap: 2, bars: 2, half: false },
  { name: '도~높은 도 (온음계)', lo: 0, hi: 7, pool: [0, 1, 2, 3, 4, 5, 6, 7], maxLeap: 2, bars: 2, half: false },
  { name: '아래 솔~높은 도, 2분음표', lo: -3, hi: 7, pool: [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7], maxLeap: 4, bars: 2, half: true },
  { name: '넓은 음역, 큰 도약', lo: -4, hi: 8, pool: [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8], maxLeap: 5, bars: 2, half: true },
];

// 한 마디(4박)를 채우는 박 패턴
const BAR_PATTERNS_Q = [[1, 1, 1, 1]];
const BAR_PATTERNS_H = [[1, 1, 1, 1], [2, 1, 1], [1, 1, 2], [2, 2]];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Returns { notes: [{ deg, beats }], bars }
export function generate(lv) {
  const patterns = lv.half ? BAR_PATTERNS_H : BAR_PATTERNS_Q;
  const rhythm = [];
  for (let b = 0; b < lv.bars; b++) rhythm.push(...pick(patterns));
  const starts = lv.pool.filter((d) => [0, 2, 4].includes(d));

  for (let attempt = 0; attempt < 200; attempt++) {
    const degs = [pick(starts)];
    for (let i = 1; i < rhythm.length; i++) {
      const prev = degs[i - 1];
      const same = i >= 2 && degs[i - 2] === prev;
      // 같은 음 반복은 가끔만 (2번 연속까지)
      const opts = lv.pool.filter(
        (d) => Math.abs(d - prev) <= lv.maxLeap && (d !== prev || (!same && Math.random() < 0.3)),
      );
      if (!opts.length) break;
      degs.push(pick(opts));
    }
    if (degs.length !== rhythm.length) continue;
    // 끝은 으뜸음(도)으로 마무리
    const last = degs.length - 1;
    if (degs[last] !== 0) {
      if (Math.abs(degs[last - 1] - 0) > lv.maxLeap || degs[last - 1] === 0) continue;
      degs[last] = 0;
    }
    return { notes: degs.map((deg, i) => ({ deg, beats: rhythm[i] })), bars: lv.bars };
  }
  throw new Error('melody generation failed');
}

// 자주 쓰는 장조 9개 (조표 4개 이하)
const KEYS = [
  { name: 'C', pc: 0 }, { name: 'G', pc: 7 }, { name: 'D', pc: 2 }, { name: 'A', pc: 9 },
  { name: 'E', pc: 4 }, { name: 'F', pc: 5 }, { name: 'Bb', pc: 10 }, { name: 'Eb', pc: 3 }, { name: 'Ab', pc: 8 },
];

// Picks a key and tonic octave so the whole melody sits inside the singer's range.
export function chooseKey(range, mel) {
  const degs = mel.notes.map((n) => n.deg);
  const lo = degSemi(Math.min(...degs));
  const hi = degSemi(Math.max(...degs));
  const fits = [];
  let closest = null;
  for (const k of KEYS) {
    for (let tonic = k.pc + 36; tonic <= 72; tonic += 12) {
      const over = Math.max(0, range.low - (tonic + lo), tonic + hi - range.high);
      if (over === 0) fits.push({ ...k, tonic });
      if (!closest || over < closest.over) closest = { ...k, tonic, over };
    }
  }
  return fits.length ? pick(fits) : closest;
}

export const midiOf = (key, deg) => key.tonic + degSemi(deg);
