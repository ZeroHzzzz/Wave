import { useEffect, useMemo, useRef } from 'react';
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

interface ConsoleDisplayRow {
  id: string;
  direction: ConsoleEntry['direction'];
  content: string;
}

function buildConsoleDisplayRows(
  logs: ConsoleEntry[],
  mode: 'string' | 'hex',
  showTimestamps: boolean
): ConsoleDisplayRow[] {
  if (mode === 'hex' || showTimestamps) {
    return logs
      .map((entry) => ({
        id: entry.id,
        direction: entry.direction,
        content: renderConsoleEntry(entry, mode, showTimestamps)
      }))
      .reverse();
  }

  const rows: ConsoleDisplayRow[] = [];
  let pendingRow: {
    firstId: string;
    direction: ConsoleEntry['direction'];
    text: string;
    lineIndex: number;
  } | null = null;

  const pushPendingRow = () => {
    if (!pendingRow || pendingRow.text === '') {
      return;
    }

    rows.push({
      id: `${pendingRow.firstId}-line-${pendingRow.lineIndex}`,
      direction: pendingRow.direction,
      content: pendingRow.text
    });
  };

  logs.forEach((entry) => {
    if (pendingRow?.direction !== entry.direction) {
      pushPendingRow();
      pendingRow = {
        firstId: entry.id,
        direction: entry.direction,
        text: '',
        lineIndex: 0
      };
    }

    const segments = (entry.text || '').split(/\r\n|\r|\n/);
    pendingRow.text += segments[0] ?? '';

    for (let index = 1; index < segments.length; index += 1) {
      pushPendingRow();
      pendingRow = {
        firstId: entry.id,
        direction: entry.direction,
        text: segments[index] ?? '',
        lineIndex: pendingRow.lineIndex + 1
      };
    }
  });

  pushPendingRow();

  return rows.reverse();
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

  const displayRows = useMemo(() => {
    const filteredLogs = logs.filter((entry) => (
      filter === 'all' ? true : entry.direction === 'rx'
    ));

    return buildConsoleDisplayRows(filteredLogs, mode, showTimestamps);
  }, [filter, logs, mode, showTimestamps]);

  useEffect(() => {
    if (!rawDataPanelRef.current || displayRows.length === 0) {
      return;
    }

    const panel = rawDataPanelRef.current;
    panel.scrollTop = 0;
  }, [displayRows]);

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
        {displayRows.map((row) => (
          <div key={row.id} className={`console-entry ${row.direction}`}>
            {row.content}
          </div>
        ))}
      </div>
    </section>
  );
}
