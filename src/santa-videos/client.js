import { ageCaptionPng } from './ageCaption.js';
import { setupSiblings } from './siblings.js';
import { videoRequest } from './request.js';
import { setupPlanning } from './planning.js';
import { setupNamePicker } from './namePicker.js';
import { nameCaptionPng } from './nameCaption.js';
import { stitchArguments, outputDuration } from './arguments.js';
import { HISTORY_KEY, validHistory, averageTimes } from './history.js';

const el = id => document.getElementById(id);
let selected, audioURL, outputURL, active;
let history = [];
try { history = validHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')); } catch { /* Keep an in-memory history if storage is unavailable. */ }
const seconds = milliseconds => `${(milliseconds / 1000).toFixed(1)}s`;
function renderHistory() {
  const average = averageTimes(history);
  el('average-stitch').textContent = average.count ? seconds(average.stitchingMs) : '—';
  el('average-total').textContent = average.count ? seconds(average.totalMs) : '—';
  for (const [mode, id] of [[true, 'average-bells-on'], [false, 'average-bells-off']]) {
    const result = averageTimes(history.filter(row => row.bells === mode));
    el(id).textContent = result.count ? `${seconds(result.stitchingMs)} (${result.count})` : '—';
  }
  const withName = averageTimes(history.filter(row => row.nameCaption));
  el('average-with-name').textContent = withName.count ? `${seconds(withName.stitchingMs)} (${withName.count})` : '—';
  el('history-count').textContent = average.count ? `Based on ${average.count} completed ${average.count === 1 ? 'build' : 'builds'}.` : 'No completed builds yet.';
  el('history-table').hidden = !average.count; el('clear-history').disabled = !average.count;
  el('history-rows').replaceChildren();
  for (const record of [...history].reverse()) {
    const row = document.createElement('tr');
    const name = document.createElement('td'); name.textContent = record.name;
    const mode = document.createElement('span'); mode.className = 'history-mode'; mode.textContent = `${record.bells ? 'Bells on' : 'Bells off'}${record.nameCaption ? ` · ${record.nameCaption}` : ''}`; name.append(mode);
    const stitch = document.createElement('td'); stitch.textContent = seconds(record.stitchingMs);
    const total = document.createElement('td'); total.textContent = seconds(record.totalMs);
    row.append(name, stitch, total); el('history-rows').append(row);
  }
}
function saveHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
  catch { el('history-storage').textContent = 'History is available for this visit only because browser storage is unavailable.'; }
  renderHistory();
}
renderHistory();
el('clear-history').addEventListener('click', () => { history = []; saveHistory(); });
function timer(milliseconds) {
  const tenths = Math.floor(milliseconds / 100);
  return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
}
function progress(stage, percent = null) {
  el('stage').textContent = stage;
  if (percent === null) el('progress').removeAttribute('value');
  else el('progress').value = Math.max(0, Math.min(100, percent));
  el('percent').textContent = percent === null ? 'Working…' : `${Math.floor(percent)}%`;
}
function error(message) { el('error').textContent = message; el('error').hidden = !message; }
function clearOutput() {
  el('video-preview').pause(); el('video-preview').removeAttribute('src'); el('video-preview').load();
  el('download').removeAttribute('href'); el('result').hidden = true;
  if (outputURL) URL.revokeObjectURL(outputURL);
  outputURL = null;
}
function choose(files) {
  if (active) return;
  error('');
  const file = files[0];
  if (!file) return;
  if (files.length !== 1 || !/\.mp3$/i.test(file.name) || file.size === 0 || file.size > 30 * 1024 * 1024) {
    error('Choose one non-empty MP3 file, up to 30 MB.'); return;
  }
  selected = file;
  clearOutput();
  if (audioURL) URL.revokeObjectURL(audioURL);
  audioURL = URL.createObjectURL(file);
  el('audio-preview').src = audioURL; el('audio-preview').hidden = false;
  el('file-info').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
  el('create').disabled = false;
  el('timer').textContent = '00:00.0';
  for (const id of ['preparation', 'stitching', 'finishing']) el(id).textContent = '—';
  progress('Ready to create', 0); el('status').textContent = 'Your MP3 is ready. Click Create video to start the timer.';
}
function durationOf(file, signal) {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    const clean = () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); };
    const fail = message => { clean(); reject(new Error(message)); };
    const abort = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timeout = setTimeout(() => fail('Could not read this MP3. Check it plays correctly and try again.'), 20000);
    signal.addEventListener('abort', abort, { once: true });
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      try { stitchArguments(duration); } catch (e) { fail(e.message); return; }
      clean(); resolve(duration);
    };
    audio.onerror = () => fail('This file could not be read as audio. Please choose a valid MP3.');
    audio.preload = 'metadata'; audio.src = url;
  });
}
async function sourceAsset(asset, label, signal) {
  // Bounded ranges also fit serverless response limits; every range is authenticated.
  const chunks = [];
  let offset = 0, total = Infinity;
  while (offset < total) {
    const response = await videoRequest(asset, {
      credentials: 'same-origin', signal, headers: { Range: `bytes=${offset}-${offset + 2 * 1024 * 1024 - 1}` },
    });
    if (!response.ok) throw new Error(`The ${label} could not be loaded. Reload the page and try again.`);
    const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '');
    if (response.status !== 206 || !range || Number(range[1]) !== offset) throw new Error(`The ${label} returned an unexpected response.`);
    total = Number(range[3]);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== Number(range[2]) - offset + 1 || !bytes.length) throw new Error(`The ${label} download was interrupted. Please try again.`);
    chunks.push(bytes); offset += bytes.length;
    progress(`Loading ${label}`, offset / total * 100);
  }
  const result = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) { result.set(chunk, position); position += chunk.length; }
  return result;
}
const planner = setupPlanning(() => { if (!active) clearOutput(); });
const siblings = setupSiblings(() => { clearOutput(); });
const namePicker = setupNamePicker(() => {
  planner.setName(namePicker.value);
  if (active) return;
  clearOutput(); error(''); progress('Ready to create', 0); el('timer').textContent = '00:00.0';
  for (const id of ['preparation', 'stitching', 'finishing']) el(id).textContent = '—';
  el('status').textContent = selected ? 'Name settings updated. Click Create video when ready.' : 'Choose an MP3 to start.';
});
async function create() {
  if (!selected || active) return;
  if (namePicker.hasUnselectedQuery) { error('Choose a name from the live list, or remove it to create without a name.'); namePicker.focus(); return; }
  const captionName = namePicker.value;
  const captionAge = planner.age;
  if (siblings.pending) { error('Press Enter or Add to include the sibling name you have typed.'); siblings.focus(); return; }
  const siblingNames = siblings.value;
  if (siblingNames.length && !captionName) { error('Choose the main name before adding siblings to the video.'); namePicker.focus(); return; }
  const file = selected;
  const sleighbells = el('bells').checked;
  const job = { controller: new AbortController(), started: performance.now(), ffmpeg: null };
  active = job;
  const signal = job.controller.signal;
  clearOutput(); error(''); el('audio-preview').pause();
  el('create').disabled = true; el('audio-file').disabled = true; el('bells').disabled = true; namePicker.setDisabled(true); siblings.setDisabled(true); planner.setDisabled(true); el('cancel').hidden = false;
  for (const id of ['preparation', 'stitching', 'finishing']) el(id).textContent = '—';
  const tick = () => { el('timer').textContent = timer(performance.now() - job.started); };
  tick(); const interval = setInterval(tick, 100);
  let phase = 'preparation', phaseStarted = job.started, stitchingMs = 0;
  try {
    progress('Checking your MP3'); el('status').textContent = 'Preparing the video maker. Your MP3 stays on this device.';
    const audioDuration = await durationOf(file, signal);
    const duration = outputDuration(audioDuration);
    signal.throwIfAborted();
    progress('Loading video tools');
    const [{ FFmpeg }, { default: coreURL }, { default: wasmURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'), import('@ffmpeg/core?url'), import('@ffmpeg/core/wasm?url'),
    ]);
    signal.throwIfAborted();
    job.ffmpeg = new FFmpeg();
    await job.ffmpeg.load({ coreURL, wasmURL });
    signal.throwIfAborted();
    const video = await sourceAsset('source', 'Santa’s video', signal);
    await job.ffmpeg.writeFile('source.mp4', video);
    if (sleighbells) await job.ffmpeg.writeFile('bells.mp3', await sourceAsset('bells', 'sleighbells', signal));
    await job.ffmpeg.writeFile('audio.mp3', new Uint8Array(await file.arrayBuffer()));
    if (captionName) {
      await job.ffmpeg.writeFile('name.png', await nameCaptionPng(captionName, false, siblingNames));
      await job.ffmpeg.writeFile('name-second.png', await nameCaptionPng(captionName, true, siblingNames));
    }
    if (captionAge) await job.ffmpeg.writeFile('age.png', await ageCaptionPng(captionAge));
    signal.throwIfAborted();
    el('preparation').textContent = seconds(performance.now() - phaseStarted);
    phase = 'stitching'; phaseStarted = performance.now();
    progress('Stitching your video', 0); el('status').textContent = sleighbells ? 'Mixing Santa’s audio, your MP3 and sleighbells. Keep this tab open.' : 'Mixing your MP3 with Santa’s original audio. Keep this tab open.';
    if (captionName) el('status').textContent = `Rendering ${captionName} on the parchment at 0:11–0:17 and again at 1:24–1:30. This takes longer than audio-only stitching.`;
    let lastPercent = 0;
    job.ffmpeg.on('progress', ({ time }) => {
      if (signal.aborted || phase !== 'stitching') return;
      lastPercent = Math.max(lastPercent, Math.min(99, time / 1000000 / duration * 100));
      progress('Stitching your video', lastPercent);
    });
    const code = await job.ffmpeg.exec(stitchArguments(audioDuration, sleighbells, !!captionName, !!captionAge));
    if (code !== 0) throw new Error('The video could not be created. Check your MP3 plays correctly, or try a shorter recording.');
    signal.throwIfAborted();
    stitchingMs = performance.now() - phaseStarted;
    el('stitching').textContent = seconds(stitchingMs);
    phase = 'finishing'; phaseStarted = performance.now();
    progress('Finishing your MP4'); el('status').textContent = 'Preparing the finished video for playback and download.';
    const bytes = await job.ffmpeg.readFile('output.mp4');
    signal.throwIfAborted();
    const blob = new Blob([bytes], { type: 'video/mp4' });
    outputURL = URL.createObjectURL(blob);
    el('video-preview').src = outputURL;
    el('download').href = outputURL;
    el('download').download = `${file.name.replace(/\.mp3$/i, '')}-santa-video.mp4`;
    el('finishing').textContent = seconds(performance.now() - phaseStarted);
    const totalMs = performance.now() - job.started;
    el('summary').textContent = `Created in ${seconds(totalMs)} total · ${duration.toFixed(1)} seconds of video · ${(blob.size / 1024 / 1024).toFixed(1)} MB · Sleighbells ${sleighbells ? 'on' : 'off'}${captionName ? ` · Name: ${captionName}` : ''}${siblingNames.length ? ` · Siblings: ${siblingNames.join(', ')}` : ''}${captionAge ? ` · Age: ${captionAge.label}` : ''}`;
    history = validHistory([...history, { name: file.name, bells: sleighbells, stitchingMs, totalMs, nameCaption: captionName }]);
    saveHistory();
    el('result').hidden = false;
    progress('Complete', 100); el('status').textContent = 'Your video is ready to play and download.';
  } catch (e) {
    el(phase).textContent = `${seconds(performance.now() - phaseStarted)} (stopped)`;
    progress(signal.aborted ? 'Cancelled' : 'Stopped', 0);
    el('status').textContent = signal.aborted ? 'Cancelled. Your MP3 is ready to try again.' : 'The build stopped. You can try again.';
    if (!signal.aborted) error(e.message || 'The video maker could not finish. Try again with a shorter MP3.');
  } finally {
    clearInterval(interval); tick(); job.ffmpeg?.terminate(); active = null;
    el('create').disabled = !selected; el('audio-file').disabled = false; el('bells').disabled = false; namePicker.setDisabled(false); siblings.setDisabled(false); planner.setDisabled(false); el('cancel').hidden = true;
  }
}
el('audio-file').addEventListener('change', e => choose(e.target.files));
el('drop').addEventListener('dragover', e => e.preventDefault());
el('drop').addEventListener('drop', e => { e.preventDefault(); choose(e.dataTransfer.files); });
el('bells').addEventListener('change', () => {
  clearOutput(); error(''); progress('Ready to create', 0); el('timer').textContent = '00:00.0';
  for (const id of ['preparation', 'stitching', 'finishing']) el(id).textContent = '—';
  el('status').textContent = selected ? 'Sound settings updated. Click Create video to start.' : 'Choose an MP3 to start.';
});
el('create').addEventListener('click', create);
el('cancel').addEventListener('click', () => {
  if (!active) return;
  active.controller.abort(); active.ffmpeg?.terminate();
});
window.addEventListener('beforeunload', () => { active?.controller.abort(); active?.ffmpeg?.terminate(); });
