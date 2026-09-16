const fs = require('fs');
const path = require('path');
const root = process.cwd();

function show(label, val) { console.log(label + ' = ' + val); }

const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
show('app.version', app.version);
show('app.android.versionCode', app.android.versionCode);
const pj = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
show('deps.expo-audio', pj.dependencies['expo-audio']);
show('plugins incl expo-audio', (app.plugins || []).includes('expo-audio'));
for (const f of ['src/services/soundService.ts', 'assets/sounds/error.wav']) {
  const p = path.join(root, f);
  show(f, fs.existsSync(p) ? 'EXISTE' : 'NO');
}
const wav = path.join(root, 'assets/sounds/error.wav');
if (fs.existsSync(wav)) {
  const b = fs.readFileSync(wav);
  show('error.wav bytes', b.length);
  show('RIFF/WAVE valido', b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE');
}
