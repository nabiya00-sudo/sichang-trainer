import './style.css';
import { load, save, exportJson, importJson } from './store.js';
import { ensureCtx, loadPiano, playNote, playChord, click } from './audio.js';
import { startMic, midiName, median, foldedDiff } from './pitch.js';
import { LEVELS, generate, chooseKey, midiOf, degName, SOLFEGE } from './melody.js';
import { renderScore } from './notation.js';
import { TERMS, termsUpTo, termsAt } from './terms.js';

const app = document.getElementById('app');
let S = load();
let stopCurrent = null; // cleanup hook of the active screen (mic, animation frames)

const ATTRIBUTION = 'Piano: Salamander Grand Piano (Alexander Holm, CC BY 3.0)';
const footer = `<footer>${ATTRIBUTION}</footer>`;

function show(fn, ...args) {
  if (stopCurrent) stopCurrent();
  stopCurrent = null;
  window.scrollTo(0, 0);
  fn(...args);
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- 홈 */
function home() {
  const lv = LEVELS[S.level - 1];
  const recent = S.history.slice(-10);
  const avg = recent.length ? Math.round((recent.reduce((a, h) => a + h.rate, 0) / recent.length) * 100) : null;
  app.innerHTML = `
    <h1>시창 트레이너</h1>
    <div class="card">
      <span class="pill">현재 레벨 ${S.level} / ${LEVELS.length}</span>
      <h2 style="margin-top:8px">${esc(lv.name)}</h2>
      <p class="sub">최근 ${recent.length}회 평균 적중률 ${avg === null ? '-' : avg + '%'} · 연속 성공 ${S.streak}/2</p>
      <p class="sub">내 음역: ${midiName(S.range.low)} ~ ${midiName(S.range.high)} ${S.rangeMeasured ? '' : '(기본값 — 먼저 음역 측정을 권장)'}</p>
    </div>
    <div class="row">
      <button class="primary" id="go">시창 시작</button>
      <button id="range">음역 측정</button>
    </div>
    <div class="row" style="margin-top:10px">
      <button id="terms">용어 사전</button>
      <button id="stats">기록</button>
    </div>
    <div class="card">
      <h2>설정</h2>
      <label>속도: <b id="tv">${S.tempo}</b> BPM</label>
      <input type="range" id="tempo" min="44" max="100" value="${S.tempo}" />
      <label>마이크 지연 보정: <b id="lv">${Math.round(S.latency * 1000)}</b> ms (결과가 계속 늦게/빨리 나오면 조정)</label>
      <input type="range" id="lat" min="0" max="400" step="10" value="${Math.round(S.latency * 1000)}" />
      <div class="row" style="margin-top:12px">
        <button id="exp" class="ghost">기록 백업(내보내기)</button>
        <button id="imp" class="ghost">백업 불러오기</button>
      </div>
      <input type="file" id="file" accept="application/json" hidden />
    </div>
    <p class="sub">이어폰을 끼고 연습하면 피아노 소리가 마이크에 섞이지 않아 정확합니다.</p>
    ${footer}`;
  app.querySelector('#go').onclick = () => show(session);
  app.querySelector('#range').onclick = () => show(rangeTest);
  app.querySelector('#terms').onclick = () => show(termsScreen);
  app.querySelector('#stats').onclick = () => show(statsScreen);
  app.querySelector('#tempo').oninput = (e) => {
    S.tempo = +e.target.value;
    app.querySelector('#tv').textContent = S.tempo;
    save(S);
  };
  app.querySelector('#lat').oninput = (e) => {
    S.latency = +e.target.value / 1000;
    app.querySelector('#lv').textContent = e.target.value;
    save(S);
  };
  app.querySelector('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportJson(S)], { type: 'application/json' }));
    a.download = `sichang-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const file = app.querySelector('#file');
  app.querySelector('#imp').onclick = () => file.click();
  file.onchange = async () => {
    try {
      S = importJson(await file.files[0].text());
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
    <p class="sub">레벨이 오르면 새 용어가 열립니다. (잠긴 용어 ${locked}개)</p>
    ${open.map((t) => `<div class="card"><h2>${esc(t.title)}</h2><p>${esc(t.body)}</p></div>`).join('')}
    <button id="back">홈으로</button>${footer}`;
  app.querySelector('#back').onclick = () => show(home);
}

/* ---------------------------------------------------------------- 기록 */
function statsScreen() {
  const rows = SOLFEGE.map((n) => {
    const d = S.degree[n] || { n: 0, h: 0 };
    const pct = d.n ? Math.round((d.h / d.n) * 100) : null;
    return `<div>${n}</div><div class="bar"><i style="width:${pct ?? 0}%"></i></div><div class="sub">${pct === null ? '-' : pct + '%'}</div>`;
  }).join('');
  const hist = S.history.slice(-15).reverse()
    .map((h) => `<tr><td>${new Date(h.t).toLocaleDateString('ko-KR')}</td><td>Lv${h.level}</td><td>${Math.round(h.rate * 100)}%</td></tr>`)
    .join('');
  app.innerHTML = `
    <h1>기록</h1>
    <div class="card"><h2>계이름별 적중률 (약점 확인)</h2><div class="grid">${rows}</div></div>
    <div class="card"><h2>최근 연습</h2>
      ${hist ? `<table><tr><th>날짜</th><th>레벨</th><th>적중</th></tr>${hist}</table>` : '<p class="sub">아직 기록이 없습니다.</p>'}
    </div>
    <button id="back">홈으로</button>${footer}`;
  app.querySelector('#back').onclick = () => show(home);
}

/* ---------------------------------------------------------------- 음역 측정 */
function rangeTest() {
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
  stopCurrent = () => { cancelAnimationFrame(raf); mic && mic.stop(); };

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
    show(home);
  };
  app.querySelector('#back').onclick = () => show(home);
}

/* ---------------------------------------------------------------- 시창 */
function session() {
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
    <p><span class="pill">Lv${S.level} ${esc(lv.name)}</span> <span class="pill">${key.name}장조 · ${S.tempo}BPM</span></p>
    ${newTerms.length ? `<div class="card"><h2>새 용어</h2>${newTerms.map((t) => `<p><b>${esc(t.title)}</b> — ${esc(t.body)}</p>`).join('')}</div>` : ''}
    <div class="score" id="score"></div>
    <div class="big" id="big"></div>
    <canvas id="trace"></canvas>
    <p class="sub" id="msg">먼저 악보를 눈으로 읽어 보세요. 그 다음 "으뜸음 듣기"로 도를 귀에 새기고 시작합니다.</p>
    <div class="row" id="ctl">
      <button id="tonic">으뜸음 듣기</button>
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
  stopCurrent = () => { cancelAnimationFrame(raf); mic && mic.stop(); };
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
      const t = playCadence(key, beat);
      q('#msg').textContent = '도-파-솔-도 … 마지막 소리가 으뜸음 "도"입니다. 머릿속에 남겨 두세요.';
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
      const cad = playCadence(key, beat);
      q('#msg').textContent = '카덴스 → 카운트 → 노래하세요.';
      const t0 = cad.end + 0.2; // 카운트인 시작
      const singStart = t0 + 4 * beat;
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
    const results = mel.notes.map((n, i) => {
      const target = midiOf(key, n.deg);
      const from = singStart + (starts[i] + 0.3 * n.beats) * beat;
      const to = singStart + (starts[i] + n.beats * 0.95) * beat;
      const ds = frames
        .filter((f) => f.t - S.latency >= from && f.t - S.latency <= to)
        .map((f) => foldedDiff(f.midi, target));
      if (ds.length < 3) return { cents: null, state: 'miss' };
      const cents = Math.round(median(ds) * 100);
      const a = Math.abs(cents);
      return { cents, state: a <= 25 ? 'good' : a <= 50 ? 'ok' : 'miss' };
    });
    results.forEach((r, i) => view.setResult(i, r.state));
    drawBase(0, frames, singStart);

    const hits = results.filter((r) => r.state !== 'miss').length;
    const rate = hits / results.length;
    mel.notes.forEach((n, i) => {
      const name = degName(n.deg);
      const d = S.degree[name] || { n: 0, h: 0 };
      d.n++;
      if (results[i].state !== 'miss') d.h++;
      S.degree[name] = d;
    });

    const before = S.level;
    let note = '';
    if (rate >= 0.8) {
      S.streak++;
      if (S.streak >= 2 && S.level < LEVELS.length) { S.level++; S.streak = 0; note = `🎉 2회 연속 성공! 레벨 ${S.level}로 올라갑니다.`; }
      else if (S.level >= LEVELS.length) note = '최고 레벨에서 안정적입니다.';
      else note = `성공! 한 번 더 성공하면 레벨이 올라갑니다. (${S.streak}/2)`;
    } else if (rate < 0.5) {
      S.streak = 0;
      if (S.level > 1) { S.level--; note = `레벨 ${S.level}로 내려가 기초를 다집니다.`; }
      else note = '천천히 다시 해 봐요. 으뜸음 듣기를 충분히 활용하세요.';
    } else {
      S.streak = 0;
      note = '거의 다 왔어요. 같은 레벨에서 다시 도전합니다.';
    }
    S.history.push({ t: Date.now(), level: before, rate });
    S.history = S.history.slice(-300);
    save(S);

    const rows = mel.notes.map((n, i) => {
      const r = results[i];
      const c = r.cents === null ? '소리 없음' : `${r.cents > 0 ? '+' : ''}${r.cents}¢ ${r.cents > 0 ? '(높음)' : r.cents < 0 ? '(낮음)' : ''}`;
      return `<tr><td>${i + 1}</td><td>${degName(n.deg)}</td><td class="${r.state === 'miss' ? 'bad' : 'good'}">${c}</td></tr>`;
    }).join('');
    q('#msg').innerHTML = `<b>${hits}/${results.length} 적중 (${Math.round(rate * 100)}%)</b><br>${note}`;
    const panel = document.createElement('div');
    panel.innerHTML = `
      <div class="card"><table><tr><th>음</th><th>계이름</th><th>음정 차이</th></tr>${rows}</table>
      <p class="sub">±25¢ 이내 초록 · ±50¢ 이내 노랑 · 그 밖 빨강 (100¢ = 반음, 옥타브는 무시)</p></div>
      <div class="row"><button id="hear">정답 듣기</button><button class="primary" id="next">다음 문제</button></div>`;
    q('#ctl').remove(); // 시작 버튼 줄 제거
    q('#msg').after(panel);
    q('#hear').onclick = async () => {
      ensureCtx();
      await loadPiano();
      playMelody(mel, key, ensureCtx().currentTime + 0.1, beat);
    };
    q('#next').onclick = () => show(session);
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
show(home);
