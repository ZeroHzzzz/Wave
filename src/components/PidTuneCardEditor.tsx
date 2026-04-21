import React from 'react';
import { Send, Trash2 } from 'lucide-react';
import type { PidTuneCard } from '../types';
import { isPidCardValid } from '../utils/pidProtocol';

interface PidTuneCardEditorProps {
  card: PidTuneCard;
  isConnected: boolean;
  onChange: (uid: string, updates: Partial<PidTuneCard>) => void;
  onRemove: (uid: string) => void;
  onSend: (uid: string) => void;
}

const PARAMETER_FIELDS = [
  { key: 'kp', label: 'Kp' },
  { key: 'ki', label: 'Ki' },
  { key: 'kd', label: 'Kd' },
  { key: 'outMax', label: 'OutMax' },
  { key: 'intMax', label: 'IntMax' },
  { key: 'sepErr', label: 'SepErr' },
  { key: 'errMax', label: 'ErrMax' },
  { key: 'pol', label: 'Pol' },
  { key: 'tMs', label: 'T(ms)' }
] as const;

const TOGGLE_FIELDS = [
  { key: 'enable', label: 'Enable' },
  { key: 'outLim', label: 'OutLim' },
  { key: 'intLim', label: 'IntLim' },
  { key: 'intSep', label: 'IntSep' },
  { key: 'errLim', label: 'ErrLim' }
] as const;

export const PidTuneCardEditor: React.FC<PidTuneCardEditorProps> = ({
  card,
  isConnected,
  onChange,
  onRemove,
  onSend
}) => {
  const isValid = isPidCardValid(card);

  return (
    <article className="pid-card">
      <div className="pid-card-header">
        <div className="pid-card-title-group">
          <div>
            <h3>{card.name.trim() || 'Untitled PID'}</h3>
            <p>ID: {card.targetId.trim() || 'unset'}</p>
          </div>
          <div className="pid-card-header-actions">
            <button className="btn secondary compact" onClick={() => onSend(card.uid)} disabled={!isConnected || !isValid}>
              <Send size={15} />
              Send
            </button>
            <button className="icon-btn" onClick={() => onRemove(card.uid)} title="Remove PID card">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="pid-identity-grid">
        <label className="field-group">
          <span>Card Name</span>
          <input
            type="text"
            value={card.name}
            onChange={(event) => onChange(card.uid, { name: event.target.value })}
            placeholder="Yaw Controller"
          />
        </label>

        <label className="field-group">
          <span>Target ID</span>
          <input
            type="text"
            value={card.targetId}
            onChange={(event) => onChange(card.uid, { targetId: event.target.value })}
            placeholder="1-4"
          />
        </label>
      </div>

      <div className="pid-parameter-grid">
        {PARAMETER_FIELDS.map((field) => (
          <label key={field.key} className="field-group">
            <span>{field.label}</span>
            <input
              type="text"
              inputMode="decimal"
              value={card[field.key]}
              onChange={(event) => onChange(card.uid, { [field.key]: event.target.value })}
              placeholder="0.000"
            />
          </label>
        ))}
      </div>

      <div className="pid-toggle-grid">
        {TOGGLE_FIELDS.map((field) => (
          <label key={field.key} className="pid-toggle-item">
            <input
              type="checkbox"
              checked={card[field.key]}
              onChange={(event) => onChange(card.uid, { [field.key]: event.target.checked })}
            />
            <span>{field.label}</span>
          </label>
        ))}
      </div>

      <div className="pid-card-footer">
        <span className={`validation-chip ${isValid ? 'valid' : 'invalid'}`}>
          {isValid ? 'Ready to send' : 'Fill ID and all float parameters'}
        </span>
        <span className="pid-card-footer-id">{card.targetId.trim() || 'No target ID'}</span>
      </div>
    </article>
  );
};
