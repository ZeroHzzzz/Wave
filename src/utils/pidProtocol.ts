import type { PidTuneCard } from '../types';

export const PID_PROTOCOL_LABEL = 'VX/1 PID_SET';
export const RUN_PROTOCOL_LABEL = 'VX/1 RUN_SET';
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
const SYSTEM_TUNER_MSG_RUN_SET = 0x02;
const SYSTEM_TUNER_PID_FLOAT_COUNT = 9;
const SYSTEM_TUNER_PID_PAYLOAD_SIZE = 2 + SYSTEM_TUNER_PID_FLOAT_COUNT * 4;
const SYSTEM_TUNER_RUN_PAYLOAD_SIZE = 1;

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

function getNextSequence() {
  const sequence = nextSequence & 0xff;
  nextSequence = (nextSequence + 1) & 0xff;

  if (nextSequence === 0) {
    nextSequence = 1;
  }

  return sequence;
}

function buildFrame(messageType: number, payload: Uint8Array) {
  const sequence = getNextSequence();
  const frame = new Uint8Array(6 + payload.length + 2);
  const view = new DataView(frame.buffer);

  frame[0] = SYSTEM_TUNER_SOF0;
  frame[1] = SYSTEM_TUNER_SOF1;
  frame[2] = SYSTEM_TUNER_PROTOCOL_VERSION;
  frame[3] = messageType;
  frame[4] = payload.length;
  frame[5] = sequence;
  frame.set(payload, 6);

  const crc = crc16Ccitt(frame.subarray(2, 6 + payload.length));
  view.setUint16(6 + payload.length, crc, true);

  return {
    packet: frame,
    sequence
  };
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
  const payload = new Uint8Array(SYSTEM_TUNER_PID_PAYLOAD_SIZE);
  const view = new DataView(payload.buffer);

  payload[0] = targetId;
  payload[1] = flags;

  values.forEach((value, index) => {
    view.setFloat32(2 + index * 4, value, true);
  });

  const { packet, sequence } = buildFrame(SYSTEM_TUNER_MSG_PID_SET, payload);

  return {
    packet,
    sequence,
    targetId
  };
}

export function buildRunStatePacket(enabled: boolean) {
  const payload = new Uint8Array(SYSTEM_TUNER_RUN_PAYLOAD_SIZE);
  payload[0] = enabled ? 1 : 0;

  const { packet, sequence } = buildFrame(SYSTEM_TUNER_MSG_RUN_SET, payload);

  return {
    packet,
    sequence,
    enabled
  };
}
