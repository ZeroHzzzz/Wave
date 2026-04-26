import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import ReactECharts from 'echarts-for-react';
import './App.css';
import type { ChannelConfig, ScopeDisplayMode } from './types';
import { useSerialReceiver } from './hooks/useSerialReceiver';
import { usePidCards } from './hooks/usePidCards';
import { OscilloscopeDisplay } from './components/OscilloscopeDisplay';
import { ChannelControl } from './components/ChannelControl';
import { ScopeControlBar } from './components/ScopeControlBar';
import { PidTuningPanel } from './components/PidTuningPanel';
import { ConsolePanel } from './components/ConsolePanel';
import { createAutoChannel, INITIAL_CHANNELS } from './constants/appDefaults';
import { buildRunStatePacket } from './utils/pidProtocol';

function App() {
  const [channels, setChannels] = useState<ChannelConfig[]>(INITIAL_CHANNELS);
  const [displayMode, setDisplayMode] = useState<ScopeDisplayMode>('timeline');
  const [delimiter, setDelimiter] = useState(',');
  const [baudRate, setBaudRate] = useState(115200);
  const [historyLimit, setHistoryLimit] = useState<number>(200000);
  const [coordinateXChannelId, setCoordinateXChannelId] = useState(INITIAL_CHANNELS[0]?.id ?? '');
  const [coordinateYChannelId, setCoordinateYChannelId] = useState(
    INITIAL_CHANNELS[1]?.id ?? INITIAL_CHANNELS[0]?.id ?? ''
  );
  const [coordinateWindowSize, setCoordinateWindowSize] = useState<number>(500);
  const [consoleMode, setConsoleMode] = useState<'string' | 'hex'>('string');
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'rx'>('all');
  const [showConsoleTimestamps, setShowConsoleTimestamps] = useState(true);
  const [scopeHeight, setScopeHeight] = useState(560);
  const [isResizingScope, setIsResizingScope] = useState(false);
  const [isVehicleRunning, setIsVehicleRunning] = useState(false);
  const [isVehicleTogglePending, setIsVehicleTogglePending] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<ReactECharts>(null);
  const pidImportInputRef = useRef<HTMLInputElement>(null);

  const handleDataLengthChange = useCallback((count: number) => {
    setChannels(prev => {
      if (prev.length === count) return prev;

      if (prev.length > count) {
        return prev.slice(0, count);
      }

      return [
        ...prev,
        ...Array.from({ length: count - prev.length }, (_, index) => createAutoChannel(prev.length + index))
      ];
    });
  }, []);

  const {
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
    sendBytes
  } = useSerialReceiver(channels, historyLimit, delimiter, handleDataLengthChange);
  const {
    cards: pidCards,
    status: pidStatus,
    addCard,
    updateCard,
    removeCard,
    sendCard,
    sendAll,
    exportCards,
    importFromFile
  } = usePidCards(sendBytes);

  useEffect(() => {
    if (!isResizingScope) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const workspaceRect = workspaceRef.current?.getBoundingClientRect();
      if (!workspaceRect) return;

      const nextHeight = event.clientY - workspaceRect.top - 5;
      const minHeight = 360;
      const maxHeight = Math.max(minHeight, window.innerHeight - 180);
      setScopeHeight(Math.min(Math.max(nextHeight, minHeight), maxHeight));
    };

    const handlePointerUp = () => {
      setIsResizingScope(false);
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizingScope]);

  useEffect(() => {
    setCoordinateXChannelId(prev => (
      channels.some(channel => channel.id === prev) ? prev : (channels[0]?.id ?? '')
    ));
    setCoordinateYChannelId(prev => (
      channels.some(channel => channel.id === prev)
        ? prev
        : (channels[1]?.id ?? channels[0]?.id ?? '')
    ));
  }, [channels]);

  useEffect(() => {
    setCoordinateWindowSize(prev => Math.min(prev, historyLimit));
  }, [historyLimit]);

  const updateChannel = (id: string, updates: Partial<ChannelConfig>) => {
    setChannels(prev => prev.map(ch => (ch.id === id ? { ...ch, ...updates } : ch)));
  };

  const handleImportPidCards = () => {
    pidImportInputRef.current?.click();
  };

  const handleToggleVehicleRun = useCallback(async () => {
    const nextRunState = !isVehicleRunning;
    const packet = buildRunStatePacket(nextRunState);

    setIsVehicleTogglePending(true);
    const result = await sendBytes(
      packet.packet,
      `RUN_SET state=${nextRunState ? 1 : 0} seq=${packet.sequence}`
    );

    if (result.ok) {
      setIsVehicleRunning(nextRunState);
    }

    setIsVehicleTogglePending(false);
  }, [isVehicleRunning, sendBytes]);

  const handlePidFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    await importFromFile(file);
  };

  const handleAutoScale = () => {
    if (data.length === 0) return;

    if (displayMode === 'coordinate') {
      if (echartsRef.current) {
        const echart = echartsRef.current.getEchartsInstance();
        echart.dispatchAction({
          type: 'dataZoom',
          dataZoomId: 'zoomXInside',
          start: 0,
          end: 100
        });
        echart.dispatchAction({
          type: 'dataZoom',
          dataZoomId: 'zoomYInside',
          start: 0,
          end: 100
        });
        echart.dispatchAction({
          type: 'dataZoom',
          dataZoomId: 'zoomXSlider',
          start: 0,
          end: 100
        });
      }
      return;
    }

    let min = Infinity;
    let max = -Infinity;
    const activeChannels = channels.filter(ch => ch.visible);

    data.forEach(point => {
      activeChannels.forEach(channel => {
        const value = point[channel.id];
        if (value !== undefined && value !== null) {
          const actualValue = (value as number) * channel.gain + channel.offset;
          if (actualValue < min) min = actualValue;
          if (actualValue > max) max = actualValue;
        }
      });
    });

    if (min === Infinity || max === -Infinity) return;

    let range = max - min;
    if (range === 0) {
      range = 10;
      min -= 5;
      max += 5;
    }

    const padding = range * 0.1;
    const finalMin = Math.floor(min - padding);
    const finalMax = Math.ceil(max + padding);

    if (echartsRef.current) {
      const echart = echartsRef.current.getEchartsInstance();
      echart.dispatchAction({
        type: 'dataZoom',
        dataZoomId: 'zoomYInside',
        startValue: finalMin,
        endValue: finalMax
      });
      echart.dispatchAction({
        type: 'dataZoom',
        dataZoomId: 'zoomXInside',
        start: 0,
        end: 100
      });
      echart.dispatchAction({
        type: 'dataZoom',
        dataZoomId: 'zoomXSlider',
        start: 0,
        end: 100
      });
    }
  };

  return (
    <div className="app-container">
      <div
        ref={workspaceRef}
        className={`workspace-layout ${isResizingScope ? 'is-resizing' : ''}`}
        style={{ gridTemplateRows: `${scopeHeight}px 10px auto` }}
      >
        <section className="panel scope-panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Monitor</p>
              <h2 className="panel-title">Oscilloscope Workspace</h2>
            </div>
            <span className="header-chip compact">Timeline zoom enabled</span>
          </div>

          <div className="scope-workspace">
            <div className="scope-main">
              <ScopeControlBar
                isConnected={isConnected}
                isConnecting={isConnecting}
                isPaused={isPaused}
                hasSelectedPort={hasSelectedPort}
                selectedPortLabel={selectedPortLabel}
                baudRate={baudRate}
                delimiter={delimiter}
                displayMode={displayMode}
                historyLimit={historyLimit}
                coordinateXChannelId={coordinateXChannelId}
                coordinateYChannelId={coordinateYChannelId}
                coordinateWindowSize={coordinateWindowSize}
                availableChannels={channels}
                sampleCount={data.length}
                visibleChannelCount={channels.filter(ch => ch.visible).length}
                isVehicleRunning={isVehicleRunning}
                isVehicleTogglePending={isVehicleTogglePending}
                onSelectDevice={selectDevice}
                onBaudRateChange={setBaudRate}
                onChangeDelimiter={setDelimiter}
                onDisplayModeChange={setDisplayMode}
                onHistoryLimitChange={setHistoryLimit}
                onCoordinateXChannelChange={setCoordinateXChannelId}
                onCoordinateYChannelChange={setCoordinateYChannelId}
                onCoordinateWindowSizeChange={(value) => {
                  const normalizedValue = Number.isFinite(value) ? Math.round(value) : 10;
                  setCoordinateWindowSize(Math.min(Math.max(normalizedValue, 10), historyLimit));
                }}
                onConnect={() => connect(baudRate)}
                onDisconnect={disconnect}
                onToggleVehicleRun={handleToggleVehicleRun}
                onTogglePause={togglePause}
                onClear={clearData}
                onAutoScale={handleAutoScale}
              />

              <div className="chart-area">
                <OscilloscopeDisplay
                  channels={channels}
                  data={data}
                  clearVersion={clearVersion}
                  displayMode={displayMode}
                  coordinateXChannelId={coordinateXChannelId}
                  coordinateYChannelId={coordinateYChannelId}
                  coordinateWindowSize={coordinateWindowSize}
                  echartsRef={echartsRef}
                />
              </div>
            </div>

            <aside className="channel-panel">
              <div className="panel-header inset">
                <div>
                  <p className="panel-eyebrow">Signals</p>
                  <h2 className="panel-title">Channel Controls</h2>
                </div>
                <span className="header-chip compact">{channels.length} channels</span>
              </div>
              <div className="channel-list">
                {channels.map(channel => (
                  <ChannelControl
                    key={channel.id}
                    channel={channel}
                    onChange={(updates) => updateChannel(channel.id, updates)}
                  />
                ))}
              </div>
            </aside>
          </div>
        </section>

        <div
          className="workspace-resizer"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize oscilloscope height"
          onPointerDown={(event) => {
            event.preventDefault();
            setIsResizingScope(true);
          }}
        >
          <span className="workspace-resizer-handle" />
        </div>

        <div className="bottom-workspace">
          <input
            ref={pidImportInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden-file-input"
            onChange={handlePidFileSelected}
          />

          <PidTuningPanel
            cards={pidCards}
            isConnected={isConnected}
            statusMessage={pidStatus.message}
            statusTone={pidStatus.tone}
            onAddCard={addCard}
            onUpdateCard={updateCard}
            onRemoveCard={removeCard}
            onSendCard={sendCard}
            onSendAll={sendAll}
            onExport={exportCards}
            onImport={handleImportPidCards}
          />

          <ConsolePanel
            isConnected={isConnected}
            logs={rawLogs}
            mode={consoleMode}
            filter={consoleFilter}
            showTimestamps={showConsoleTimestamps}
            onModeChange={setConsoleMode}
            onFilterChange={setConsoleFilter}
            onToggleTimestamps={() => setShowConsoleTimestamps(prev => !prev)}
            onClear={clearLogs}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
