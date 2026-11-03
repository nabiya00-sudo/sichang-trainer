import { env, esc, sleep, footer, playScale } from './ui.js';
import { ensureCtx, loadPiano, playNote, click } from './audio.js';
import { startMic, midiName } from './pitch.js';
import { chooseKey, midiOf, degName } from './melody.js';
import { scoreNotes, isHit, centsText, makeTrace } from './sing.js';
import { advance } from './progress.js';
import { save } from './store.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// n = 음 개수, leap = 이웃 음과의 최대 도수 차(스케일 단계), pool = 사용 계이름(도=0)
export const MATCH_LEVELS = [
  { name: '한 음 (도·미·솔)', n: 1, pool: [0, 2, 4], leap: 99 },
  { name: '한 음 (온음계)', n: 1, pool: range(0, 7), leap: 99 },
  { name: '두 음', n: 2, pool: range(0, 7), leap: 4 },
  { name: '세 음', n: 3, pool: range(0, 7), leap: 3 },
  { name: '네 음 선율', n: 4, pool: range(-3, 7), leap: 4 },
  { name: '네 음 · 넓은 음역', n: 4, pool: range(-4, 8), leap: 5 },
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function makeTrial(lvIdx, lastFirst) {
  const lv = MATCH_LEVELS[lvIdx];
  for (let tries = 0; tries < 100; tries++) {
    const degs = [pick(lv.pool)];
    for (let i = 1; i < lv.n; i++) {
      const prev = degs[i - 1];
      const opts = lv.pool.filter((d) => d !== prev && Math.abs(d - prev) <= lv.leap);
      if (!opts.length) break;
      degs.push(pick(opts));
    }
    if (degs.length === lv.n && (lv.n > 1 || degs[0] !== lastFirst)) return { lvIdx, degs, beats: lv.n === 1 ? 2 : 1 };
  }
  return { lvIdx, degs: lv.pool.slice(0, lv.n), beats: lv.n === 1 ? 2 : 1 };
}

// 세션 동안 같은 조를 쓴다 (기준음이 바뀌면 초보에게 혼란스럽다). 내 음역 안에 들어오도록 선택.
function sessionKey(lvIdxs) {
  const degs = lvIdxs.flatMap((i) => MATCH_LEVELS[i].pool);
  const S = env.S;
  return chooseKey(
    { low: S.range.low + 1, high: S.range.high - 1 },
    { notes: [{ deg: Math.min(...degs) }, { deg: Math.max(...degs) }] },
  );
}

// opts: { lvIdx, keyLevels?, next?(i, trials) -> {lvIdx}|null, onFinish?(info), title? }
export function runMatch(opts) {
  const app = env.app;
  const S = env.S;
  const key = sessionKey(opts.keyLevels || [opts.lvIdx]);
  const beat = 60 / S.tempo;
  const lvDef = MATCH_LEVELS[opts.lvIdx ?? 0];
  const count = lvDef.n === 1 ? 8 : 5;
  const next = opts.next || ((i) => (i < count ? { lvIdx: opts.lvIdx } : null));
  const title = opts.title || `따라 부르기 · ${lvDef.name}`;
  let mic = null;
  let raf = 0;
  let dead = false;
  env.stop = () => { dead = true; cancelAnimationFrame(raf); mic && mic.stop(); mic = null; };

  app.innerHTML = `
    <p><span class="pill">${esc(title)}</span> <span class="pill">${key.name}장조 · ${S.tempo}BPM</span> <span class="pill" id="cnt"></span></p>
    <div class="card"><p>① 피아노가 들려주는 음을 <b>잘 듣고</b> ② 카운트가 끝나면 <b>같은 음을 노래</b>하세요. 이어폰을 끼면 더 정확합니다.</p>
      <p class="sub">내 음역에서 부르세요. 한 옥타브 위나 아래로 부르면 오답입니다.</p></div>
    <div class="big" id="big"></div>
    <div class="syl" id="syl"></div>
    <canvas id="trace"></canvas>
    <p class="sub" id="msg">"시작"을 누르면 먼저 음계를 들려줍니다. 도(으뜸음)를 기억하세요.</p>
    <div class="row" id="ctl"><button class="primary" id="go">시작</button></div>
    <div class="row" id="ctl2" hidden><button id="again">정답 듣기</button><button class="primary" id="next">다음</button></div>
    <div class="row" style="margin-top:10px"><button class="ghost" id="back">그만하기</button></div>
    ${footer}`;
  const q = (s) => app.querySelector(s);
  q('#back').onclick = () => env.show(env.home);
  const canvas = q('#trace');
  const wait = (id) => new Promise((res) => { q(id).onclick = res; });

  q('#go').onclick = async () => {
    q('#go').disabled = true;
    const ctx = ensureCtx();
    try {
      await loadPiano();
      mic = await startMic(ctx);
    } catch (e) {
      q('#msg').textContent = e && e.name === 'NotAllowedError'
        ? '마이크 권한이 필요합니다. 주소창의 자물쇠 → 권한에서 마이크를 허용해 주세요.'
        : '시작하지 못했습니다: ' + (e && e.message ? e.message : e);
      q('#go').disabled = false;
      return;
    }
    if (dead) return;
    q('#ctl').hidden = true;
    const intro = playScale(key);
    await sleep((intro.end - ctx.currentTime) * 1000);

    const trials = [];
    let lastFirst = null;
    for (let i = 0; ; i++) {
      if (dead) return;
      const spec = next(i, trials);
      if (!spec) break;
      const trial = makeTrial(spec.lvIdx, lastFirst);
      lastFirst = trial.degs[0];
      q('#cnt').textContent = `${i + 1}번째`;
      const res = await doTrial(trial, ctx);
      if (dead) return;
      trials.push(res);
      q('#ctl2').hidden = false;
      q('#next').textContent = '다음';
      await wait('#next');
      q('#ctl2').hidden = true;
    }
    finish(trials);
  };

  async function doTrial(trial, ctx) {
    const total = trial.degs.length * trial.beats;
    const notes = trial.degs.map((d, k) => ({ target: midiOf(key, d), start: k * trial.beats, beats: trial.beats }));
    const tr = makeTrace(canvas, key.tonic, notes, total);
    tr.draw(null, 0, beat, 0, false);
    q('#syl').textContent = trial.degs.map(() => '?').join('  ');
    q('#msg').textContent = '듣기…';

    const t0 = ctx.currentTime + 0.3;
    notes.forEach((n) => playNote(n.target, t0 + n.start * beat, n.beats * beat * 0.95, 1));
    const refEnd = t0 + total * beat;
    const countStart = refEnd + 0.3;
    const singStart = countStart + 2 * beat;
    for (let c = 0; c < 2; c++) click(countStart + c * beat, c === 0, 0.5);
    for (let k = 0; k < total; k++) click(singStart + k * beat, false, 0.18);
    const endAt = singStart + total * beat + 0.4;
    if (import.meta.env.DEV) window.__trial = { notes, singStart, beat }; // 개발 중 자동 시험용
    const frames = [];
    const bigEl = q('#big');
    await new Promise((resolve) => {
      const tick = () => {
        if (dead) return resolve();
        const now = ctx.currentTime;
        const p = mic.read();
        if (p) frames.push(p);
        if (now < refEnd) bigEl.textContent = '듣기';
        else if (now < singStart) { bigEl.textContent = '준비'; q('#msg').textContent = '곧 부르세요…'; }
        else { bigEl.textContent = p ? midiName(p.midi) : '·'; q('#msg').textContent = '지금 부르세요!'; }
        tr.draw(frames, singStart, beat, S.latency, false);
        if (now < endAt) raf = requestAnimationFrame(tick); else resolve();
      };
      tick();
    });
    if (dead) return null;
    bigEl.textContent = '';
    const results = scoreNotes(frames, notes, singStart, beat, S.latency, S.octaveStrict);
    tr.draw(frames, singStart, beat, S.latency, true);
    const hits = results.filter(isHit).length;
    q('#syl').innerHTML = trial.degs.map((d, i) => `<span class="${isHit(results[i]) ? 'good' : 'bad'}">${degName(d)}</span>`).join('  ');
    q('#msg').innerHTML = `<b>${hits}/${results.length} 적중</b> — ${results.map((r) => centsText(r)).join(' / ')}`;
    q('#again').onclick = () => {
      ensureCtx();
      const t = ctx.currentTime + 0.1;
      notes.forEach((n) => playNote(n.target, t + n.start * beat, n.beats * beat * 0.95, 1));
    };
    return { lvIdx: trial.lvIdx, hits, total: results.length };
  }

  function finish(trials) {
    env.stop();
    const hits = trials.reduce((a, t) => a + t.hits, 0);
    const total = trials.reduce((a, t) => a + t.total, 0);
    const rate = total ? hits / total : 0;
    if (opts.onFinish) { opts.onFinish({ trials, rate, hits, total }); return; }
    const note = advance(S, 'match', rate);
    save(S);
    app.innerHTML = `
      <h1>따라 부르기 결과</h1>
      <div class="card"><h2>${hits}/${total} 적중 (${Math.round(rate * 100)}%)</h2><p>${esc(note)}</p></div>
      <div class="row"><button class="primary" id="again">한 번 더</button><button id="home">홈으로</button></div>${footer}`;
    app.querySelector('#again').onclick = () => env.show(runMatch, { lvIdx: S.match.level - 1 });
    app.querySelector('#home').onclick = () => env.show(env.home);
  }
}
