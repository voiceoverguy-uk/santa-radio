import { useRadio } from './RadioProvider.jsx';
import './Snowfall.css';

export default function Snowfall() {
  const { effects } = useRadio();
  if (!effects) return null;
  return (
    <div className="site-snow" aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => (
        <i key={i} style={{
          '--x': `${(i * 41 + 7) % 100}%`,
          '--delay': `${-i * 1.7}s`,
          '--duration': `${13 + i % 9}s`,
        }} />
      ))}
    </div>
  );
}
