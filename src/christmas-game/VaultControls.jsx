import { ChevronDown, ShipWheel } from 'lucide-react';
import { modeLabels } from './people.js';

export function GameCategory({ value, onChange, disabled }) {
  return <label className="christmas-category">Choose your game
    <span className="christmas-category__field">
      <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>
        {Object.entries(modeLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <ChevronDown size={24} strokeWidth={2.5} aria-hidden="true" />
    </span>
  </label>;
}

export function VaultDoors({ opening = false }) {
  return <span className={`christmas-study__vault${opening ? ' christmas-study__vault--opening' : ''}`}
    role={opening ? undefined : 'status'} aria-hidden={opening || undefined}>
    <span className="christmas-study__vault-plate"><ShipWheel size={26} aria-hidden="true" /> Locked in Santa’s vault</span>
  </span>;
}

