const fs = require('fs');
const path = require('path');
const root = process.cwd();

function ok(label, val) { console.log((val ? 'OK ' : '-- ') + label + (val && typeof val !== 'boolean' ? ': ' + val : '')); }

ok('app.json version', JSON.parse(fs.readFileSync(path.join(root, 'app.json'))).expo.version);
ok('app.json androidVersionCode', JSON.parse(fs.readFileSync(path.join(root, 'app.json'))).expo.android.versionCodeonge);
const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok('gradle versionCode', (g.match(/versionCode (\d+)/) || [])[1]);
ok('gradle versionName', (g.match(/versionName "([^"]+)"/) || [])[1]);
const pj = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
ok('expo-audio dep', pj.dependencies['expo-audio']);
const aj = JSON.parse(fs.readFileSync(path.join(root, 'app.json')));
ok('plugin expo-audio', (aj.expo.plugins || []).includes('expo-audio'));
ok('soundService.ts exists', fs.existsSync(path.join(root, 'src/services/soundService.ts')));
ok('error.wav exists', fs.existsSync(path.join(root, 'assets/sounds/error.wav')));
const wav = path.join(root, 'assets/sounds/error.wav');
if (fs.existsSync(wav)) {
  const b = fs.readFileSync(wav);
  ok('error.wav size', b.length);
  ok('error.wav RIFF/WAVE', b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE');
}
