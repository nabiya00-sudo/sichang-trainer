import { env, esc, sleep, footer, playScale, keyboard } from './ui.js';
import { ensureCtx, loadPiano, playNote } from './audio.js';
import { renderPair } from './notation.js';
import { advance } from './progress.js';
import { save } from './store.js';

const BASE = 60; // 가운데 도(C4). 이 훈련은 항상 C장조.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const KEY_C = { name: 'C', pc: 0, tonic: BASE };
const NAMES = { 0: '도', 1: '도#', 2: '레', 3: '레#', 4: '미', 5: '파', 6: '파#', 7: '솔', 8: '솔#', 9: '라', 10: '라#', 11: '시' };
const nameOf = (m) => NAMES[((m % 12) + 12) % 12];

// pool: 도(C4)에서 반음 수
export const IV_LEVELS = [
  { name: '도·미·솔', pool: [0, 4, 7] },
  { name: '도·레·미', pool: [0, 2, 4] },
  { name: '도~솔', pool: [0, 2, 4, 5, 7] },
  { name: '온음계 한 옥타브', pool: [0, 2, 4, 5, 7, 9, 11, 12] },
  { name: '반음 포함 한 옥타브', pool: range(0, 12) },
  { name: '아래 방향까지', pool: range(-5, 12) },
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

function makeQuestion(lvIdx, last) {
  const pool = IV_LEVELS[lvIdx].pool;
  for (let i = 0; i < 100; i++) {
    const a = pick(pool);
    const b = pick(pool);
    if (a !== b && !(last && last.a === BASE + a && last.b === BASE + b)) return { lvIdx, a: BASE + a, b: BASE + b };
  }
  return { lvIdx, a: BASE + pool[0], b: BASE + pool[1] };
}

// opts: { lvIdx, count?, next?(i, results) -> {lvIdx}|null, onFinish?(info), title? }
export function runInterval(opts) {
  const app = env.app;
  const S = env.S;
  const count = opts.count || 8;
  const next = opts.next || ((i) => (i < count ? { lvIdx: opts.lvIdx } : null));
  const title = opts.title || `음 간격 맞히기 · ${IV_LEVELS[opts.lvIdx ?? 0].name}`;
  let dead = false;
  const startedAt = Date.now();
  env.stop = () => { dead = true; };

  app.innerHTML = `
    <p><span class="pill">${esc(title)}</span> <span class="pill" id="cnt"></span></p>
    <div class="card"><p>피아노가 <b>음계</b>를 들려준 뒤, <b>두 음("띵 땅")</b>을 들려줍니다. 들은 순서대로 건반 두 개를 눌러 주세요.</p></div>
    <div class="big" id="picks">① ?  ② ?</div>
    <div id="kb"></div>
    <p class="sub" id="msg">"시작"을 누르면 음계를 먼저 들려줍니다.</p>
    <div class="score" id="staff" hidden></div>
    <div class="row" id="ctl"><button class="primary" id="go">시작</button></div>
    <div class="row" id="ctl2" hidden><button id="hear">다시 듣기</button><button id="scale">음계 듣기</button><button class="primary" id="next" hidden>다음</button></div>
    <div class="row" style="margin-top:10px"><button class="ghost" id="back">그만하기</button></div>
    ${footer}`;
  const q = (s) => app.querySelector(s);
  q('#back').onclick = () => env.show(env.home);
  const wait = (id) => new Promise((res) => { q(id).onclick = res; });

  q('#go').onclick = async () => {
    q('#go').disabled = true;
    const ctx = ensureCtx();
    try { await loadPiano(); } catch { q('#msg').textContent = '피아노 소리를 불러오지 못했습니다.'; q('#go').disabled = false; return; }
    q('#ctl').hidden = true;
    q('#ctl2').hidden = false;
    q('#scale').onclick = () => playScale(KEY_C);
    const intro = playScale(KEY_C);
    await sleep((intro.end - ctx.currentTime) * 1000);

    const results = [];
    const pending = [];
    let last = null;
    while (!dead) {
      const due = pending.findIndex((p) => p.after <= results.length);
      let qu;
      let retry = false;
      if (due >= 0) { qu = pending.splice(due, 1)[0].q; retry = true; }
      else {
        const spec = next(results.length, results);
        if (spec) qu = makeQuestion(spec.lvIdx, last);
        else if (pending.length) { qu = pending.shift().q; retry = true; }
        else break;
      }
      last = qu;
      q('#cnt').textContent = retry ? '복습' : `${results.length + 1}번째`;
      const correct = await ask(qu, retry, ctx);
      if (dead) return;
      if (!retry) {
        results.push({ lvIdx: qu.lvIdx, correct });
        if (!correct && opts.retry !== false) pending.push({ q: qu, after: results.length + 2 });
      }
      await wait('#next');
    }
    if (!dead) finish(results);
  };

  async function ask(qu, retry, ctx) {
    const lv = IV_LEVELS[qu.lvIdx];
    const lo = BASE + Math.min(...lv.pool);
    const hi = BASE + Math.max(...lv.pool);
    const picks = [];
    let done = false;
    q('#staff').hidden = true;
    q('#next').hidden = true;
    const picksEl = q('#picks');
    const label = () => `① ${picks[0] !== undefined ? nameOf(picks[0]) : '?'}  ② ${picks[1] !== undefined ? nameOf(picks[1]) : '?'}`;
    picksEl.textContent = label();
    q('#msg').textContent = retry ? '아까 틀린 문제를 다시 풀어 봅니다. 잘 들어 보세요.' : '잘 듣고 두 음을 순서대로 누르세요.';
    const play = () => {
      const t = ensureCtx().currentTime + 0.15;
      playNote(qu.a, t, 0.85, 1);
      playNote(qu.b, t + 0.95, 0.85, 1);
    };
    q('#hear').onclick = play;
    play();

    return new Promise((resolve) => {
      const kb = keyboard(q('#kb'), lo, hi, qu.lvIdx >= 4, (m) => {
        if (done || picks.length >= 2) return;
        picks.push(m);
        playNote(m, ensureCtx().currentTime + 0.02, 0.6, 0.9);
        kb.mark(m, 'sel');
        picksEl.textContent = label();
        if (picks.length < 2) return;
        done = true;
        const correct = picks[0] === qu.a && picks[1] === qu.b;
        picks.forEach((p, i) => { if (p !== [qu.a, qu.b][i]) kb.mark(p, 'no'); });
        kb.mark(qu.a, 'ok');
        kb.mark(qu.b, 'ok');
        kb.lock();
        picksEl.innerHTML = `<span class="${correct ? 'good' : 'bad'}">${correct ? '정답!' : '오답'}</span>`;
        q('#msg').innerHTML = correct
          ? `<b>${nameOf(qu.a)} → ${nameOf(qu.b)}</b>`
          : `정답은 <b>${nameOf(qu.a)} → ${nameOf(qu.b)}</b> 입니다. 오선지 위치도 확인하세요. 틀린 문제는 조금 뒤에 다시 나옵니다.`;
        const staff = q('#staff');
        staff.hidden = false;
        renderPair(staff, [qu.a, qu.b]);
        q('#next').hidden = false;
        resolve(correct);
      });
    });
  }

  function finish(results) {
    env.stop();
    const hits = results.filter((r) => r.correct).length;
    const rate = results.length ? hits / results.length : 0;
    if (opts.onFinish) { opts.onFinish({ results, rate, hits, total: results.length }); return; }
    const note = advance(S, 'interval', rate, { sec: (Date.now() - startedAt) / 1000 });
    save(S);
    const buttons = opts.cont
      ? `<div class="row"><button class="primary" id="cont">${esc(opts.cont.label)}</button><button id="home">그만하기</button></div>`
      : '<div class="row"><button class="primary" id="again">한 번 더</button><button id="home">홈으로</button></div>';
    app.innerHTML = `
      <h1>음 간격 맞히기 결과</h1>
      <div class="card"><h2>${hits}/${results.length} 정답 (${Math.round(rate * 100)}%)</h2><p>${esc(note)}</p></div>
      ${buttons}${footer}`;
    if (opts.cont) app.querySelector('#cont').onclick = opts.cont.fn;
    else app.querySelector('#again').onclick = () => env.show(runInterval, { lvIdx: S.interval.level - 1 });
    app.querySelector('#home').onclick = () => env.show(env.home);
  }
}
