import { ShipWheel } from 'lucide-react';
import { modeLabels } from './people.js';

export function GameCategory({ value, onChange, disabled }) {
  return <label className="christmas-category">Choose your game
    <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>
      {Object.entries(modeLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  </label>;
}

export function VaultDoors({ opening = false }) {
  return <span className={`christmas-study__vault${opening ? ' christmas-study__vault--opening' : ''}`}
    role={opening ? undefined : 'status'} aria-hidden={opening || undefined}>
    <span className="christmas-study__vault-plate"><ShipWheel size={26} aria-hidden="true" /> Locked in Santa’s vault</span>
  </span>;
}

