import React from 'react';
import { Cpu, Eraser, Link, Loader2, Pause, Play, Unlink, ZoomIn } from 'lucide-react';

interface ScopeControlBarProps {
  isConnected: boolean;
  isConnecting: boolean;
  isPaused: boolean;
  hasSelectedPort: boolean;
  selectedPortLabel: string;
  baudRate: number;
  delimiter: string;
  historyLimit: number;
  sampleCount: number;
  visibleChannelCount: number;
  onSelectDevice: () => void;
  onBaudRateChange: (rate: number) => void;
  onChangeDelimiter: (value: string) => void;
  onHistoryLimitChange: (value: number) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onTogglePause: () => void;
  onClear: () => void;
  onAutoScale: () => void;
}

export const ScopeControlBar: React.FC<ScopeControlBarProps> = ({
  isConnected,
  isConnecting,
  isPaused,
  hasSelectedPort,
  selectedPortLabel,
  baudRate,
  delimiter,
  historyLimit,
  sampleCount,
  visibleChannelCount,
  onSelectDevice,
  onBaudRateChange,
  onChangeDelimiter,
  onHistoryLimitChange,
  onConnect,
  onDisconnect,
  onTogglePause,
  onClear,
  onAutoScale
}) => {
  return (
    <div className="scope-control-bar">
      <div className="scope-control-actions">
        <button className="btn secondary" onClick={onSelectDevice} disabled={isConnecting}>
          <Cpu size={16} />
          Select Device
        </button>

        {!isConnected ? (
          <button className="btn primary" onClick={onConnect} disabled={isConnecting || !hasSelectedPort}>
            {isConnecting ? <Loader2 className="animate-spin" size={16} /> : <Link size={16} />}
            {isConnecting ? 'Connecting' : 'Connect'}
          </button>
        ) : (
          <button className="btn danger" onClick={onDisconnect}>
            <Unlink size={16} />
            Disconnect
          </button>
        )}

        <button className={`btn ${isPaused ? 'primary' : 'secondary'}`} onClick={onTogglePause} disabled={!isConnected}>
          {isPaused ? <Play size={16} /> : <Pause size={16} />}
          {isPaused ? 'Resume' : 'Freeze'}
        </button>

        <button className="btn secondary" onClick={onAutoScale}>
          <ZoomIn size={16} />
          Auto Scale
        </button>

        <button className="btn secondary" onClick={onClear}>
          <Eraser size={16} />
          Clear
        </button>
      </div>

      <div className="scope-control-form">
        <div className={`device-pill ${hasSelectedPort ? 'ready' : 'empty'}`}>
          <span>Device</span>
          <strong>{selectedPortLabel}</strong>
        </div>

        <label className="field-group compact field-inline">
          <span>Baud</span>
          <select
            value={baudRate}
            onChange={(event) => onBaudRateChange(parseInt(event.target.value, 10))}
            disabled={isConnected || isConnecting}
          >
            <option value="9600">9600</option>
            <option value="19200">19200</option>
            <option value="38400">38400</option>
            <option value="57600">57600</option>
            <option value="115200">115200</option>
          </select>
        </label>

        <label className="field-group compact field-inline">
          <span>Delimiter</span>
          <select value={delimiter} onChange={(event) => onChangeDelimiter(event.target.value)}>
            <option value=",">Comma</option>
            <option value=" ">Space</option>
            <option value="\t">Tab</option>
            <option value=";">Semi</option>
          </select>
        </label>

        <label className="field-group compact field-inline">
          <span>Cache</span>
          <select value={historyLimit} onChange={(event) => onHistoryLimitChange(parseInt(event.target.value, 10))}>
            <option value="10000">10k</option>
            <option value="50000">50k</option>
            <option value="100000">100k</option>
            <option value="200000">200k</option>
            <option value="500000">500k</option>
          </select>
        </label>
      </div>

      <div className="scope-metrics">
        <div className="metric-pill">
          <span>Samples</span>
          <strong>{sampleCount.toLocaleString()}</strong>
        </div>
        <div className="metric-pill">
          <span>Visible CH</span>
          <strong>{visibleChannelCount}</strong>
        </div>
      </div>
    </div>
  );
};
