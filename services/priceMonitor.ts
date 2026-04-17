import axios from 'axios';

function isCrypto(symbol: string): boolean {
  const cryptos = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOGE', 'LTC'];
  return cryptos.some(c => symbol.toUpperCase().startsWith(c));
}

function toTwelveSymbol(s: string): string {
  const clean = s.toUpperCase().replace('/', '');
  if (clean.length === 6) return `${clean.slice(0, 3)}/${clean.slice(3)}`;
  return clean;
}

export function getPollingInterval(symbol: string): number {
  return isCrypto(symbol) ? 15000 : 60000;
}

export async function buscarPrecoAtual(symbol: string, twelveDataApiKey: string): Promise<number> {
  if (isCrypto(symbol)) {
    const par = symbol.toUpperCase().replace('/', '') + 'T';
    const { data } = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      params: { symbol: par },
      timeout: 6000,
    });
    return parseFloat(data.price);
  }

  let data: any;
  try {
    const resp = await axios.get('https://api.twelvedata.com/price', {
      params: { symbol: toTwelveSymbol(symbol), apikey: twelveDataApiKey },
      timeout: 6000,
    });
    data = resp.data;
  } catch (err: any) {
    const msg = err?.response?.data?.message ?? err.message;
    throw new Error(`Twelve Data: ${msg}`);
  }

  if (data.status === 'error') throw new Error(`Twelve Data: ${data.message}`);
  return parseFloat(data.price);
}
