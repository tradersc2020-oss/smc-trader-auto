import axios from 'axios';
import { Analise } from '../types/analise';
import { formatarDataHora } from './parser';

// Converte preço para ponto flutuante padrão que o MQL5 StringToDouble entende (ex: 4780.50)
// Regra: se tem vírgula E ponto → detecta qual é decimal pela posição relativa
//        se só vírgula → troca por ponto
//        se só ponto (ex: 159.500 ou 43500.00) → deixa como está (Claude já retorna limpo)
function normalizarPreco(preco: string): string {
  let s = preco.trim().replace(/[^\d.,-]/g, '');
  if (!s) return preco;

  const temPonto  = s.includes('.');
  const temVirgula = s.includes(',');

  if (temVirgula && temPonto) {
    // Determina qual é separador decimal pela posição: o que vier por ÚLTIMO é o decimal
    const lastDot   = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Formato BR: 4.780,50 → remove pontos de milhar, troca vírgula por ponto
      return s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato EN: 4,780.50 → remove vírgulas de milhar
      return s.replace(/,/g, '');
    }
  }

  if (temVirgula && !temPonto) {
    // Só vírgula como decimal: 4780,50 → 4780.50
    return s.replace(',', '.');
  }

  // Só ponto ou sem separador (ex: 159.500, 43500.00, 4780) → já está correto
  return s;
}

function emojiScore(score: number): string {
  if (score >= 90) return '🔥';
  if (score >= 75) return '✅';
  if (score >= 50) return '⚠️';
  return '❌';
}

function emojiTipo(tipo: string): string {
  if (tipo === 'COMPRA') return '📈';
  if (tipo === 'VENDA') return '📉';
  return '⏸';
}

export function formatarMensagemTelegram(analise: Analise, entradaEscalonada: boolean = true): string {
  const { ativo, timeframe, tipo, ordem, score, resumo, isEntradaForte, timestamp } = analise;
  const dataHora    = formatarDataHora(timestamp);
  const tipoEmoji   = emojiTipo(tipo);
  const scoreEmoji  = emojiScore(score);
  // Respeita config: só mostra entradas separadas se escalonada habilitada
  const escalonada  = entradaEscalonada && !!(ordem.entrada1 && ordem.entrada2);
  const multiTP     = !!(ordem.tp1 && ordem.tp2);

  let msg = `🤖 *SMC TRADER ALERT*\n`;
  msg += `━━━━━━━━━━━━━━━\n`;
  msg += `📊 *${ativo}* | ${timeframe}\n`;
  msg += `🕐 ${dataHora}\n\n`;

  msg += `${tipoEmoji} *TIPO:* ${tipo.replace('_', ' ')}\n`;

  // Entrada: escalonada ou simples
  // Quando não escalonada: usa entrada1 (principal) se disponível, senão entrada
  const entradaSimples = ordem.entrada1 ?? ordem.entrada;
  if (escalonada) {
    msg += `🎯 *ENTRADA 1 (${ordem.entrada1_pct ?? 50}%):* ${ordem.entrada1}\n`;
    msg += `🎯 *ENTRADA 2 (${ordem.entrada2_pct ?? 50}%):* ${ordem.entrada2}\n`;
  } else {
    msg += `🎯 *ENTRADA:* ${entradaSimples || 'N/A'}\n`;
  }

  msg += `🛑 *STOP:* ${ordem.sl || 'N/A'}\n`;

  // TPs: multi ou simples
  if (multiTP) {
    msg += `✅ *TP 1 (H1):* ${ordem.tp1}  _(${ordem.rr_tp1 ?? 'N/A'})_\n`;
    if (ordem.tp2) msg += `✅ *TP 2 (H4):* ${ordem.tp2}  _(${ordem.rr_tp2 ?? 'N/A'})_\n`;
    if (ordem.tp3) msg += `✅ *TP 3 (MACRO):* ${ordem.tp3}  _(${ordem.rr_tp3 ?? 'N/A'})_\n`;
  } else {
    msg += `✅ *TP:* ${ordem.tp || 'N/A'}\n`;
    msg += `⚖️ *RR:* ${ordem.rr || 'N/A'}\n`;
  }

  msg += `\n`;

  // Bias badges para modo institucional
  if (analise.modoInstitucional) {
    const d1Color = analise.bias_d1 === 'ALTA' ? '📈' : analise.bias_d1 === 'BAIXA' ? '📉' : '➡️';
    const h4Color = analise.bias_h4 === 'ALTA' ? '📈' : analise.bias_h4 === 'BAIXA' ? '📉' : '➡️';
    msg += `${d1Color} *D1:* ${analise.bias_d1 ?? 'N/A'}  |  ${h4Color} *H4:* ${analise.bias_h4 ?? 'N/A'}\n`;
    if (analise.alinhamento_total !== undefined) {
      msg += `${analise.alinhamento_total ? '✅' : '❌'} *Alinhamento:* ${analise.alinhamento_total ? 'TOTAL' : 'DESALINHADO'}\n`;
    }
    if (analise.win_probability != null) {
      msg += `🎲 *Win Probability:* ${analise.win_probability}%\n`;
    }
    msg += `\n`;
  } else if (analise.modoCompleto && analise.bias_h4) {
    const h4Emoji = analise.bias_h4 === 'ALTA' ? '📈' : analise.bias_h4 === 'BAIXA' ? '📉' : '➡️';
    msg += `${h4Emoji} *H4 Bias:* ${analise.bias_h4}\n\n`;
  }

  msg += `📊 *SCORE:* ${score}/100 ${scoreEmoji}\n`;
  msg += `🧠 *VALE ENTRAR:* ${resumo.vale ? 'SIM' : 'NÃO'}\n`;
  if (resumo.justificativa) {
    msg += `_${resumo.justificativa}_\n`;
  }
  if (isEntradaForte) {
    msg += `\n👉 *ENTRADA FORTE* 🔥\n`;
  }
  msg += `━━━━━━━━━━━━━━━\n`;
  msg += `_Gerado pelo SMC Trader App_`;

  return msg;
}

const LOT_MINIMO = 0.01;

// Arredonda lote para baixo com 2 casas (ex: 0.0368 → 0.03)
function arredondarLote(lote: number): number {
  return Math.floor(lote * 100) / 100;
}

// Constrói um bloco EA individual para o MT5
function blocoEA(params: {
  ativo: string;
  eaTipo: string;
  entry: string;
  sl: string;
  tp: string;
  lotPct: number;
  lot: number | null;  // lote real calculado; null = EA usa LOT_PCT
  ordem: number;
  totalOrdens: number;
  score: number;
  timeframe: string;
  isEntradaForte: boolean;
  tsSegundos: number;
}): string {
  let msg = `SMCSTART\n`;
  msg += `SYMBOL=${params.ativo}\n`;
  msg += `TYPE=${params.eaTipo}\n`;
  msg += `ENTRY=${params.entry}\n`;
  msg += `SL=${params.sl}\n`;
  msg += `TP=${params.tp}\n`;
  if (params.lot !== null) {
    msg += `LOT=${params.lot.toFixed(2)}\n`;
  }
  msg += `LOT_PCT=${params.lotPct}\n`;
  msg += `ORDER=${params.ordem}\n`;
  msg += `TOTAL_ORDERS=${params.totalOrdens}\n`;
  msg += `SCORE=${params.score}\n`;
  msg += `TIMEFRAME=${params.timeframe}\n`;
  msg += `FORTE=${params.isEntradaForte ? '1' : '0'}\n`;
  msg += `TS=${params.tsSegundos}\n`;
  msg += `SMCEND`;
  return msg;
}

// Retorna array de blocos EA — 1 por TP (MT5 abre uma ordem independente por mensagem)
// lotSugerido: lote calculado pelo app (da gestão de risco). Null = EA usa LOT_PCT.
export function formatarMensagensEA(
  analise: Analise,
  lotSugerido: number | null = null,
  entradaEscalonada: boolean = true,
): string[] {
  const { ativo, timeframe, tipo, ordem, score, isEntradaForte } = analise;

  const tpPrimario = ordem.tp1 || ordem.tp;
  if (tipo === 'SEM_OPERACAO' || score < 50 || !ordem.sl || !tpPrimario) return [];

  // Se entrada escalonada desabilitada nas config → força 1 único bloco
  const escalonada = entradaEscalonada && !!(ordem.entrada1 && ordem.entrada2);
  const eaTipo     = tipo === 'COMPRA' ? 'BUY' : 'SELL';
  const slNorm     = normalizarPreco(ordem.sl);
  const tsSegundos = Math.floor(Date.now() / 1000);
  // Multi-TP só funciona quando entrada escalonada habilitada
  const multiTP    = entradaEscalonada && !!(ordem.tp1 && ordem.tp2 && ordem.tp3);

  // Entrada principal = entrada1 se existir (seja escalonada ou não)
  // entrada (média) só é usada como fallback quando entrada1 não existe
  const entradaPrincipal = ordem.entrada1 ?? ordem.entrada;
  const e1   = normalizarPreco(escalonada ? (ordem.entrada1 ?? ordem.entrada) : entradaPrincipal);
  const e2   = normalizarPreco(escalonada ? (ordem.entrada2 ?? ordem.entrada) : entradaPrincipal);
  const eMed = normalizarPreco(escalonada ? ordem.entrada : entradaPrincipal);

  // Calcula lotes reais por ordem (34/33/33) e verifica se é viável dividir
  let lot1: number | null = null;
  let lot2: number | null = null;
  let lot3: number | null = null;
  let podeDividir = true;

  if (lotSugerido !== null && multiTP) {
    lot1 = arredondarLote(lotSugerido * 0.34);
    lot2 = arredondarLote(lotSugerido * 0.33);
    lot3 = arredondarLote(lotSugerido * 0.33);
    // Colapsa para 1 ordem se qualquer lote ficar abaixo do mínimo
    if (lot1 < LOT_MINIMO || lot2 < LOT_MINIMO || lot3 < LOT_MINIMO) {
      podeDividir = false;
    }
  }

  if (multiTP && podeDividir) {
    return [
      blocoEA({ ativo, eaTipo, entry: e1,   sl: slNorm, tp: normalizarPreco(ordem.tp1!), lot: lot1, lotPct: 34, ordem: 1, totalOrdens: 3, score, timeframe, isEntradaForte, tsSegundos }),
      blocoEA({ ativo, eaTipo, entry: eMed, sl: slNorm, tp: normalizarPreco(ordem.tp2!), lot: lot2, lotPct: 33, ordem: 2, totalOrdens: 3, score, timeframe, isEntradaForte, tsSegundos }),
      blocoEA({ ativo, eaTipo, entry: e2,   sl: slNorm, tp: normalizarPreco(ordem.tp3!), lot: lot3, lotPct: 33, ordem: 3, totalOrdens: 3, score, timeframe, isEntradaForte, tsSegundos }),
    ];
  }

  // Single TP ou lote insuficiente para dividir → 1 único bloco com lote total
  const lotTotal = lotSugerido !== null ? lotSugerido : null;
  return [blocoEA({
    ativo, eaTipo,
    entry: e1,
    sl: slNorm,
    tp: normalizarPreco(tpPrimario),
    lot: lotTotal,
    lotPct: 100,
    ordem: 1, totalOrdens: 1, score, timeframe, isEntradaForte, tsSegundos,
  })];
}

// Mantém compatibilidade com código legado
export function formatarMensagemEA(analise: Analise): string | null {
  const blocos = formatarMensagensEA(analise, null);
  return blocos.length > 0 ? blocos[0] : null;
}

export async function enviarTelegram(
  botToken: string,
  chatId: string,
  mensagem: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await axios.post(
    url,
    { chat_id: chatId, text: mensagem, parse_mode: 'Markdown' },
    { timeout: 15000 }
  );
}

export async function enviarTelegramComEA(
  botToken: string,
  chatId: string,
  analise: Analise,
  lotSugerido: number | null = null,
  entradaEscalonada: boolean = true,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  // 1ª mensagem — alerta humano com emojis e Markdown
  const msgHumana = formatarMensagemTelegram(analise, entradaEscalonada);
  await axios.post(url, {
    chat_id: chatId,
    text: msgHumana,
    parse_mode: 'Markdown',
  }, { timeout: 15000 });

  // Blocos EA — respeita config entradaEscalonada
  // false → sempre 1 bloco / true → até 3 blocos se lote viável
  const blocos = formatarMensagensEA(analise, lotSugerido, entradaEscalonada);
  for (const bloco of blocos) {
    await axios.post(url, {
      chat_id: chatId,
      text: bloco,
    }, { timeout: 15000 });
  }
}

export async function testarConexaoTelegram(
  botToken: string,
  chatId: string
): Promise<void> {
  const msg = `✅ *SMC Trader* conectado com sucesso!\n🕐 ${new Date().toLocaleString('pt-BR')}\n_Teste de conexão_`;
  await enviarTelegram(botToken, chatId, msg);
}
