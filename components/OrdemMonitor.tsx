import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Analise } from '../types/analise';
import { buscarPrecoAtual, getPollingInterval } from '../services/priceMonitor';
import { atualizarResultado } from '../services/storage';
import {
  notificarOrdemExecutada,
  notificarResultadoOrdem,
  notificarSLProximo,
  notificarTPParcial,
  notificarMoverSL,
} from '../services/notifications';

interface Props {
  analise: Analise;
  twelveDataApiKey: string;
  onResultadoAtualizado?: (resultado: 'WIN' | 'LOSS') => void;
}

type MonitorStatus = 'PENDENTE' | 'ABERTA' | 'TP1' | 'TP2' | 'WIN' | 'LOSS';

function formatPreco(p: number): string {
  if (p >= 1000) return p.toFixed(2);
  if (p >= 10)   return p.toFixed(3);
  return p.toFixed(5);
}

function distInfo(preco: number, nivel: number): { diff: string; pct: string; acima: boolean } {
  const acima = preco > nivel;
  const diff  = Math.abs(preco - nivel);
  const pct   = ((diff / nivel) * 100).toFixed(2);
  return { diff: diff.toFixed(2), pct, acima };
}

export default function OrdemMonitor({ analise, twelveDataApiKey, onResultadoAtualizado }: Props) {
  const [preco, setPreco]             = useState<number | null>(null);
  const [updateTime, setUpdateTime]   = useState<string>('');
  const [erro, setErro]               = useState<string | null>(null);
  const [monitorando, setMonitorando] = useState(false);
  const [status, setStatus]           = useState<MonitorStatus>('PENDENTE');

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const encerradoRef  = useRef(false);
  const executadaRef  = useRef(false);
  const slProximoRef  = useRef(false);
  const tp1HitRef     = useRef(false);
  const tp2HitRef     = useRef(false);

  const { ordem, tipo } = analise;

  const escalonada = !!(ordem.entrada1 && ordem.entrada2);
  const entrada1 = escalonada ? (parseFloat(ordem.entrada1!) || 0) : 0;
  const entrada2 = escalonada ? (parseFloat(ordem.entrada2!) || 0) : 0;
  const entrada  = parseFloat(ordem.entrada) || 0;
  const sl       = parseFloat(ordem.sl)      || 0;

  // Multi-TP: usa tp1/tp2/tp3 se disponível
  const hasMultiTP = !!(ordem.tp1 && ordem.tp2);
  const tp1v = hasMultiTP ? (parseFloat(ordem.tp1!) || 0) : 0;
  const tp2v = hasMultiTP ? (parseFloat(ordem.tp2!) || 0) : 0;
  const tp3v = hasMultiTP ? (parseFloat(ordem.tp3!) || 0) : 0;
  const tp    = hasMultiTP ? tp1v : (parseFloat(ordem.tp) || 0); // para barra visual

  const entradaGatilho = escalonada
    ? (tipo === 'COMPRA' ? Math.max(entrada1, entrada2) : Math.min(entrada1, entrada2))
    : entrada;

  // calcStatus só é usado para single-TP
  function calcStatus(p: number): MonitorStatus {
    if (tipo === 'COMPRA') {
      if (sl > 0 && p <= sl)                              return 'LOSS';
      if (tp > 0 && p >= tp)                              return 'WIN';
      if (entradaGatilho > 0 && p <= entradaGatilho * 1.002) return 'ABERTA';
    } else {
      if (sl > 0 && p >= sl)                              return 'LOSS';
      if (tp > 0 && p <= tp)                              return 'WIN';
      if (entradaGatilho > 0 && p >= entradaGatilho * 0.998) return 'ABERTA';
    }
    return 'PENDENTE';
  }

  const pararMonitoramento = useCallback(() => {
    setMonitorando(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const buscarPreco = useCallback(async () => {
    try {
      setErro(null);
      const p = await buscarPrecoAtual(analise.ativo, twelveDataApiKey);
      setPreco(p);
      setUpdateTime(new Date().toLocaleTimeString('pt-BR'));

      if (encerradoRef.current) return;

      const isCompra = tipo === 'COMPRA';

      // ── Alerta SL próximo (universal) ──────────────────────────────────────
      if (!slProximoRef.current && sl > 0 && entradaGatilho > 0) {
        const totalRange = Math.abs(entradaGatilho - sl);
        const distToSL   = Math.abs(p - sl);
        if (totalRange > 0 && distToSL / totalRange < 0.25) {
          slProximoRef.current = true;
          notificarSLProximo(analise).catch(() => {});
        }
      }

      // ── Multi-TP (H4+H1 ou D1+H4+H1) ─────────────────────────────────────
      if (hasMultiTP) {
        // Verificar SL sempre que em operação
        if (executadaRef.current && sl > 0) {
          const slHit = isCompra ? p <= sl : p >= sl;
          if (slHit) {
            encerradoRef.current = true;
            setStatus('LOSS');
            await atualizarResultado(analise.id, 'LOSS');
            notificarResultadoOrdem(analise, 'LOSS').catch(() => {});
            onResultadoAtualizado?.('LOSS');
            pararMonitoramento();
            return;
          }
        }

        if (!tp1HitRef.current) {
          // Verificar entrada
          if (!executadaRef.current) {
            const entryHit = isCompra
              ? p <= entradaGatilho * 1.002
              : p >= entradaGatilho * 0.998;
            if (entryHit) {
              executadaRef.current = true;
              setStatus('ABERTA');
              notificarOrdemExecutada(analise).catch(() => {});
            }
          }
          // Verificar TP1
          if (tp1v > 0) {
            const tp1Hit = isCompra ? p >= tp1v : p <= tp1v;
            if (tp1Hit) {
              tp1HitRef.current = true;
              setStatus('TP1');
              notificarTPParcial(analise, 1, ordem.tp1!).catch(() => {});
              notificarMoverSL(analise, ordem.entrada).catch(() => {});
            }
          }
        } else if (!tp2HitRef.current) {
          // TP1 já atingido — verificar TP2
          if (tp2v > 0) {
            const tp2Hit = isCompra ? p >= tp2v : p <= tp2v;
            if (tp2Hit) {
              if (tp3v > 0) {
                tp2HitRef.current = true;
                setStatus('TP2');
                notificarTPParcial(analise, 2, ordem.tp2!).catch(() => {});
              } else {
                encerradoRef.current = true;
                setStatus('WIN');
                await atualizarResultado(analise.id, 'WIN');
                notificarResultadoOrdem(analise, 'WIN').catch(() => {});
                onResultadoAtualizado?.('WIN');
                pararMonitoramento();
              }
            }
          }
        } else {
          // TP2 atingido — verificar TP3 (alvo final)
          if (tp3v > 0) {
            const tp3Hit = isCompra ? p >= tp3v : p <= tp3v;
            if (tp3Hit) {
              encerradoRef.current = true;
              setStatus('WIN');
              await atualizarResultado(analise.id, 'WIN');
              notificarResultadoOrdem(analise, 'WIN').catch(() => {});
              onResultadoAtualizado?.('WIN');
              pararMonitoramento();
            }
          }
        }
      } else {
        // ── Single-TP (modo simples) ──────────────────────────────────────
        const novoStatus = calcStatus(p);
        setStatus(novoStatus);

        if (novoStatus === 'ABERTA' && !executadaRef.current) {
          executadaRef.current = true;
          notificarOrdemExecutada(analise).catch(() => {});
        }

        if ((novoStatus === 'WIN' || novoStatus === 'LOSS') && !encerradoRef.current) {
          encerradoRef.current = true;
          await atualizarResultado(analise.id, novoStatus);
          notificarResultadoOrdem(analise, novoStatus).catch(() => {});
          onResultadoAtualizado?.(novoStatus);
          pararMonitoramento();
        }
      }
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao buscar preço');
    }
  }, [analise.ativo, analise.id, twelveDataApiKey, tipo, sl, tp, tp1v, tp2v, tp3v, entradaGatilho, hasMultiTP]);

  function iniciarMonitoramento() {
    encerradoRef.current  = false;
    executadaRef.current  = false;
    slProximoRef.current  = false;
    tp1HitRef.current     = false;
    tp2HitRef.current     = false;
    setMonitorando(true);
    buscarPreco();
    const interval = getPollingInterval(analise.ativo);
    intervalRef.current = setInterval(buscarPreco, interval);
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  if (tipo === 'SEM_OPERACAO') return null;

  // Barra visual: entre SL e TP mais alto disponível
  const tpVisual = hasMultiTP ? (tp3v || tp2v || tp1v) : tp;
  const barMin   = tipo === 'COMPRA' ? sl        : tpVisual;
  const barMax   = tipo === 'COMPRA' ? tpVisual  : sl;
  const barRange = barMax - barMin || 1;
  const barPct   = preco
    ? Math.max(2, Math.min(98, ((preco - barMin) / barRange) * 100))
    : 50;

  const entradaPct  = Math.max(2, Math.min(98, ((entrada  - barMin) / barRange) * 100));
  const entrada1Pct = escalonada ? Math.max(2, Math.min(98, ((entrada1 - barMin) / barRange) * 100)) : entradaPct;
  const entrada2Pct = escalonada ? Math.max(2, Math.min(98, ((entrada2 - barMin) / barRange) * 100)) : entradaPct;

  // Posições dos TPs na barra
  const tp1Pct = hasMultiTP && tp1v ? Math.max(2, Math.min(98, ((tp1v - barMin) / barRange) * 100)) : null;
  const tp2Pct = hasMultiTP && tp2v ? Math.max(2, Math.min(98, ((tp2v - barMin) / barRange) * 100)) : null;

  const STATUS_CONFIG: Record<MonitorStatus, { label: string; color: string }> = {
    PENDENTE: { label: '⏳ PENDENTE',    color: '#666'    },
    ABERTA:   { label: '🟡 ABERTA',      color: '#FFD700' },
    TP1:      { label: '🔰 TP1 PARCIAL', color: '#FFA500' },
    TP2:      { label: '🔰 TP2 PARCIAL', color: '#00C896' },
    WIN:      { label: '✅ WIN',          color: '#00C896' },
    LOSS:     { label: '❌ LOSS',         color: '#FF4444' },
  };
  const { label: statusLabel, color: statusColor } = STATUS_CONFIG[status];

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="pulse" size={14} color="#FFD700" />
          <Text style={styles.title}>MONITOR DE ORDEM</Text>
          {hasMultiTP && (
            <View style={styles.multiTPBadge}>
              <Text style={styles.multiTPText}>3 TPs</Text>
            </View>
          )}
        </View>
        <View style={[styles.statusBadge, { borderColor: statusColor + '80', backgroundColor: statusColor + '18' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Banner TP parcial com instrução */}
      {(status === 'TP1' || status === 'TP2') && (
        <View style={styles.tpParcialbanner}>
          <Ionicons name="information-circle" size={14} color="#FFA500" />
          <Text style={styles.tpParcialText}>
            {status === 'TP1'
              ? '💡 Feche 50% da posição · Mova SL para entrada'
              : '💡 Feche mais 25% · Mova SL para TP1'}
          </Text>
        </View>
      )}

      {/* Preço atual */}
      {preco ? (
        <>
          <View style={styles.precoBox}>
            <Text style={styles.precoLabel}>PREÇO ATUAL</Text>
            <Text style={[styles.precoValor, { color: tipo === 'COMPRA' ? '#00C896' : '#FF4444' }]}>
              {formatPreco(preco)}
            </Text>
            <Text style={styles.updateTime}>atualizado {updateTime}</Text>
          </View>

          {/* Barra SL → TP com marcadores */}
          <View style={styles.barSection}>
            <View style={styles.barBg}>
              <View style={[styles.barZonaSL, { width: `${entradaPct}%` }]} />
              <View style={[styles.barZonaTP, { width: `${100 - entradaPct}%` }]} />
              {/* Marcadores de entrada */}
              {escalonada ? (
                <>
                  <View style={[styles.entradaMarker, { left: `${entrada1Pct}%` as any, backgroundColor: '#FFD700cc' }]} />
                  <View style={[styles.entradaMarker, { left: `${entrada2Pct}%` as any, backgroundColor: '#FFA500aa' }]} />
                </>
              ) : (
                <View style={[styles.entradaMarker, { left: `${entradaPct}%` as any }]} />
              )}
              {/* Marcadores de TP parcial */}
              {tp1Pct !== null && tp1HitRef.current === false && (
                <View style={[styles.tpMarker, { left: `${tp1Pct}%` as any, backgroundColor: '#FFA500' }]} />
              )}
              {tp2Pct !== null && tp2HitRef.current === false && (
                <View style={[styles.tpMarker, { left: `${tp2Pct}%` as any, backgroundColor: '#00C89680' }]} />
              )}
              {/* Marcador de preço atual */}
              <View style={[styles.precoMarker, { left: `${barPct}%` as any }]} />
            </View>
            <View style={styles.barLabels}>
              <Text style={styles.slLabel}>{tipo === 'COMPRA' ? 'SL' : 'TP'} {formatPreco(barMin)}</Text>
              {escalonada
                ? <Text style={styles.entradaBarLabel}>E1 {formatPreco(entrada1)}  E2 {formatPreco(entrada2)}</Text>
                : <Text style={styles.entradaBarLabel}>ENT {formatPreco(entrada)}</Text>
              }
              <Text style={styles.tpLabel}>{tipo === 'COMPRA' ? 'TP3' : 'SL'} {formatPreco(barMax)}</Text>
            </View>
          </View>

          {/* Distâncias */}
          <View style={[styles.distGrid, escalonada && styles.distGridWrap]}>
            {(() => {
              const s = distInfo(preco, sl);
              const tpDisplay = hasMultiTP ? tp1v : tp;
              const t = distInfo(preco, tpDisplay);
              if (escalonada) {
                const e1 = distInfo(preco, entrada1);
                const e2 = distInfo(preco, entrada2);
                return (
                  <>
                    <NivelItem label={`E1 (${ordem.entrada1_pct ?? 50}%)`} nivel={formatPreco(entrada1)} diff={e1.diff} pct={e1.pct} atingido={Math.abs(preco - entrada1) / entrada1 < 0.002} color="#FFD700" />
                    <NivelItem label={`E2 (${ordem.entrada2_pct ?? 50}%)`} nivel={formatPreco(entrada2)} diff={e2.diff} pct={e2.pct} atingido={Math.abs(preco - entrada2) / entrada2 < 0.002} color="#FFA500" />
                    <NivelItem label="STOP"  nivel={formatPreco(sl)} diff={s.diff} pct={s.pct} atingido={status === 'LOSS'} color="#FF4444" />
                    <NivelItem label="TP 1"  nivel={formatPreco(tpDisplay)} diff={t.diff} pct={t.pct} atingido={status === 'WIN' || status === 'TP1' || status === 'TP2'} color="#00C896" />
                  </>
                );
              }
              return (
                <>
                  <NivelItem label="ENTRADA" nivel={formatPreco(entrada)} diff={distInfo(preco, entrada).diff} pct={distInfo(preco, entrada).pct} atingido={Math.abs(preco - entrada) / (entrada || 1) < 0.001} color="#FFD700" />
                  <NivelItem label="STOP"    nivel={formatPreco(sl)}      diff={s.diff} pct={s.pct} atingido={status === 'LOSS'} color="#FF4444" />
                  <NivelItem label="TP 1"    nivel={formatPreco(tpDisplay)} diff={t.diff} pct={t.pct} atingido={status === 'WIN' || status === 'TP1' || status === 'TP2'} color="#00C896" />
                </>
              );
            })()}
          </View>

          {/* Alvos TP2/TP3 quando multi-TP */}
          {hasMultiTP && (
            <View style={styles.tpAdicionalRow}>
              {tp2v > 0 && (
                <View style={[styles.tpAdicionalItem, tp1HitRef.current && { borderColor: '#FFA50060', backgroundColor: '#FFA50010' }]}>
                  <Text style={[styles.tpAdicionalLabel, tp1HitRef.current && { color: '#FFA500' }]}>TP2</Text>
                  <Text style={styles.tpAdicionalValor}>{formatPreco(tp2v)}</Text>
                  <Text style={[styles.tpAdicionalDist, { color: tp1HitRef.current ? '#FFA500' : '#444' }]}>
                    Δ {distInfo(preco, tp2v).diff}
                  </Text>
                </View>
              )}
              {tp3v > 0 && (
                <View style={[styles.tpAdicionalItem, tp2HitRef.current && { borderColor: '#00C89660', backgroundColor: '#00C89610' }]}>
                  <Text style={[styles.tpAdicionalLabel, tp2HitRef.current && { color: '#00C896' }]}>TP3</Text>
                  <Text style={styles.tpAdicionalValor}>{formatPreco(tp3v)}</Text>
                  <Text style={[styles.tpAdicionalDist, { color: tp2HitRef.current ? '#00C896' : '#444' }]}>
                    Δ {distInfo(preco, tp3v).diff}
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      ) : erro ? (
        <Text style={styles.erro}>{erro}</Text>
      ) : monitorando ? (
        <Text style={styles.aguardando}>Buscando preço...</Text>
      ) : (
        <Text style={styles.aguardando}>
          Polling a cada {getPollingInterval(analise.ativo) / 1000}s · notificações automáticas ativas
        </Text>
      )}

      {/* Botão iniciar/parar */}
      <TouchableOpacity
        style={[styles.btn, monitorando ? styles.btnStop : styles.btnStart]}
        onPress={monitorando ? pararMonitoramento : iniciarMonitoramento}
        activeOpacity={0.8}
      >
        <Ionicons
          name={monitorando ? 'stop-circle' : 'play-circle'}
          size={16}
          color={monitorando ? '#FF4444' : '#000'}
        />
        <Text style={[styles.btnText, { color: monitorando ? '#FF4444' : '#000' }]}>
          {monitorando ? 'PARAR MONITORAMENTO' : 'MONITORAR ORDEM'}
        </Text>
      </TouchableOpacity>

    </View>
  );
}

function NivelItem({
  label, nivel, diff, pct, atingido, color,
}: {
  label: string; nivel: string; diff: string; pct: string; atingido: boolean; color: string;
}) {
  return (
    <View style={[styles.nivelItem, atingido && { borderColor: color + '80', backgroundColor: color + '12' }]}>
      <Text style={[styles.nivelLabel, { color }]}>{label}</Text>
      <Text style={styles.nivelValor}>{nivel}</Text>
      <Text style={[styles.nivelDist, { color: color + 'cc' }]}>Δ {diff} ({pct}%)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD70030',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    color: '#FFD700', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, fontFamily: 'monospace',
  },
  multiTPBadge: {
    backgroundColor: '#00C89620',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#00C89660',
  },
  multiTPText: { color: '#00C896', fontSize: 9, fontWeight: '700', fontFamily: 'monospace' },

  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },

  tpParcialbanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFA50015',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFA50040',
  },
  tpParcialText: { color: '#FFA500', fontSize: 11, fontFamily: 'monospace', flex: 1 },

  precoBox: { alignItems: 'center', marginBottom: 16 },
  precoLabel: { color: '#444', fontSize: 9, letterSpacing: 2, fontFamily: 'monospace', marginBottom: 4 },
  precoValor: { fontSize: 34, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 1 },
  updateTime: { color: '#333', fontSize: 9, fontFamily: 'monospace', marginTop: 4 },

  barSection: { marginBottom: 14 },
  barBg: {
    height: 10, borderRadius: 5, overflow: 'hidden',
    flexDirection: 'row', position: 'relative',
    backgroundColor: '#2a2a2a',
  },
  barZonaSL: { backgroundColor: '#FF444428', height: '100%' },
  barZonaTP: { backgroundColor: '#00C89628', height: '100%' },
  entradaMarker: {
    position: 'absolute', top: 0, bottom: 0,
    width: 2, backgroundColor: '#FFD700aa',
  },
  tpMarker: {
    position: 'absolute', top: 0, bottom: 0,
    width: 2, opacity: 0.6,
  },
  precoMarker: {
    position: 'absolute', top: -3, bottom: -3,
    width: 4, borderRadius: 2,
    backgroundColor: '#fff',
    shadowColor: '#fff', shadowOpacity: 0.8, shadowRadius: 3,
    elevation: 4,
  },
  barLabels: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 5,
  },
  slLabel:         { color: '#FF4444', fontSize: 9, fontFamily: 'monospace' },
  entradaBarLabel: { color: '#FFD700', fontSize: 9, fontFamily: 'monospace', textAlign: 'center' },
  tpLabel:         { color: '#00C896', fontSize: 9, fontFamily: 'monospace' },

  distGrid: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  distGridWrap: { flexWrap: 'wrap' },
  nivelItem: {
    flex: 1, backgroundColor: '#141414', borderRadius: 8, padding: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a',
  },
  nivelLabel: { fontSize: 9, fontWeight: '700', fontFamily: 'monospace', marginBottom: 3 },
  nivelValor: { color: '#ccc', fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  nivelDist:  { fontSize: 9, fontFamily: 'monospace', marginTop: 3, textAlign: 'center' },

  tpAdicionalRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  tpAdicionalItem: {
    flex: 1, backgroundColor: '#141414', borderRadius: 8, padding: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a',
  },
  tpAdicionalLabel: { color: '#444', fontSize: 9, fontWeight: '700', fontFamily: 'monospace', marginBottom: 2 },
  tpAdicionalValor: { color: '#ccc', fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  tpAdicionalDist:  { fontSize: 9, fontFamily: 'monospace', marginTop: 2 },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1,
  },
  btnStart: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  btnStop:  { backgroundColor: '#FF444415', borderColor: '#FF444460' },
  btnText:  { fontSize: 12, fontWeight: '900', letterSpacing: 1, fontFamily: 'monospace' },

  erro:       { color: '#FF4444', fontSize: 11, fontFamily: 'monospace', textAlign: 'center', marginBottom: 12 },
  aguardando: { color: '#444', fontSize: 11, fontFamily: 'monospace', textAlign: 'center', marginBottom: 12 },
});
