import { useEffect, useRef } from 'react';
import type { ConsoleEntry } from '../types';

interface ConsolePanelProps {
  isConnected: boolean;
  logs: ConsoleEntry[];
  mode: 'string' | 'hex';
  filter: 'all' | 'rx';
  showTimestamps: boolean;
  onModeChange: (mode: 'string' | 'hex') => void;
  onFilterChange: (filter: 'all' | 'rx') => void;
  onToggleTimestamps: () => void;
  onClear: () => void;
}

function renderConsoleEntry(
  entry: ConsoleEntry,
  mode: 'string' | 'hex',
  showTimestamps: boolean
) {
  const payload = mode === 'hex'
    ? (entry.hex || '--')
    : (entry.text || '--');

  if (!showTimestamps) {
    return payload;
  }

  return `[${entry.timestamp.toFixed(3)}s] ${payload}`;
}

export function ConsolePanel({
  isConnected,
  logs,
  mode,
  filter,
  showTimestamps,
  onModeChange,
  onFilterChange,
  onToggleTimestamps,
  onClear
}: ConsolePanelProps) {
  const rawDataPanelRef = useRef<HTMLDivElement>(null);

  const visibleLogs = logs
    .filter((entry) => (filter === 'all' ? true : entry.direction === 'rx'))
    .slice()
    .reverse();

  useEffect(() => {
    if (!rawDataPanelRef.current || visibleLogs.length === 0) {
      return;
    }

    const panel = rawDataPanelRef.current;
    panel.scrollTop = 0;
  }, [visibleLogs]);

  return (
    <section className="panel console-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Console</p>
          <h2 className="panel-title">Data Stream</h2>
        </div>
        <div className="console-toolbar">
          <div className="console-mode-switch">
            <button
              className={`console-mode-btn ${mode === 'string' ? 'active' : ''}`}
              onClick={() => onModeChange('string')}
            >
              String
            </button>
            <button
              className={`console-mode-btn ${mode === 'hex' ? 'active' : ''}`}
              onClick={() => onModeChange('hex')}
            >
              Hex Raw
            </button>
          </div>
          <div className="console-mode-switch">
            <button
              className={`console-mode-btn ${showTimestamps ? 'active' : ''}`}
              onClick={onToggleTimestamps}
            >
              Timestamp {showTimestamps ? 'On' : 'Off'}
            </button>
          </div>
          <div className="console-mode-switch">
            <button
              className={`console-mode-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => onFilterChange('all')}
            >
              RX + TX
            </button>
            <button
              className={`console-mode-btn ${filter === 'rx' ? 'active' : ''}`}
              onClick={() => onFilterChange('rx')}
            >
              Only RX
            </button>
          </div>
          <button className="btn secondary compact" onClick={onClear} disabled={logs.length === 0}>
            Clear Console
          </button>
          <span className="console-status">
            {isConnected
              ? `${filter === 'rx' ? 'RX only' : 'RX and TX'} stream visible`
              : 'Waiting for connection'}
          </span>
        </div>
      </div>

      <div ref={rawDataPanelRef} className="raw-data-panel">
        {visibleLogs.map((log) => (
          <div key={log.id} className={`console-entry ${log.direction}`}>
            {renderConsoleEntry(log, mode, showTimestamps)}
          </div>
        ))}
      </div>
    </section>
  );
}
