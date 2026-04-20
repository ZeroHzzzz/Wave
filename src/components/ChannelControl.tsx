import React from 'react';
import type { ChannelConfig } from '../types';

interface ChannelControlProps {
  channel: ChannelConfig;
  onChange: (updates: Partial<ChannelConfig>) => void;
}

export const ChannelControl: React.FC<ChannelControlProps> = ({ channel, onChange }) => {
  return (
    <div 
      className={`channel-card ${channel.visible ? 'active' : ''}`}
      style={{ '--chan-color': channel.color } as React.CSSProperties}
    >
      <div className="channel-header">
        <div>
          <div className="channel-title">
            <div className="color-dot" style={{ backgroundColor: channel.color }}></div>
            {channel.name}
          </div>
          <div className="channel-meta">{channel.id.toUpperCase()}</div>
        </div>
        <label className="switch">
          <input 
            type="checkbox" 
            checked={channel.visible} 
            onChange={e => onChange({ visible: e.target.checked })}
          />
          <span className="slider"></span>
        </label>
      </div>

      {channel.visible && (
        <div className="channel-settings">
          <div className="control-group">
            <label>Line Color</label>
            <div className="channel-color-row">
              <input 
                type="color" 
                value={channel.color}
                onChange={e => onChange({ color: e.target.value })}
                className="color-input"
              />
              <span className="channel-color-value">
                {channel.color.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="control-group">
            <label>
              Gain (Multiplier) <span className="value-display">x{channel.gain.toFixed(1)}</span>
            </label>
            <input 
              type="range" 
              min="0.1" 
              max="10" 
              step="0.1" 
              value={channel.gain}
              onChange={e => onChange({ gain: parseFloat(e.target.value) })}
            />
          </div>

          <div className="control-group">
            <label>
              Y-Offset <span className="value-display">{channel.offset.toFixed(1)}</span>
            </label>
            <input 
              type="range" 
              min="-10" 
              max="10" 
              step="0.1" 
              value={channel.offset}
              onChange={e => onChange({ offset: parseFloat(e.target.value) })}
            />
          </div>
        </div>
      )}
    </div>
  );
};
