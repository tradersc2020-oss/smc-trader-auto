export type TipoOperacao = 'COMPRA' | 'VENDA' | 'SEM_OPERACAO';

export type Timeframe = 'M5' | 'M15' | 'H1' | 'H4' | 'D1' | 'H4+H1' | 'D1+H4+H1';

export type ResultadoOperacao = 'WIN' | 'LOSS' | 'PENDENTE' | null;

export interface OrdemPronta {
  ativo: string;
  tipo: TipoOperacao;
  entrada: string;
  sl: string;
  tp: string;
  rr: string;
  // Análise Completa (H4+H1)
  tp1?: string;
  tp2?: string;
  tp3?: string;
  rr_tp1?: string;
  rr_tp2?: string;
  rr_tp3?: string;
  // Entrada escalonada (D1+H4+H1)
  entrada1?: string;
  entrada1_pct?: number;
  entrada2?: string;
  entrada2_pct?: number;
}

export interface ResumoAnalise {
  vale: boolean;
  justificativa: string;
}

export interface ScoreDetalhes {
  confluenciaZonas: boolean;
  sweepConfirmado: boolean;
  bosCHoCHPresente: boolean;
  rrFavoravel: boolean;
  entradaLongeDoMeio: boolean;
}

export interface ScoreBreakdown {
  alinhamento_timeframes: number;
  qualidade_zona: number;
  confluencia_tecnica: number;
  contexto_macro: number;
}

export interface Analise {
  id: string;
  ativo: string;
  timeframe: Timeframe;
  imagemUri: string;
  imagemBase64?: string;
  textoCompleto: string;
  tipo: TipoOperacao;
  ordem: OrdemPronta;
  score: number;
  resumo: ResumoAnalise;
  isEntradaForte: boolean;
  scoreDetalhes?: ScoreDetalhes;
  dataHora: string;
  timestamp: number;
  resultado?: ResultadoOperacao;
  // Análise Completa (H4+H1)
  modoCompleto?: boolean;
  bias_h4?: 'ALTA' | 'BAIXA' | 'NEUTRO';
  alinhamento_tf?: boolean;
  imagemUri2?: string;
  // Análise Institucional (D1+H4+H1)
  modoInstitucional?: boolean;
  bias_d1?: 'ALTA' | 'BAIXA' | 'NEUTRO';
  alinhamento_d1_h4?: boolean;
  alinhamento_h4_h1?: boolean;
  alinhamento_total?: boolean;
  win_probability?: number;
  score_breakdown?: ScoreBreakdown;
  imagemUri3?: string;
}

export interface ConfigApp {
  anthropicApiKey: string;
  twelveDataApiKey: string;
  telegramBotToken: string;
  telegramChatId: string;
  modoAgressivo: boolean;
  autoEnviarTelegram: boolean;
  scoreMinimoOperar: number;
  scoreMinimoInstitucional: number;
  notificacoesHorario: boolean;
  notificacoesEntradaForte: boolean;
  notificacoesKillZone: boolean;
  bancaTotal: number;
  riscoPercento: number;
  valorPorPonto: number;
  entradaEscalonada: boolean;
}

export const CONFIG_DEFAULT: ConfigApp = {
  anthropicApiKey: '',
  twelveDataApiKey: '',
  telegramBotToken: '',
  telegramChatId: '',
  modoAgressivo: false,
  autoEnviarTelegram: false,
  scoreMinimoOperar: 70,
  scoreMinimoInstitucional: 75,
  notificacoesHorario: false,
  notificacoesEntradaForte: true,
  notificacoesKillZone: false,
  bancaTotal: 0,
  riscoPercento: 1,
  valorPorPonto: 10,
  entradaEscalonada: true,
};

export const TIMEFRAMES: Timeframe[] = ['M5', 'M15', 'H1', 'H4', 'D1'];

export const ATIVOS_SUGERIDOS = [
  'XAUUSD',
  'EURUSD',
  'USDJPY',
  'GBPUSD',
  'BTCUSD',
];
