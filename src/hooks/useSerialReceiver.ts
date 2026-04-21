import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import type { ChannelConfig, ConsoleEntry, DataPoint } from '../types';

const MAX_LOGS = 300;
const UI_UPDATE_INTERVAL = 50;
const NO_DEVICE_SELECTED_LABEL = 'No device selected';

interface SerialPortInfoLike {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  getInfo?: () => SerialPortInfoLike;
}

interface SerialLike {
  getPorts: () => Promise<SerialPortLike[]>;
  requestPort: () => Promise<SerialPortLike>;
}

function getSerialApi() {
  return (navigator as Navigator & { serial?: SerialLike }).serial ?? null;
}

function appendLimitedItems<T>(current: T[], incoming: T[], limit: number) {
  const merged = current.length === 0 ? incoming : [...current, ...incoming];
  return merged.length > limit
    ? merged.slice(merged.length - limit)
    : merged;
}

export function useSerialReceiver(
  channels: ChannelConfig[], 
  maxDataPoints: number,
  delimiter: string = ',',
  onDataLengthChange?: (count: number) => void
) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [rawLogs, setRawLogs] = useState<ConsoleEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [clearVersion, setClearVersion] = useState(0);
  const [selectedPortLabel, setSelectedPortLabel] = useState(NO_DEVICE_SELECTED_LABEL);
  const [hasSelectedPort, setHasSelectedPort] = useState(false);
  const isPausedRef = useRef(false);
  
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const maxDataPointsRef = useRef(maxDataPoints);
  maxDataPointsRef.current = maxDataPoints;
  
  const portRef = useRef<SerialPortLike | null>(null);
  const rememberedPortRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keepReadingRef = useRef(false);
  const encoderRef = useRef(new TextEncoder());
  const textDecoderRef = useRef(new TextDecoder());
  
  const timeRef = useRef<number>(0);
  const bufferRef = useRef<string>('');
  const pendingPointsRef = useRef<DataPoint[]>([]);
  const pendingLogsRef = useRef<ConsoleEntry[]>([]);
  const resetStreamStateRef = useRef(false);
  const lastDataLengthRef = useRef<number | null>(null);
  const sessionStartRef = useRef(performance.now());

  const formatPortLabel = useCallback((port: SerialPortLike) => {
    const info = port?.getInfo?.() ?? {};
    const vendor = typeof info.usbVendorId === 'number'
      ? info.usbVendorId.toString(16).padStart(4, '0').toUpperCase()
      : null;
    const product = typeof info.usbProductId === 'number'
      ? info.usbProductId.toString(16).padStart(4, '0').toUpperCase()
      : null;

    if (vendor || product) {
      return `VID ${vendor ?? '----'} / PID ${product ?? '----'}`;
    }

    return 'Authorized Serial Device';
  }, []);

  const clearSelectedPort = useCallback(() => {
    rememberedPortRef.current = null;
    setHasSelectedPort(false);
    setSelectedPortLabel(NO_DEVICE_SELECTED_LABEL);
  }, []);

  const rememberSelectedPort = useCallback((port: SerialPortLike) => {
    rememberedPortRef.current = port;
    setHasSelectedPort(true);
    setSelectedPortLabel(formatPortLabel(port));
  }, [formatPortLabel]);

  const buildHexString = useCallback((bytes: Uint8Array) => (
    Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(' ')
  ), []);

  const getLogTimestamp = useCallback(() => (
    (performance.now() - sessionStartRef.current) / 1000
  ), []);

  const createConsoleEntry = useCallback((
    direction: ConsoleEntry['direction'],
    text: string,
    hex: string
  ): ConsoleEntry => ({
    id: `${direction}-${performance.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: getLogTimestamp(),
    direction,
    text,
    hex
  }), [getLogTimestamp]);

  useEffect(() => {
    setData(prev => (
      prev.length > maxDataPoints ? prev.slice(prev.length - maxDataPoints) : prev
    ));
  }, [maxDataPoints]);

  useEffect(() => {
    const serial = getSerialApi();
    if (!serial || rememberedPortRef.current) {
      return undefined;
    }

    let cancelled = false;

    const restoreAuthorizedPort = async () => {
      try {
        const ports = await serial.getPorts();
        if (cancelled || !ports?.length) {
          return;
        }

        rememberSelectedPort(ports[0]);
      } catch (error) {
        console.error('Failed to restore authorized serial ports', error);
      }
    };

    void restoreAuthorizedPort();

    return () => {
      cancelled = true;
    };
  }, [rememberSelectedPort]);

  const flushPendingBuffers = useCallback(() => {
    const nextPoints = isPausedRef.current
      ? []
      : pendingPointsRef.current.splice(0, pendingPointsRef.current.length);
    const nextLogs = pendingLogsRef.current.splice(0, pendingLogsRef.current.length);

    if (nextPoints.length > 0 && !isPausedRef.current) {
      startTransition(() => {
        setData(prev => {
          return appendLimitedItems(prev, nextPoints, maxDataPointsRef.current);
        });
      });
    }

    if (nextLogs.length > 0) {
      startTransition(() => {
        setRawLogs(prev => appendLimitedItems(prev, nextLogs, MAX_LOGS));
      });
    }
  }, []);

  const appendLogs = useCallback((entries: ConsoleEntry[]) => {
    if (entries.length === 0) return;

    startTransition(() => {
      setRawLogs(prev => appendLimitedItems(prev, entries, MAX_LOGS));
    });
  }, []);

  const disconnect = useCallback(async () => {
    keepReadingRef.current = false;
    setIsConnecting(false);
    
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (e) {
        console.error("Error cancelling reader", e);
      }
      readerRef.current = null;
    }
    
    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch (e) {
        console.error("Error closing port", e);
      }
      portRef.current = null;
    }
    
    setIsConnected(false);
    setIsPaused(false);
    isPausedRef.current = false;
    bufferRef.current = '';
    pendingPointsRef.current.length = 0;
    pendingLogsRef.current.length = 0;
  }, []);

  const togglePause = useCallback(() => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(isPausedRef.current);
  }, []);

  const selectDevice = useCallback(async () => {
    const serial = getSerialApi();
    if (!serial) {
      alert("Web Serial API is not supported in this browser. Please use Chrome or Edge.");
      return {
        ok: false,
        message: 'Web Serial API is not supported.'
      };
    }

    if (isConnected) {
      await disconnect();
    }

    try {
      const port = await serial.requestPort();
      portRef.current = null;
      rememberSelectedPort(port);

      return {
        ok: true,
        message: ''
      };
    } catch (error: any) {
      if (error?.name === 'NotFoundError') {
        return {
          ok: false,
          message: 'No device selected.'
        };
      }

      const message = error?.message ?? 'Failed to select serial device.';
      alert(`Serial Device Error: ${message}`);

      return {
        ok: false,
        message
      };
    }
  }, [disconnect, isConnected, rememberSelectedPort]);

  const connect = useCallback(async (baudRate: number) => {
    if (!getSerialApi()) {
      alert("Web Serial API is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    try {
      setIsConnecting(true);

      const port = portRef.current ?? rememberedPortRef.current;
      if (!port) {
        setIsConnecting(false);
        alert('Please select a serial device first.');
        return;
      }

      await port.open({ baudRate });

      portRef.current = port;
      rememberSelectedPort(port);
      setIsConnected(true);
      setIsConnecting(false);
      keepReadingRef.current = true;
      sessionStartRef.current = performance.now();
      textDecoderRef.current = new TextDecoder();
      if (!port.readable) {
        throw new Error('Selected serial device does not expose a readable stream.');
      }
      const reader = port.readable.getReader();
      readerRef.current = reader;

      let lastRealTime = performance.now();
      let lastUiUpdateTime = performance.now();

      // Read loop
      while (port.readable && keepReadingRef.current) {
        if (resetStreamStateRef.current) {
          pendingPointsRef.current.length = 0;
          pendingLogsRef.current.length = 0;
          bufferRef.current = '';
          sessionStartRef.current = performance.now();
          textDecoderRef.current = new TextDecoder();
          lastRealTime = performance.now();
          lastUiUpdateTime = lastRealTime;
          resetStreamStateRef.current = false;
        }

        const { value, done } = await reader.read();
        
        if (done) break;
        if (value) {
          const textChunk = textDecoderRef.current.decode(value, { stream: true });
          pendingLogsRef.current.push(createConsoleEntry('rx', textChunk, buildHexString(value)));
          bufferRef.current += textChunk;
          const lines = bufferRef.current.split(/\r?\n/);
          
          if (lines.length > 1) {
            // Keep the last incomplete segment in the buffer
            bufferRef.current = lines.pop() || '';
            
            // Calculate time evenly across the chunk lines to prevent vertical stacking
            const currentRealTime = performance.now();
            const delta = currentRealTime - lastRealTime;
            lastRealTime = currentRealTime;
            const timeStep = lines.length > 0 ? (delta / 1000) / lines.length : 0;

            const newPoints: DataPoint[] = [];

            // Process fully received lines
            lines.forEach((line) => {
              const trimmedLine = line.trim();
              if (trimmedLine === '') return;
              
              timeRef.current += timeStep;
              
              const rawParts = delimiter === ' '
                ? trimmedLine.split(/\s+/)
                : trimmedLine.split(delimiter);
              const parts = rawParts.map(part => parseFloat(part.trim()));
              
              if (onDataLengthChange) {
                const validPartsCount = parts.length;
                if (validPartsCount > 0 && validPartsCount !== lastDataLengthRef.current) {
                  lastDataLengthRef.current = validPartsCount;
                  if (validPartsCount !== channelsRef.current.length) {
                    onDataLengthChange(validPartsCount);
                  }
                }
              }
              
              const newPoint: DataPoint = { time: timeRef.current };
              
              channelsRef.current.forEach((ch, index) => {
                 if (index < parts.length && !Number.isNaN(parts[index])) {
                   newPoint[ch.id] = parts[index];
                 } else {
                   newPoint[ch.id] = null;
                 }
              });
              
              newPoints.push(newPoint);
            });

            if (newPoints.length > 0) {
              pendingPointsRef.current.push(...newPoints);
            }
            
            const now = performance.now();
            if (now - lastUiUpdateTime >= UI_UPDATE_INTERVAL) {
              lastUiUpdateTime = now;
              flushPendingBuffers();
            }
          }
        }
      }
      
      flushPendingBuffers();
      
    } catch (err: any) {
      console.error("Serial connection failed:", err);
      if (!portRef.current) {
        clearSelectedPort();
      }
      alert(`Serial Connection Error: ${err.message}`);
      await disconnect();
    }
  }, [clearSelectedPort, delimiter, disconnect, flushPendingBuffers, onDataLengthChange, rememberSelectedPort]);

  const clearData = () => {
    pendingPointsRef.current.length = 0;
    pendingLogsRef.current.length = 0;
    setData([]);
    setRawLogs([]);
    timeRef.current = 0;
    sessionStartRef.current = performance.now();
    bufferRef.current = '';
    lastDataLengthRef.current = null;
    resetStreamStateRef.current = true;
    setClearVersion(prev => prev + 1);
  };

  const clearLogs = useCallback(() => {
    pendingLogsRef.current.length = 0;
    setRawLogs([]);
    sessionStartRef.current = performance.now();
  }, []);

  const sendText = useCallback(async (payload: string) => {
    const port = portRef.current;
    if (!port?.writable) {
      return {
        ok: false,
        message: 'Serial port is not connected.'
      };
    }

    const trimmedPayload = payload.trim();
    const writer = port.writable.getWriter();

    try {
      const encodedPayload = encoderRef.current.encode(payload);
      await writer.write(encodedPayload);
      appendLogs([createConsoleEntry('tx', trimmedPayload, buildHexString(encodedPayload))]);

      return {
        ok: true,
        message: ''
      };
    } catch (error: any) {
      const message = error?.message ?? 'Failed to send data over serial.';
      appendLogs([createConsoleEntry('error', message, '')]);

      return {
        ok: false,
        message
      };
    } finally {
      writer.releaseLock();
    }
  }, [appendLogs, buildHexString, createConsoleEntry]);

  const sendBytes = useCallback(async (payload: Uint8Array, label: string = 'binary packet') => {
    const port = portRef.current;
    if (!port?.writable) {
      return {
        ok: false,
        message: 'Serial port is not connected.'
      };
    }

    const writer = port.writable.getWriter();

    try {
      await writer.write(payload);
      appendLogs([createConsoleEntry('tx', label, buildHexString(payload))]);

      return {
        ok: true,
        message: ''
      };
    } catch (error: any) {
      const message = error?.message ?? 'Failed to send data over serial.';
      appendLogs([createConsoleEntry('error', message, '')]);

      return {
        ok: false,
        message
      };
    } finally {
      writer.releaseLock();
    }
  }, [appendLogs, buildHexString, createConsoleEntry]);

  return { 
    data, 
    rawLogs, 
    isConnected, 
    isConnecting,
    isPaused,
    selectedPortLabel,
    hasSelectedPort,
    selectDevice,
    connect, 
    disconnect, 
    togglePause,
    clearData,
    clearLogs,
    clearVersion,
    sendText,
    sendBytes
  };
}
