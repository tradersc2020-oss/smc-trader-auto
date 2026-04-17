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

export function formatarMensagemTelegram(analise: Analise): string {
  const { ativo, timeframe, tipo, ordem, score, resumo, isEntradaForte, timestamp } = analise;
  const dataHora = formatarDataHora(timestamp);
  const tipoEmoji = emojiTipo(tipo);
  const scoreEmoji = emojiScore(score);

  let msg = `🤖 *SMC TRADER ALERT*\n`;
  msg += `━━━━━━━━━━━━━━━\n`;
  msg += `📊 *${ativo}* | ${timeframe}\n`;
  msg += `🕐 ${dataHora}\n\n`;
  msg += `${tipoEmoji} *TIPO:* ${tipo.replace('_', ' ')}\n`;
  msg += `🎯 *ENTRADA:* ${ordem.entrada || 'N/A'}\n`;
  msg += `🛑 *STOP:* ${ordem.sl || 'N/A'}\n`;
  msg += `✅ *TP:* ${ordem.tp || 'N/A'}\n`;
  msg += `⚖️ *RR:* ${ordem.rr || 'N/A'}\n\n`;
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

// Mensagem separada sem emojis para o EA do MT5 parsear corretamente
export function formatarMensagemEA(analise: Analise): string | null {
  const { ativo, timeframe, tipo, ordem, score, isEntradaForte } = analise;
  if (tipo === 'SEM_OPERACAO' || score < 50 || !ordem.entrada || !ordem.sl || !ordem.tp) {
    return null;
  }
  const eaTipo = tipo === 'COMPRA' ? 'BUY' : 'SELL';
  const entradaNorm = normalizarPreco(ordem.entrada);
  const slNorm      = normalizarPreco(ordem.sl);
  const tpNorm      = normalizarPreco(ordem.tp);
  const tsSegundos = Math.floor(Date.now() / 1000);
  let msg = `SMCSTART\n`;
  msg += `SYMBOL=${ativo}\n`;
  msg += `TYPE=${eaTipo}\n`;
  msg += `ENTRY=${entradaNorm}\n`;
  msg += `SL=${slNorm}\n`;
  msg += `TP=${tpNorm}\n`;
  msg += `SCORE=${score}\n`;
  msg += `TIMEFRAME=${timeframe}\n`;
  msg += `FORTE=${isEntradaForte ? '1' : '0'}\n`;
  msg += `TS=${tsSegundos}\n`;
  msg += `SMCEND`;
  return msg;
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
  analise: Analise
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  // 1ª mensagem — alerta humano com emojis e Markdown
  const msgHumana = formatarMensagemTelegram(analise);
  await axios.post(url, {
    chat_id: chatId,
    text: msgHumana,
    parse_mode: 'Markdown',
  }, { timeout: 15000 });

  // 2ª mensagem — bloco EA limpo sem emojis (para o MT5 parsear)
  const msgEA = formatarMensagemEA(analise);
  if (msgEA) {
    await axios.post(url, {
      chat_id: chatId,
      text: msgEA,
      // sem parse_mode — texto puro, sem formatação
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
