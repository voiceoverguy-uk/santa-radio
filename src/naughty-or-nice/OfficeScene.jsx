import './checker.css';
import AnalyserMachine from './AnalyserMachine.jsx';

/* Decorative Head Elf office. All scenery is aria-hidden; real content is passed as children. */
export default function OfficeScene({ children, busy = false, compact = false }) {
  const cls = ['nn-scene', compact ? 'nn-scene--compact' : 'nn-scene--full', busy ? 'is-busy' : '']
    .filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="nn-scenery" aria-hidden="true" />
      <div className="nn-scene-content">{children}</div>
    </div>
  );
}

/* Optional decorative analyser; place inside a stage. Text results must be rendered as HTML siblings. */
export function NnComputer({ busy = false, secondsRemaining = 0, connecting = false, finalAnalysis = false }) {
  return <AnalyserMachine busy={busy} secondsRemaining={secondsRemaining} connecting={connecting} finalAnalysis={finalAnalysis} />;
}
export { AnalyserMachine };
