import axios from 'axios';

export interface Candle {
  time: number;   // timestamp em ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Mapeamento de símbolos ──────────────────────────────────────────────────

// Binance aceita XAUUSDT, BTCUSDT, ETHUSDT, etc.
// Twelve Data aceita XAUUSD, EURUSD, USDJPY, etc.

function isCrypto(symbol: string): boolean {
  const cryptos = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOGE', 'LTC'];
  return cryptos.some(c => symbol.toUpperCase().startsWith(c));
}

function isGold(symbol: string): boolean {
  return symbol.toUpperCase().includes('XAU');
}

// ─── Binance (Crypto) ────────────────────────────────────────────────────────

const BINANCE_INTERVALS: Record<string, string> = {
  M5: '5m', M15: '15m', H1: '1h', H4: '4h', D1: '1d',
};

async function buscarCandlesBinance(symbol: string, timeframe: string, limit = 100): Promise<Candle[]> {
  const par = symbol.toUpperCase().replace('/', '') + 'T'; // BTC → BTCUSDT
  const interval = BINANCE_INTERVALS[timeframe] ?? '1h';

  const { data } = await axios.get('https://api.binance.com/api/v3/klines', {
    params: { symbol: par, interval, limit },
    timeout: 10000,
  });

  return (data as any[]).map(k => ({
    time:   Number(k[0]),
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// ─── Twelve Data (Forex / Ouro / Índices) ────────────────────────────────────

const TWELVE_INTERVALS: Record<string, string> = {
  M5: '5min', M15: '15min', H1: '1h', H4: '4h', D1: '1day',
};

function toTwelveSymbol(symbol: string): string {
  const s = symbol.toUpperCase().replace('/', '');
  // Twelve Data exige formato BASE/QUOTE (ex: XAU/USD, EUR/USD)
  if (s.length === 6) return `${s.slice(0, 3)}/${s.slice(3)}`;
  return s;
}

async function buscarCandlesTwelve(
  symbol: string,
  timeframe: string,
  apiKey: string,
  limit = 100,
): Promise<Candle[]> {
  const interval = TWELVE_INTERVALS[timeframe] ?? '1h';

  let data: any;
  try {
    const resp = await axios.get('https://api.twelvedata.com/time_series', {
      params: {
        symbol:     toTwelveSymbol(symbol),
        interval,
        outputsize: limit,
        apikey:     apiKey,
        format:     'JSON',
        order:      'ASC',
      },
      timeout: 10000,
    });
    data = resp.data;
  } catch (err: any) {
    const msg = err?.response?.data?.message ?? err?.response?.data?.code ?? err.message;
    throw new Error(`Twelve Data: ${msg}`);
  }

  if (data.status === 'error') throw new Error(`Twelve Data: ${data.message}`);

  return (data.values as any[]).map(v => ({
    time:   new Date(v.datetime).getTime(),
    open:   parseFloat(v.open),
    high:   parseFloat(v.high),
    low:    parseFloat(v.low),
    close:  parseFloat(v.close),
    volume: parseFloat(v.volume ?? '0'),
  }));
}

// ─── Função principal ────────────────────────────────────────────────────────

export async function buscarCandles(
  symbol: string,
  timeframe: string,
  twelveDataApiKey: string,
  limit = 100,
): Promise<Candle[]> {
  if (isCrypto(symbol)) {
    return buscarCandlesBinance(symbol, timeframe, limit);
  }
  // Forex, Ouro, Índices → Twelve Data
  return buscarCandlesTwelve(symbol, timeframe, twelveDataApiKey, limit);
}
