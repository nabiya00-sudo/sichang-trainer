import './style.css';
import { load, save, exportJson, importJson } from './store.js';
import { ensureCtx, loadPiano, playNote, playChord, click } from './audio.js';
import { startMic, midiName, median } from './pitch.js';
import { LEVELS, generate, chooseKey, midiOf, degName, SOLFEGE } from './melody.js';
import { renderScore } from './notation.js';
import { TERMS, termsUpTo, termsAt } from './terms.js';
import { env, esc, sleep, footer, playScale } from './ui.js';
import { SKILLS, levelOf, recentRate, advance, checkDue } from './progress.js';
import { scoreNotes, isHit, centsText, meanAbsCents } from './sing.js';
import { startDaily } from './daily.js';
import { weekInfo, streak, secToday, MIN_SEC } from './habit.js';
import { runMatch, MATCH_LEVELS } from './match.js';
import { runInterval, IV_LEVELS } from './interval.js';
import { checkScreen } from './check.js';

const app = document.getElementById('app');
let S = load();
env.app = app;
env.S = S;

function show(fn, ...args) {
  if (env.stop) env.stop();
  env.stop = null;
  window.scrollTo(0, 0);
  fn(...args);
}
env.show = show;

const LEVEL_NAME = {
  match: (s) => MATCH_LEVELS[s.match.level - 1].name,
  interval: (s) => IV_LEVELS[s.interval.level - 1].name,
  sing: (s) => LEVELS[s.level - 1].name,
};
const SKILL_DESC = {
  match: '피아노 음을 듣고 같은 음을 노래합니다. 실시간 그래프로 바로 확인.',
  interval: '두 음을 듣고 화면 건반에서 순서대로 고릅니다. 코드 따기의 기초.',
  sing: '악보를 보고 계이름으로 노래합니다.',
};

// 가장 낮은 레벨 비율의 기술을 오늘의 연습으로 추천한다.
function recommend() {
  const order = ['match', 'interval', 'sing'];
  return order.reduce((best, k) => (
    (levelOf(S, k) - 1) / (SKILLS[k].max - 1) < (levelOf(S, best) - 1) / (SKILLS[best].max - 1) ? k : best
  ), 'match');
}

/* ---------------------------------------------------------------- 홈 */
function home() {
  const rec = recommend();
  const due = S.placed && checkDue(S);
  const startFn = { match: () => show(runMatch, { lvIdx: S.match.level - 1 }), interval: () => show(runInterval, { lvIdx: S.interval.level - 1 }), sing: () => show(session) };
  const card = (k) => {
    const r = recentRate(S, k);
    return `<div class="card">
      <span class="pill">${SKILLS[k].name} · Lv${levelOf(S, k)} / ${SKILLS[k].max}</span>${rec === k && S.placed ? ' <span class="pill rec">가장 약한 기술</span>' : ''}
      <h2 style="margin-top:8px">${esc(LEVEL_NAME[k](S))}</h2>
      <p class="sub">${SKILL_DESC[k]}</p>
      <p class="sub">최근 5회 평균 ${r === null ? '-' : Math.round(r * 100) + '%'}</p>
      <button id="go-${k}" style="width:100%">${SKILLS[k].name}만 하기</button>
    </div>`;
  };
  const week = weekInfo(S);
  const todaySec = secToday(S);
  const todayDone = todaySec >= MIN_SEC;
  const st = streak(S);
  const dots = week.days.map((d) => `<div class="dot ${d.counted ? 'on' : ''} ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}"><span>${d.label}</span></div>`).join('');
  const mins = [5, 10, 15, 20];
  app.innerHTML = `
    <h1>시창 트레이너</h1>
    ${!S.placed ? `<div class="card hl"><h2>처음이시네요! 레벨 진단부터 해 보세요</h2>
      <p>약 5분 동안 지금 실력을 확인해 내게 맞는 시작 단계를 정합니다.</p>
      <button class="primary" id="check" style="width:100%">레벨 진단 시작</button></div>` : ''}
    ${due && S.placed ? `<div class="card hl"><h2>수준 점검 시기입니다</h2>
      <p>${S.sinceCheck >= 10 ? `마지막 점검 후 ${S.sinceCheck}일 연습했습니다.` : '마지막 점검 후 2주가 지났습니다.'} 짧게(약 5분) 다시 측정해 레벨을 맞춥니다.</p>
      <button class="primary" id="check" style="width:100%">수준 점검 시작</button></div>` : ''}
    <div class="card ${todayDone ? '' : 'hl'}">
      <h2>오늘의 연습 ${todayDone ? '<span class="good">✓ 완료</span>' : ''}</h2>
      <div class="dots">${dots}</div>
      <p>이번 주 <b>${week.done} / ${S.goalDays}일</b>${week.done >= S.goalDays ? ' — 목표 달성!' : ''} <span class="sub">· 연속 ${st}일 · 오늘 ${Math.round(todaySec / 60)}분</span></p>
      ${S.plan ? `<p class="sub">내 연습 시간: ${esc(S.plan)}</p>` : `<div class="plan"><label>언제 연습할지 정해 보세요 (예: 저녁 먹은 뒤 태블릿 앞에서)</label>
        <div class="row"><input type="text" id="planin" maxlength="60" placeholder="나는 ___할 때 연습한다" /><button id="plansave">저장</button></div>
        <p class="sub">알림은 갤럭시 탭의 시계 앱 → 알람에서 연습 시간·요일을 반복으로 설정해 두세요.</p></div>`}
      <div class="chips">${mins.map((m) => `<button class="chip ${S.sessionMin === m ? 'on' : ''}" data-min="${m}">${m}분</button>`).join('')}</div>
      <button class="primary" id="daily" style="width:100%">오늘의 연습 시작 (${S.sessionMin}분)</button>
      <button id="mini" style="width:100%;margin-top:8px">5분 미니 연습 (바쁜 날)</button>
    </div>
    <h2 style="margin-top:18px">훈련 하나만 하기</h2>
    ${['match', 'interval', 'sing'].map(card).join('')}
    <p class="sub">내 음역: ${midiName(S.range.low)} ~ ${midiName(S.range.high)} ${S.rangeMeasured ? '' : '(기본값 — 음역 측정이 필요합니다)'}</p>
    <div class="row">
      <button id="range">음역 측정</button>
      ${S.placed && !due ? '<button id="check">수준 점검</button>' : ''}
    </div>
    <div class="row" style="margin-top:10px">
      <button id="terms">용어 사전</button>
      <button id="stats">기록</button>
    </div>
    <div class="card">
      <h2>설정</h2>
      <label>주간 목표 (하루 4분 이상 연습한 날)</label>
      <select id="goal">${[3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${S.goalDays === n ? 'selected' : ''}>주 ${n}일</option>`).join('')}</select>
      <label>내 연습 시간 (언제 할지)</label>
      <input type="text" id="plan" maxlength="60" value="${esc(S.plan)}" placeholder="나는 ___할 때 연습한다" />
      <label>속도: <b id="tv">${S.tempo}</b> BPM</label>
      <input type="range" id="tempo" min="44" max="100" value="${S.tempo}" />
      <label>마이크 지연 보정: <b id="lv">${Math.round(S.latency * 1000)}</b> ms (결과가 계속 늦게/빨리 나오면 조정)</label>
      <input type="range" id="lat" min="0" max="400" step="10" value="${Math.round(S.latency * 1000)}" />
      <label style="display:flex;gap:10px;align-items:center;color:var(--text)">
        <input type="checkbox" id="oct" ${S.octaveStrict ? 'checked' : ''} style="width:22px;height:22px" />
        옥타브까지 정확히 채점 (내 음역에서 부르기, 권장)
      </label>
      <label>시창 시작 전 소리</label>
      <select id="intro"><option value="scale" ${S.intro === 'scale' ? 'selected' : ''}>음계 (도레미파솔라시도)</option><option value="cadence" ${S.intro === 'cadence' ? 'selected' : ''}>화음 진행 (도-파-솔-도)</option></select>
      <div class="row" style="margin-top:12px">
        <button id="exp" class="ghost">기록 백업(내보내기)</button>
        <button id="imp" class="ghost">백업 불러오기</button>
      </div>
      <input type="file" id="file" accept="application/json" hidden />
    </div>
    <p class="sub">이어폰을 끼고 연습하면 피아노 소리가 마이크에 섞이지 않아 정확합니다.</p>
    ${footer}`;
  const q = (s) => app.querySelector(s);
  ['match', 'interval', 'sing'].forEach((k) => { q(`#go-${k}`).onclick = startFn[k]; });
  if (q('#check')) q('#check').onclick = () => show(checkScreen);
  q('#daily').onclick = () => startDaily(S.sessionMin);
  q('#mini').onclick = () => startDaily(5);
  app.querySelectorAll('.chip').forEach((b) => {
    b.onclick = () => { S.sessionMin = +b.dataset.min; save(S); show(home); };
  });
  if (q('#plansave')) {
    q('#plansave').onclick = () => {
      const v = q('#planin').value.trim();
      if (!v) return;
      S.plan = v;
      save(S);
      show(home);
    };
  }
  q('#goal').onchange = (e) => { S.goalDays = +e.target.value; save(S); show(home); };
  q('#plan').onchange = (e) => { S.plan = e.target.value.trim(); save(S); };
  q('#range').onclick = () => show(rangeTest);
  q('#terms').onclick = () => show(termsScreen);
  q('#stats').onclick = () => show(statsScreen);
  q('#tempo').oninput = (e) => {
    S.tempo = +e.target.value;
    q('#tv').textContent = S.tempo;
    save(S);
  };
  q('#lat').oninput = (e) => {
    S.latency = +e.target.value / 1000;
    q('#lv').textContent = e.target.value;
    save(S);
  };
  q('#oct').onchange = (e) => {
    S.octaveStrict = e.target.checked;
    save(S);
  };
  q('#intro').onchange = (e) => {
    S.intro = e.target.value;
    save(S);
  };
  q('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportJson(S)], { type: 'application/json' }));
    a.download = `sichang-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const file = q('#file');
  q('#imp').onclick = () => file.click();
  file.onchange = async () => {
    try {
      S = importJson(await file.files[0].text());
      env.S = S;
      save(S);
      show(home);
    } catch (e) {
      alert(e.message);
    }
  };
}

/* ---------------------------------------------------------------- 용어 사전 */
function termsScreen() {
  const open = termsUpTo(S.level);
  const locked = TERMS.length - open.length;
  app.innerHTML = `
    <h1>용어 사전</h1>
    <p class="sub">시창 레벨이 오르면 새 용어가 열립니다. (잠긴 용어 ${locked}개)</p>
    ${open.map((t) => `<div class="card"><h2>${esc(t.title)}</h2><p>${esc(t.body)}</p></div>`).join('')}
    <button id="back">홈으로</button>${footer}`;
  app.querySelector('#back').onclick = () => show(home);
}

/* ---------------------------------------------------------------- 기록 */
const spark = (rates) => `<div class="spark">${rates.map((r) => `<i style="height:${Math.max(4, Math.round(r * 100))}%" title="${Math.round(r * 100)}%"></i>`).join('')}</div>`;

function statsScreen() {
  const skillBlock = (k) => {
    const h = S.history.filter((x) => (x.skill || 'sing') === k);
    const last = h.slice(-20);
    return `<div class="card"><h2>${SKILLS[k].name} · 현재 Lv${levelOf(S, k)}</h2>
      ${last.length ? `${spark(last.map((x) => x.rate))}<p class="sub">최근 ${last.length}회 (막대 높이 = 적중률) · 총 ${h.length}회 연습</p>` : '<p class="sub">아직 기록이 없습니다.</p>'}</div>`;
  };
  // 최근 4주 달력 (월~일), 하루 4분 이상 연습한 날이 주황색
  const weeks = [3, 2, 1, 0].map((o) => weekInfo(S, o));
  const cal = `<div class="cal">${weeks.map((w) => w.days.map((d) => `<div class="cell ${d.counted ? 'on' : d.sec > 0 ? 'part' : ''} ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}" title="${d.key} · ${Math.round(d.sec / 60)}분">${d.sec ? Math.max(1, Math.round(d.sec / 60)) : ''}</div>`).join('')).join('')}</div>`;
  const total4 = weeks.reduce((a, w) => a + w.done, 0);
  // 음정 오차 추이: 최근 5회 vs 그 이전 5회 (따라 부르기·시창)
  const errs = S.history.filter((x) => x.err !== undefined).map((x) => x.err);
  const recent = errs.slice(-5);
  const before = errs.slice(-10, -5);
  const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  const errCard = errs.length
    ? `<div class="card"><h2>음정 오차 추이 (작을수록 정확)</h2>
        <p>최근 ${recent.length}회 평균 <b>${avg(recent)}¢</b>${before.length ? ` · 그 이전 ${before.length}회 <b>${avg(before)}¢</b> ${avg(recent) < avg(before) ? '<span class="good">▼ 좋아졌어요</span>' : avg(recent) > avg(before) ? '<span class="bad">▲ 늘었어요</span>' : ''}` : ''}</p>
        ${spark(errs.slice(-20).map((e) => Math.max(0.04, 1 - Math.min(e, 100) / 100)))}
        <p class="sub">막대가 높을수록 오차가 작습니다. 100¢ = 반음. 따라 부르기와 시창을 합친 값입니다.</p></div>`
    : '';
  const rows = SOLFEGE.map((n) => {
    const d = S.degree[n] || { n: 0, h: 0 };
    const pct = d.n ? Math.round((d.h / d.n) * 100) : null;
    return `<div>${n}</div><div class="bar"><i style="width:${pct ?? 0}%"></i></div><div class="sub">${pct === null ? '-' : pct + '%'}</div>`;
  }).join('');
  const checks = S.checks.slice(-6).reverse()
    .map((c) => `<tr><td>${new Date(c.t).toLocaleDateString('ko-KR')}</td><td>Lv${c.interval}</td><td>Lv${c.match}</td><td>Lv${c.sing}</td></tr>`)
    .join('');
  app.innerHTML = `
    <h1>기록</h1>
    <div class="card"><h2>최근 4주 연습 달력</h2>
      <div class="calhead">${['월', '화', '수', '목', '금', '토', '일'].map((d) => `<span>${d}</span>`).join('')}</div>${cal}
      <p class="sub">숫자는 그날 연습 분. 4분 이상이면 주황색(연습한 날). 최근 4주 중 <b>${total4}일</b> 연습했습니다.</p></div>
    ${errCard}
    ${['match', 'interval', 'sing'].map(skillBlock).join('')}
    <div class="card"><h2>점검 기록 (시작 레벨)</h2>
      ${checks ? `<table><tr><th>날짜</th><th>음 간격</th><th>따라 부르기</th><th>시창</th></tr>${checks}</table>` : '<p class="sub">아직 점검 기록이 없습니다. 홈에서 레벨 진단을 해 보세요.</p>'}
    </div>
    <div class="card"><h2>시창: 계이름별 적중률 (약점 확인)</h2><div class="grid">${rows}</div></div>
    <button id="back">홈으로</button>${footer}`;
  app.querySelector('#back').onclick = () => show(home);
}

/* ---------------------------------------------------------------- 음역 측정 */
function rangeTest(after) {
  const result = { low: null, high: null };
  app.innerHTML = `
    <h1>음역 측정</h1>
    <p>"아~" 소리로 <b>편하게 낼 수 있는</b> 가장 낮은 음과 가장 높은 음을 각각 3초씩 내 주세요. 무리하지 마세요.</p>
    <div class="card"><div class="big" id="show">-</div><p class="sub" id="msg">버튼을 누르고 바로 소리를 내세요.</p></div>
    <div class="row"><button class="primary" id="low">낮은 음 측정</button><button class="primary" id="high">높은 음 측정</button></div>
    <div class="row" style="margin-top:10px"><button id="done" disabled>저장</button><button id="back" class="ghost">취소</button></div>`;
  const showEl = app.querySelector('#show');
  const msg = app.querySelector('#msg');
  const done = app.querySelector('#done');
  let mic = null;
  let raf = 0;
  env.stop = () => { cancelAnimationFrame(raf); mic && mic.stop(); };

  async function measure(which) {
    try {
      const ctx = ensureCtx();
      mic = await startMic(ctx);
    } catch {
      msg.textContent = '마이크를 사용할 수 없습니다. 브라우저의 마이크 권한을 허용해 주세요.';
      return;
    }
    msg.textContent = '지금 소리를 내세요…';
    const frames = [];
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const p = mic.read();
        if (p) { frames.push(p.midi); showEl.textContent = midiName(p.midi); }
        if (performance.now() - t0 < 3200) raf = requestAnimationFrame(tick); else resolve();
      };
      tick();
    });
    mic.stop();
    mic = null;
    if (frames.length < 15) { msg.textContent = '소리가 잘 들리지 않았어요. 조금 더 크게 다시 해 주세요.'; return; }
    const stable = frames.slice(Math.floor(frames.length * 0.3)); // 앞부분(시작 흔들림) 제외
    result[which] = Math.round(median(stable));
    showEl.textContent = midiName(result[which]);
    msg.textContent = `${which === 'low' ? '낮은' : '높은'} 음: ${midiName(result[which])}`;
    done.disabled = !(result.low !== null && result.high !== null && result.high - result.low >= 7);
    if (result.low !== null && result.high !== null && result.high - result.low < 7) msg.textContent += ' — 음역이 너무 좁게 측정되었어요. 다시 해 주세요.';
  }
  app.querySelector('#low').onclick = () => measure('low');
  app.querySelector('#high').onclick = () => measure('high');
  done.onclick = () => {
    S.range = { low: result.low, high: result.high };
    S.rangeMeasured = true;
    save(S);
    if (typeof after === 'function') after();
    else show(home);
  };
  app.querySelector('#back').onclick = () => show(home);
}

/* ---------------------------------------------------------------- 시창 */
// opts: { count?: 한 번에 부를 선율 수, done?: 지금까지 끝낸 수, cont?: {label, fn}, title? } (오늘의 연습에서 사용)
function session(opts = {}) {
  const done = opts.done || 0;
  const startedAt = Date.now();
  const lv = LEVELS[S.level - 1];
  const mel = generate(lv);
  // 음역 안쪽으로 한 걸음 들여서 가장자리 음을 피한다.
  const key = chooseKey({ low: S.range.low + 1, high: S.range.high - 1 }, mel);
  const beat = 60 / S.tempo;
  const total = mel.notes.reduce((a, n) => a + n.beats, 0);
  const starts = [];
  mel.notes.reduce((acc, n, i) => { starts[i] = acc; return acc + n.beats; }, 0);
  const newTerms = !S.seenLevels.includes(S.level) ? termsAt(S.level) : [];
  if (newTerms.length) { S.seenLevels.push(S.level); save(S); }

  app.innerHTML = `
    <p>${opts.title ? `<span class="pill rec">${esc(opts.title)}${opts.count ? ` · ${done + 1}/${opts.count}` : ''}</span> ` : ''}<span class="pill">시창 Lv${S.level} ${esc(lv.name)}</span> <span class="pill">${key.name}장조 · ${S.tempo}BPM</span></p>
    ${newTerms.length ? `<div class="card"><h2>새 용어</h2>${newTerms.map((t) => `<p><b>${esc(t.title)}</b> — ${esc(t.body)}</p>`).join('')}</div>` : ''}
    <div class="score" id="score"></div>
    <div class="big" id="big"></div>
    <canvas id="trace"></canvas>
    <p class="sub" id="msg">먼저 악보를 눈으로 읽어 보세요. 그 다음 "음계·으뜸음 듣기"로 도를 귀에 새기고 시작합니다.</p>
    <div class="row" id="ctl">
      <button id="tonic">음계·으뜸음 듣기</button>
      <button class="primary" id="start">부르기 시작</button>
    </div>
    <div class="row" style="margin-top:10px"><button id="back" class="ghost">그만하기</button></div>
    ${footer}`;

  const q = (s) => app.querySelector(s);
  const view = renderScore(q('#score'), mel, key);
  const canvas = q('#trace');
  const g2 = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = 150 * dpr;
  g2.scale(dpr, dpr);
  const CW = canvas.clientWidth;
  const CH = 150;

  let mic = null;
  let raf = 0;
  let busy = false;
  env.stop = () => { cancelAnimationFrame(raf); mic && mic.stop(); };
  q('#back').onclick = () => show(home);

  // y축: 으뜸음 기준 반음 수(-1 ~ 12). 같은 계이름이면 옥타브와 상관없이 같은 높이.
  const yOf = (semi) => CH - 14 - ((semi + 1) / 13) * (CH - 28);
  function drawBase(tNow, frames, singStart) {
    g2.clearRect(0, 0, CW, CH);
    g2.font = '11px system-ui';
    [0, 2, 4, 5, 7, 9, 11].forEach((s, i) => {
      g2.strokeStyle = '#242a36';
      g2.beginPath(); g2.moveTo(26, yOf(s)); g2.lineTo(CW, yOf(s)); g2.stroke();
      g2.fillStyle = '#6f7a8c';
      g2.fillText(SOLFEGE[i], 4, yOf(s) + 4);
    });
    const px = (beats) => 30 + (beats / total) * (CW - 40);
    mel.notes.forEach((n, i) => {
      const semi = ((midiOf(key, n.deg) - key.tonic) % 12 + 12) % 12;
      g2.fillStyle = 'rgba(255,176,32,0.35)';
      g2.fillRect(px(starts[i]) + 2, yOf(semi + 0.5), px(starts[i] + n.beats) - px(starts[i]) - 4, yOf(semi - 0.5) - yOf(semi + 0.5));
    });
    if (!frames) return;
    g2.fillStyle = '#3ecf7a';
    frames.forEach((f) => {
      const beats = (f.t - S.latency - singStart) / beat;
      if (beats < 0 || beats > total) return;
      let semi = (((f.midi - key.tonic) % 12) + 12) % 12;
      if (semi > 11) semi -= 12;
      g2.beginPath(); g2.arc(px(beats), yOf(semi), 3, 0, 7); g2.fill();
    });
  }
  drawBase();

  function setBusy(b) {
    busy = b;
    q('#tonic').disabled = b;
    q('#start').disabled = b;
  }

  q('#tonic').onclick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      ensureCtx();
      await loadPiano();
      const t = playIntro(key, beat);
      q('#msg').textContent = '마지막에 홀로 울리는 소리가 으뜸음 "도"입니다. 머릿속에 남겨 두세요.';
      await sleep((t.end - ensureCtx().currentTime) * 1000);
    } catch {
      q('#msg').textContent = '피아노 소리를 불러오지 못했습니다.';
    }
    setBusy(false);
  };

  q('#start').onclick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ctx = ensureCtx();
      await loadPiano();
      mic = await startMic(ctx);
      const cad = playIntro(key, beat);
      q('#msg').textContent = '기준음 → 카운트 → 노래하세요.';
      const t0 = cad.end + 0.2; // 카운트인 시작
      const singStart = t0 + 4 * beat;
      if (import.meta.env.DEV) window.__trial = { notes: mel.notes.map((n, i) => ({ target: midiOf(key, n.deg), start: starts[i], beats: n.beats })), singStart, beat }; // 개발 중 자동 시험용
      for (let i = 0; i < 4; i++) click(t0 + i * beat, i === 0, 0.5);
      for (let i = 0; i < total; i++) click(singStart + i * beat, i % 4 === 0, 0.22);
      const frames = [];
      const endAt = singStart + total * beat + 0.4;

      await new Promise((resolve) => {
        const tick = () => {
          const now = ctx.currentTime;
          const p = mic.read();
          if (p) frames.push(p);
          const bigEl = q('#big');
          if (now < singStart) {
            bigEl.textContent = now < t0 ? '준비' : String(4 - Math.floor((now - t0) / beat));
            view.setActive(-1);
            drawBase(now, frames, singStart);
          } else {
            const b = (now - singStart) / beat;
            const idx = starts.findIndex((s, i) => b >= s && b < s + mel.notes[i].beats);
            view.setActive(idx);
            bigEl.textContent = p ? midiName(p.midi) : '·';
            drawBase(now, frames, singStart);
          }
          if (now < endAt) raf = requestAnimationFrame(tick); else resolve();
        };
        tick();
      });
      mic.stop();
      mic = null;
      view.setActive(-1);
      q('#big').textContent = '';
      finish(frames, singStart);
    } catch (e) {
      mic && mic.stop();
      mic = null;
      q('#msg').textContent = e && e.name === 'NotAllowedError'
        ? '마이크 권한이 필요합니다. 주소창의 자물쇠 → 권한에서 마이크를 허용해 주세요.'
        : '시작하지 못했습니다: ' + (e && e.message ? e.message : e);
      setBusy(false);
    }
  };

  function finish(frames, singStart) {
    const results = scoreNotes(
      frames,
      mel.notes.map((n, i) => ({ target: midiOf(key, n.deg), start: starts[i], beats: n.beats })),
      singStart, beat, S.latency, S.octaveStrict,
    );
    results.forEach((r, i) => view.setResult(i, r.state));
    drawBase(0, frames, singStart);

    const hits = results.filter(isHit).length;
    const rate = hits / results.length;
    mel.notes.forEach((n, i) => {
      const name = degName(n.deg);
      const d = S.degree[name] || { n: 0, h: 0 };
      d.n++;
      if (isHit(results[i])) d.h++;
      S.degree[name] = d;
    });

    const note = advance(S, 'sing', rate, { sec: (Date.now() - startedAt) / 1000, err: meanAbsCents(results) });
    save(S);
    const more = opts.count && done + 1 < opts.count;
    const nextLabel = more ? `다음 문제 (${done + 2}/${opts.count})` : opts.cont ? opts.cont.label : '다음 문제';

    const rows = mel.notes.map((n, i) => {
      const r = results[i];
      return `<tr><td>${i + 1}</td><td>${degName(n.deg)}</td><td class="${isHit(r) ? 'good' : 'bad'}">${centsText(r)}</td></tr>`;
    }).join('');
    q('#msg').innerHTML = `<b>${hits}/${results.length} 적중 (${Math.round(rate * 100)}%)</b><br>${note}`;
    const panel = document.createElement('div');
    panel.innerHTML = `
      <div class="card"><table><tr><th>음</th><th>계이름</th><th>음정 차이</th></tr>${rows}</table>
      <p class="sub">±25¢ 이내 초록 · ±50¢ 이내 노랑 · 그 밖 빨강 (100¢ = 반음, ${S.octaveStrict ? '옥타브가 다르면 빨강' : '옥타브는 무시'})</p></div>
      <div class="row"><button id="hear">정답 듣기</button><button class="primary" id="next">${esc(nextLabel)}</button></div>`;
    q('#ctl').remove(); // 시작 버튼 줄 제거
    q('#msg').after(panel);
    q('#hear').onclick = async () => {
      ensureCtx();
      await loadPiano();
      playMelody(mel, key, ensureCtx().currentTime + 0.1, beat);
    };
    q('#next').onclick = () => {
      if (more) show(session, { ...opts, done: done + 1 });
      else if (opts.cont) opts.cont.fn();
      else show(session);
    };
  }
}

/* ---------------------------------------------------------------- 소리 */
function playCadence(key, beat) {
  const ctx = ensureCtx();
  const t = key.tonic;
  const chords = [[t, t + 4, t + 7], [t - 7, t - 3, t], [t - 5, t - 1, t + 2], [t, t + 4, t + 7]];
  const t0 = ctx.currentTime + 0.15;
  chords.forEach((c, i) => playChord(c, t0 + i * beat, beat * 0.95, 0.7));
  playNote(t, t0 + 4 * beat, beat * 1.9, 1); // 마지막에 으뜸음만 단독으로
  return { end: t0 + 6 * beat };
}

// 시창 시작 전 기준음: 기본은 음계 + 으뜸음, 설정에서 화음 진행(카덴스)으로 바꿀 수 있다.
function playIntro(key, beat) {
  return S.intro === 'cadence' ? playCadence(key, beat) : playScale(key);
}

function playMelody(mel, key, when, beat) {
  let t = when;
  mel.notes.forEach((n) => {
    playNote(midiOf(key, n.deg), t, n.beats * beat * 0.95, 1);
    t += n.beats * beat;
  });
}

/* ---------------------------------------------------------------- 시작 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
env.home = home;
env.rangeTest = rangeTest;
env.session = session;
show(home);
