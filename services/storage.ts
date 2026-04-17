import AsyncStorage from '@react-native-async-storage/async-storage';
import { Analise, ConfigApp, CONFIG_DEFAULT, ResultadoOperacao } from '../types/analise';

const KEYS = {
  HISTORICO: '@smc_historico',
  CONFIG: '@smc_config',
};

// ─── Histórico ───────────────────────────────────────────────────────────────

export async function salvarAnalise(analise: Analise): Promise<void> {
  const historico = await carregarHistorico();
  // Store without full base64 to save space (keep URI only)
  const analinseParaSalvar = { ...analise, imagemBase64: undefined };
  historico.unshift(analinseParaSalvar);
  // Keep only last 100
  const truncado = historico.slice(0, 100);
  await AsyncStorage.setItem(KEYS.HISTORICO, JSON.stringify(truncado));
}

export async function carregarHistorico(): Promise<Analise[]> {
  try {
    const json = await AsyncStorage.getItem(KEYS.HISTORICO);
    if (!json) return [];
    return JSON.parse(json) as Analise[];
  } catch {
    return [];
  }
}

export async function deletarAnalise(id: string): Promise<void> {
  const historico = await carregarHistorico();
  const filtrado = historico.filter((a) => a.id !== id);
  await AsyncStorage.setItem(KEYS.HISTORICO, JSON.stringify(filtrado));
}

export async function buscarAnalise(id: string): Promise<Analise | null> {
  const historico = await carregarHistorico();
  return historico.find((a) => a.id === id) || null;
}

export async function limparHistorico(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.HISTORICO);
}

export async function atualizarResultado(
  id: string,
  resultado: ResultadoOperacao
): Promise<void> {
  const historico = await carregarHistorico();
  const atualizado = historico.map((a) =>
    a.id === id ? { ...a, resultado } : a
  );
  await AsyncStorage.setItem(KEYS.HISTORICO, JSON.stringify(atualizado));
}

export async function calcularEstatisticas(): Promise<{
  total: number;
  wins: number;
  losses: number;
  taxaAcerto: number;
}> {
  const historico = await carregarHistorico();
  const comResultado = historico.filter(
    (a) => a.resultado === 'WIN' || a.resultado === 'LOSS'
  );
  const wins = comResultado.filter((a) => a.resultado === 'WIN').length;
  const losses = comResultado.filter((a) => a.resultado === 'LOSS').length;
  const total = comResultado.length;
  const taxaAcerto = total > 0 ? Math.round((wins / total) * 100) : 0;
  return { total, wins, losses, taxaAcerto };
}

export interface StatsAvancadas {
  streakAtual: number;
  streakTipo: 'WIN' | 'LOSS' | null;
  mediaScore: number;
  totalAnalises: number;
  porAtivo: Record<string, { wins: number; losses: number; total: number; taxa: number }>;
  porTimeframe: Record<string, { wins: number; losses: number; total: number; taxa: number }>;
  melhorAtivo: string;
  melhorTimeframe: string;
}

export async function calcularEstatisticasAvancadas(): Promise<StatsAvancadas> {
  const historico = await carregarHistorico();

  // Streak atual
  let streakAtual = 0;
  let streakTipo: 'WIN' | 'LOSS' | null = null;
  for (const a of historico) {
    if (a.resultado === 'WIN' || a.resultado === 'LOSS') {
      if (streakTipo === null) {
        streakTipo = a.resultado;
        streakAtual = 1;
      } else if (a.resultado === streakTipo) {
        streakAtual++;
      } else {
        break;
      }
    }
  }

  // Média de score
  const mediaScore = historico.length > 0
    ? Math.round(historico.reduce((acc, a) => acc + a.score, 0) / historico.length)
    : 0;

  // Stats por ativo
  const porAtivo: StatsAvancadas['porAtivo'] = {};
  for (const a of historico) {
    if (a.resultado !== 'WIN' && a.resultado !== 'LOSS') continue;
    if (!porAtivo[a.ativo]) porAtivo[a.ativo] = { wins: 0, losses: 0, total: 0, taxa: 0 };
    porAtivo[a.ativo].total++;
    if (a.resultado === 'WIN') porAtivo[a.ativo].wins++;
    else porAtivo[a.ativo].losses++;
  }
  for (const k of Object.keys(porAtivo)) {
    const s = porAtivo[k];
    s.taxa = Math.round((s.wins / s.total) * 100);
  }

  // Stats por timeframe
  const porTimeframe: StatsAvancadas['porTimeframe'] = {};
  for (const a of historico) {
    if (a.resultado !== 'WIN' && a.resultado !== 'LOSS') continue;
    if (!porTimeframe[a.timeframe]) porTimeframe[a.timeframe] = { wins: 0, losses: 0, total: 0, taxa: 0 };
    porTimeframe[a.timeframe].total++;
    if (a.resultado === 'WIN') porTimeframe[a.timeframe].wins++;
    else porTimeframe[a.timeframe].losses++;
  }
  for (const k of Object.keys(porTimeframe)) {
    const s = porTimeframe[k];
    s.taxa = Math.round((s.wins / s.total) * 100);
  }

  // Melhor ativo e timeframe (>= 3 operações)
  const melhorAtivo = Object.entries(porAtivo)
    .filter(([, s]) => s.total >= 3)
    .sort((a, b) => b[1].taxa - a[1].taxa)[0]?.[0] ?? '';

  const melhorTimeframe = Object.entries(porTimeframe)
    .filter(([, s]) => s.total >= 3)
    .sort((a, b) => b[1].taxa - a[1].taxa)[0]?.[0] ?? '';

  return {
    streakAtual,
    streakTipo,
    mediaScore,
    totalAnalises: historico.length,
    porAtivo,
    porTimeframe,
    melhorAtivo,
    melhorTimeframe,
  };
}

// ─── Último ativo usado ───────────────────────────────────────────────────────

export async function salvarUltimoAtivo(ativo: string): Promise<void> {
  await AsyncStorage.setItem('@smc_ultimo_ativo', ativo);
}

export async function carregarUltimoAtivo(): Promise<string> {
  try {
    return (await AsyncStorage.getItem('@smc_ultimo_ativo')) ?? '';
  } catch {
    return '';
  }
}

// ─── Configurações ────────────────────────────────────────────────────────────

export async function salvarConfig(config: ConfigApp): Promise<void> {
  await AsyncStorage.setItem(KEYS.CONFIG, JSON.stringify(config));
}

export async function carregarConfig(): Promise<ConfigApp> {
  try {
    const json = await AsyncStorage.getItem(KEYS.CONFIG);
    if (!json) return { ...CONFIG_DEFAULT };
    return { ...CONFIG_DEFAULT, ...JSON.parse(json) } as ConfigApp;
  } catch {
    return { ...CONFIG_DEFAULT };
  }
}
