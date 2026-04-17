import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { OrdemPronta, TipoOperacao } from '../types/analise';

interface OrdemCardProps {
  ordem: OrdemPronta;
  isEntradaForte?: boolean;
}

const CORES: Record<TipoOperacao, { text: string; border: string; bg: string }> = {
  COMPRA: { text: '#00C896', border: '#00C896', bg: '#00C89615' },
  VENDA: { text: '#FF4444', border: '#FF4444', bg: '#FF444415' },
  SEM_OPERACAO: { text: '#FFA500', border: '#FFA500', bg: '#FFA50015' },
};

export default function OrdemCard({ ordem, isEntradaForte }: OrdemCardProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tipo = ordem.tipo;
  const cores = CORES[tipo] || CORES['SEM_OPERACAO'];

  useEffect(() => {
    if (isEntradaForte) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isEntradaForte]);

  const tipoLabel = tipo === 'COMPRA' ? '▲ COMPRA' : tipo === 'VENDA' ? '▼ VENDA' : '⏸ SEM OP';

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: pulseAnim }] }]}>
      <LinearGradient
        colors={['#FFD70020', '#1a1a1a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.container,
          { borderColor: isEntradaForte ? '#FFD700' : cores.border },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.ordemTitle}>🚀 ORDEM PRONTA</Text>
          {isEntradaForte && (
            <View style={styles.forteBadge}>
              <Text style={styles.forteText}>👉 ENTRADA FORTE</Text>
            </View>
          )}
        </View>

        <View style={[styles.tipoBox, { backgroundColor: cores.bg, borderColor: cores.border }]}>
          <Text style={[styles.tipoText, { color: cores.text }]}>{tipoLabel}</Text>
        </View>

        <View style={styles.grid}>
          <OrdemRow label="ATIVO" value={ordem.ativo} />
          {ordem.entrada1 ? (
            <>
              <OrdemRow label={`ENTRADA 1 (${ordem.entrada1_pct ?? 50}%)`} value={ordem.entrada1} highlight />
              <OrdemRow label={`ENTRADA 2 (${ordem.entrada2_pct ?? 50}%)`} value={ordem.entrada2 ?? '—'} highlight />
            </>
          ) : (
            <OrdemRow label="ENTRADA" value={ordem.entrada} highlight />
          )}
          <OrdemRow label="STOP LOSS" value={ordem.sl} cor="#FF4444" />
          {ordem.tp1 ? (
            <>
              <OrdemRow label="TP 1 (H1)"  value={`${ordem.tp1}  ${ordem.rr_tp1 ? `R/R ${ordem.rr_tp1}` : ''}`.trim()} cor="#00C896" />
              <OrdemRow label="TP 2 (H4)"  value={`${ordem.tp2}  ${ordem.rr_tp2 ? `R/R ${ordem.rr_tp2}` : ''}`.trim()} cor="#00C896" />
              <OrdemRow label="TP 3 (MACRO)" value={`${ordem.tp3}  ${ordem.rr_tp3 ? `R/R ${ordem.rr_tp3}` : ''}`.trim()} cor="#00E5FF" />
            </>
          ) : (
            <>
              <OrdemRow label="TAKE PROFIT" value={ordem.tp}  cor="#00C896" />
              <OrdemRow label="R/R"         value={ordem.rr}  cor="#FFD700" />
            </>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function OrdemRow({
  label,
  value,
  highlight,
  cor,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  cor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHL, cor ? { color: cor } : null]}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  container: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ordemTitle: {
    color: '#FFD700',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  forteBadge: {
    backgroundColor: '#FFD70030',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  forteText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
  },
  tipoBox: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
  },
  tipoText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  grid: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    gap: 8,
  },
  rowLabel: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    minWidth: 80,
    flexShrink: 0,
  },
  rowValue: {
    color: '#eee',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  rowValueHL: {
    color: '#fff',
    fontSize: 15,
  },
});
