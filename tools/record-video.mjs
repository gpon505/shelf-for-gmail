// Records the launch video: serves the repo, opens tools/demo.html in
// headless Chrome, injects tools/video-director.js, captures a CDP
// screencast while the director performs, then assembles MP4 + GIF with
// ffmpeg-static. Usage:
//   node tools/record-video.mjs <workdir-with-node_modules> <out-dir>
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [workdir, outdir] = process.argv.slice(2);
if (!workdir || !outdir) {
  console.error('usage: node tools/record-video.mjs <workdir> <outdir>');
  process.exit(1);
}
const require = createRequire(path.join(workdir, 'noop.js'));
const puppeteer = require('puppeteer-core');
const ffmpeg = require('ffmpeg-static');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PORT = 8129;
const server = spawn('/usr/bin/python3', ['-m', 'http.server', String(PORT)], { cwd: repo, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const framesDir = path.join(workdir, 'frames');
mkdirSync(framesDir, { recursive: true });
mkdirSync(outdir, { recursive: true });

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--window-size=1280,800', '--hide-scrollbars', '--force-device-scale-factor=1']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/tools/demo.html`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.addScriptTag({ content: readFileSync(path.join(repo, 'tools/video-director.js'), 'utf8') });

  const frames = [];
  const client = await page.createCDPSession();
  client.on('Page.screencastFrame', (frame) => {
    frames.push({ data: frame.data, ts: frame.metadata.timestamp });
    client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 });

  const t0 = Date.now();
  const log = await page.evaluate(() => window.__runDemo());
  await new Promise((r) => setTimeout(r, 400));
  await client.send('Page.stopScreencast');
  console.log('director beats:', JSON.stringify(log));
  console.log(`captured ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (frames.length < 50) throw new Error('too few frames — recording likely failed');

  // concat demuxer with real per-frame durations from screencast timestamps
  let concat = '';
  for (let i = 0; i < frames.length; i++) {
    const name = `f${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(path.join(framesDir, name), Buffer.from(frames[i].data, 'base64'));
    const dur = i + 1 < frames.length ? Math.max(0.02, frames[i + 1].ts - frames[i].ts) : 0.7;
    concat += `file '${name}'\nduration ${dur.toFixed(4)}\n`;
  }
  concat += `file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
  writeFileSync(path.join(framesDir, 'concat.txt'), concat);

  const mp4 = path.join(outdir, 'shelf-demo.mp4');
  execFileSync(ffmpeg, [
    '-y', '-f', 'concat', '-safe', '0', '-i', path.join(framesDir, 'concat.txt'),
    '-vf', 'fps=30,scale=1280:800:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', mp4
  ], { stdio: 'pipe' });

  // GIF of the build-it beats (beat2 → beat5), 800px wide.
  // Director times are page-clock; the assembled video runs on screencast
  // timestamps, which pace slightly differently — scale beat times by the
  // ratio of video duration to director duration.
  let videoDur = 0.7;
  for (let i = 0; i + 1 < frames.length; i++) videoDur += Math.max(0.02, frames[i + 1].ts - frames[i].ts);
  const endT = (log.find((l) => l.name === 'end') || {}).t / 1000;
  const startT = (log.find((l) => l.name === 'start') || {}).t / 1000;
  const scale = videoDur / (endT - startT + 1.5); // + lead-in before the director ran
  const b2 = ((log.find((l) => l.name === 'beat2') || {}).t / 1000) * scale;
  const b5 = ((log.find((l) => l.name === 'beat5') || {}).t / 1000) * scale;
  const gif = path.join(outdir, 'shelf-demo.gif');
  const palette = path.join(workdir, 'palette.png');
  execFileSync(ffmpeg, ['-y', '-ss', String(b2), '-to', String(b5), '-i', mp4,
    '-vf', 'fps=12,scale=800:-1:flags=lanczos,palettegen', palette], { stdio: 'pipe' });
  execFileSync(ffmpeg, ['-y', '-ss', String(b2), '-to', String(b5), '-i', mp4, '-i', palette,
    '-lavfi', 'fps=12,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse', gif], { stdio: 'pipe' });

  console.log('wrote', mp4, 'and', gif);
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}
