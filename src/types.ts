export type WaveformType = 'sine' | 'square' | 'noise' | 'sawtooth' | 'triangle';

export interface ChannelConfig {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  type: WaveformType;
  amplitude: number;
  frequency: number;
  offset: number;
  gain: number; // Added Gain multiplier
}

export interface DataPoint {
  time: number;
  [channelId: string]: number | null;
}

export interface ConsoleEntry {
  id: string;
  timestamp: number;
  direction: 'rx' | 'tx' | 'error';
  text: string;
  hex: string;
}

export interface PidTuneCard {
  uid: string;
  name: string;
  targetId: string;
  kp: string;
  ki: string;
  kd: string;
  outMax: string;
  intMax: string;
  sepErr: string;
  errMax: string;
  pol: string;
  tMs: string;
  enable: boolean;
  outLim: boolean;
  intLim: boolean;
  intSep: boolean;
  errLim: boolean;
}
