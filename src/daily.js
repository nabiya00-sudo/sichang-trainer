import { env, footer } from './ui.js';
import { SKILLS, levelOf } from './progress.js';
import { runMatch, MATCH_LEVELS } from './match.js';
import { runInterval, IV_LEVELS } from './interval.js';
import { weekInfo, streak, secToday } from './habit.js';

// 한 블록의 예상 소요 시간(초). 따라 부르기·음 간격 맞히기는 한 세트, 시창은 선율 3개.
const EST = { match: 100, interval: 100, sing: 120 };

// 가장 약한(레벨 비율이 낮은) 기술에 더 많이 배정한다. 같은 기술이 연달아 나오지 않게 순환.
export function buildPlan(S, minutes) {
  const norm = (k) => (levelOf(S, k) - 1) / (SKILLS[k].max - 1);
  const order = ['match', 'interval', 'sing'].sort((a, b) => norm(a) - norm(b));
  const cycle = [order[0], order[1], order[0], order[2], order[1], order[0]];
  const budget = minutes * 60;
  const plan = [];
  let used = 0;
  for (let i = 0; i < cycle.length && (plan.length === 0 || used < budget * 0.7); i++) {
    plan.push(cycle[i]);
    used += EST[cycle[i]];
  }
  return plan;
}

let run = null;

export function startDaily(minutes) {
  run = { plan: buildPlan(env.S, minutes), i: 0, minutes };
  env.show(step);
}

function step() {
  const { plan, i } = run;
  if (i >= plan.length) { summary(); return; }
  const S = env.S;
  const k = plan[i];
  const last = i + 1 >= plan.length;
  const cont = {
    label: last ? '오늘의 연습 마치기' : `다음 훈련 (${i + 2}/${plan.length})`,
    fn: () => { run.i++; env.show(step); },
  };
  const head = `오늘의 연습 ${i + 1}/${plan.length}`;
  if (k === 'match') env.show(runMatch, { lvIdx: S.match.level - 1, cont, title: `${head} · ${MATCH_LEVELS[S.match.level - 1].name}` });
  else if (k === 'interval') env.show(runInterval, { lvIdx: S.interval.level - 1, cont, title: `${head} · ${IV_LEVELS[S.interval.level - 1].name}` });
  else env.show(env.session, { count: 3, cont, title: head });
}

function summary() {
  const { app, S } = env;
  const w = weekInfo(S);
  const goalMet = w.done >= S.goalDays;
  app.innerHTML = `
    <h1>오늘의 연습 완료 🎉</h1>
    <div class="card">
      <p>오늘 연습 시간 약 <b>${Math.max(1, Math.round(secToday(S) / 60))}분</b></p>
      <p>이번 주 <b>${w.done} / ${S.goalDays}일</b> ${goalMet ? '— 주간 목표 달성!' : ''}</p>
      <p class="sub">연속 ${streak(S)}일 (하루 쉬는 것은 봐줍니다)</p>
    </div>
    <p class="sub">내일은 정한 시간에 맞춰 다시 열어 주세요. 바쁜 날은 5분 미니 연습만 해도 한 날로 셉니다.</p>
    <button class="primary" id="home" style="width:100%">홈으로</button>${footer}`;
  app.querySelector('#home').onclick = () => env.show(env.home);
}
