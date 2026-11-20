import './StudioPreparationRunner.css';

export default function StudioPreparationRunner({ costume, stumbles = false, hops = false }) {
  const base = `/images/studio-runners/${costume}`;
  return (
    <div className={`studio-runner-lane${stumbles ? ' studio-runner-stumbles' : ''}${hops ? ' studio-runner-lane--hops' : ''}`} aria-hidden="true">
      <div className="studio-runner-travel"><picture className="studio-runner-pose">
        <source media="(prefers-reduced-motion: reduce)" srcSet={`${base}-still.png`} />
        <img src={`${base}.webp`} alt="" width="60" height="64" draggable="false" />
      </picture></div>
    </div>
  );
}
