import React, { useDeferredValue, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ChannelConfig, DataPoint } from '../types';

interface OscilloscopeDisplayProps {
  channels: ChannelConfig[];
  data: DataPoint[];
  clearVersion: number;
  echartsRef: React.RefObject<ReactECharts | null>;
}

export const OscilloscopeDisplay: React.FC<OscilloscopeDisplayProps> = ({
  channels,
  data,
  clearVersion,
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
          startValue: -15,
          endValue: 15
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
  }, [clearVersion, echartsRef]);

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
        dataZoomId: 'zoomXSlider',
        start: 0,
        end: 100
      });
    }
  }, [deferredData.length, echartsRef]);

  const options = useMemo(() => {
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
  }, [channels, deferredData]);

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
