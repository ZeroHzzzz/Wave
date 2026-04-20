import type { PidTuneCard } from '../types';

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

type PidFloatField = (typeof PID_FLOAT_FIELDS)[number];
type PidFlagField = (typeof PID_FLAG_FIELDS)[number];

type PersistedPidCard = Omit<PidTuneCard, 'uid'> & { uid?: string };

function expandScientificNotation(rawValue: string) {
  const value = rawValue.trim();
  if (value === '') return value;
  if (!/[eE]/.test(value)) return value;

  const match = value.match(/^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/);
  if (!match) return value;

  const [, sign, integerPart, fractionalPart = '', exponentText] = match;
  const exponent = Number.parseInt(exponentText, 10);
  if (!Number.isFinite(exponent)) return value;

  const digits = `${integerPart}${fractionalPart}`;
  const decimalIndex = integerPart.length + exponent;

  if (decimalIndex <= 0) {
    const zeros = '0'.repeat(Math.abs(decimalIndex));
    return `${sign}0.${zeros}${digits}`;
  }

  if (decimalIndex >= digits.length) {
    const zeros = '0'.repeat(decimalIndex - digits.length);
    return `${sign}${digits}${zeros}`;
  }

  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function normalizeSavedNumber(value: string) {
  return expandScientificNotation(value.trim());
}

function sanitizeFlag(value: unknown) {
  return value === true;
}

export function serializePidCards(cards: PidTuneCard[]) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: cards.map((card) => {
      const nextCard: Record<string, unknown> = {
        uid: card.uid,
        name: card.name,
        targetId: card.targetId
      };

      PID_FLOAT_FIELDS.forEach((field) => {
        nextCard[field] = normalizeSavedNumber(card[field]);
      });

      PID_FLAG_FIELDS.forEach((field) => {
        nextCard[field] = card[field];
      });

      return nextCard;
    })
  };
}

export function deserializePidCards(
  input: unknown,
  createFallbackCard: (index: number) => PidTuneCard
) {
  const maybeCards = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as { cards?: unknown[] }).cards)
      ? (input as { cards: unknown[] }).cards
      : null;

  if (!maybeCards) {
    throw new Error('JSON format is invalid. Expected an array or an object with a cards field.');
  }

  return maybeCards.map((rawCard, index) => {
    const fallback = createFallbackCard(index + 1);
    const card = (rawCard ?? {}) as Partial<PersistedPidCard>;
    const nextCard: PidTuneCard = {
      ...fallback,
      uid: typeof card.uid === 'string' && card.uid.trim() !== '' ? card.uid : fallback.uid,
      name: typeof card.name === 'string' ? card.name : fallback.name,
      targetId: typeof card.targetId === 'string' ? card.targetId : fallback.targetId
    };

    PID_FLOAT_FIELDS.forEach((field: PidFloatField) => {
      const rawValue = card[field];
      nextCard[field] = typeof rawValue === 'string'
        ? normalizeSavedNumber(rawValue)
        : fallback[field];
    });

    PID_FLAG_FIELDS.forEach((field: PidFlagField) => {
      nextCard[field] = sanitizeFlag(card[field]);
    });

    return nextCard;
  });
}
