import React from 'react';
import { Download, Plus, Send, SlidersHorizontal, Upload } from 'lucide-react';
import type { PidTuneCard } from '../types';
import { PidTuneCardEditor } from './PidTuneCardEditor';

interface PidTuningPanelProps {
  cards: PidTuneCard[];
  isConnected: boolean;
  statusMessage: string;
  statusTone: 'neutral' | 'success' | 'error';
  onAddCard: () => void;
  onUpdateCard: (uid: string, updates: Partial<PidTuneCard>) => void;
  onRemoveCard: (uid: string) => void;
  onSendCard: (uid: string) => void;
  onSendAll: () => void;
  onExport: () => void;
  onImport: () => void;
}

export const PidTuningPanel: React.FC<PidTuningPanelProps> = ({
  cards,
  isConnected,
  statusMessage,
  statusTone,
  onAddCard,
  onUpdateCard,
  onRemoveCard,
  onSendCard,
  onSendAll,
  onExport,
  onImport
}) => {
  return (
    <section className="panel pid-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Tuning</p>
          <h2 className="panel-title">PID Parameter Cards</h2>
        </div>
        <div className="panel-header-actions">
          <button className="btn secondary compact" onClick={onImport}>
            <Upload size={15} />
            Import JSON
          </button>
          <button className="btn secondary compact" onClick={onExport} disabled={cards.length === 0}>
            <Download size={15} />
            Save JSON
          </button>
          <button className="icon-btn" onClick={onAddCard} title="Add PID card">
            <Plus size={16} />
          </button>
          <button className="btn secondary compact" onClick={onSendAll} disabled={!isConnected || cards.length === 0}>
            <Send size={15} />
            Send All
          </button>
        </div>
      </div>

      <div className="panel-body pid-panel-body">
        <div className="protocol-banner">
          <div className="protocol-banner-text">
            <SlidersHorizontal size={16} />
            <span>Protocol: <code>PID,&lt;id&gt;,&lt;kp&gt;,&lt;ki&gt;,&lt;kd&gt;,...,&lt;flags&gt;</code></span>
          </div>
          <span className={`status-inline ${statusTone}`}>{statusMessage}</span>
        </div>

        <div className="pid-card-list">
          {cards.map((card) => (
            <PidTuneCardEditor
              key={card.uid}
              card={card}
              isConnected={isConnected}
              onChange={onUpdateCard}
              onRemove={onRemoveCard}
              onSend={onSendCard}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
