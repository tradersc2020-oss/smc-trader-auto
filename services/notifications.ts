import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Analise } from '../types/analise';

// Notificações não funcionam no Expo Go desde SDK 53
const isExpoGo = Constants.appOwnership === 'expo';

// Helper: injeta channelId no Android sem quebrar iOS
function withChannel(
  content: Notifications.NotificationContentInput,
  channelId: 'ordem-resultado' | 'ordem-alerta' | 'mercado-info',
): Notifications.NotificationContentInput {
  if (Platform.OS !== 'android') return content;
  return { ...content, ...(Platform.OS === 'android' ? ({ android: { channelId } } as any) : {}) };
}

if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── Permissões ───────────────────────────────────────────────────────────────

export async function solicitarPermissaoNotificacoes(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Notificação imediata de Entrada Forte ────────────────────────────────────

export async function notificarEntradaForte(analise: Analise): Promise<void> {
  const perm = await solicitarPermissaoNotificacoes();
  if (!perm) return;

  const tipoEmoji = analise.tipo === 'COMPRA' ? '📈' : analise.tipo === 'VENDA' ? '📉' : '⏸';

  await Notifications.scheduleNotificationAsync({
    content: withChannel({
      title: `🔥 ENTRADA FORTE — ${analise.ativo}`,
      body: `${tipoEmoji} ${analise.tipo} | Score: ${analise.score}/100 | ${analise.timeframe}`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { analiseId: analise.id },
    }, 'ordem-alerta'),
    trigger: null,
  });
}

// ─── Notificações de monitoramento de ordem ──────────────────────────────────

export async function notificarOrdemExecutada(analise: Analise): Promise<void> {
  const perm = await solicitarPermissaoNotificacoes();
  if (!perm) return;

  const tipoEmoji = analise.tipo === 'COMPRA' ? '📈' : '📉';
  const entrada = analise.ordem.entrada1 ?? analise.ordem.entrada;

  await Notifications.scheduleNotificationAsync({
    content: withChannel({
      title: `⚡ ORDEM EXECUTADA — ${analise.ativo}`,
      body: `${tipoEmoji} ${analise.tipo} @ ${entrada} | ${analise.timeframe} | Score ${analise.score}/100`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { analiseId: analise.id, tipo: 'ordem_executada' },
    }, 'ordem-alerta'),
    trigger: null,
  });
}

export async function notificarResultadoOrdem(
  analise: Analise,
  resultado: 'WIN' | 'LOSS',
): Promise<void> {
  const perm = await solicitarPermissaoNotificacoes();
  if (!perm) return;

  const isWin = resultado === 'WIN';
  const tp    = analise.ordem.tp1 ?? analise.ordem.tp;
  const sl    = analise.ordem.sl;
  const nivel = isWin ? tp : sl;

  await Notifications.scheduleNotificationAsync({
    content: withChannel({
      title: isWin
        ? `✅ WIN — ${analise.ativo} ${analise.timeframe}`
        : `❌ LOSS — ${analise.ativo} ${analise.timeframe}`,
      body: isWin
        ? `TP atingido @ ${nivel} 🎯 | Score ${analise.score}/100`
        : `SL atingido @ ${nivel} 🛑 | Revise o setup`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 400, 200, 400, 200, 400],
      data: { analiseId: analise.id, tipo: 'resultado_ordem', resultado },
    }, 'ordem-resultado'),
    trigger: null,
  });
}

export async function notificarSLProximo(analise: Analise): Promise<void> {
  const perm = await solicitarPermissaoNotificacoes();
  if (!perm) return;

  const tipoEmoji = analise.tipo === 'COMPRA' ? '📈' : '📉';

  await Notifications.scheduleNotificationAsync({
    content: withChannel({
      title: `⚠️ SL PRÓXIMO — ${analise.ativo}`,
      body: `${tipoEmoji} Preço a menos de 25% do stop @ ${analise.ordem.sl} · Decida agora`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      vibrate: [0, 300, 150, 300],
      data: { analiseId: analise.id, tipo: 'sl_proximo' },
    }, 'ordem-alerta'),
    trigger: null,
  });
}

export async function notificarTPParcial(
  analise: Analise,
  tpNum: 1 | 2,
  tpValor: string,
): Promise<void> {
  const perm = await solicitarPermissaoNotificacoes();
  if (!perm) return;

  const proxAlvo = tpNum === 1
    ? (analise.ordem.tp2 ? `· Próximo alvo TP2 @ ${analise.ordem.tp2}` : '')
    : (analise.ordem.tp3 ? `· Próximo alvo TP3 @ ${analise.ordem.tp3}` : '');

  await Notifications.scheduleNotificationAsync({
    content: withChannel({
      title: `🔰 TP${tpNum} ATINGIDO — ${analise.ativo}`,
      body: `Parcial @ ${tpValor} ✅ ${proxAlvo}`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      vibrate: [0, 250, 100, 250],
      data: { analiseId: analise.id, tipo: `tp${tpNum}_parcial` },
    }, 'ordem-alerta'),
    trigger: null,
  });
}

export async function notificarMoverSL(analise: Analise, novoSL: string): Promise<void> {
  const perm = await solicitarPermissaoNotificacoes();
  if (!perm) return;

  await Notifications.scheduleNotificationAsync({
    content: withChannel({
      title: `🔒 MOVER SL — ${analise.ativo}`,
      body: `TP1 garantido · Mova o Stop Loss para entrada @ ${novoSL}`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { analiseId: analise.id, tipo: 'mover_sl' },
    }, 'ordem-alerta'),
    trigger: null,
  });
}

// ─── Notificação de resultado da análise ─────────────────────────────────────

export async function notificarAnalise(analise: Analise): Promise<void> {
  const perm = await solicitarPermissaoNotificacoes();
  if (!perm) return;

  if (analise.score < 50) return; // Não notificar análises fracas

  const titulo = analise.isEntradaForte
    ? `🔥 ENTRADA FORTE — ${analise.ativo}`
    : `📊 Análise — ${analise.ativo}`;

  const tipoEmoji = analise.tipo === 'COMPRA' ? '📈' : analise.tipo === 'VENDA' ? '📉' : '⏸';

  await Notifications.scheduleNotificationAsync({
    content: withChannel({
      title: titulo,
      body: `${tipoEmoji} ${analise.tipo.replace('_', ' ')} | ${analise.resumo.vale ? 'Vale entrar ✅' : 'Aguardar ⏳'} | Score: ${analise.score}/100`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      data: { analiseId: analise.id },
    }, 'mercado-info'),
    trigger: null,
  });
}

// ─── Horários do mercado ──────────────────────────────────────────────────────

const HORARIOS_MERCADO = [
  { hora: 6,  minuto: 0,  msg: '🌏 Sessão Asiática — Possíveis armadilhas de liquidez' },
  { hora: 9,  minuto: 0,  msg: '🌍 Abertura Europa — Hora de preparar setups' },
  { hora: 13, minuto: 30, msg: '🇺🇸 Abertura Nova York — Máxima volatilidade do dia!' },
  { hora: 17, minuto: 0,  msg: '⚡ Sobreposição EUR/NY — Melhor janela para scalp!' },
  { hora: 17, minuto: 30, msg: '🇧🇷 Fechamento B3 — Revisar mini contratos (WIN/WDO)' },
  { hora: 18, minuto: 0,  msg: '🔔 Fechamento Europa — Revisar posições abertas' },
];

// ─── Kill Zones ───────────────────────────────────────────────────────────────

const KILL_ZONES = [
  { hora: 8,  minuto: 0,  msg: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 LONDON KILL ZONE — Alta probabilidade! Busque sweep + OB' },
  { hora: 13, minuto: 0,  msg: '🗽 NY KILL ZONE em 30min — Prepare seu gráfico agora!' },
  { hora: 15, minuto: 0,  msg: '⚡ NY PM SESSION — Possível reversão ou continuação' },
  { hora: 20, minuto: 0,  msg: '🌙 NY Close — Últimas entradas do dia' },
];

export async function agendarHorariosMercado(): Promise<void> {
  const perm = await solicitarPermissaoNotificacoes();
  if (!perm) return;

  await cancelarHorariosMercado();

  for (const h of HORARIOS_MERCADO) {
    await Notifications.scheduleNotificationAsync({
      content: withChannel({
        title: 'SMC Trader — Mercado',
        body: h.msg,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        data: { tipo: 'horario_mercado' },
      }, 'mercado-info'),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: h.hora,
        minute: h.minuto,
      },
    });
  }
}

export async function agendarKillZones(): Promise<void> {
  const perm = await solicitarPermissaoNotificacoes();
  if (!perm) return;

  await cancelarKillZones();

  for (const kz of KILL_ZONES) {
    await Notifications.scheduleNotificationAsync({
      content: withChannel({
        title: '🎯 SMC Kill Zone',
        body: kz.msg,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        data: { tipo: 'kill_zone' },
      }, 'mercado-info'),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: kz.hora,
        minute: kz.minuto,
      },
    });
  }
}

export async function cancelarKillZones(): Promise<void> {
  const agendadas = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of agendadas) {
    if ((n.content.data as any)?.tipo === 'kill_zone') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function cancelarHorariosMercado(): Promise<void> {
  const agendadas = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of agendadas) {
    if ((n.content.data as any)?.tipo === 'horario_mercado') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

// ─── Canais Android (3 níveis de prioridade) ─────────────────────────────────

export async function configurarCanalAndroid(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Canal 1: Resultado de ordem — MÁXIMA prioridade (WIN / LOSS)
  await Notifications.setNotificationChannelAsync('ordem-resultado', {
    name: '📊 Resultado de Ordem',
    description: 'WIN e LOSS — nunca silenciar',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    lightColor: '#00C896',
    sound: 'default',
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Canal 2: Alertas de ordem — ALTA prioridade (execução, SL próximo, TP parcial, mover SL)
  await Notifications.setNotificationChannelAsync('ordem-alerta', {
    name: '⚡ Alertas de Ordem',
    description: 'Ordem executada, SL próximo, TPs parciais',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#FFD700',
    sound: 'default',
  });

  // Canal 3: Informações de mercado — DEFAULT (Kill Zones, horários, análises)
  await Notifications.setNotificationChannelAsync('mercado-info', {
    name: '📈 Informações de Mercado',
    description: 'Kill Zones, horários de sessão, novas análises',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 100],
    lightColor: '#FFD700',
    sound: 'default',
  });
}
