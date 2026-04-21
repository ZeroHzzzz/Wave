import { useCallback, useRef, useState } from 'react';
import type { PidTuneCard } from '../types';
import { createPidCard } from '../constants/appDefaults';
import { deserializePidCards, serializePidCards } from '../utils/pidPersistence';
import { buildPidPacket } from '../utils/pidProtocol';

interface PidStatus {
  tone: 'neutral' | 'success' | 'error';
  message: string;
}

interface SendPacketResult {
  ok: boolean;
  message: string;
}

type SendPacketFn = (payload: Uint8Array, label?: string) => Promise<SendPacketResult>;

function downloadJsonFile(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function usePidCards(sendPacket: SendPacketFn) {
  const [cards, setCards] = useState<PidTuneCard[]>(() => [createPidCard(1)]);
  const [status, setStatus] = useState<PidStatus>({
    tone: 'neutral',
    message: 'Ready to configure and send PID packets.'
  });
  const nextCardIndexRef = useRef(2);

  const addCard = useCallback(() => {
    const nextIndex = nextCardIndexRef.current;
    nextCardIndexRef.current += 1;
    setCards(prev => [...prev, createPidCard(nextIndex)]);
  }, []);

  const updateCard = useCallback((uid: string, updates: Partial<PidTuneCard>) => {
    setCards(prev => prev.map(card => (card.uid === uid ? { ...card, ...updates } : card)));
  }, []);

  const removeCard = useCallback((uid: string) => {
    setCards(prev => prev.filter(card => card.uid !== uid));
  }, []);

  const sendCards = useCallback(async (targetCards: PidTuneCard[]) => {
    const packets = targetCards.map(card => buildPidPacket(card));
    if (packets.some(packet => packet === null)) {
      setStatus({
        tone: 'error',
        message: 'Some cards are incomplete. Please fill a numeric target ID and all float parameters before sending.'
      });
      return;
    }

    for (const packetInfo of packets) {
      if (!packetInfo) {
        return;
      }

      const result = await sendPacket(
        packetInfo.packet,
        `PID_SET target=${packetInfo.targetId} seq=${packetInfo.sequence}`
      );

      if (!result.ok) {
        setStatus({
          tone: 'error',
          message: result.message
        });
        return;
      }
    }

    setStatus({
      tone: 'success',
      message: `Sent ${targetCards.length} PID ${targetCards.length === 1 ? 'card' : 'cards'} successfully.`
    });
  }, [sendPacket]);

  const sendCard = useCallback(async (uid: string) => {
    const card = cards.find(item => item.uid === uid);
    if (!card) {
      return;
    }

    await sendCards([card]);
  }, [cards, sendCards]);

  const sendAll = useCallback(async () => {
    if (cards.length === 0) {
      setStatus({
        tone: 'error',
        message: 'There are no PID cards to send.'
      });
      return;
    }

    await sendCards(cards);
  }, [cards, sendCards]);

  const exportCards = useCallback(() => {
    if (cards.length === 0) {
      setStatus({
        tone: 'error',
        message: 'There are no PID cards to export.'
      });
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJsonFile(serializePidCards(cards), `pid-params-${timestamp}.json`);

    setStatus({
      tone: 'success',
      message: `Exported ${cards.length} PID ${cards.length === 1 ? 'card' : 'cards'} to JSON.`
    });
  }, [cards]);

  const importFromFile = useCallback(async (file: File) => {
    try {
      const fileContent = await file.text();
      const parsed = JSON.parse(fileContent);
      const importedCards = deserializePidCards(parsed, createPidCard);

      setCards(importedCards);
      nextCardIndexRef.current = importedCards.length + 1;
      setStatus({
        tone: 'success',
        message: `Imported ${importedCards.length} PID ${importedCards.length === 1 ? 'card' : 'cards'} from JSON.`
      });
    } catch (error: any) {
      setStatus({
        tone: 'error',
        message: error?.message ?? 'Failed to import PID JSON file.'
      });
    }
  }, []);

  return {
    cards,
    status,
    addCard,
    updateCard,
    removeCard,
    sendCard,
    sendAll,
    exportCards,
    importFromFile
  };
}
