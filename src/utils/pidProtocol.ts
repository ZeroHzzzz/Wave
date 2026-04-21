import type { PidTuneCard } from '../types';

export const PID_PROTOCOL_LABEL = 'VX/1 PID_SET';
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
const SYSTEM_TUNER_PROTOCOL_VERSION = 0x01;
const SYSTEM_TUNER_SOF0 = 0x56;
const SYSTEM_TUNER_SOF1 = 0x58;
const SYSTEM_TUNER_MSG_PID_SET = 0x01;
const SYSTEM_TUNER_PID_FLOAT_COUNT = 9;
const SYSTEM_TUNER_PID_PAYLOAD_SIZE = 2 + SYSTEM_TUNER_PID_FLOAT_COUNT * 4;

const SYSTEM_TUNER_FLAG_ENABLE = 1 << 0;
const SYSTEM_TUNER_FLAG_OUT_LIMIT = 1 << 1;
const SYSTEM_TUNER_FLAG_INT_LIMIT = 1 << 2;
const SYSTEM_TUNER_FLAG_INT_SEP = 1 << 3;
const SYSTEM_TUNER_FLAG_ERR_LIMIT = 1 << 4;

let nextSequence = 1;

function normalizeFloatInput(value: string) {
  return value.trim();
}

function parseTargetId(value: string) {
  const normalized = value.trim();
  if (normalized === '') return null;

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 255) {
    return null;
  }

  return parsed;
}

function isFiniteFloatInput(value: string) {
  const normalized = normalizeFloatInput(value);
  if (normalized === '') return false;

  const parsed = Number(normalized);
  return Number.isFinite(parsed);
}

export function isPidCardValid(card: PidTuneCard) {
  return (
    parseTargetId(card.targetId) !== null &&
    PID_FLOAT_FIELDS.every((field) => isFiniteFloatInput(card[field]))
  );
}

function crc16Ccitt(data: Uint8Array) {
  let crc = 0xffff;

  for (const byte of data) {
    crc ^= byte << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0
        ? ((crc << 1) ^ 0x1021) & 0xffff
        : (crc << 1) & 0xffff;
    }
  }

  return crc;
}

export function buildPidPacket(card: PidTuneCard) {
  if (!isPidCardValid(card)) {
    return null;
  }

  const targetId = parseTargetId(card.targetId);
  if (targetId === null) {
    return null;
  }

  const values = PID_FLOAT_FIELDS.map((field) => Number(normalizeFloatInput(card[field])));
  const flags =
    (card.enable ? SYSTEM_TUNER_FLAG_ENABLE : 0) |
    (card.outLim ? SYSTEM_TUNER_FLAG_OUT_LIMIT : 0) |
    (card.intLim ? SYSTEM_TUNER_FLAG_INT_LIMIT : 0) |
    (card.intSep ? SYSTEM_TUNER_FLAG_INT_SEP : 0) |
    (card.errLim ? SYSTEM_TUNER_FLAG_ERR_LIMIT : 0);
  const sequence = nextSequence & 0xff;
  nextSequence = (nextSequence + 1) & 0xff;

  if (nextSequence === 0) {
    nextSequence = 1;
  }

  const frame = new Uint8Array(6 + SYSTEM_TUNER_PID_PAYLOAD_SIZE + 2);
  const view = new DataView(frame.buffer);

  frame[0] = SYSTEM_TUNER_SOF0;
  frame[1] = SYSTEM_TUNER_SOF1;
  frame[2] = SYSTEM_TUNER_PROTOCOL_VERSION;
  frame[3] = SYSTEM_TUNER_MSG_PID_SET;
  frame[4] = SYSTEM_TUNER_PID_PAYLOAD_SIZE;
  frame[5] = sequence;
  frame[6] = targetId;
  frame[7] = flags;

  values.forEach((value, index) => {
    view.setFloat32(8 + index * 4, value, true);
  });

  const crc = crc16Ccitt(frame.subarray(2, 6 + SYSTEM_TUNER_PID_PAYLOAD_SIZE));
  view.setUint16(6 + SYSTEM_TUNER_PID_PAYLOAD_SIZE, crc, true);

  return {
    packet: frame,
    sequence,
    targetId
  };
}
