import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import * as Crypto from 'expo-crypto';

import { Timeframe, ATIVOS_SUGERIDOS, ConfigApp } from '../../types/analise';
import { buscarCandles, Candle } from '../../services/chartData';
import { analisarGrafico, analisarGraficoCompleto, analisarGraficoD1H4H1 } from '../../services/claudeApi';
import { carregarConfig, salvarAnalise, carregarHistorico } from '../../services/storage';
import {
  extractTipo, extractOrdem, extractScore, extractResumo,
  isEntradaForte as checkEntradaForte, parseAnaliseCompleta, parseAnaliseInstitucional,
} from '../../services/parser';
import { enviarTelegramComEA } from '../../services/telegramApi';
import CandleChart from '../../components/CandleChart';
import { Analise } from '../../types/analise';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W  = 800;
const CHART_H  = 460;

const TIMEFRAMES: Timeframe[] = ['M5', 'M15', 'H1', 'H4', 'D1'];

type Etapa = 'idle' | 'candles' | 'capturando' | 'analisando';

export default function IndexScreen() {
  const insets = useSafeAreaInsets();

  const [ativo, setAtivo]           = useState('XAUUSD');
  const [timeframe, setTF]          = useState<Timeframe>('H1');
  const [modo, setModo]             = useState<'simples' | 'institucional'>('simples');
  const [etapa, setEtapa]           = useState<Etapa>('idle');
  const [config, setConfig]         = useState<ConfigApp | null>(null);
  const [ultimaAnalise, setUltima]  = useState<Analise | null>(null);

  // Candles carregados
  const [candlesD1, setCandlesD1]   = useState<Candle[]>([]);
  const [candlesH4, setCandlesH4]   = useState<Candle[]>([]);
  const [candlesH1, setCandlesH1]   = useState<Candle[]>([]);
  const [candlesTF, setCandlesTF]   = useState<Candle[]>([]);

  // Refs para captura
  const shotRef    = useRef<ViewShot>(null);
  const shotRefD1  = useRef<ViewShot>(null);
  const shotRefH4  = useRef<ViewShot>(null);
  const shotRefH1  = useRef<ViewShot>(null);

  useEffect(() => {
    carregarConfig().then(setConfig);
    carregarHistorico().then(h => setUltima(h[0] ?? null));
  }, []);

  // ─── Labels de etapa ──────────────────────────────────────────────────────

  function labelEtapa(): string {
    if (etapa === 'candles')    return 'Buscando candles...';
    if (etapa === 'capturando') return 'Renderizando gráfico...';
    if (etapa === 'analisando') return 'Claude analisando...';
    return '';
  }

  // ─── Análise principal ────────────────────────────────────────────────────

  async function handleAnalisar() {
    if (!config?.anthropicApiKey) {
      Alert.alert('API Key', 'Configure a chave Claude nas Configurações.');
      return;
    }
    if (!config?.twelveDataApiKey && ativo !== 'BTCUSD') {
      Alert.alert('Twelve Data', 'Configure a chave Twelve Data nas Configurações para operar Forex/Ouro.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // 1. Buscar candles
      setEtapa('candles');
      console.log('[SMC] Buscando candles:', ativo, modo);

      if (modo === 'institucional') {
        const [d1, h4, h1] = await Promise.all([
          buscarCandles(ativo, 'D1', config.twelveDataApiKey, 100),
          buscarCandles(ativo, 'H4', config.twelveDataApiKey, 100),
          buscarCandles(ativo, 'H1', config.twelveDataApiKey, 100),
        ]);
        console.log('[SMC] D1:', d1.length, 'H4:', h4.length, 'H1:', h1.length);
        setCandlesD1(d1);
        setCandlesH4(h4);
        setCandlesH1(h1);
      } else {
        const data = await buscarCandles(ativo, timeframe, config.twelveDataApiKey, 100);
        console.log('[SMC] Candles:', data.length);
        setCandlesTF(data);
      }

      // 2. Aguardar renderização do gráfico
      setEtapa('capturando');
      await new Promise(r => setTimeout(r, 1200));

      // 3. Capturar como imagem base64
      const strip = (s: string) => s.replace(/^data:image\/\w+;base64,/, '');
      let base64D1 = '';
      let base64H4 = '';
      let base64H1 = '';
      let base64TF = '';

      if (modo === 'institucional') {
        base64D1 = strip((await shotRefD1.current?.capture?.()) ?? '');
        base64H4 = strip((await shotRefH4.current?.capture?.()) ?? '');
        base64H1 = strip((await shotRefH1.current?.capture?.()) ?? '');
        if (!base64D1 || !base64H4 || !base64H1) throw new Error('Falha na captura do gráfico. Tente novamente.');
      } else {
        base64TF = strip((await shotRef.current?.capture?.()) ?? '');
        if (!base64TF) throw new Error('Falha na captura do gráfico. Tente novamente.');
      }

      // 4. Enviar para Claude
      setEtapa('analisando');

      let textoResposta = '';
      let analise: Analise;
      const id = Crypto.randomUUID();
      const agora = new Date();

      if (modo === 'institucional') {
        textoResposta = await analisarGraficoD1H4H1(
          config.anthropicApiKey, ativo, base64D1, base64H4, base64H1,
        );
        const parsed = parseAnaliseInstitucional(textoResposta, ativo);
        analise = {
          ...parsed,
          id,
          ativo,
          timeframe:        'D1+H4+H1' as const,
          textoCompleto:    textoResposta,
          modoInstitucional: true,
          imagemUri:  '',
          imagemUri2: '',
          imagemUri3: '',
          dataHora:   agora.toLocaleString('pt-BR'),
          timestamp:  agora.getTime(),
          resultado:  null,
        };
      } else {
        textoResposta = await analisarGrafico(
          config.anthropicApiKey, ativo, timeframe, base64TF,
        );
        const tipo    = extractTipo(textoResposta);
        const ordem   = extractOrdem(textoResposta);
        const score   = extractScore(textoResposta);
        const resumo  = extractResumo(textoResposta);
        const isForte = checkEntradaForte(textoResposta);

        analise = {
          id,
          ativo,
          timeframe,
          imagemUri:     '',
          textoCompleto: textoResposta,
          tipo,
          ordem,
          score,
          resumo,
          isEntradaForte: isForte,
          dataHora:  agora.toLocaleString('pt-BR'),
          timestamp: agora.getTime(),
          resultado: null,
        };
      }

      await salvarAnalise(analise);

      // Enviar Telegram se configurado
      if (config.autoEnviarTelegram && config.telegramBotToken && config.telegramChatId) {
        try {
          await enviarTelegramComEA(config.telegramBotToken, config.telegramChatId, analise);
        } catch (_) {}
      }

      setEtapa('idle');
      router.push(`/resultado/${id}`);

    } catch (err: any) {
      setEtapa('idle');
      Alert.alert('Erro', err?.message ?? 'Falha na análise. Verifique sua conexão e API keys.');
    }
  }

  const carregando = etapa !== 'idle';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Seletor de ativo */}
        <Text style={styles.sectionLabel}>ATIVO</Text>
        <View style={styles.ativoRow}>
          {ATIVOS_SUGERIDOS.map(a => (
            <TouchableOpacity
              key={a}
              style={[styles.ativoBtn, ativo === a && styles.ativoBtnActive]}
              onPress={() => setAtivo(a)}
              disabled={carregando}
            >
              <Text style={[styles.ativoBtnText, ativo === a && styles.ativoBtnTextActive]}>
                {a}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Modo */}
        <Text style={styles.sectionLabel}>MODO</Text>
        <View style={styles.modoRow}>
          <TouchableOpacity
            style={[styles.modoBtn, modo === 'simples' && styles.modoBtnActive]}
            onPress={() => setModo('simples')}
            disabled={carregando}
          >
            <Ionicons name="analytics-outline" size={15} color={modo === 'simples' ? '#000' : '#555'} />
            <Text style={[styles.modoBtnText, modo === 'simples' && styles.modoBtnTextActive]}>
              SIMPLES
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modoBtn, modo === 'institucional' && styles.modoBtnActive]}
            onPress={() => setModo('institucional')}
            disabled={carregando}
          >
            <Ionicons name="layers-outline" size={15} color={modo === 'institucional' ? '#000' : '#555'} />
            <Text style={[styles.modoBtnText, modo === 'institucional' && styles.modoBtnTextActive]}>
              D1+H4+H1
            </Text>
          </TouchableOpacity>
        </View>

        {/* Timeframe — só no modo simples */}
        {modo === 'simples' && (
          <>
            <Text style={styles.sectionLabel}>TIMEFRAME</Text>
            <View style={styles.tfRow}>
              {TIMEFRAMES.map(tf => (
                <TouchableOpacity
                  key={tf}
                  style={[styles.tfBtn, timeframe === tf && styles.tfBtnActive]}
                  onPress={() => setTF(tf)}
                  disabled={carregando}
                >
                  <Text style={[styles.tfBtnText, timeframe === tf && styles.tfBtnTextActive]}>
                    {tf}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Prévia dos gráficos (quando carregados) */}
        {modo === 'simples' && candlesTF.length > 0 && (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>GRÁFICO {timeframe}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <CandleChart candles={candlesTF} symbol={ativo} timeframe={timeframe}
                width={SCREEN_W - 32} height={220} />
            </ScrollView>
          </View>
        )}

        {modo === 'institucional' && candlesD1.length > 0 && (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>D1</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <CandleChart candles={candlesD1} symbol={ativo} timeframe="D1"
                width={SCREEN_W - 32} height={160} />
            </ScrollView>
            <Text style={[styles.previewLabel, { marginTop: 10 }]}>H4</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <CandleChart candles={candlesH4} symbol={ativo} timeframe="H4"
                width={SCREEN_W - 32} height={160} />
            </ScrollView>
            <Text style={[styles.previewLabel, { marginTop: 10 }]}>H1</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <CandleChart candles={candlesH1} symbol={ativo} timeframe="H1"
                width={SCREEN_W - 32} height={160} />
            </ScrollView>
          </View>
        )}

        {/* Botão ANALISAR */}
        <TouchableOpacity
          style={[styles.analyzeBtn, carregando && styles.analyzeBtnDisabled]}
          onPress={handleAnalisar}
          disabled={carregando}
        >
          {carregando ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#1a1a1a" size="small" />
              <Text style={styles.analyzeBtnText}>{labelEtapa()}</Text>
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <Ionicons name="flash" size={18} color="#000" />
              <Text style={styles.analyzeBtnText}>ANALISAR {ativo}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Última análise (empty state) */}
        {!carregando && candlesTF.length === 0 && candlesH4.length === 0 && ultimaAnalise && (
          <TouchableOpacity
            style={styles.ultimaCard}
            onPress={() => router.push(`/resultado/${ultimaAnalise.id}`)}
            activeOpacity={0.8}
          >
            <Text style={styles.ultimaLabel}>ÚLTIMA ANÁLISE</Text>
            <View style={styles.ultimaRow}>
              <Text style={styles.ultimaAtivo}>{ultimaAnalise.ativo}</Text>
              <Text style={styles.ultimaTF}>{ultimaAnalise.timeframe}</Text>
              <View style={[styles.ultimaBadge, {
                backgroundColor: ultimaAnalise.tipo === 'COMPRA' ? '#00C89620' : ultimaAnalise.tipo === 'VENDA' ? '#FF444420' : '#FFA50020',
                borderColor:     ultimaAnalise.tipo === 'COMPRA' ? '#00C896'   : ultimaAnalise.tipo === 'VENDA' ? '#FF4444'   : '#FFA500',
              }]}>
                <Text style={[styles.ultimaBadgeText, {
                  color: ultimaAnalise.tipo === 'COMPRA' ? '#00C896' : ultimaAnalise.tipo === 'VENDA' ? '#FF4444' : '#FFA500',
                }]}>{ultimaAnalise.tipo.replace('_', ' ')}</Text>
              </View>
              <Text style={styles.ultimaScore}>{ultimaAnalise.score}/100</Text>
              <Ionicons name="chevron-forward" size={14} color="#333" />
            </View>
            <Text style={styles.ultimaData}>{ultimaAnalise.dataHora}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Gráficos off-screen para captura (alta resolução) */}
      <View style={styles.offscreen}>
        {/* Modo simples */}
        {candlesTF.length > 0 && (
          <ViewShot ref={shotRef} options={{ format: 'jpg', quality: 0.92, result: 'base64' }}>
            <CandleChart candles={candlesTF} symbol={ativo} timeframe={timeframe}
              width={CHART_W} height={CHART_H} />
          </ViewShot>
        )}
        {/* Modo institucional D1+H4+H1 */}
        {candlesD1.length > 0 && (
          <ViewShot ref={shotRefD1} options={{ format: 'jpg', quality: 0.92, result: 'base64' }}>
            <CandleChart candles={candlesD1} symbol={ativo} timeframe="D1"
              width={CHART_W} height={CHART_H} />
          </ViewShot>
        )}
        {candlesH4.length > 0 && (
          <ViewShot ref={shotRefH4} options={{ format: 'jpg', quality: 0.92, result: 'base64' }}>
            <CandleChart candles={candlesH4} symbol={ativo} timeframe="H4"
              width={CHART_W} height={CHART_H} />
          </ViewShot>
        )}
        {candlesH1.length > 0 && (
          <ViewShot ref={shotRefH1} options={{ format: 'jpg', quality: 0.92, result: 'base64' }}>
            <CandleChart candles={candlesH1} symbol={ativo} timeframe="H1"
              width={CHART_W} height={CHART_H} />
          </ViewShot>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0d0d0d' },
  scroll:     { padding: 16, paddingTop: 8 },

  sectionLabel: {
    color: '#555', fontSize: 10, fontWeight: '700',
    letterSpacing: 2, fontFamily: 'monospace', marginBottom: 8, marginTop: 20,
  },

  // Ativos
  ativoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ativoBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a',
    backgroundColor: '#141414',
  },
  activoBtnActive: {},
  ativoBtnActive: { borderColor: '#FFD700', backgroundColor: '#FFD70015' },
  ativoBtnText: { color: '#555', fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  ativoBtnTextActive: { color: '#FFD700' },

  // Modo
  modoRow: { flexDirection: 'row', gap: 10 },
  modoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#141414',
  },
  modoBtnActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  modoBtnText: { color: '#555', fontWeight: '700', fontSize: 12, fontFamily: 'monospace' },
  modoBtnTextActive: { color: '#000' },

  // Timeframe
  tfRow: { flexDirection: 'row', gap: 8 },
  tfBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#141414',
  },
  tfBtnActive: { borderColor: '#FFD700', backgroundColor: '#FFD70015' },
  tfBtnText: { color: '#555', fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  tfBtnTextActive: { color: '#FFD700' },

  // Preview
  previewBox: {
    marginTop: 20, backgroundColor: '#111',
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  previewLabel: {
    color: '#444', fontSize: 10, fontFamily: 'monospace',
    letterSpacing: 1, marginBottom: 6,
  },

  // Botão
  analyzeBtn: {
    marginTop: 28, backgroundColor: '#FFD700', borderRadius: 14,
    paddingVertical: 17, alignItems: 'center',
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  analyzeBtnDisabled: { opacity: 0.6 },
  analyzeBtnText: {
    color: '#000', fontSize: 15, fontWeight: '900',
    letterSpacing: 2, fontFamily: 'monospace',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Última análise
  ultimaCard: {
    marginTop: 20, backgroundColor: '#111',
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  ultimaLabel: { color: '#333', fontSize: 9, fontWeight: '700', letterSpacing: 2, fontFamily: 'monospace', marginBottom: 8 },
  ultimaRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ultimaAtivo: { color: '#ccc', fontSize: 14, fontWeight: '800', fontFamily: 'monospace' },
  ultimaTF:    { color: '#555', fontSize: 11, fontFamily: 'monospace' },
  ultimaBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  ultimaBadgeText: { fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  ultimaScore: { color: '#FFD700', fontSize: 12, fontWeight: '700', fontFamily: 'monospace', marginLeft: 'auto' },
  ultimaData:  { color: '#333', fontSize: 10, fontFamily: 'monospace', marginTop: 6 },

  // Off-screen para captura
  offscreen: { position: 'absolute', left: -9999, top: -9999 },
});
