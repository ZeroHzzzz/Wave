import React, { useDeferredValue, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ChannelConfig, DataPoint } from '../types';

const LOGIC_POINT_CACHE_LIMIT = 50;
const VEHICLE_POINT_CACHE_LIMIT = 6;
const MAX_TRAJECTORY_POINTS = 1200;
const COMPACT_FRAME_VALUE_COUNT = 6;
const TRACK_SENSOR_WIDTH_MM = 15 * 9;

type PointTuple = [number, number];

interface LogicCloudFrame {
  carPos: PointTuple | null;
  latestRealPoint: PointTuple | null;
  latestRelativePoint: PointTuple | null;
}

interface LogicCloudDisplayProps {
  channels: ChannelConfig[];
  data: DataPoint[];
  clearVersion: number;
  resetVersion: number;
}

function readFrameValues(point: DataPoint | null, channels: ChannelConfig[]) {
  if (!point) return [];

  return channels.map(channel => {
    const value = point[channel.id];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  });
}

function readPoint(values: Array<number | null>, startIndex: number): PointTuple | null {
  const x = values[startIndex];
  const y = values[startIndex + 1];

  return typeof x === 'number' && typeof y === 'number' ? [x, y] : null;
}

function extractLogicFrame(point: DataPoint | null, channels: ChannelConfig[]): LogicCloudFrame {
  const values = readFrameValues(point, channels);

  if (values.length < COMPACT_FRAME_VALUE_COUNT) {
    return {
      carPos: null,
      latestRealPoint: null,
      latestRelativePoint: null
    };
  }

  return {
    carPos: readPoint(values, 0),
    latestRealPoint: readPoint(values, 2),
    latestRelativePoint: readPoint(values, 4)
  };
}

function extractCarTrajectory(data: DataPoint[], channels: ChannelConfig[]) {
  const start = Math.max(0, data.length - MAX_TRAJECTORY_POINTS);
  const trajectory: PointTuple[] = [];
  let lastPoint: PointTuple | null = null;

  for (let index = start; index < data.length; index += 1) {
    const values = readFrameValues(data[index], channels);
    const point = readPoint(values, 0);

    if (!point) continue;
    if (lastPoint && Math.abs(lastPoint[0] - point[0]) < 0.0001 && Math.abs(lastPoint[1] - point[1]) < 0.0001) continue;

    lastPoint = point;
    trajectory.push(point);
  }

  return trajectory;
}

function extractPointCache(data: DataPoint[], channels: ChannelConfig[], startIndex: number) {
  const points: PointTuple[] = [];

  for (let index = Math.max(0, data.length - MAX_TRAJECTORY_POINTS); index < data.length; index += 1) {
    const values = readFrameValues(data[index], channels);
    const point = readPoint(values, startIndex);

    if (point) {
      points.push(point);
    }
  }

  return points.slice(-LOGIC_POINT_CACHE_LIMIT);
}

function bodyPointToVehicleChart(point: PointTuple): PointTuple {
  const [forward, left] = point;
  return [left, forward];
}

function formatNumber(value: number | null | undefined, digits = 1) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--';
}

export const LogicCloudDisplay: React.FC<LogicCloudDisplayProps> = ({
  channels,
  data,
  clearVersion,
  resetVersion
}) => {
  const globalChartRef = useRef<ReactECharts>(null);
  const relativeChartRef = useRef<ReactECharts>(null);
  const deferredData = useDeferredValue(data);

  const frame = useMemo(
    () => extractLogicFrame(deferredData.at(-1) ?? null, channels),
    [channels, deferredData]
  );
  const carTrajectory = useMemo(
    () => extractCarTrajectory(deferredData, channels),
    [channels, deferredData]
  );
  const realPointCache = useMemo(
    () => extractPointCache(deferredData, channels, 2),
    [channels, deferredData]
  );
  const relativePointCache = useMemo(
    () => extractPointCache(deferredData, channels, 4),
    [channels, deferredData]
  );
  const vehiclePointCache = useMemo(
    () => relativePointCache.slice(-VEHICLE_POINT_CACHE_LIMIT).map(bodyPointToVehicleChart),
    [relativePointCache]
  );
  const vehicleHistoryPoints = useMemo(
    () => vehiclePointCache.slice(0, -1),
    [vehiclePointCache]
  );
  const latestVehiclePoint = useMemo(
    () => vehiclePointCache.at(-1) ?? null,
    [vehiclePointCache]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      [globalChartRef.current, relativeChartRef.current].forEach(chartRef => {
        const chart = chartRef?.getEchartsInstance();
        if (!chart) return;

        chart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [clearVersion, resetVersion]);

  const globalOptions = useMemo(() => ({
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      textStyle: { color: '#e5e7eb' },
      formatter: (params: { seriesName?: string; data?: PointTuple }) => {
        const dataPoint = params.data;
        if (!Array.isArray(dataPoint)) return params.seriesName ?? '';
        return `${params.seriesName}<br/>forward ${formatNumber(dataPoint[1])} mm<br/>left ${formatNumber(dataPoint[0])} mm`;
      }
    },
    legend: {
      top: 4,
      right: 10,
      textStyle: { color: '#cbd5e1' },
      itemWidth: 16,
      itemHeight: 8
    },
    grid: { top: 46, bottom: 44, left: 54, right: 28, containLabel: true },
    xAxis: {
      type: 'value',
      name: 'X mm',
      nameTextStyle: { color: '#94a3b8' },
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#475569' } },
      splitLine: { show: true, lineStyle: { color: '#1f2937', type: 'dashed' } },
      min: 'dataMin',
      max: 'dataMax'
    },
    yAxis: {
      type: 'value',
      name: 'Y mm',
      nameTextStyle: { color: '#94a3b8' },
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#475569' } },
      splitLine: { show: true, lineStyle: { color: '#1f2937', type: 'dashed' } },
      min: 'dataMin',
      max: 'dataMax'
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      { type: 'inside', yAxisIndex: 0, filterMode: 'none' }
    ],
    series: [
      {
        name: 'INS Track',
        type: 'line',
        showSymbol: false,
        data: carTrajectory,
        lineStyle: { color: '#38bdf8', width: 2.2 },
        emphasis: { disabled: true }
      },
      {
        name: 'Real Points',
        type: 'scatter',
        symbolSize: 8,
        data: realPointCache,
        itemStyle: { color: '#fbbf24' }
      },
      {
        name: 'Car',
        type: 'scatter',
        symbol: 'triangle',
        symbolSize: 18,
        data: frame.carPos ? [frame.carPos] : [],
        itemStyle: { color: '#34d399', borderColor: '#ecfeff', borderWidth: 1.5 }
      }
    ]
  }), [carTrajectory, frame.carPos, realPointCache]);

  const relativeOptions = useMemo(() => ({
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      textStyle: { color: '#e5e7eb' },
      formatter: (params: { seriesName?: string; data?: PointTuple }) => {
        const dataPoint = params.data;
        if (!Array.isArray(dataPoint)) return params.seriesName ?? '';
        return `${params.seriesName}<br/>x ${formatNumber(dataPoint[0])} mm<br/>y ${formatNumber(dataPoint[1])} mm`;
      }
    },
    legend: {
      top: 4,
      right: 10,
      textStyle: { color: '#cbd5e1' },
      itemWidth: 16,
      itemHeight: 8
    },
    grid: { top: 46, bottom: 44, left: 54, right: 28, containLabel: true },
    xAxis: {
      type: 'value',
      name: 'Left / Right mm',
      inverse: true,
      nameTextStyle: { color: '#94a3b8' },
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#475569' } },
      splitLine: { show: true, lineStyle: { color: '#1f2937', type: 'dashed' } },
      min: -TRACK_SENSOR_WIDTH_MM,
      max: TRACK_SENSOR_WIDTH_MM
    },
    yAxis: {
      type: 'value',
      name: 'Forward mm',
      nameTextStyle: { color: '#94a3b8' },
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#475569' } },
      splitLine: { show: true, lineStyle: { color: '#1f2937', type: 'dashed' } },
      min: -35,
      max: Math.max(200, latestVehiclePoint?.[1] ?? 0)
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      { type: 'inside', yAxisIndex: 0, filterMode: 'none' }
    ],
    series: [
      {
        name: 'Line History',
        type: 'scatter',
        symbolSize: 7,
        data: vehicleHistoryPoints,
        itemStyle: { color: '#c4b5fd', opacity: 0.45 },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(148, 163, 184, 0.38)', type: 'dashed' },
          data: [{ xAxis: 0 }]
        }
      },
      {
        name: 'Line Point',
        type: 'scatter',
        symbolSize: 18,
        data: latestVehiclePoint ? [latestVehiclePoint] : [],
        itemStyle: { color: '#f8fafc', borderColor: '#c4b5fd', borderWidth: 2.5 }
      },
      {
        name: 'Car',
        type: 'scatter',
        symbol: 'triangle',
        symbolSize: 20,
        data: [[0, 0]],
        itemStyle: { color: '#22c55e', borderColor: '#ecfeff', borderWidth: 1.5 }
      }
    ]
  }), [latestVehiclePoint, vehicleHistoryPoints]);

  return (
    <div className="logic-cloud-workspace">
      <div className="logic-cloud-metrics">
        <div className="logic-metric">
          <span>Car X</span>
          <strong>{formatNumber(frame.carPos?.[0])}</strong>
        </div>
        <div className="logic-metric">
          <span>Car Y</span>
          <strong>{formatNumber(frame.carPos?.[1])}</strong>
        </div>
        <div className="logic-metric">
          <span>Real Cache</span>
          <strong>{realPointCache.length}/{LOGIC_POINT_CACHE_LIMIT}</strong>
        </div>
        <div className="logic-metric">
          <span>Relative Cache</span>
          <strong>{Math.min(relativePointCache.length, VEHICLE_POINT_CACHE_LIMIT)}/{VEHICLE_POINT_CACHE_LIMIT}</strong>
        </div>
        <div className="logic-metric accent">
          <span>Line Fwd</span>
          <strong>{formatNumber(frame.latestRelativePoint?.[0])}</strong>
        </div>
        <div className="logic-metric accent">
          <span>Line Left</span>
          <strong>{formatNumber(frame.latestRelativePoint?.[1])}</strong>
        </div>
      </div>

      <div className="logic-cloud-grid">
        <section className="logic-chart-panel">
          <div className="logic-chart-header">
            <p className="panel-eyebrow">World</p>
            <h3>INS Position</h3>
          </div>
          <div className="logic-chart-body">
            <ReactECharts
              ref={globalChartRef}
              option={globalOptions}
              notMerge={false}
              lazyUpdate={true}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        </section>

        <section className="logic-chart-panel">
          <div className="logic-chart-header">
            <p className="panel-eyebrow">Vehicle</p>
            <h3>Vehicle View</h3>
          </div>
          <div className="logic-chart-body">
            <ReactECharts
              ref={relativeChartRef}
              option={relativeOptions}
              notMerge={false}
              lazyUpdate={true}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        </section>
      </div>
    </div>
  );
};
