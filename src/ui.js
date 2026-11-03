import { ensureCtx, playNote } from './audio.js';
import { midiOf } from './melody.js';

// 화면 모듈들이 함께 쓰는 상태. main.js 가 채워 넣는다.
export const env = { app: null, S: null, stop: null, show: null, home: null, rangeTest: null, session: null };

export const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const footer = '<footer>Piano: Salamander Grand Piano (Alexander Holm, CC BY 3.0)</footer>';

const WHITE_SOLFEGE = { 0: '도', 2: '레', 4: '미', 5: '파', 7: '솔', 9: '라', 11: '시' };
const NOTE_LETTER = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };

// 음계(도→높은 도)와 마지막에 으뜸음 한 번. 조성을 귀에 새기는 기본 도입.
export function playScale(key, step = 0.42) {
  const ctx = ensureCtx();
  const t0 = ctx.currentTime + 0.15;
  for (let d = 0; d <= 7; d++) playNote(midiOf(key, d), t0 + d * step, d === 7 ? 1.0 : step * 0.95, 1);
  playNote(key.tonic, t0 + 8 * step + 0.5, 1.4, 1);
  return { end: t0 + 8 * step + 0.5 + 1.4 };
}

// 화면 건반. lo..hi (MIDI) 범위, C장조 계이름을 표시한다.
export function keyboard(el, lo, hi, showBlack, onPick) {
  el.className = 'kb';
  el.innerHTML = '';
  const isBlack = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
  const whites = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const w = 100 / whites.length;
  const btns = new Map();
  const make = (m, cls, left, width, html) => {
    const b = document.createElement('button');
    b.className = cls;
    b.style.left = `${left}%`;
    b.style.width = `${width}%`;
    b.innerHTML = html;
    b.onclick = () => onPick(m);
    el.appendChild(b);
    btns.set(m, b);
  };
  whites.forEach((m, i) => {
    const pc = ((m % 12) + 12) % 12;
    make(m, 'wk', i * w, w, `<span>${WHITE_SOLFEGE[pc]}</span><small>${NOTE_LETTER[pc]}</small>`);
  });
  if (showBlack) {
    for (let m = lo; m <= hi; m++) {
      if (!isBlack(m)) continue;
      const idx = whites.indexOf(m - 1);
      if (idx < 0) continue;
      make(m, 'bk', (idx + 1) * w - w * 0.3, w * 0.6, '');
    }
  }
  return {
    mark(m, cls) { const b = btns.get(m); if (b) b.classList.add(cls); },
    reset() { btns.forEach((b) => { b.classList.remove('sel', 'ok', 'no'); b.disabled = false; }); },
    lock() { btns.forEach((b) => { b.disabled = true; }); },
  };
}
