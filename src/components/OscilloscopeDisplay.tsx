import React, { useDeferredValue, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ChannelConfig, DataPoint, ScopeDisplayMode } from '../types';

interface OscilloscopeDisplayProps {
  channels: ChannelConfig[];
  data: DataPoint[];
  clearVersion: number;
  displayMode: ScopeDisplayMode;
  coordinateXChannelId: string;
  coordinateYChannelId: string;
  coordinateWindowSize: number;
  echartsRef: React.RefObject<ReactECharts | null>;
}

export const OscilloscopeDisplay: React.FC<OscilloscopeDisplayProps> = ({
  channels,
  data,
  clearVersion,
  displayMode,
  coordinateXChannelId,
  coordinateYChannelId,
  coordinateWindowSize,
  echartsRef
}) => {
  const deferredData = useDeferredValue(data);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (echartsRef.current) {
        const echart = echartsRef.current.getEchartsInstance();
        echart.dispatchAction({
          type: 'dataZoom',
          dataZoomId: 'zoomYInside',
          ...(displayMode === 'timeline'
            ? { startValue: -15, endValue: 15 }
            : { start: 0, end: 100 })
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
    }, 100);
    return () => clearTimeout(timer);
  }, [clearVersion, displayMode, echartsRef]);

  useEffect(() => {
    if (deferredData.length === 0 && echartsRef.current) {
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
  }, [deferredData.length, echartsRef]);

  const options = useMemo(() => {
    const coordinateXChannel = channels.find(channel => channel.id === coordinateXChannelId) ?? null;
    const coordinateYChannel = channels.find(channel => channel.id === coordinateYChannelId) ?? null;

    if (displayMode === 'coordinate') {
      const coordinatePoints = deferredData
        .map(point => {
          const rawX = coordinateXChannel ? point[coordinateXChannel.id] : null;
          const rawY = coordinateYChannel ? point[coordinateYChannel.id] : null;

          if (
            rawX === undefined || rawX === null ||
            rawY === undefined || rawY === null
          ) {
            return null;
          }

          return [
            (rawX as number) * (coordinateXChannel?.gain ?? 1) + (coordinateXChannel?.offset ?? 0),
            (rawY as number) * (coordinateYChannel?.gain ?? 1) + (coordinateYChannel?.offset ?? 0)
          ] as [number, number];
        })
        .filter((point): point is [number, number] => point !== null);

      const visibleCoordinatePoints = coordinateWindowSize > 0
        ? coordinatePoints.slice(-coordinateWindowSize)
        : coordinatePoints;

      return {
        backgroundColor: 'transparent',
        tooltip: { show: false },
        legend: { show: false },
        grid: { top: 30, bottom: 50, left: 50, right: 40, containLabel: true },
        xAxis: {
          type: 'value',
          name: coordinateXChannel?.name ?? 'X',
          nameTextStyle: { color: '#9ca3af' },
          splitLine: { show: true, lineStyle: { color: '#1f2937', type: 'dashed' } },
          axisLabel: { color: '#9ca3af', formatter: '{value} mm' },
          axisLine: { lineStyle: { color: '#374151' } },
          min: 'dataMin',
          max: 'dataMax',
          animation: false
        },
        yAxis: {
          type: 'value',
          name: coordinateYChannel?.name ?? 'Y',
          nameTextStyle: { color: '#9ca3af' },
          splitLine: { show: true, lineStyle: { color: '#1f2937', type: 'dashed' } },
          axisLabel: { color: '#9ca3af', formatter: '{value} mm' },
          axisLine: { lineStyle: { color: '#374151' } },
          min: 'dataMin',
          max: 'dataMax',
          animation: false
        },
        dataZoom: [
          { id: 'zoomXInside', type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true },
          { id: 'zoomYInside', type: 'inside', yAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true },
          { id: 'zoomXSlider', type: 'slider', xAxisIndex: 0, filterMode: 'none', bottom: 10, height: 20, textStyle: { color: '#9ca3af' } }
        ],
        series: [
          {
            name: 'Trajectory',
            type: 'scatter',
            symbolSize: 8,
            large: true,
            largeThreshold: 2000,
            data: visibleCoordinatePoints,
            itemStyle: {
              color: coordinateYChannel?.color ?? '#38bdf8',
              shadowColor: coordinateYChannel?.color ?? '#38bdf8',
              shadowBlur: 6,
            },
            animation: false,
          }
        ]
      };
    }

    const activeChannels = channels.filter(ch => ch.visible);
    const series = activeChannels.map(ch => ({
      name: ch.name,
      type: 'line',
      showSymbol: false,
      hoverAnimation: false,
      emphasis: { disabled: true },
      large: true,
      largeThreshold: 2000,
      progressive: 8000,
      progressiveThreshold: 12000,
      sampling: 'lttb',
      data: deferredData.map(d => [
        d.time,
        d[ch.id] !== undefined && d[ch.id] !== null
          ? (d[ch.id] as number) * ch.gain + ch.offset
          : null
      ]),
      lineStyle: {
        width: 1.8,
        color: ch.color,
        shadowColor: ch.color,
        shadowBlur: 4,
      },
      itemStyle: { color: ch.color },
      animation: false,
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        show: false
      },
      legend: { show: false },
      grid: { top: 30, bottom: 50, left: 40, right: 40, containLabel: true },
      xAxis: {
        type: 'value',
        splitLine: { show: true, lineStyle: { color: '#1f2937', type: 'dashed' } },
        axisLabel: { color: '#9ca3af', formatter: '{value} s' },
        axisLine: { lineStyle: { color: '#374151' } },
        min: 'dataMin',
        max: 'dataMax',
        animation: false
      },
      yAxis: {
        type: 'value',
        splitLine: { show: true, lineStyle: { color: '#1f2937', type: 'dashed' } },
        axisLabel: { color: '#9ca3af' },
        axisLine: { lineStyle: { color: '#374151' } },
        min: -1000000,
        max: 1000000,
        animation: false
      },
      dataZoom: [
        { id: 'zoomXInside', type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true },
        { id: 'zoomYInside', type: 'inside', yAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true },
        { id: 'zoomXSlider', type: 'slider', xAxisIndex: 0, filterMode: 'none', bottom: 10, height: 20, textStyle: { color: '#9ca3af' } }
      ],
      series
    };
  }, [
    channels,
    coordinateWindowSize,
    coordinateXChannelId,
    coordinateYChannelId,
    deferredData,
    displayMode
  ]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactECharts 
        key={clearVersion}
        ref={echartsRef}
        option={options} 
        notMerge={false}
        lazyUpdate={true}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
};
