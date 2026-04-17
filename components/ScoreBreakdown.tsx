import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoreBreakdown as ScoreBreakdownType } from '../types/analise';

interface Props {
  breakdown: ScoreBreakdownType;
}

const ITEMS: { key: keyof ScoreBreakdownType; label: string }[] = [
  { key: 'alinhamento_timeframes', label: 'Alinhamento TF' },
  { key: 'qualidade_zona',         label: 'Qualidade da Zona' },
  { key: 'confluencia_tecnica',    label: 'Confluência Técnica' },
  { key: 'contexto_macro',         label: 'Contexto Macro' },
];

function barColor(val: number): string {
  if (val >= 20) return '#00C896';
  if (val >= 12) return '#FFA500';
  return '#FF4444';
}

export default function ScoreBreakdown({ breakdown }: Props) {
  const [open, setOpen] = useState(false);
  const total = ITEMS.reduce((s, i) => s + (breakdown[i.key] ?? 0), 0);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <View style={styles.titleRow}>
          <Ionicons name="bar-chart-outline" size={14} color="#FFD700" />
          <Text style={styles.title}>SCORE BREAKDOWN</Text>
          <View style={[styles.totalBadge, { backgroundColor: total >= 70 ? '#00C89620' : total >= 50 ? '#FFA50020' : '#FF444420' }]}>
            <Text style={[styles.totalText, { color: total >= 70 ? '#00C896' : total >= 50 ? '#FFA500' : '#FF4444' }]}>
              {total}/100
            </Text>
          </View>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#555" />
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {ITEMS.map(({ key, label }) => {
            const val = Math.max(0, Math.min(25, breakdown[key] ?? 0));
            const pct = (val / 25) * 100;
            const color = barColor(val);
            return (
              <View key={key} style={styles.itemRow}>
                <Text style={styles.itemLabel}>{label}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                </View>
                <Text style={[styles.itemValue, { color }]}>{val}/25</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFD70030',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    color: '#FFD700', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, fontFamily: 'monospace',
  },
  totalBadge: {
    borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3,
  },
  totalText: { fontSize: 11, fontWeight: '900', fontFamily: 'monospace' },

  body: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemLabel: {
    color: '#888', fontSize: 10, fontFamily: 'monospace', minWidth: 110,
  },
  barBg: {
    flex: 1, height: 6, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  itemValue: {
    fontSize: 10, fontWeight: '700', fontFamily: 'monospace', minWidth: 36, textAlign: 'right',
  },
});
