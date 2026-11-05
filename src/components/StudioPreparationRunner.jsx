import './StudioPreparationRunner.css';

export default function StudioPreparationRunner({ costume }) {
  const base = `/images/studio-runners/${costume}`;
  return (
    <div className="studio-runner-lane" aria-hidden="true">
      <picture className="studio-runner-travel">
        <source media="(prefers-reduced-motion: reduce)" srcSet={`${base}-still.png`} />
        <img src={`${base}.webp`} alt="" width="60" height="64" draggable="false" />
      </picture>
    </div>
  );
}
