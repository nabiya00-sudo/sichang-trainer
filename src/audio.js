const SAMPLES = [
  ['C3', 48], ['Ds3', 51], ['Fs3', 54], ['A3', 57],
  ['C4', 60], ['Ds4', 63], ['Fs4', 66], ['A4', 69],
  ['C5', 72], ['Ds5', 75],
];

let ctx = null;
let master = null;
const buffers = [];
let loading = null;

// Must be called from inside a tap/click handler so mobile browsers allow sound.
export function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // The Salamander samples are recorded quietly: boost, then compress so chords do not clip.
    master = ctx.createGain();
    master.gain.value = 3.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function loadPiano() {
  if (loading) return loading;
  const c = ensureCtx();
  loading = Promise.all(
    SAMPLES.map(async ([name, midi]) => {
      const res = await fetch(`${import.meta.env.BASE_URL}audio/piano/${name}.mp3`);
      const data = await res.arrayBuffer();
      buffers.push({ midi, buf: await c.decodeAudioData(data) });
    }),
  ).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

function nearest(midi) {
  return buffers.reduce((best, b) => (Math.abs(b.midi - midi) < Math.abs(best.midi - midi) ? b : best));
}

// Plays one piano note at audio-clock time `when`.
export function playNote(midi, when, dur = 0.9, vel = 1) {
  const c = ensureCtx();
  const { midi: base, buf } = nearest(midi);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 2 ** ((midi - base) / 12);
  const g = c.createGain();
  g.gain.setValueAtTime(vel, when);
  g.gain.setTargetAtTime(0, when + dur, 0.15 / 3);
  src.connect(g);
  g.connect(master);
  src.start(when);
  src.stop(when + dur + 0.6);
}

export function playChord(midis, when, dur = 0.9, vel = 0.7) {
  midis.forEach((m) => playNote(m, when, dur, vel));
}

// Short metronome tick; accent = louder and higher.
export function click(when, accent = false, vol = 0.35) {
  const c = ensureCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.value = accent ? 1500 : 1000;
  g.gain.setValueAtTime(vol * (accent ? 1 : 0.7), when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(when);
  osc.stop(when + 0.08);
}
