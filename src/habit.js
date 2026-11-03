// 연습 습관 기록: 하루에 MIN_SEC 이상 연습하면 그날을 "연습한 날"로 센다.
export const MIN_SEC = 240; // 4분. 5분 미니 연습으로 채울 수 있는 기준

const pad = (n) => String(n).padStart(2, '0');
export const keyOf = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isCounted = (S, k) => (S.days[k] ? S.days[k].sec : 0) >= MIN_SEC;
export const secToday = (S) => (S.days[keyOf()] ? S.days[keyOf()].sec : 0);

// 연습 시간을 오늘 기록에 더한다. 그날이 처음 "연습한 날"이 되면 점검 카운터(sinceCheck)도 올린다.
export function logPractice(S, sec) {
  const k = keyOf();
  const d = S.days[k] || { sec: 0, n: 0 };
  const was = d.sec >= MIN_SEC;
  d.sec += Math.round(sec);
  d.n += 1;
  S.days[k] = d;
  if (!was && d.sec >= MIN_SEC) S.sinceCheck = (S.sinceCheck || 0) + 1;
  // 오래된 기록 정리 (약 4달)
  const keys = Object.keys(S.days).sort();
  while (keys.length > 120) delete S.days[keys.shift()];
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

// 이번 주(월~일) 요약
export function weekInfo(S, offsetWeeks = 0) {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 월=0
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - offsetWeeks * 7);
  const todayKey = keyOf(now);
  const days = DAY_LABELS.map((label, i) => {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    const key = keyOf(d);
    return { key, label, counted: isCounted(S, key), sec: S.days[key] ? S.days[key].sec : 0, today: key === todayKey, future: key > todayKey };
  });
  return { days, done: days.filter((d) => d.counted).length };
}

// 연속 일수. 하루 쉬는 것은 봐주고, 이틀 연속 쉬면 끊긴다. 오늘 아직 안 했어도 끊기지 않는다.
export function streak(S) {
  const d = new Date();
  let count = 0;
  let misses = 0;
  for (let i = 0; i < 120; i++) {
    if (isCounted(S, keyOf(d))) {
      count++;
      misses = 0;
    } else if (i > 0) {
      misses++;
      if (misses >= 2) break;
    }
    d.setDate(d.getDate() - 1);
  }
  return count;
}
