import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { Candle } from '../services/chartData';

interface Props {
  candles: Candle[];
  symbol: string;
  timeframe: string;
  width: number;
  height: number;
}

const PAD_LEFT   = 8;
const PAD_RIGHT  = 70;  // espaço para labels de preço
const PAD_TOP    = 36;
const PAD_BOTTOM = 32;
const VOL_HEIGHT = 0.18; // 18% do height para volume

export default function CandleChart({ candles, symbol, timeframe, width, height }: Props) {
  if (!candles.length) return null;

  const chartW = width  - PAD_LEFT - PAD_RIGHT;
  const chartH = height - PAD_TOP  - PAD_BOTTOM;
  const priceH = chartH * (1 - VOL_HEIGHT);
  const volH   = chartH * VOL_HEIGHT;
  const volY   = PAD_TOP + priceH + 6;

  const candleW   = Math.max(2, (chartW / candles.length) - 1);
  const candleGap = chartW / candles.length;

  // Escala de preços
  const prices = candles.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const priceRange = maxP - minP || 1;
  const padding = priceRange * 0.04;
  const lo = minP - padding;
  const hi = maxP + padding;
  const range = hi - lo;

  const py = (price: number) => PAD_TOP + priceH * (1 - (price - lo) / range);

  // Escala de volume
  const maxVol = Math.max(...candles.map(c => c.volume), 1);
  const vy = (vol: number) => volY + volH * (1 - vol / maxVol);

  // Labels de preço (5 linhas)
  const priceLabels: number[] = [];
  for (let i = 0; i <= 4; i++) priceLabels.push(lo + (range * i) / 4);

  // Decimais adequados por símbolo
  function formatPrice(p: number): string {
    if (p >= 1000) return p.toFixed(2);
    if (p >= 10)   return p.toFixed(3);
    return p.toFixed(5);
  }

  // Labels de tempo (5 labels distribuídos)
  const timeLabels: { idx: number; label: string }[] = [];
  const step = Math.floor(candles.length / 5);
  const firstDay = new Date(candles[0].time).getDate();
  const lastDay  = new Date(candles[candles.length - 1].time).getDate();
  const spansDays = firstDay !== lastDay;
  for (let i = 0; i < 5; i++) {
    const idx = i * step;
    const d = new Date(candles[idx].time);
    let label: string;
    if (timeframe === 'D1') {
      label = `${d.getDate()}/${d.getMonth() + 1}`;
    } else if (spansDays) {
      label = `${d.getDate()}/${d.getMonth() + 1}\n${String(d.getHours()).padStart(2,'0')}h`;
    } else {
      label = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }
    timeLabels.push({ idx, label });
  }

  const lastClose  = candles[candles.length - 1].close;
  const lastY      = py(lastClose);
  const isPositive = lastClose >= candles[0].open;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>

        {/* Fundo */}
        <Rect x={0} y={0} width={width} height={height} fill="#0d0d0d" />

        {/* Header */}
        <Rect x={0} y={0} width={width} height={PAD_TOP - 2} fill="#141414" />
        <SvgText
          x={PAD_LEFT + 4} y={PAD_TOP - 8}
          fill="#FFD700" fontSize={13} fontWeight="bold"
        >
          {symbol}
        </SvgText>
        <SvgText
          x={PAD_LEFT + 80} y={PAD_TOP - 8}
          fill="#666" fontSize={11}
        >
          {timeframe}
        </SvgText>
        <SvgText
          x={width - PAD_RIGHT - 4} y={PAD_TOP - 8}
          fill={isPositive ? '#00C896' : '#FF4444'} fontSize={12}
          textAnchor="end"
        >
          {formatPrice(lastClose)}
        </SvgText>

        {/* Grid horizontal */}
        {priceLabels.map((p, i) => {
          const y = py(p);
          return (
            <G key={i}>
              <Line x1={PAD_LEFT} y1={y} x2={PAD_LEFT + chartW} y2={y}
                stroke="#1e1e1e" strokeWidth={1} />
              <SvgText
                x={PAD_LEFT + chartW + 4} y={y + 4}
                fill="#555" fontSize={9.5} textAnchor="start"
              >
                {formatPrice(p)}
              </SvgText>
            </G>
          );
        })}

        {/* Separador área volume */}
        <Line
          x1={PAD_LEFT} y1={volY - 2}
          x2={PAD_LEFT + chartW} y2={volY - 2}
          stroke="#1e1e1e" strokeWidth={1}
        />

        {/* Candles */}
        {candles.map((c, i) => {
          const x      = PAD_LEFT + i * candleGap + candleGap / 2;
          const isBull = c.close >= c.open;
          const color  = isBull ? '#00C896' : '#FF4444';
          const bodyY  = py(Math.max(c.open, c.close));
          const bodyH  = Math.max(1, Math.abs(py(c.open) - py(c.close)));
          const wickX  = x;

          return (
            <G key={i}>
              {/* Pavio superior */}
              <Line
                x1={wickX} y1={py(c.high)}
                x2={wickX} y2={bodyY}
                stroke={color} strokeWidth={1}
              />
              {/* Corpo */}
              <Rect
                x={x - candleW / 2} y={bodyY}
                width={candleW} height={bodyH}
                fill={color}
                opacity={isBull ? 0.9 : 0.85}
              />
              {/* Pavio inferior */}
              <Line
                x1={wickX} y1={bodyY + bodyH}
                x2={wickX} y2={py(c.low)}
                stroke={color} strokeWidth={1}
              />
              {/* Volume */}
              <Rect
                x={x - candleW / 2}
                y={vy(c.volume)}
                width={candleW}
                height={volY + volH - vy(c.volume)}
                fill={color}
                opacity={0.4}
              />
            </G>
          );
        })}

        {/* Linha de preço atual */}
        <Line
          x1={PAD_LEFT} y1={lastY}
          x2={PAD_LEFT + chartW} y2={lastY}
          stroke={isPositive ? '#00C896' : '#FF4444'}
          strokeWidth={1}
          strokeDasharray="4,3"
          opacity={0.7}
        />

        {/* Labels de tempo */}
        {timeLabels.map(({ idx, label }) => {
          const x = PAD_LEFT + idx * candleGap + candleGap / 2;
          return (
            <SvgText
              key={idx}
              x={x} y={height - 6}
              fill="#444" fontSize={9}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}

      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d0d0d',
    borderRadius: 10,
    overflow: 'hidden',
  },
});
