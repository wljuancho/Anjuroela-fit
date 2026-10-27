const fs = require('node:fs');

const sampleRate = 22050;

function writeTone(file, parts) {
  const samples = [];
  for (const part of parts) {
    const count = Math.floor((sampleRate * part.ms) / 1000);
    for (let index = 0; index < count; index += 1) {
      const fade = Math.min(1, index / 220, (count - index) / 220);
      const sample = Math.max(0, fade) * Math.sin((2 * Math.PI * part.hz * index) / sampleRate) * 0.72;
      samples.push(sample);
    }
    const silence = Math.floor((sampleRate * (part.gap ?? 0)) / 1000);
    for (let index = 0; index < silence; index += 1) samples.push(0);
  }

  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => {
    data.writeInt16LE(Math.round(sample * 32767), index * 2);
  });

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

writeTone('assets/sounds/alarm-digital.wav', [
  { hz: 880, ms: 140, gap: 80 },
  { hz: 880, ms: 140 },
]);
writeTone('assets/sounds/alarm-classic.wav', [
  { hz: 740, ms: 180, gap: 75 },
  { hz: 980, ms: 180, gap: 75 },
  { hz: 740, ms: 300 },
]);
