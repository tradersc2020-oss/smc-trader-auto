import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Analise, TipoOperacao, ResultadoOperacao } from '../../types/analise';
import {
  carregarHistorico,
  deletarAnalise,
  calcularEstatisticas,
  calcularEstatisticasAvancadas,
  StatsAvancadas,
} from '../../services/storage';

const BADGE: Record<TipoOperacao, { label: string; cor: string; bg: string }> = {
  COMPRA:       { label: 'COMPRA', cor: '#00C896', bg: '#00C89620' },
  VENDA:        { label: 'VENDA',  cor: '#FF4444', bg: '#FF444420' },
  SEM_OPERACAO: { label: 'SEM OP', cor: '#FFA500', bg: '#FFA50020' },
};

const RESULTADO_BADGE: Record<string, { label: string; cor: string }> = {
  WIN:      { label: 'WIN',  cor: '#00C896' },
  LOSS:     { label: 'LOSS', cor: '#FF4444' },
  PENDENTE: { label: '⏳',   cor: '#FFA500' },
};

type FiltroTipo = 'TODOS' | TipoOperacao;
type FiltroResultado = 'TODOS' | 'WIN' | 'LOSS' | 'PENDENTE';
type AbaStats = 'GERAL' | 'ATIVOS' | 'TIMEFRAMES';

export default function HistoricoScreen() {
  const [historico, setHistorico]       = useState<Analise[]>([]);
  const [filtro, setFiltro]             = useState('');
  const [filtroTipo, setFiltroTipo]     = useState<FiltroTipo>('TODOS');
  const [filtroRes, setFiltroRes]       = useState<FiltroResultado>('TODOS');
  const [stats, setStats]               = useState({ total: 0, wins: 0, losses: 0, taxaAcerto: 0 });
  const [statsAdv, setStatsAdv]         = useState<StatsAvancadas | null>(null);
  const [abaStats, setAbaStats]         = useState<AbaStats>('GERAL');
  const [mostrarStats, setMostrarStats] = useState(false);
  const insets = useSafeAreaInsets();

  const carregarDados = useCallback(async () => {
    const [dados, est, adv] = await Promise.all([
      carregarHistorico(),
      calcularEstatisticas(),
      calcularEstatisticasAvancadas(),
    ]);
    setHistorico(dados);
    setStats(est);
    setStatsAdv(adv);
  }, []);

  useFocusEffect(useCallback(() => { carregarDados(); }, [carregarDados]));

  const handleDeletar = async (id: string) => {
    Alert.alert('Deletar', 'Remover esta análise do histórico?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deletar',
        style: 'destructive',
        onPress: async () => { await deletarAnalise(id); await carregarDados(); },
      },
    ]);
  };

  const filtrado = historico.filter((a) => {
    if (filtro.trim() !== '' && !a.ativo.toLowerCase().includes(filtro.toLowerCase())) return false;
    if (filtroTipo !== 'TODOS' && a.tipo !== filtroTipo) return false;
    if (filtroRes !== 'TODOS') {
      if (filtroRes === 'PENDENTE' && a.resultado !== 'PENDENTE' && a.resultado !== null && a.resultado !== undefined) return false;
      if (filtroRes === 'WIN' && a.resultado !== 'WIN') return false;
      if (filtroRes === 'LOSS' && a.resultado !== 'LOSS') return false;
    }
    return true;
  });

  const renderRightActions = (id: string) => (
    <TouchableOpacity style={styles.swipeDelete} onPress={() => handleDeletar(id)}>
      <Ionicons name="trash" size={22} color="#fff" />
      <Text style={styles.swipeDeleteText}>Deletar</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: Analise }) => {
    const badge    = BADGE[item.tipo] || BADGE['SEM_OPERACAO'];
    const resBadge = item.resultado
      ? RESULTADO_BADGE[item.resultado]
      : item.tipo !== 'SEM_OPERACAO' ? RESULTADO_BADGE['PENDENTE'] : null;

    return (
      <Swipeable renderRightActions={() => renderRightActions(item.id)} overshootRight={false}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/resultado/${item.id}`)}
          activeOpacity={0.8}
        >
          {item.imagemUri ? (
            <Image source={{ uri: item.imagemUri }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: badge.bg }]}>
              <Ionicons name="bar-chart" size={24} color={badge.cor} />
            </View>
          )}

          <View style={styles.cardInfo}>
            <View style={styles.row}>
              <Text style={styles.ativo}>{item.ativo}</Text>
              <Text style={styles.tf}>{item.timeframe}</Text>
              {item.isEntradaForte && <Text style={{ fontSize: 13 }}>⭐</Text>}
            </View>

            <View style={styles.row}>
              <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.cor }]}>
                <Text style={[styles.badgeText, { color: badge.cor }]}>{badge.label}</Text>
              </View>
              <Text style={[styles.score, { color: getScoreColor(item.score) }]}>
                {item.score}/100
              </Text>
              {resBadge && (
                <View style={[styles.resBadge, { borderColor: resBadge.cor + '80' }]}>
                  <Text style={[styles.resBadgeText, { color: resBadge.cor }]}>
                    {resBadge.label}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.dataHora}>{item.dataHora}</Text>
          </View>

          <View style={styles.cardActions}>
            <Ionicons name="chevron-forward" size={16} color="#333" />
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeletar(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color="#FF444490" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Stats Bar ──────────────────────────────── */}
      {stats.total > 0 && (
        <TouchableOpacity
          style={styles.statsBar}
          onPress={() => setMostrarStats(!mostrarStats)}
          activeOpacity={0.8}
        >
          <StatPill label="TOTAL" value={String(historico.length)} color="#FFD700" />
          <StatPill label="WIN" value={String(stats.wins)} color="#00C896" />
          <StatPill label="LOSS" value={String(stats.losses)} color="#FF4444" />
          <StatPill label="ACERTO" value={`${stats.taxaAcerto}%`} color={stats.taxaAcerto >= 60 ? '#00C896' : '#FFA500'} />
          {statsAdv && (
            <StatPill
              label="STREAK"
              value={statsAdv.streakAtual > 0 ? `${statsAdv.streakAtual}${statsAdv.streakTipo === 'WIN' ? '🔥' : '❄️'}` : '-'}
              color={statsAdv.streakTipo === 'WIN' ? '#00C896' : '#FF4444'}
            />
          )}
          <Ionicons name={mostrarStats ? 'chevron-up' : 'chevron-down'} size={14} color="#555" />
        </TouchableOpacity>
      )}

      {/* ── Painel Stats Avançadas ─────────────────── */}
      {mostrarStats && statsAdv && (
        <View style={styles.statsPanel}>
          <View style={styles.statsAbas}>
            {(['GERAL', 'ATIVOS', 'TIMEFRAMES'] as AbaStats[]).map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.statsAba, abaStats === a && styles.statsAbaActive]}
                onPress={() => setAbaStats(a)}
              >
                <Text style={[styles.statsAbaText, abaStats === a && styles.statsAbaTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {abaStats === 'GERAL' && (
            <View style={styles.statsGeralRow}>
              <MiniStat label="Análises" value={String(statsAdv.totalAnalises)} />
              <MiniStat label="Score médio" value={`${statsAdv.mediaScore}/100`} color={getScoreColor(statsAdv.mediaScore)} />
              {statsAdv.melhorAtivo ? <MiniStat label="Melhor ativo" value={statsAdv.melhorAtivo} color="#FFD700" /> : null}
              {statsAdv.melhorTimeframe ? <MiniStat label="Melhor TF" value={statsAdv.melhorTimeframe} color="#FFD700" /> : null}
            </View>
          )}

          {abaStats === 'ATIVOS' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {Object.entries(statsAdv.porAtivo)
                .sort((a, b) => b[1].taxa - a[1].taxa)
                .map(([ativo, s]) => (
                  <View key={ativo} style={styles.rankCard}>
                    <Text style={styles.rankAtivo}>{ativo}</Text>
                    <Text style={[styles.rankTaxa, { color: s.taxa >= 60 ? '#00C896' : '#FFA500' }]}>{s.taxa}%</Text>
                    <Text style={styles.rankDetalhe}>{s.wins}W / {s.losses}L</Text>
                  </View>
                ))}
              {Object.keys(statsAdv.porAtivo).length === 0 && (
                <Text style={styles.rankVazio}>Nenhum resultado marcado</Text>
              )}
            </ScrollView>
          )}

          {abaStats === 'TIMEFRAMES' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {Object.entries(statsAdv.porTimeframe)
                .sort((a, b) => b[1].taxa - a[1].taxa)
                .map(([tf, s]) => (
                  <View key={tf} style={styles.rankCard}>
                    <Text style={styles.rankAtivo}>{tf}</Text>
                    <Text style={[styles.rankTaxa, { color: s.taxa >= 60 ? '#00C896' : '#FFA500' }]}>{s.taxa}%</Text>
                    <Text style={styles.rankDetalhe}>{s.wins}W / {s.losses}L</Text>
                  </View>
                ))}
              {Object.keys(statsAdv.porTimeframe).length === 0 && (
                <Text style={styles.rankVazio}>Nenhum resultado marcado</Text>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── Barra de busca ─────────────────────────── */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color="#555" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={filtro}
          onChangeText={setFiltro}
          placeholder="Filtrar por ativo..."
          placeholderTextColor="#444"
          autoCapitalize="characters"
        />
        {filtro.length > 0 && (
          <TouchableOpacity onPress={() => setFiltro('')}>
            <Ionicons name="close-circle" size={16} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filtros de tipo e resultado ────────────── */}
      <View style={styles.filtrosRow}>
        {(['TODOS', 'COMPRA', 'VENDA', 'SEM_OPERACAO'] as FiltroTipo[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroChip, filtroTipo === f && styles.filtroChipActive]}
            onPress={() => setFiltroTipo(f)}
          >
            <Text style={[styles.filtroChipText, filtroTipo === f && styles.filtroChipTextActive]}>
              {f === 'SEM_OPERACAO' ? 'SEM OP' : f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={[styles.filtrosRow, { marginTop: 4 }]}>
        {(['TODOS', 'WIN', 'LOSS', 'PENDENTE'] as FiltroResultado[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroChip, filtroRes === f && styles.filtroChipActive,
              f === 'WIN' && filtroRes === f && { borderColor: '#00C896', backgroundColor: '#00C89620' },
              f === 'LOSS' && filtroRes === f && { borderColor: '#FF4444', backgroundColor: '#FF444420' },
            ]}
            onPress={() => setFiltroRes(f)}
          >
            <Text style={[styles.filtroChipText, filtroRes === f && styles.filtroChipTextActive,
              f === 'WIN' && filtroRes === f && { color: '#00C896' },
              f === 'LOSS' && filtroRes === f && { color: '#FF4444' },
            ]}>
              {f === 'PENDENTE' ? '⏳' : f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtrado.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={60} color="#2a2a2a" />
          <Text style={styles.emptyText}>Nenhuma análise encontrada</Text>
          <Text style={styles.emptySubText}>
            {historico.length === 0 ? 'Faça sua primeira análise!' : 'Nenhum resultado para este filtro.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtrado}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#1a1a1a' }} />}
        />
      )}
    </View>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={statStyles.pill}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function MiniStat({ label, value, color = '#aaa' }: { label: string; value: string; color?: string }) {
  return (
    <View style={statStyles.miniStat}>
      <Text style={[statStyles.miniValue, { color }]}>{value}</Text>
      <Text style={statStyles.miniLabel}>{label}</Text>
    </View>
  );
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#FFD700';
  if (score >= 75) return '#00C896';
  if (score >= 50) return '#FFA500';
  return '#FF4444';
}

const statStyles = StyleSheet.create({
  pill:      { alignItems: 'center', flex: 1 },
  value:     { fontSize: 15, fontWeight: '900', fontFamily: 'monospace' },
  label:     { color: '#444', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 },
  miniStat:  { alignItems: 'center', marginRight: 20 },
  miniValue: { fontSize: 15, fontWeight: '900', fontFamily: 'monospace' },
  miniLabel: { color: '#555', fontSize: 10, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },

  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 4,
  },

  statsPanel: {
    backgroundColor: '#141414',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    padding: 12,
  },
  statsAbas: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statsAba: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statsAbaActive: {
    backgroundColor: '#FFD70020',
    borderColor: '#FFD700',
  },
  statsAbaText:       { color: '#555', fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  statsAbaTextActive: { color: '#FFD700' },

  statsGeralRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },

  rankCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  rankAtivo:   { color: '#FFD700', fontSize: 13, fontWeight: '900', fontFamily: 'monospace' },
  rankTaxa:    { fontSize: 18, fontWeight: '900', fontFamily: 'monospace', marginTop: 4 },
  rankDetalhe: { color: '#555', fontSize: 10, marginTop: 2 },
  rankVazio:   { color: '#444', fontSize: 13, padding: 8 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
  },

  filtrosRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 4,
  },
  filtroChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  filtroChipActive: {
    backgroundColor: '#FFD70020',
    borderColor: '#FFD700',
  },
  filtroChipText:       { color: '#555', fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  filtroChipTextActive: { color: '#FFD700' },

  list: { paddingBottom: 20 },

  card: {
    backgroundColor: '#0d0d0d',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  thumbPlaceholder: {
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  ativo: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  tf: {
    color: '#FFD700',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
    backgroundColor: '#FFD70015',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badge: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },

  score: { fontSize: 11, fontFamily: 'monospace', fontWeight: '700' },

  resBadge: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    backgroundColor: '#ffffff08',
  },
  resBadgeText: { fontSize: 10, fontWeight: '900', fontFamily: 'monospace' },

  dataHora: { color: '#444', fontSize: 10, fontFamily: 'monospace' },

  cardActions: {
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    padding: 4,
  },
  swipeDelete: {
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    gap: 4,
  },
  swipeDeleteText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60,
  },
  emptyText:    { color: '#555', fontSize: 16, fontWeight: '700' },
  emptySubText: { color: '#333', fontSize: 13 },
});
