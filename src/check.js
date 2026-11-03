import { env, esc, footer } from './ui.js';
import { runInterval } from './interval.js';
import { runMatch, MATCH_LEVELS } from './match.js';
import { SKILLS } from './progress.js';
import { save } from './store.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 짧은 점검(약 5분): 음 간격 맞히기 6문제(적응형) + 따라 부르기 5~8문제.
// 처음에는 시작 레벨을 정하고, 이후에는 현재 수준을 다시 측정한다.
export function checkScreen() {
  const { app, S } = env;
  const first = !S.placed;
  app.innerHTML = `
    <h1>${first ? '레벨 진단' : '수준 점검'}</h1>
    <div class="card">
      <p>${first ? '내 수준에 맞는 시작 단계를 정합니다.' : '지금 실력을 다시 측정해 레벨을 조정합니다.'} 약 5분, 두 부분입니다.</p>
      <p>① 음 간격 맞히기: 두 음을 듣고 건반에서 고르기 (6문제, 점점 어려워지거나 쉬워집니다)</p>
      <p>② 따라 부르기: 피아노 음을 듣고 같은 음을 노래하기</p>
      <p class="sub">점수가 낮아도 괜찮습니다. 시작 지점을 찾는 것이 목적이고, 이어폰을 끼면 더 정확합니다.</p>
    </div>
    ${S.rangeMeasured ? '' : '<div class="card"><p class="bad">먼저 음역 측정이 필요합니다. (따라 부르기가 내 음역 안에서 진행됩니다)</p></div>'}
    <div class="row">
      <button class="primary" id="go">${S.rangeMeasured ? '시작' : '음역 측정부터'}</button>
      <button class="ghost" id="back">나중에</button>
    </div>${footer}`;
  app.querySelector('#back').onclick = () => env.show(env.home);
  app.querySelector('#go').onclick = () => {
    if (!S.rangeMeasured) env.show(env.rangeTest, () => env.show(checkScreen));
    else startIntervalPart();
  };
}

function startIntervalPart() {
  const S = env.S;
  let lv = 2; // 1~6, 2에서 시작해 맞히면 올라가고 틀리면 내려간다
  const asked = [];
  env.show(runInterval, {
    title: '점검 ① 음 간격',
    retry: false, // 측정이 목적이므로 틀린 문제를 다시 내지 않는다
    next: (i, results) => {
      if (i >= 6) return null;
      if (i > 0) lv = clamp(results[i - 1].correct ? lv + 1 : lv - 1, 1, 6);
      asked.push(lv);
      return { lvIdx: lv - 1 };
    },
    onFinish: ({ results }) => {
      const tail = asked.slice(-4);
      const est = clamp(Math.round(tail.reduce((a, b) => a + b, 0) / tail.length), 1, 6);
      const ivRate = results.filter((r) => r.correct).length / results.length;
      startMatchPart({ intervalLevel: est, ivRate });
    },
  });
}

function startMatchPart(part) {
  env.show(runMatch, {
    title: '점검 ② 따라 부르기',
    lvIdx: 0,
    keyLevels: [0, 3],
    next: (i, trials) => {
      if (i < 5) return { lvIdx: 0 };
      const r1 = trials.slice(0, 5).reduce((a, t) => a + t.hits, 0) / 5;
      if (r1 >= 0.8 && i < 8) return { lvIdx: 3 }; // 한 음을 잘 맞히면 세 음 선율도 시험
      return null;
    },
    onFinish: ({ trials }) => {
      const r1 = trials.slice(0, 5).reduce((a, t) => a + t.hits, 0) / 5;
      const t2 = trials.slice(5);
      const r2 = t2.length ? t2.reduce((a, t) => a + t.hits, 0) / t2.reduce((a, t) => a + t.total, 0) : null;
      let level = 1;
      if (r1 >= 0.8) level = r2 === null || r2 < 0.4 ? 2 : r2 < 0.67 ? 3 : 4;
      finishCheck({ ...part, matchLevel: level, r1, r2 });
    },
  });
}

function finishCheck({ intervalLevel, ivRate, matchLevel, r1, r2 }) {
  const { app, S } = env;
  const prev = S.checks[S.checks.length - 1];
  const wasPlaced = S.placed;
  S.interval = { level: intervalLevel, streak: 0 };
  S.match = { level: matchLevel, streak: 0 };
  if (!wasPlaced) { S.level = matchLevel >= 4 ? 2 : 1; S.streak = 0; } // 시창은 처음에만 보수적으로 설정
  S.placed = true;
  S.lastCheck = Date.now();
  S.sinceCheck = 0;
  S.checks.push({ t: Date.now(), interval: intervalLevel, match: matchLevel, ivRate, r1, r2, sing: S.level });
  save(S);

  const row = (skill, now, before) => `<tr><td>${SKILLS[skill].name}</td><td>Lv${now}</td><td>${before === undefined ? '-' : before === now ? '변화 없음' : before < now ? `▲ Lv${before}에서` : `▼ Lv${before}에서`}</td></tr>`;
  app.innerHTML = `
    <h1>점검 결과</h1>
    <div class="card"><table>
      <tr><th>기술</th><th>시작 레벨</th><th>지난 점검 대비</th></tr>
      ${row('interval', intervalLevel, prev && prev.interval)}
      ${row('match', matchLevel, prev && prev.match)}
      ${row('sing', S.level, prev && prev.sing)}
    </table></div>
    <div class="card"><p>음 간격 정답률 ${Math.round(ivRate * 100)}% · 한 음 따라 부르기 ${Math.round(r1 * 100)}%${r2 === null ? '' : ` · 세 음 ${Math.round(r2 * 100)}%`}</p>
      <p class="sub">${esc(MATCH_LEVELS[matchLevel - 1].name)} 단계부터 따라 부르기를 시작합니다. 연습하면서 레벨은 계속 자동으로 조정됩니다.</p></div>
    <button class="primary" id="home" style="width:100%">홈으로</button>${footer}`;
  app.querySelector('#home').onclick = () => env.show(env.home);
}
