import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { carregarConfig, salvarConfig } from '../../services/storage';
import { testarConexaoTelegram } from '../../services/telegramApi';
import { ConfigApp, CONFIG_DEFAULT } from '../../types/analise';
import {
  solicitarPermissaoNotificacoes,
  agendarHorariosMercado,
  cancelarHorariosMercado,
  agendarKillZones,
  cancelarKillZones,
} from '../../services/notifications';

export default function ConfiguracoesScreen() {
  const [config, setConfig]     = useState<ConfigApp>({ ...CONFIG_DEFAULT });
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [showApiKey, setShowApiKey]     = useState(false);
  const [showTwelve, setShowTwelve]     = useState(false);
  const [showToken, setShowToken]       = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => { carregarConfig().then(setConfig); }, []);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await salvarConfig(config);

      if (config.notificacoesHorario) {
        const perm = await solicitarPermissaoNotificacoes();
        if (perm) await agendarHorariosMercado();
        else Alert.alert('Permissão', 'Ative as notificações nas configurações do sistema.');
      } else {
        await cancelarHorariosMercado();
      }

      if (config.notificacoesKillZone) {
        const perm = await solicitarPermissaoNotificacoes();
        if (perm) await agendarKillZones();
      } else {
        await cancelarKillZones();
      }

      Alert.alert('✅ Configurações salvas');
    } finally {
      setSalvando(false);
    }
  };

  const handleTestarTelegram = async () => {
    if (!config.telegramBotToken || !config.telegramChatId) {
      Alert.alert('Configuração incompleta', 'Preencha o BOT TOKEN e CHAT ID.');
      return;
    }
    setTestando(true);
    try {
      await testarConexaoTelegram(config.telegramBotToken, config.telegramChatId);
      Alert.alert('✅ Telegram conectado!', 'Mensagem de teste enviada com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha ao conectar com o Telegram.');
    } finally {
      setTestando(false);
    }
  };

  const update = <K extends keyof ConfigApp>(key: K, val: ConfigApp[K]) =>
    setConfig((prev) => ({ ...prev, [key]: val }));

  const riscoReais = config.bancaTotal > 0
    ? (config.bancaTotal * config.riscoPercento / 100).toFixed(2)
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      {/* ── API ANTHROPIC ──────────────────────────── */}
      <SectionHeader title="API ANTHROPIC" icon="key" />
      <View style={styles.card}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldTitle}>API KEY</Text>
          <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)}>
            <Ionicons name={showApiKey ? 'eye-off' : 'eye'} size={16} color="#555" />
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          value={config.anthropicApiKey}
          onChangeText={(v) => update('anthropicApiKey', v)}
          placeholder="sk-ant-..."
          placeholderTextColor="#333"
          secureTextEntry={!showApiKey}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>Obtenha em console.anthropic.com</Text>
      </View>

      {/* ── API TWELVE DATA ────────────────────────── */}
      <SectionHeader title="TWELVE DATA (FOREX / OURO)" icon="bar-chart" />
      <View style={styles.card}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldTitle}>API KEY</Text>
          <TouchableOpacity onPress={() => setShowTwelve(!showTwelve)}>
            <Ionicons name={showTwelve ? 'eye-off' : 'eye'} size={16} color="#555" />
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          value={config.twelveDataApiKey}
          onChangeText={(v) => update('twelveDataApiKey', v)}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          placeholderTextColor="#333"
          secureTextEntry={!showTwelve}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>Gratuito em twelvedata.com · 800 req/dia</Text>
        <Text style={styles.hint}>Necessário para XAUUSD, EURUSD, USDJPY, GBPUSD</Text>
      </View>

      {/* ── TELEGRAM ───────────────────────────────── */}
      <SectionHeader title="TELEGRAM" icon="paper-plane" />
      <View style={styles.card}>
        <Text style={styles.fieldTitle}>BOT TOKEN</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={config.telegramBotToken}
            onChangeText={(v) => update('telegramBotToken', v)}
            placeholder="123456:ABC..."
            placeholderTextColor="#333"
            secureTextEntry={!showToken}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowToken(!showToken)} style={styles.eyeBtn}>
            <Ionicons name={showToken ? 'eye-off' : 'eye'} size={16} color="#555" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.fieldTitle, { marginTop: 14 }]}>CHAT ID</Text>
        <TextInput
          style={styles.input}
          value={config.telegramChatId}
          onChangeText={(v) => update('telegramChatId', v)}
          placeholder="-100123456789"
          placeholderTextColor="#333"
          keyboardType="numeric"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.testBtn, testando && styles.disabledBtn]}
          onPress={handleTestarTelegram}
          disabled={testando}
        >
          {testando ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={16} color="#000" />
              <Text style={styles.testBtnText}>Testar Conexão</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── GESTÃO DE RISCO ────────────────────────── */}
      <SectionHeader title="GESTÃO DE RISCO" icon="shield-checkmark" />
      <View style={styles.card}>
        <Text style={styles.fieldTitle}>BANCA TOTAL (R$)</Text>
        <TextInput
          style={styles.input}
          value={config.bancaTotal > 0 ? String(config.bancaTotal) : ''}
          onChangeText={(v) => update('bancaTotal', Number(v.replace(/\./g, '').replace(',', '.')) || 0)}
          placeholder="Ex: 10000"
          placeholderTextColor="#333"
          keyboardType="numeric"
          autoCorrect={false}
        />
        {config.bancaTotal > 0 && (
          <Text style={styles.bancaFormatada}>
            {config.bancaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </Text>
        )}

        <View style={[styles.sliderSection, { marginTop: 16 }]}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Risco por operação</Text>
            <Text style={[styles.sliderValue, { color: getRiscoColor(config.riscoPercento) }]}>
              {config.riscoPercento}%
            </Text>
          </View>
          <Slider
            style={{ width: '100%', height: 36 }}
            minimumValue={0.5}
            maximumValue={3}
            step={0.5}
            value={config.riscoPercento}
            onValueChange={(v) => update('riscoPercento', v)}
            minimumTrackTintColor="#FFD700"
            maximumTrackTintColor="#2a2a2a"
            thumbTintColor="#FFD700"
          />
          <View style={styles.sliderTicks}>
            {[0.5, 1, 1.5, 2, 2.5, 3].map((v) => (
              <Text key={v} style={[styles.sliderTick, v === config.riscoPercento && { color: '#FFD700' }]}>
                {v}%
              </Text>
            ))}
          </View>
        </View>

        {riscoReais && (
          <View style={styles.riscoPreview}>
            <Ionicons name="calculator-outline" size={14} color="#FFD700" />
            <Text style={styles.riscoPreviewText}>
              Risco por op: <Text style={{ color: '#FF6B6B', fontWeight: '900' }}>R$ {riscoReais}</Text>
            </Text>
          </View>
        )}

        <View style={[styles.sliderSection, { marginTop: 18 }]}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Valor por ponto (R$)</Text>
            <Text style={[styles.sliderValue, { color: '#FFD700' }]}>
              {config.valorPorPonto}
            </Text>
          </View>
          <Slider
            style={{ width: '100%', height: 36 }}
            minimumValue={1}
            maximumValue={50}
            step={1}
            value={config.valorPorPonto}
            onValueChange={(v) => update('valorPorPonto', v)}
            minimumTrackTintColor="#FFD700"
            maximumTrackTintColor="#2a2a2a"
            thumbTintColor="#FFD700"
          />
          <View style={styles.sliderTicks}>
            {[1, 10, 20, 30, 40, 50].map((v) => (
              <Text key={v} style={[styles.sliderTick, v === config.valorPorPonto && { color: '#FFD700' }]}>
                {v}
              </Text>
            ))}
          </View>
        </View>
        <Text style={styles.hint}>XAUUSD=10 | EURUSD=10 | WIN=0.2 | WDO=2</Text>
      </View>

      {/* ── NOTIFICAÇÕES ───────────────────────────── */}
      <SectionHeader title="NOTIFICAÇÕES" icon="notifications" />
      <View style={styles.card}>
        <ToggleRow
          label="Horários do Mercado"
          sublabel="Alertas: 6h, 9h, 13h30, 17h, 18h (BRT)"
          value={config.notificacoesHorario}
          onChange={(v) => update('notificacoesHorario', v)}
          iconName="time-outline"
        />
        <View style={styles.divider} />
        <ToggleRow
          label="Kill Zones ICT"
          sublabel="London 8h | NY 13h | NY PM 15h | NY Close 20h"
          value={config.notificacoesKillZone}
          onChange={(v) => update('notificacoesKillZone', v)}
          iconName="locate-outline"
        />
        <View style={styles.divider} />
        <ToggleRow
          label="Alerta Entrada Forte"
          sublabel="Notifica quando score ≥ 90"
          value={config.notificacoesEntradaForte}
          onChange={(v) => update('notificacoesEntradaForte', v)}
          iconName="flash-outline"
        />
      </View>

      {/* ── PREFERÊNCIAS ───────────────────────────── */}
      <SectionHeader title="PREFERÊNCIAS" icon="options" />
      <View style={styles.card}>
        <ToggleRow
          label="Modo Agressivo"
          sublabel="Ativa marcador ENTRADA FORTE"
          value={config.modoAgressivo}
          onChange={(v) => update('modoAgressivo', v)}
          iconName="trending-up-outline"
        />
        <View style={styles.divider} />
        <ToggleRow
          label="Auto-enviar Telegram"
          sublabel={`Envia automaticamente quando score ≥ ${config.scoreMinimoOperar}`}
          value={config.autoEnviarTelegram}
          onChange={(v) => update('autoEnviarTelegram', v)}
          iconName="send-outline"
        />
        <View style={styles.divider} />

        <View style={styles.sliderSection}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Score mínimo para operar</Text>
            <Text style={[styles.sliderValue, { color: getScoreColor(config.scoreMinimoOperar) }]}>
              {config.scoreMinimoOperar}
            </Text>
          </View>
          <Slider
            style={{ width: '100%', height: 36 }}
            minimumValue={50}
            maximumValue={90}
            step={5}
            value={config.scoreMinimoOperar}
            onValueChange={(v) => update('scoreMinimoOperar', v)}
            minimumTrackTintColor="#FFD700"
            maximumTrackTintColor="#2a2a2a"
            thumbTintColor="#FFD700"
          />
          <View style={styles.sliderTicks}>
            {[50, 60, 70, 80, 90].map((v) => (
              <Text key={v} style={[styles.sliderTick, v === config.scoreMinimoOperar && { color: '#FFD700' }]}>
                {v}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.sliderSection}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Score mínimo D1+H4+H1</Text>
            <Text style={[styles.sliderValue, { color: getScoreColor(config.scoreMinimoInstitucional) }]}>
              {config.scoreMinimoInstitucional}
            </Text>
          </View>
          <Slider
            style={{ width: '100%', height: 36 }}
            minimumValue={60}
            maximumValue={95}
            step={5}
            value={config.scoreMinimoInstitucional}
            onValueChange={(v) => update('scoreMinimoInstitucional', v)}
            minimumTrackTintColor="#00C896"
            maximumTrackTintColor="#2a2a2a"
            thumbTintColor="#00C896"
          />
          <View style={styles.sliderTicks}>
            {[60, 70, 75, 85, 95].map((v) => (
              <Text key={v} style={[styles.sliderTick, v === config.scoreMinimoInstitucional && { color: '#00C896' }]}>
                {v}
              </Text>
            ))}
          </View>
          <Text style={styles.hint}>Modo institucional requer maior alinhamento</Text>
        </View>

        <View style={styles.divider} />

        <ToggleRow
          label="Entrada Escalonada"
          sublabel="D1+H4+H1: 2 entradas (50%+50%) nos OBs"
          value={config.entradaEscalonada}
          onChange={(v) => update('entradaEscalonada', v)}
          iconName="git-branch-outline"
        />
      </View>

      {/* ── SALVAR ─────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.saveBtn, salvando && styles.disabledBtn]}
        onPress={handleSalvar}
        disabled={salvando}
      >
        {salvando ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.saveBtnText}>💾 SALVAR CONFIGURAÇÕES</Text>
        )}
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>SMC Trader v1.0.0</Text>
        <Text style={styles.footerDev}>Desenvolvido por Caiolf</Text>
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={14} color="#FFD700" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function ToggleRow({
  label, sublabel, value, onChange, iconName,
}: {
  label: string; sublabel: string; value: boolean;
  onChange: (v: boolean) => void; iconName?: string;
}) {
  return (
    <View style={styles.toggleRow}>
      {iconName && (
        <Ionicons name={iconName as any} size={18} color={value ? '#FFD700' : '#444'} style={{ marginRight: 10 }} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSublabel}>{sublabel}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#2a2a2a', true: '#FFD70080' }}
        thumbColor={value ? '#FFD700' : '#555'}
      />
    </View>
  );
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#FFD700';
  if (score >= 75) return '#00C896';
  if (score >= 50) return '#FFA500';
  return '#FF4444';
}

function getRiscoColor(risco: number): string {
  if (risco <= 1) return '#00C896';
  if (risco <= 2) return '#FFA500';
  return '#FF4444';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  content:   { padding: 16 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 24, marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFD700', fontSize: 11, fontWeight: '700',
    letterSpacing: 2, fontFamily: 'monospace',
  },

  card: {
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: '#2a2a2a',
  },
  fieldRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  fieldTitle: {
    color: '#888', fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginBottom: 6, fontFamily: 'monospace',
  },
  input: {
    backgroundColor: '#0d0d0d', borderRadius: 8, borderWidth: 1,
    borderColor: '#2a2a2a', color: '#fff', fontSize: 14,
    fontFamily: 'monospace', paddingHorizontal: 12, paddingVertical: 10,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: {
    padding: 10, backgroundColor: '#0d0d0d',
    borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a',
  },
  hint: { color: '#444', fontSize: 11, marginTop: 6, fontFamily: 'monospace' },
  bancaFormatada: { color: '#FFD700', fontSize: 12, marginTop: 4, fontFamily: 'monospace', textAlign: 'right' },

  riscoPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, backgroundColor: '#FFD70010',
    borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#FFD70030',
  },
  riscoPreviewText: {
    color: '#aaa', fontSize: 13, fontFamily: 'monospace',
  },

  testBtn: {
    marginTop: 14, backgroundColor: '#FFD700', borderRadius: 8,
    paddingVertical: 11, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  testBtnText: { color: '#000', fontWeight: '900', fontSize: 13, fontFamily: 'monospace' },
  disabledBtn: { opacity: 0.6 },

  divider: { height: 1, backgroundColor: '#2a2a2a', marginVertical: 14 },

  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  toggleLabel: { color: '#ddd', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  toggleSublabel: { color: '#555', fontSize: 11 },

  sliderSection: { paddingTop: 4 },
  sliderHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sliderLabel:   { color: '#ddd', fontSize: 14, fontWeight: '600' },
  sliderValue:   { fontSize: 18, fontWeight: '900', fontFamily: 'monospace' },
  sliderTicks:   { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  sliderTick:    { color: '#444', fontSize: 10, fontFamily: 'monospace' },

  saveBtn: {
    marginTop: 28, backgroundColor: '#FFD700', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  saveBtnText: {
    color: '#000', fontSize: 15, fontWeight: '900',
    letterSpacing: 2, fontFamily: 'monospace',
  },

  footer: {
    marginTop: 32, marginBottom: 16,
    alignItems: 'center', gap: 4,
  },
  footerText: {
    color: '#333', fontSize: 11, fontFamily: 'monospace', letterSpacing: 1,
  },
  footerDev: {
    color: '#444', fontSize: 12, fontFamily: 'monospace',
  },
});
