import {useEffect, useRef, useState} from 'react';

export function formatMoment(seconds) {
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

export function parseMoments(text, duration) {
  const tokens = text.trim().split(/[\s,]+/).filter(Boolean);
  const times = tokens.map(token => {
    if (!/^\d{1,4}:[0-5]\d$/.test(token)) throw new Error('Use minutes and seconds, for example 0:12 or 1:26.');
    const [minutes, seconds] = token.split(':').map(Number);
    const time = minutes * 60 + seconds;
    if (time > 359999 || (Number.isFinite(duration) && time >= duration)) throw new Error(token + ' is beyond the playable recording.');
    return time;
  });
  const sorted = [...new Set(times)].sort((a, b) => a - b);
  if (sorted.length > 200) throw new Error('Use up to 200 moments per example.');
  return sorted;
}

export default function DemoMomentEditor({src, value, onChange, busy}) {
  const video = useRef(null);
  const field = useRef(null);
  const [duration, setDuration] = useState(NaN);
  let times = [], error = '';
  try { times = parseMoments(value, duration); }
  catch (failure) { error = failure.message; }
  useEffect(() => { field.current?.setCustomValidity(error); }, [error]);
  const update = items => onChange(items.map(formatMoment).join(', '));
  function mark() {
    const time = Math.floor(video.current.currentTime);
    if (time >= duration || times.includes(time)) return;
    update([...times, time].sort((a,b) => a-b));
  }
  return <fieldset className="demo-moments" disabled={busy}>
    <legend>Personalisation moments</legend>
    <video ref={video} src={src} controls playsInline preload="metadata" aria-label="Preview personalisation moments"
      onLoadedMetadata={event => setDuration(event.currentTarget.duration)} />
    <button type="button" disabled={!Number.isFinite(duration) || Boolean(error)} onClick={mark}>Mark this moment</button>
    <label>Times (minutes:seconds)
      <textarea ref={field} rows={2} value={value} placeholder="0:12, 0:20, 1:10" onChange={event => onChange(event.target.value)} />
    </label>
    <small>Separate times with commas or line breaks. Select a saved time to replay it.</small>
    {error && <p role="alert">{error}</p>}
    <div className="demo-moments__times">{times.map(time => <span key={time}>
      <button type="button" disabled={!Number.isFinite(duration)} onClick={() => {
        video.current.currentTime = time;
        video.current.play().catch(() => {});
      }}>{formatMoment(time)}</button>
      <button type="button" aria-label={'Remove ' + formatMoment(time)} onClick={() => update(times.filter(t => t !== time))}>×</button>
    </span>)}</div>
  </fieldset>;
}
