import type { ChannelConfig, PidTuneCard } from '../types';

const CHANNEL_COLORS = ['#ffff00', '#00ffff', '#ff00ff', '#00ff00', '#ff8800', '#0088ff'];

export const INITIAL_CHANNELS: ChannelConfig[] = [
  { id: 'ch1', name: 'CH1: Main Signal', color: '#ffff00', visible: true, type: 'sine', amplitude: 5, frequency: 1, offset: 0, gain: 1 },
  { id: 'ch2', name: 'CH2: Error Diff', color: '#00ffff', visible: true, type: 'noise', amplitude: 1.5, frequency: 5, offset: 0, gain: 1 },
  { id: 'ch3', name: 'CH3: Clock', color: '#ff00ff', visible: false, type: 'square', amplitude: 3, frequency: 2, offset: 0, gain: 1 },
  { id: 'ch4', name: 'CH4: Reference', color: '#00ff00', visible: false, type: 'triangle', amplitude: 4, frequency: 0.5, offset: 0, gain: 1 }
];

export function createPidCard(index: number): PidTuneCard {
  return {
    uid: `pid-card-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: `PID Card ${index}`,
    targetId: `pid_${index}`,
    kp: '0.000',
    ki: '0.000',
    kd: '0.000',
    outMax: '100.000',
    intMax: '100.000',
    sepErr: '0.000',
    errMax: '0.000',
    pol: '1.000',
    tMs: '1.000',
    enable: true,
    outLim: true,
    intLim: true,
    intSep: false,
    errLim: false
  };
}

export function createAutoChannel(index: number): ChannelConfig {
  return {
    id: `ch${index + 1}`,
    name: `CH${index + 1}: Data ${index + 1}`,
    color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
    visible: true,
    type: 'sine',
    amplitude: 1,
    frequency: 1,
    offset: 0,
    gain: 1
  };
}
