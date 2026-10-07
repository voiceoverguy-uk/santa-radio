// Local diagnostic: no submitted names, input paths or contact data in its output.
// Usage: node scripts/profile-santa-render.mjs [renderer|prepared|unprepared] [single|parallel] [cpu] [addressSpaceMiB]
// Optional address-space limit is NOT a resident-memory/hosting simulation.
import { spawn, spawnSync } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { renderArgs } from './santa-audio-filters.mjs';
const [renderer = 'scripts/render-santa-message.mjs', mode = 'single', cpu, memoryMiB] = process.argv.slice(2);
const dir = await mkdtemp(join(tmpdir(), 'santa-profile-'));
const count = mode === 'parallel' ? 2 : 1;
const started = performance.now();
try {
  const results = await Promise.all(Array.from({ length: count }, (_, index) => new Promise(resolveResult => {
    const prepared = renderer === 'prepared';
    const direct = prepared || renderer === 'unprepared';
    const audioArgs = direct ? renderArgs(
      resolve(prepared ? 'server/santa-audio/prepared/intro.wav' : 'server/santa-audio/free-intro.wav'),
      resolve('server/santa-audio/names/arabella.wav'),
      resolve(prepared ? 'server/santa-audio/prepared/outro.wav' : 'server/santa-audio/free-outro.wav'),
      resolve('server/santa-audio/sleighbells.mp3'), join(dir, `${index}.mp3`), prepared) : null;
    const args = direct ? audioArgs : [resolve(renderer), resolve('server/santa-audio/free-intro.wav'),
      resolve('server/santa-audio/names/arabella.wav'), resolve('server/santa-audio/free-outro.wav'),
      resolve('server/santa-audio/sleighbells.mp3'), join(dir, `${index}.mp3`), ffmpeg];
    let executable = direct ? ffmpeg : process.execPath;
    let commandArgs = args;
    if (memoryMiB !== undefined) {
      commandArgs = [`--as=${Number(memoryMiB) * 1024 * 1024}`, '--', executable, ...commandArgs];
      executable = 'prlimit';
    }
    if (cpu !== undefined) { commandArgs = ['-c', cpu, executable, ...commandArgs]; executable = 'taskset'; }
    const child = spawn(executable, commandArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    let peakRssKb = 0, peakThreads = 0;
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000); });
    const sample = setInterval(async () => {
      try {
        // Some constrained runtimes omit /proc/PID/task/PID/children.
        const children = spawnSync('ps', ['--ppid', String(child.pid), '-o', 'pid='], { encoding: 'utf8' }).stdout;
        for (const pid of [child.pid, ...children.trim().split(/\s+/).filter(Boolean)]) {
          const status = await readFile(`/proc/${pid}/status`, 'utf8');
          peakRssKb = Math.max(peakRssKb, Number(status.match(/VmHWM:\s+(\d+)/)?.[1] || 0));
          peakThreads = Math.max(peakThreads, Number(status.match(/Threads:\s+(\d+)/)?.[1] || 0));
        }
      } catch {}
    }, 50);
    const timer = setTimeout(() => {
      // Kill descendants, not only the Node wrapper.
      const children = spawnSync('ps', ['--ppid', String(child.pid), '-o', 'pid='], { encoding: 'utf8' }).stdout;
      for (const pid of children.trim().split(/\s+/).filter(Boolean)) {
        try { process.kill(Number(pid), 'SIGKILL'); } catch {}
      }
      child.kill('SIGKILL');
    }, 90000);
    child.on('close', (code, signal) => {
      clearInterval(sample); clearTimeout(timer);
      resolveResult({ code, signal, elapsedMs: Math.round(performance.now() - started), peakRssKb, peakThreads,
        speed: stderr.match(/speed=\s*(\S+)/g)?.at(-1) ?? null });
    });
    child.on('error', () => { clearInterval(sample); clearTimeout(timer); resolveResult({ code: 'SPAWN_FAILED' }); });
  })));
  console.log(JSON.stringify({ prepared: renderer === 'prepared', mode, constrainedCpu: cpu !== undefined,
    addressSpaceMiB: memoryMiB === undefined ? null : Number(memoryMiB), results }, null, 2));
  if (results.some(result => result.code !== 0)) process.exitCode = 1;
} finally { await rm(dir, { recursive: true, force: true }); }
