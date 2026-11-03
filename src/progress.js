// 기술별 레벨 관리. sing 은 예전 기록과 호환되도록 S.level / S.streak 를 그대로 쓴다.
export const SKILLS = {
  match: { name: '따라 부르기', max: 6 },
  interval: { name: '음 간격 맞히기', max: 6 },
  sing: { name: '시창', max: 6 },
};

export const levelOf = (S, skill) => (skill === 'sing' ? S.level : S[skill].level);

// 최근 기록(최대 5회) 평균 적중률. 없으면 null.
export function recentRate(S, skill) {
  const h = S.history.filter((x) => (x.skill || 'sing') === skill).slice(-5);
  return h.length ? h.reduce((a, x) => a + x.rate, 0) / h.length : null;
}

// 적중률 80% 이상 2회 연속 → 레벨 업, 50% 미만 → 레벨 다운. 안내 문구를 돌려준다.
export function advance(S, skill, rate) {
  const max = SKILLS[skill].max;
  const st = skill === 'sing' ? { level: S.level, streak: S.streak } : S[skill];
  const before = st.level;
  let note;
  if (rate >= 0.8) {
    st.streak++;
    if (st.streak >= 2 && st.level < max) {
      st.level++;
      st.streak = 0;
      note = `🎉 2회 연속 성공! 레벨 ${st.level}로 올라갑니다.`;
    } else if (st.level >= max) {
      note = '최고 레벨에서 안정적입니다.';
    } else {
      note = `성공! 한 번 더 성공하면 레벨이 올라갑니다. (${st.streak}/2)`;
    }
  } else if (rate < 0.5) {
    st.streak = 0;
    if (st.level > 1) {
      st.level--;
      note = `레벨 ${st.level}로 내려가 기초를 다집니다.`;
    } else {
      note = '천천히 다시 해 봐요.';
    }
  } else {
    st.streak = 0;
    note = '거의 다 왔어요. 같은 레벨에서 다시 도전합니다.';
  }
  if (skill === 'sing') {
    S.level = st.level;
    S.streak = st.streak;
  }
  S.history.push({ t: Date.now(), skill, level: before, rate });
  S.history = S.history.slice(-400);
  S.sinceCheck = (S.sinceCheck || 0) + 1;
  return note;
}

// 재점검 시기: 마지막 점검 후 10회 연습 또는 14일.
export function checkDue(S) {
  if (!S.placed) return true;
  return S.sinceCheck >= 10 || Date.now() - S.lastCheck > 14 * 24 * 3600 * 1000;
}
