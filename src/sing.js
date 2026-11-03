import { median } from './pitch.js';
import { SOLFEGE } from './melody.js';

// notes: [{ target(MIDI), start(박), beats }]
// frames: 마이크 프레임 [{ midi, t }]. 각 음 구간의 중앙값을 목표음과 비교한다.
export function scoreNotes(frames, notes, singStart, beat, latency, strict) {
  return notes.map((n) => {
    const from = singStart + (n.start + 0.3 * n.beats) * beat;
    const to = singStart + (n.start + n.beats * 0.95) * beat;
    const ds = frames
      .filter((f) => f.t - latency >= from && f.t - latency <= to)
      .map((f) => f.midi - n.target);
    if (ds.length < 3) return { cents: null, oct: 0, state: 'miss' };
    const raw = median(ds);
    const oct = Math.round(raw / 12); // 0 = 올바른 옥타브, +1 = 한 옥타브 높게
    const cents = Math.round((raw - 12 * oct) * 100);
    const a = Math.abs(cents);
    if (oct !== 0 && strict) return { cents, oct, state: 'miss' };
    return { cents, oct, state: a <= 25 ? 'good' : a <= 50 ? 'ok' : 'miss' };
  });
}

export const isHit = (r) => r.state !== 'miss';

// 소리가 잡힌 음들의 평균 음정 오차(센트, 절댓값). 하나도 없으면 null.
export function meanAbsCents(results) {
  const v = results.filter((r) => r.cents !== null).map((r) => Math.abs(r.cents));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// 결과 표 한 줄 문구
export function centsText(r) {
  if (r.cents === null) return '소리 없음';
  const oct = r.oct ? ` · 옥타브 ${r.oct > 0 ? '높음' : '낮음'}` : '';
  return `${r.cents > 0 ? '+' : ''}${r.cents}¢ ${r.cents > 0 ? '(높음)' : r.cents < 0 ? '(낮음)' : ''}${oct}`;
}

// 실시간 음높이 그래프. y축은 으뜸음 기준 반음 수(옥타브 접힘), 막대는 목표음.
export function makeTrace(canvas, tonic, notes, totalBeats) {
  const g2 = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const CW = canvas.clientWidth;
  const CH = 150;
  canvas.width = CW * dpr;
  canvas.height = CH * dpr;
  g2.scale(dpr, dpr);
  const yOf = (semi) => CH - 14 - ((semi + 1) / 13) * (CH - 28);
  const px = (beats) => 30 + (beats / totalBeats) * (CW - 40);
  return {
    draw(frames, singStart, beat, latency, showTargets = true) {
      g2.clearRect(0, 0, CW, CH);
      g2.font = '11px system-ui';
      [0, 2, 4, 5, 7, 9, 11].forEach((s, i) => {
        g2.strokeStyle = '#242a36';
        g2.beginPath(); g2.moveTo(26, yOf(s)); g2.lineTo(CW, yOf(s)); g2.stroke();
        g2.fillStyle = '#6f7a8c';
        g2.fillText(SOLFEGE[i], 4, yOf(s) + 4);
      });
      if (showTargets) {
        notes.forEach((n) => {
          const semi = (((n.target - tonic) % 12) + 12) % 12;
          g2.fillStyle = 'rgba(255,176,32,0.35)';
          g2.fillRect(px(n.start) + 2, yOf(semi + 0.5), px(n.start + n.beats) - px(n.start) - 4, yOf(semi - 0.5) - yOf(semi + 0.5));
        });
      }
      if (!frames) return;
      g2.fillStyle = '#3ecf7a';
      frames.forEach((f) => {
        const beats = (f.t - latency - singStart) / beat;
        if (beats < 0 || beats > totalBeats) return;
        let semi = (((f.midi - tonic) % 12) + 12) % 12;
        if (semi > 11) semi -= 12;
        g2.beginPath(); g2.arc(px(beats), yOf(semi), 3, 0, 7); g2.fill();
      });
    },
  };
}
