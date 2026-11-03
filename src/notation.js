import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow/bravura';
import { degName, degSemi } from './melody.js';

const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const LETTER_OF = { C: 0, G: 4, D: 1, A: 5, E: 2, F: 3, Bb: 6, Eb: 2, Ab: 5 };
const W = 720;
const H = 178;

// Written pitch ("g#/4") for a scale degree. Male voices are written in treble clef with "8vb",
// i.e. the note is printed one octave higher than it sounds.
export function vexKey(key, deg) {
  const letterIdx = LETTER_OF[key.name];
  const tonicNat = NATURAL[letterIdx];
  const tonicAcc = ((key.pc - tonicNat + 18) % 12) - 6; // -1 flat, 0 natural, +1 sharp
  const tonicOct = Math.floor((key.tonic - tonicAcc) / 12) - 1;
  const diatonic = tonicOct * 7 + letterIdx + deg;
  const idx = ((diatonic % 7) + 7) % 7;
  const oct = Math.floor(diatonic / 7);
  const pc = (((key.tonic + degSemi(deg)) % 12) + 12) % 12;
  const acc = ((pc - NATURAL[idx] + 18) % 12) - 6;
  return `${LETTERS[idx]}${acc === 1 ? '#' : acc === -1 ? 'b' : ''}/${oct + 1}`;
}

const DUR = { 1: 'q', 2: 'h' };
const SHARP_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

// 두 음(MIDI)을 높은음자리표 한 마디에 그린다. 음 간격 맞히기 정답 확인용.
export function renderPair(el, midis) {
  el.innerHTML = '';
  const renderer = new Renderer(el, Renderer.Backends.SVG);
  renderer.resize(320, 130);
  const ctx = renderer.getContext();
  const stave = new Stave(10, 20, 300);
  stave.addClef('treble');
  stave.setContext(ctx).draw();
  const notes = midis.map((m) => {
    const name = SHARP_NAMES[((m % 12) + 12) % 12];
    const n = new StaveNote({ keys: [`${name}/${Math.floor(m / 12) - 1}`], duration: 'q' });
    if (name.includes('#')) n.addModifier(new Accidental('#'), 0);
    return n;
  });
  const voice = new Voice({ numBeats: 2, beatValue: 4 }).addTickables(notes);
  new Formatter().joinVoices([voice]).format([voice], 180);
  voice.draw(ctx, stave);
  const svg = el.querySelector('svg');
  svg.setAttribute('viewBox', '0 0 320 130');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '100%';
  svg.style.maxWidth = '420px';
  svg.style.height = 'auto';
}

// Draws the melody into `el` and returns helpers to highlight and colour single notes.
export function renderScore(el, mel, key) {
  el.innerHTML = '';
  const renderer = new Renderer(el, Renderer.Backends.SVG);
  renderer.resize(W, H);
  const ctx = renderer.getContext();

  // split notes into bars of 4 beats
  const bars = [];
  let cur = [];
  let beats = 0;
  mel.notes.forEach((n, i) => {
    cur.push({ ...n, i });
    beats += n.beats;
    if (beats >= 4) {
      bars.push(cur);
      cur = [];
      beats = 0;
    }
  });

  const widths = bars.length === 1 ? [W - 20] : [400, W - 20 - 400];
  const noteEls = []; // { x, label }
  let x = 10;
  bars.forEach((bar, b) => {
    const stave = new Stave(x, 30, widths[b]);
    if (b === 0) stave.addClef('treble', 'default', '8vb').addKeySignature(key.name).addTimeSignature('4/4');
    stave.setContext(ctx).draw();
    const notes = bar.map((n) => new StaveNote({ keys: [vexKey(key, n.deg)], duration: DUR[n.beats], clef: 'treble' }));
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables(notes);
    Accidental.applyAccidentals([voice], key.name);
    new Formatter().joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 20);
    voice.draw(ctx, stave);
    bar.forEach((n, j) => noteEls[n.i] = { x: notes[j].getAbsoluteX() + 7, y: stave.getYForLine(4) + 52 });
    x += widths[b];
  });

  const svg = el.querySelector('svg');
  const NS = 'http://www.w3.org/2000/svg';
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '100%';
  svg.style.height = 'auto';

  const hi = [];
  const labels = [];
  mel.notes.forEach((n, i) => {
    const { x: nx, y } = noteEls[i];
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', nx - 20);
    rect.setAttribute('y', 18);
    rect.setAttribute('width', 40);
    rect.setAttribute('height', y - 8);
    rect.setAttribute('rx', 8);
    rect.setAttribute('fill', 'rgba(255,170,0,0.28)');
    rect.setAttribute('opacity', '0');
    svg.insertBefore(rect, svg.firstChild);
    hi.push(rect);

    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', nx);
    t.setAttribute('y', y);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', '22');
    t.setAttribute('font-weight', '700');
    t.setAttribute('fill', '#2a2f3a');
    t.textContent = degName(n.deg);
    svg.appendChild(t);
    labels.push(t);
  });

  return {
    setActive(i) {
      hi.forEach((r, k) => r.setAttribute('opacity', k === i ? '1' : '0'));
    },
    setResult(i, state) {
      labels[i].setAttribute('fill', state === 'good' ? '#1a9a52' : state === 'ok' ? '#c98a00' : '#d23b3b');
    },
    showLabels(on) {
      labels.forEach((t) => t.setAttribute('opacity', on ? '1' : '0'));
    },
  };
}
