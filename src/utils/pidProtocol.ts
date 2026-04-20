import type { PidTuneCard } from '../types';

export const PID_PROTOCOL_LABEL = 'PID';
const PID_FLOAT_FIELDS = [
  'kp',
  'ki',
  'kd',
  'outMax',
  'intMax',
  'sepErr',
  'errMax',
  'pol',
  'tMs'
] as const;
const PID_FLAG_FIELDS = ['enable', 'outLim', 'intLim', 'intSep', 'errLim'] as const;

function normalizeFloatInput(value: string) {
  return value.trim();
}

function isFiniteFloatInput(value: string) {
  const normalized = normalizeFloatInput(value);
  if (normalized === '') return false;

  const parsed = Number(normalized);
  return Number.isFinite(parsed);
}

export function isPidCardValid(card: PidTuneCard) {
  return (
    card.targetId.trim() !== '' &&
    PID_FLOAT_FIELDS.every((field) => isFiniteFloatInput(card[field]))
  );
}

export function buildPidCommand(card: PidTuneCard) {
  if (!isPidCardValid(card)) {
    return null;
  }

  const targetId = card.targetId.trim();
  const numericValues = PID_FLOAT_FIELDS.map((field) => normalizeFloatInput(card[field]));
  const flagValues = PID_FLAG_FIELDS.map((field) => (card[field] ? '1' : '0'));

  return `${PID_PROTOCOL_LABEL},${targetId},${numericValues.join(',')},${flagValues.join(',')}\n`;
}
