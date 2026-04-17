import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Share,
  Modal,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as SharingExpo from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';

import { Analise, ResultadoOperacao, ConfigApp } from '../../types/analise';
import { buscarAnalise, carregarConfig, atualizarResultado } from '../../services/storage';
import { extractSecao } from '../../services/parser';
import ScoreBar from '../../components/ScoreBar';
import OrdemCard from '../../components/OrdemCard';
import OrdemMonitor from '../../components/OrdemMonitor';
import SecaoAnalise from '../../components/SecaoAnalise';
import TelegramButton from '../../components/TelegramButton';
import ScoreBreakdown from '../../components/ScoreBreakdown';

export default function ResultadoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [loading, setLoading] = useState(true);
  const [telegramConfig, setTelegramConfig] = useState({ botToken: '', chatId: '' });
  const [resultado, setResultado]     = useState<ResultadoOperacao>(null);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [risco, setRisco] = useState<{ reais: number; percento: number; lotSugerido: number | null } | null>(null);
  const [twelveDataKey, setTwelveDataKey]       = useState('');
  const [entradaEscalonada, setEntradaEscalonada] = useState(true);
  const insets = useSafeAreaInsets();

  // Animação de entrada
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const carregar = async () => {
      if (!id) return;
      const [a, config] = await Promise.all([buscarAnalise(id), carregarConfig()]);
      setAnalise(a);
      setResultado(a?.resultado ?? null);
      setTelegramConfig({ botToken: config.telegramBotToken, chatId: config.telegramChatId });
      setTwelveDataKey(config.twelveDataApiKey);
      setEntradaEscalonada(config.entradaEscalonada);
      if (config.bancaTotal > 0) {
        const reais = config.bancaTotal * config.riscoPercento / 100;
        let lotSugerido: number | null = null;
        if (a && a.ordem.entrada && a.ordem.sl && config.valorPorPonto > 0) {
          const slDist = Math.abs(parseFloat(a.ordem.entrada) - parseFloat(a.ordem.sl));
          if (slDist > 0) {
            lotSugerido = Math.floor((reais / (slDist * config.valorPorPonto)) * 100) / 100;
          }
        }
        setRisco({ reais, percento: config.riscoPercento, lotSugerido });
      }
      if (a) {
        navigation.setOptions({ title: `${a.ativo} · ${a.timeframe}` });
      }
      setLoading(false);

      // Animar entrada
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1,  duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0,  duration: 400, useNativeDriver: true }),
      ]).start();
    };
    carregar();
  }, [id]);

  const handleMarcarResultado = (r: ResultadoOperacao) => {
    if (!analise) return;
    if (r === null) {
      // desfazer marcação sem confirmação
      atualizarResultado(analise.id, null).then(() => setResultado(null));
      return;
    }
    Alert.alert(
      r === 'WIN' ? '✅ Marcar como WIN?' : '❌ Marcar como LOSS?',
      `${analise.ativo} ${analise.timeframe} — confirmar resultado?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: r === 'WIN' ? 'default' : 'destructive',
          onPress: async () => {
            await atualizarResultado(analise.id, r);
            setResultado(r);
            await Haptics.notificationAsync(
              r === 'WIN'
                ? Haptics.NotificationFeedbackType.Success
                : Haptics.NotificationFeedbackType.Error
            );
          },
        },
      ]
    );
  };

  const handleCopiarOrdem = async () => {
    if (!analise) return;
    const { ordem } = analise;
    const linhas = [
      '🚀 ORDEM PRONTA',
      `ATIVO: ${ordem.ativo}`,
      `TIPO: ${ordem.tipo.replace('_', ' ')}`,
      `ENTRADA: ${ordem.entrada}`,
      `STOP LOSS: ${ordem.sl}`,
    ];
    if (ordem.tp1) {
      linhas.push(`TP 1 (H1): ${ordem.tp1}  R/R ${ordem.rr_tp1}`);
      linhas.push(`TP 2 (H4): ${ordem.tp2}  R/R ${ordem.rr_tp2}`);
      linhas.push(`TP 3 (MACRO): ${ordem.tp3}  R/R ${ordem.rr_tp3}`);
    } else {
      linhas.push(`TAKE PROFIT: ${ordem.tp}`);
      linhas.push(`R/R: ${ordem.rr}`);
    }
    await Clipboard.setStringAsync(linhas.join('\n'));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('✅ Copiado!', 'Ordem copiada para a área de transferência.');
  };

  const handleCompartilhar = async () => {
    if (!analise) return;
    try {
      const canShare = await SharingExpo.isAvailableAsync();
      if (canShare && analise.imagemUri) {
        await SharingExpo.shareAsync(analise.imagemUri, {
          dialogTitle: `SMC Trader – ${analise.ativo} ${analise.timeframe}`,
        });
      } else {
        await Share.share({ message: analise.textoCompleto });
      }
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (!analise) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Análise não encontrada.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const texto       = analise.textoCompleto;
  const leitura     = extractSecao(texto, '🔎', '📍');
  const zonas       = extractSecao(texto, '📍', '🎯');
  const decisao     = extractSecao(texto, '🎯', '🚀');
  const execucao    = extractSecao(texto, '⚠️', '🔁');
  const alternativo = extractSecao(texto, '🔁', '🧠');
  const resumoSec   = extractSecao(texto, '🧠', '📊');
  const resumoVale  = analise.resumo.vale;

  return (
    <>
      <Animated.ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────── */}
        <Animated.View
          style={[styles.headerBox, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <View>
            <Text style={styles.ativoText}>{analise.ativo}</Text>
            <Text style={styles.tfText}>{analise.timeframe} · {analise.dataHora}</Text>
          </View>
          <View style={[styles.tipoBox, { borderColor: getTipoColor(analise.tipo) + '60' }]}>
            <Text style={[styles.tipoText, { color: getTipoColor(analise.tipo) }]}>
              {analise.tipo === 'COMPRA' ? '▲ COMPRA' : analise.tipo === 'VENDA' ? '▼ VENDA' : '⏸ SEM OP'}
            </Text>
          </View>
        </Animated.View>

        {/* ── Score Bar ──────────────────────────────── */}
        <ScoreBar score={analise.score} />

        {/* ── Win Probability (modo institucional) ───── */}
        {analise.modoInstitucional && analise.win_probability != null && (
          <View style={styles.winProbCard}>
            <Text style={styles.winProbLabel}>PROBABILIDADE DE WIN</Text>
            <View style={styles.winProbBarBg}>
              <View style={[styles.winProbBarFill, {
                width: `${analise.win_probability}%` as any,
                backgroundColor: analise.win_probability >= 65 ? '#00C896' : analise.win_probability >= 45 ? '#FFA500' : '#FF4444',
              }]} />
            </View>
            <Text style={[styles.winProbValue, {
              color: analise.win_probability >= 65 ? '#00C896' : analise.win_probability >= 45 ? '#FFA500' : '#FF4444',
            }]}>{analise.win_probability}%</Text>
          </View>
        )}

        {/* ── Score Breakdown (modo institucional) ───── */}
        {analise.modoInstitucional && analise.score_breakdown && (
          <ScoreBreakdown breakdown={analise.score_breakdown} />
        )}

        {/* ── Bias badges (H4 ou D1+H4) ──────────────── */}
        {(analise.modoCompleto || analise.modoInstitucional) && (analise.bias_h4 || analise.bias_d1) && (
          <View style={styles.biasRow}>
            {analise.modoInstitucional && analise.bias_d1 && (
              <BiasBadge label="D1" bias={analise.bias_d1} />
            )}
            {analise.bias_h4 && (
              <BiasBadge label="H4" bias={analise.bias_h4} />
            )}
          </View>
        )}

        {/* ── Cascade alinhamento (modo institucional) ─ */}
        {analise.modoInstitucional && (
          <View style={styles.cascadeRow}>
            <CascadeItem label="D1" ok={analise.alinhamento_d1_h4 !== false} />
            <View style={styles.cascadeArrow}><Text style={styles.cascadeArrowText}>→</Text></View>
            <CascadeItem label="H4" ok={analise.alinhamento_h4_h1 !== false} />
            <View style={styles.cascadeArrow}><Text style={styles.cascadeArrowText}>→</Text></View>
            <CascadeItem label="H1" ok={analise.alinhamento_total !== false} />
            <View style={[styles.cascadeFinal, { backgroundColor: analise.alinhamento_total ? '#00C89620' : '#FF444420', borderColor: analise.alinhamento_total ? '#00C896' : '#FF4444' }]}>
              <Text style={[styles.cascadeFinalText, { color: analise.alinhamento_total ? '#00C896' : '#FF4444' }]}>
                {analise.alinhamento_total ? '✅ ALINHADO' : '❌ DESALINHADO'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Banner desalinhamento ─────────────────── */}
        {(analise.alinhamento_tf === false || analise.alinhamento_total === false) && (
          <View style={styles.desalinhadoBanner}>
            <Text style={styles.desalinhadoText}>⚠️ Timeframes desalinhados — ordem bloqueada</Text>
          </View>
        )}

        {/* ── Banner Resumo ──────────────────────────── */}
        <View style={[
          styles.resumoBanner,
          { backgroundColor: resumoVale ? '#00C89618' : '#FF444418', borderColor: resumoVale ? '#00C896' : '#FF4444' }
        ]}>
          <Text style={[styles.resumoBannerText, { color: resumoVale ? '#00C896' : '#FF4444' }]}>
            {resumoVale ? '🧠 VALE ENTRAR: SIM ✅' : '🧠 VALE ENTRAR: NÃO ❌'}
          </Text>
          {analise.resumo.justificativa ? (
            <Text style={styles.resumoJust}>{analise.resumo.justificativa}</Text>
          ) : null}
        </View>

        {/* ── Gráfico com zoom ───────────────────────── */}
        {analise.imagemUri ? (
          <TouchableOpacity onPress={() => setZoomVisible(true)} activeOpacity={0.9}>
            <Image source={{ uri: analise.imagemUri }} style={styles.chartImg} resizeMode="cover" />
            <View style={styles.zoomHint}>
              <Ionicons name="expand" size={14} color="#fff" />
              <Text style={styles.zoomHintText}>Toque para ampliar</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* ── Ordem Card ─────────────────────────────── */}
        {(() => {
          const bloqueada = analise.alinhamento_tf === false || analise.alinhamento_total === false;
          return (
            <View style={bloqueada ? { opacity: 0.35 } : undefined}>
              <OrdemCard ordem={analise.ordem} isEntradaForte={analise.isEntradaForte} />
            </View>
          );
        })()}

        {/* ── Monitor de Ordem ───────────────────────── */}
        {analise.tipo !== 'SEM_OPERACAO' && resultado !== 'WIN' && resultado !== 'LOSS' && (
          <OrdemMonitor
            analise={analise}
            twelveDataApiKey={twelveDataKey}
            onResultadoAtualizado={r => setResultado(r)}
          />
        )}

        {/* ── Calculadora de Risco ──────────────────── */}
        {risco && analise.tipo !== 'SEM_OPERACAO' && (
          <View style={styles.riscoCard}>
            <View style={styles.riscoHeader}>
              <Ionicons name="shield-checkmark" size={14} color="#FFD700" />
              <Text style={styles.riscoTitle}>GESTÃO DE RISCO</Text>
            </View>
            <View style={styles.riscoRow}>
              <RiscoItem label="Risco Max" value={`R$ ${risco.reais.toFixed(2)}`} color="#FF6B6B" />
              <RiscoItem label="% da Banca" value={`${risco.percento}%`} color="#FFA500" />
              <RiscoItem
                label="Score"
                value={`${analise.score}/100`}
                color={analise.score >= 75 ? '#00C896' : analise.score >= 50 ? '#FFA500' : '#FF4444'}
              />
            </View>
            {risco.lotSugerido !== null && (
              <View style={styles.lotRow}>
                <Ionicons name="layers-outline" size={13} color="#FFD700" />
                <Text style={styles.lotLabel}>Lote MT5 sugerido:</Text>
                <Text style={styles.lotValue}>{risco.lotSugerido.toFixed(2)}</Text>
              </View>
            )}
            {analise.score < 70 && (
              <Text style={styles.riscoAviso}>
                ⚠️ Score abaixo de 70 — considere reduzir o risco
              </Text>
            )}
          </View>
        )}

        {/* ── Marcar Resultado Win/Loss ──────────────── */}
        {analise.tipo !== 'SEM_OPERACAO' && (
          <View style={styles.resultadoSection}>
            <Text style={styles.resultadoLabel}>RESULTADO DA OPERAÇÃO</Text>
            <View style={styles.resultadoRow}>
              <TouchableOpacity
                style={[
                  styles.resultadoBtn,
                  styles.winBtn,
                  resultado === 'WIN' && styles.winBtnActive,
                ]}
                onPress={() => handleMarcarResultado(resultado === 'WIN' ? null : 'WIN')}
                activeOpacity={0.7}
              >
                <Text style={styles.resultadoBtnText}>
                  {resultado === 'WIN' ? '✅ WIN' : '✅ Marcar WIN'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.resultadoBtn,
                  styles.lossBtn,
                  resultado === 'LOSS' && styles.lossBtnActive,
                ]}
                onPress={() => handleMarcarResultado(resultado === 'LOSS' ? null : 'LOSS')}
                activeOpacity={0.7}
              >
                <Text style={styles.resultadoBtnText}>
                  {resultado === 'LOSS' ? '❌ LOSS' : '❌ Marcar LOSS'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Seções de análise ──────────────────────── */}
        {leitura     && <SecaoAnalise emoji="🔎" titulo="LEITURA DO MERCADO"    conteudo={leitura}     corBorda="#FFD700" collapsible />}
        {zonas       && <SecaoAnalise emoji="📍" titulo="ZONAS INSTITUCIONAIS"  conteudo={zonas}       corBorda="#FFA500" collapsible />}
        {decisao     && <SecaoAnalise emoji="🎯" titulo="DECISÃO"               conteudo={decisao}     corBorda="#00C896" />}
        {execucao    && <SecaoAnalise emoji="⚠️" titulo="EXECUÇÃO"              conteudo={execucao}    corBorda="#FFA500" collapsible defaultCollapsed />}
        {alternativo && <SecaoAnalise emoji="🔁" titulo="CENÁRIO ALTERNATIVO"   conteudo={alternativo} corBorda="#888"    collapsible defaultCollapsed />}
        {resumoSec   && <SecaoAnalise emoji="🧠" titulo="RESUMO"                conteudo={resumoSec}   corBorda={resumoVale ? '#00C896' : '#FF4444'} />}

        {/* ── Ações ──────────────────────────────────── */}
        {(() => {
          const bloqueada = analise.alinhamento_tf === false || analise.alinhamento_total === false;
          return (
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionBtn, bloqueada && { opacity: 0.4 }]}
            onPress={bloqueada ? undefined : handleCopiarOrdem}
            activeOpacity={bloqueada ? 1 : 0.7}
          >
            <Ionicons name="copy" size={18} color={bloqueada ? '#555' : '#FFD700'} />
            <Text style={[styles.actionBtnText, bloqueada && { color: '#555' }]}>Copiar Ordem</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleCompartilhar} activeOpacity={0.7}>
            <Ionicons name="share-social" size={18} color="#FFD700" />
            <Text style={styles.actionBtnText}>Compartilhar</Text>
          </TouchableOpacity>
        </View>
          );
        })()}

        <TelegramButton
          analise={analise}
          botToken={telegramConfig.botToken}
          chatId={telegramConfig.chatId}
          lotSugerido={risco?.lotSugerido ?? null}
          entradaEscalonada={entradaEscalonada}
        />

        <TouchableOpacity
          style={styles.novaAnaliseBtn}
          onPress={() => router.replace('/')}
          activeOpacity={0.8}
        >
          <Text style={styles.novaAnaliseBtnText}>⚡ NOVA ANÁLISE</Text>
        </TouchableOpacity>
      </Animated.ScrollView>

      {/* ── Modal Zoom Gráfico ─────────────────────── */}
      <Modal visible={zoomVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.zoomModal}>
          <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            contentContainerStyle={styles.zoomContent}
          >
            <Image
              source={{ uri: analise.imagemUri }}
              style={styles.zoomImage}
              resizeMode="contain"
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function BiasBadge({ label, bias }: { label: string; bias: 'ALTA' | 'BAIXA' | 'NEUTRO' }) {
  const color = bias === 'ALTA' ? '#00C896' : bias === 'BAIXA' ? '#FF4444' : '#888';
  const emoji = bias === 'ALTA' ? '📈' : bias === 'BAIXA' ? '📉' : '➡️';
  return (
    <View style={[styles.biasBadge, { borderColor: color + '60', backgroundColor: color + '18' }]}>
      <Text style={[styles.biasBadgeText, { color }]}>{label} {bias} {emoji}</Text>
    </View>
  );
}

function CascadeItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={[styles.cascadeItem, { borderColor: ok ? '#00C89660' : '#FF444460', backgroundColor: ok ? '#00C89615' : '#FF444415' }]}>
      <Text style={[styles.cascadeItemText, { color: ok ? '#00C896' : '#FF4444' }]}>{ok ? '✓' : '✗'} {label}</Text>
    </View>
  );
}

function RiscoItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.riscoItem}>
      <Text style={[styles.riscoItemValue, { color }]}>{value}</Text>
      <Text style={styles.riscoItemLabel}>{label}</Text>
    </View>
  );
}

function getTipoColor(tipo: string): string {
  if (tipo === 'COMPRA') return '#00C896';
  if (tipo === 'VENDA') return '#FF4444';
  return '#FFA500';
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0d0d0d' },
  content:     { padding: 16 },
  centered:    { flex: 1, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#555', fontSize: 14 },
  errorText:   { color: '#FF4444', fontSize: 16 },
  backBtn:     { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: '#FFD700', fontWeight: '700' },

  headerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  ativoText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  tfText: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  tipoBox: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    backgroundColor: '#0d0d0d',
  },
  tipoText: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'monospace',
  },

  resumoBanner: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  resumoBannerText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  resumoJust: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
    fontFamily: 'monospace',
  },

  chartImg: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  zoomHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginBottom: 12,
    paddingRight: 4,
  },
  zoomHintText: {
    color: '#555',
    fontSize: 11,
  },

  // Win/Loss
  resultadoSection: {
    marginBottom: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  resultadoLabel: {
    color: '#555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  resultadoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resultadoBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  winBtn: {
    backgroundColor: '#00C89615',
    borderColor: '#00C89660',
  },
  winBtnActive: {
    backgroundColor: '#00C89630',
    borderColor: '#00C896',
  },
  lossBtn: {
    backgroundColor: '#FF444415',
    borderColor: '#FF444460',
  },
  lossBtnActive: {
    backgroundColor: '#FF444430',
    borderColor: '#FF4444',
  },
  resultadoBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'monospace',
  },

  riscoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD70030',
  },
  riscoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  riscoTitle: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: 'monospace',
  },
  riscoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  riscoItem: {
    alignItems: 'center',
    flex: 1,
  },
  riscoItemValue: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  riscoItemLabel: {
    color: '#555',
    fontSize: 10,
    marginTop: 3,
    fontFamily: 'monospace',
  },
  lotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#FFD70010',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FFD70030',
  },
  lotLabel: {
    color: '#aaa',
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
  },
  lotValue: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  riscoAviso: {
    color: '#FFA500',
    fontSize: 11,
    marginTop: 10,
    fontFamily: 'monospace',
    textAlign: 'center',
  },

  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    color: '#FFD700',
    fontWeight: '700',
    fontSize: 13,
  },

  novaAnaliseBtn: {
    marginTop: 14,
    backgroundColor: '#FFD700',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  novaAnaliseBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'monospace',
  },

  // Win probability
  winProbCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  winProbLabel: {
    color: '#555',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'monospace',
    minWidth: 80,
  },
  winProbBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  winProbBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  winProbValue: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'monospace',
    minWidth: 40,
    textAlign: 'right',
  },

  // Bias badges row
  biasRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  biasBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  biasBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: 'monospace',
  },

  // Cascade alinhamento
  cascadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  cascadeItem: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  cascadeItemText: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  cascadeArrow: { paddingHorizontal: 2 },
  cascadeArrowText: { color: '#444', fontSize: 14, fontWeight: '700' },
  cascadeFinal: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    marginLeft: 4,
  },
  cascadeFinalText: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'monospace',
  },

  // Banner desalinhamento
  desalinhadoBanner: {
    backgroundColor: '#FF444418',
    borderWidth: 1,
    borderColor: '#FF4444',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  desalinhadoText: {
    color: '#FF4444',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },

  // Zoom modal
  zoomModal: {
    flex: 1,
    backgroundColor: '#000000ee',
  },
  zoomClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: '#00000080',
    borderRadius: 20,
    padding: 8,
  },
  zoomContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImage: {
    width: '100%',
    height: 400,
  },
});
