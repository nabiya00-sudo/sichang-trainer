import { PitchDetector } from 'pitchy';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiName(m) {
  const r = Math.round(m);
  return `${NOTE_NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
}

// Opens the microphone with all voice processing off (it would distort pitch).
export async function startMic(ctx) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096; // long enough for low male notes (~65 Hz)
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const detector = PitchDetector.forFloat32Array(analyser.fftSize);

  return {
    // Returns { midi, clarity, t } for the newest audio, or null when silent / not a clear pitch.
    read() {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      if (rms < 0.006) return null;
      const [hz, clarity] = detector.findPitch(buf, ctx.sampleRate);
      if (clarity < 0.9 || hz < 60 || hz > 1100) return null;
      return { midi: 69 + 12 * Math.log2(hz / 440), clarity, t: ctx.currentTime };
    },
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      src.disconnect();
    },
  };
}

export function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// Signed distance in semitones from `target` to `midi`, ignoring octave: result in [-6, 6).
export function foldedDiff(midi, target) {
  return ((((midi - target + 6) % 12) + 12) % 12) - 6;
}
