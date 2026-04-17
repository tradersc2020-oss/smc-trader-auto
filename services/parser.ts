import { TipoOperacao, OrdemPronta, ResumoAnalise, Analise } from '../types/analise';

// ─── Limpeza de Markdown ──────────────────────────────────────────────────────

export function cleanText(texto: string): string {
  return texto
    .replace(/\*\*([^*]*)\*\*/g, '$1')   // **bold** → texto limpo
    .replace(/\*([^*]*)\*/g, '$1')        // *italic* → texto limpo
    .replace(/^#{1,4}\s*/gm, '')          // ## heading → remove prefixo
    .replace(/^[-─—]{3,}\s*$/gm, '')      // --- separadores → remove linha
    .replace(/^>\s*/gm, '')               // > quote → remove prefixo
    .replace(/`([^`]*)`/g, '$1')          // `code` → texto limpo
    .trim();
}

// Remove markdown somente dos valores extraídos (não do texto de exibição)
function cleanValue(val: string): string {
  return val
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .trim();
}

// ─── Extratores ───────────────────────────────────────────────────────────────

export function extractTipo(texto: string): TipoOperacao {
  const clean = cleanText(texto).toUpperCase();
  const upper = texto.toUpperCase();

  // 1. Linha TIPO: explícita
  const tipoMatch = (clean + '\n' + upper).match(
    /TIPO:\s*(COMPRA|VENDA|SEM[_\s]OPERA[ÇC][ÃA]O)/
  );
  if (tipoMatch) {
    const v = tipoMatch[1].replace(/[\s_]/g, '_');
    if (v.includes('COMPRA')) return 'COMPRA';
    if (v.includes('VENDA')) return 'VENDA';
    return 'SEM_OPERACAO';
  }

  // 2. Bloco DECISÃO
  const decisaoBlock = clean.match(/DECIS[ÃA]O[\s\S]{0,200}/i)?.[0] || '';
  if (decisaoBlock.toUpperCase().includes('SEM OPERA')) return 'SEM_OPERACAO';
  if (decisaoBlock.toUpperCase().includes('COMPRA')) return 'COMPRA';
  if (decisaoBlock.toUpperCase().includes('VENDA')) return 'VENDA';

  // 3. Contagem global
  const compraCount = (upper.match(/\bCOMPRA\b/g) || []).length;
  const vendaCount  = (upper.match(/\bVENDA\b/g)  || []).length;
  if (compraCount > vendaCount) return 'COMPRA';
  if (vendaCount > compraCount) return 'VENDA';
  return 'SEM_OPERACAO';
}

export function extractOrdem(texto: string): OrdemPronta {
  // Tenta com texto limpo primeiro, depois com original sem **
  const clean   = cleanText(texto);
  const noStars = texto.replace(/\*\*/g, '').replace(/\*/g, '');

  const tryExtract = (src: string, pattern: RegExp) =>
    cleanValue(extractFieldRaw(src, pattern) || '');

  const ativo  = tryExtract(clean, /ATIVO:\s*([^\n]+)/)
              || tryExtract(noStars, /ATIVO:\s*([^\n]+)/);
  const tipo   = extractTipo(texto);
  const entrada = tryExtract(clean, /ENTRADA:\s*([^\n]+)/)
               || tryExtract(noStars, /ENTRADA:\s*([^\n]+)/);
  const sl     = tryExtract(clean, /STOP\s*(?:LOSS)?:\s*([^\n]+)/i)
              || tryExtract(noStars, /STOP\s*(?:LOSS)?:\s*([^\n]+)/i);
  const tp     = tryExtract(clean, /TAKE\s*(?:PROFIT)?:\s*([^\n]+)/i)
              || tryExtract(noStars, /TAKE\s*(?:PROFIT)?:\s*([^\n]+)/i);
  const rr     = tryExtract(clean, /R[\/\s]?R:\s*([^\n]+)/i)
              || tryExtract(noStars, /R[\/\s]?R:\s*([^\n]+)/i);

  return {
    ativo:   ativo.trim(),
    tipo,
    entrada: entrada.trim(),
    sl:      sl.trim(),
    tp:      tp.trim(),
    rr:      rr.trim(),
  };
}

export function extractScore(texto: string): number {
  const clean   = cleanText(texto);
  const noStars = texto.replace(/\*\*/g, '');

  for (const src of [clean, noStars, texto]) {
    const m = src.match(/SCORE:\s*(\d{1,3})/i);
    if (m) return Math.min(100, Math.max(0, parseInt(m[1], 10)));
  }

  // CONFLUÊNCIA: XX/100
  for (const src of [clean, noStars]) {
    const m = src.match(/CONFLU[EÊ]NCIA:\s*(\d{1,3})\s*\/\s*100/i);
    if (m) return Math.min(100, Math.max(0, parseInt(m[1], 10)));
  }
  return 0;
}

export function extractResumo(texto: string): ResumoAnalise {
  const clean = cleanText(texto);

  // Padrão: "Vale entrar agora? SIM/NÃO"
  for (const src of [clean, texto]) {
    const m = src.match(
      /Vale entrar agora\?\s*(SIM|N[ÃA]O)\s*\n?([\s\S]{0,400}?)(?=\n\n|\n📊|\n---|\n##|$)/i
    );
    if (m) {
      const vale = m[1].toUpperCase() === 'SIM';
      const just = cleanValue(m[2]?.trim() || '');
      return { vale, justificativa: just };
    }
  }

  // Fallback: SIM/NÃO após RESUMO
  const simMatch = clean.match(/RESUMO[\s\S]{0,300}?\b(SIM|N[ÃA]O)\b/i);
  if (simMatch) {
    const vale = simMatch[1].toUpperCase() === 'SIM';
    const after = clean.slice(clean.indexOf(simMatch[0]) + simMatch[0].length);
    const just  = after.split('\n').filter(l => l.trim() && !/^[-─—]{3}/.test(l)).slice(0, 2).join(' ').trim();
    return { vale, justificativa: just };
  }

  return { vale: false, justificativa: '' };
}

export function isEntradaForte(texto: string): boolean {
  const clean = cleanText(texto);
  return (
    clean.includes('ENTRADA FORTE') ||
    texto.includes('👉 ENTRADA FORTE') ||
    texto.includes('ENTRADA FORTE') ||
    extractScore(texto) >= 90
  );
}

export function extractSecao(texto: string, emoji: string, proximoEmoji?: string): string {
  const emojiRegex = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let pattern: RegExp;
  if (proximoEmoji) {
    const nextRegex = proximoEmoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = new RegExp(`${emojiRegex}[\\s\\S]*?(?=${nextRegex}|$)`, 'i');
  } else {
    pattern = new RegExp(`${emojiRegex}[\\s\\S]*`, 'i');
  }
  const match = texto.match(pattern);
  return match ? match[0].trim() : '';
}

// ─── Formatação de preço numérico ────────────────────────────────────────────
// Regras de casas decimais mínimas por range de preço:
//   >= 1000  → índices/ouro    → mín. 2 decimais  (4807 → 4807.00)
//   10–999   → forex JPY/pares → mín. 3 decimais  (160.2 → 160.200, 158.85 → 158.850)
//   < 10     → forex major     → mín. 5 decimais  (1.082 → 1.08200)
function formatarPrecoJson(valor: number | string | null | undefined): string {
  if (valor == null || valor === '') return '';
  const n = typeof valor === 'number' ? valor : parseFloat(String(valor));
  if (isNaN(n)) return String(valor);

  // Número mínimo de casas decimais esperado pelo range
  let minDecimals: number;
  if (n >= 1000)      minDecimals = 2;   // XAUUSD, US30, índices
  else if (n >= 10)   minDecimals = 3;   // USDJPY, GBPJPY e outros pares JPY
  else                minDecimals = 5;   // EURUSD, GBPUSD, etc.

  // Quantas casas decimais o valor já tem
  const s = String(valor);
  const dotIdx = s.indexOf('.');
  const currentDecimals = dotIdx >= 0 ? s.length - dotIdx - 1 : 0;

  if (currentDecimals >= minDecimals) return s; // já está OK
  return n.toFixed(minDecimals);                // completa com zeros
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Análise Completa H4+H1 (JSON) ───────────────────────────────────────────

export function parseAnaliseCompleta(
  texto: string,
  ativo: string,
): Pick<Analise, 'tipo' | 'ordem' | 'score' | 'resumo' | 'isEntradaForte' | 'bias_h4' | 'alinhamento_tf'> {
  let json: any = null;
  try {
    json = JSON.parse(texto);
  } catch {
    const match = texto.match(/\{[\s\S]+\}/);
    if (match) {
      try { json = JSON.parse(match[0]); } catch {}
    }
  }

  // Fallback: tentar extração de texto se JSON falhar
  if (!json) {
    return {
      tipo: extractTipo(texto),
      ordem: extractOrdem(texto),
      score: extractScore(texto),
      resumo: extractResumo(texto),
      isEntradaForte: isEntradaForte(texto),
      bias_h4: 'NEUTRO',
      alinhamento_tf: true,
    };
  }

  const tipo: TipoOperacao =
    json.direcao === 'COMPRA' ? 'COMPRA'
    : json.direcao === 'VENDA' ? 'VENDA'
    : 'SEM_OPERACAO';

  const o = json.ordem ?? {};
  const tp1 = formatarPrecoJson(o.tp1);
  const ordem: OrdemPronta = {
    ativo,
    tipo,
    entrada: formatarPrecoJson(o.entrada),
    sl:      formatarPrecoJson(o.sl),
    tp:      tp1,   // TP principal = TP1
    rr:      o.rr_tp1 ?? '',
    tp1,
    tp2:    formatarPrecoJson(o.tp2),
    tp3:    formatarPrecoJson(o.tp3),
    rr_tp1: o.rr_tp1 ?? '',
    rr_tp2: o.rr_tp2 ?? '',
    rr_tp3: o.rr_tp3 ?? '',
  };

  const score = Math.min(100, Math.max(0, parseInt(String(json.score ?? 0), 10)));
  const resumo: ResumoAnalise = {
    vale:          json.vale_entrar === true,
    justificativa: String(json.resumo ?? json.motivo_nao_entrar ?? ''),
  };

  return {
    tipo,
    ordem,
    score,
    resumo,
    isEntradaForte: score >= 90,
    bias_h4:        json.bias_h4 === 'ALTA' ? 'ALTA' : json.bias_h4 === 'BAIXA' ? 'BAIXA' : 'NEUTRO',
    alinhamento_tf: json.alinhamento_tf !== false,
  };
}

export function parseAnaliseInstitucional(
  texto: string,
  ativo: string,
): Pick<Analise,
  | 'tipo' | 'ordem' | 'score' | 'resumo' | 'isEntradaForte'
  | 'bias_h4' | 'bias_d1' | 'alinhamento_tf'
  | 'alinhamento_d1_h4' | 'alinhamento_h4_h1' | 'alinhamento_total'
  | 'win_probability' | 'score_breakdown'
> {
  let json: any = null;
  try {
    json = JSON.parse(texto);
  } catch {
    const match = texto.match(/\{[\s\S]+\}/);
    if (match) { try { json = JSON.parse(match[0]); } catch {} }
  }

  if (!json) {
    return {
      tipo: extractTipo(texto),
      ordem: extractOrdem(texto),
      score: extractScore(texto),
      resumo: extractResumo(texto),
      isEntradaForte: isEntradaForte(texto),
      bias_h4: 'NEUTRO', bias_d1: 'NEUTRO',
      alinhamento_tf: true, alinhamento_d1_h4: true,
      alinhamento_h4_h1: true, alinhamento_total: true,
      win_probability: 50,
      score_breakdown: { alinhamento_timeframes: 0, qualidade_zona: 0, confluencia_tecnica: 0, contexto_macro: 0 },
    };
  }

  const tipo: TipoOperacao =
    json.direcao === 'COMPRA' ? 'COMPRA'
    : json.direcao === 'VENDA' ? 'VENDA'
    : 'SEM_OPERACAO';

  const o = json.ordem ?? {};
  const e1 = formatarPrecoJson(o.entrada1);
  const e2 = formatarPrecoJson(o.entrada2);
  // entrada = média ponderada das duas entradas (fallback para entrada simples)
  const entradaMedia = (e1 && e2)
    ? String(((parseFloat(e1) + parseFloat(e2)) / 2).toFixed(e1.includes('.') ? e1.split('.')[1].length : 2))
    : (e1 || formatarPrecoJson(o.entrada));
  const tp1 = formatarPrecoJson(o.tp1);

  const ordem: OrdemPronta = {
    ativo,
    tipo,
    entrada:     entradaMedia,
    sl:          formatarPrecoJson(o.sl),
    tp:          tp1,
    rr:          o.rr_tp1 ?? '',
    tp1,
    tp2:         formatarPrecoJson(o.tp2),
    tp3:         formatarPrecoJson(o.tp3),
    rr_tp1:      o.rr_tp1 ?? '',
    rr_tp2:      o.rr_tp2 ?? '',
    rr_tp3:      o.rr_tp3 ?? '',
    entrada1:    e1,
    entrada1_pct: Number(o.entrada1_pct ?? 50),
    entrada2:    e2,
    entrada2_pct: Number(o.entrada2_pct ?? 50),
  };

  const score = Math.min(100, Math.max(0, parseInt(String(json.score ?? 0), 10)));
  const resumo: ResumoAnalise = {
    vale:          json.vale_entrar === true,
    justificativa: String(json.resumo ?? json.motivo_nao_entrar ?? ''),
  };

  const sb = json.score_breakdown ?? {};
  const alinhamentoTotal = json.alinhamento_total !== false
    && json.alinhamento_d1_h4 !== false
    && json.alinhamento_h4_h1 !== false;

  return {
    tipo,
    ordem,
    score,
    resumo,
    isEntradaForte: score >= 90,
    bias_h4:             json.bias_h4 === 'ALTA' ? 'ALTA' : json.bias_h4 === 'BAIXA' ? 'BAIXA' : 'NEUTRO',
    bias_d1:             json.bias_d1 === 'ALTA' ? 'ALTA' : json.bias_d1 === 'BAIXA' ? 'BAIXA' : 'NEUTRO',
    alinhamento_tf:      alinhamentoTotal,
    alinhamento_d1_h4:   json.alinhamento_d1_h4 !== false,
    alinhamento_h4_h1:   json.alinhamento_h4_h1 !== false,
    alinhamento_total:   alinhamentoTotal,
    win_probability:     Math.min(100, Math.max(0, parseInt(String(json.win_probability ?? 50), 10))),
    score_breakdown: {
      alinhamento_timeframes: Math.min(25, Math.max(0, Number(sb.alinhamento_timeframes ?? 0))),
      qualidade_zona:         Math.min(25, Math.max(0, Number(sb.qualidade_zona ?? 0))),
      confluencia_tecnica:    Math.min(25, Math.max(0, Number(sb.confluencia_tecnica ?? 0))),
      contexto_macro:         Math.min(25, Math.max(0, Number(sb.contexto_macro ?? 0))),
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractFieldRaw(texto: string, pattern: RegExp): string | null {
  const match = texto.match(pattern);
  return match ? match[1] : null;
}

export function formatarDataHora(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
