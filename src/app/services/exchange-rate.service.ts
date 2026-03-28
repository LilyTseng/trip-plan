import { Injectable } from '@angular/core';

export const CURRENCIES = ['TWD', 'JPY', 'USD', 'EUR', 'KRW', 'SGD', 'HKD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  TWD: 'NT$', JPY: '¥', USD: '$', EUR: '€', KRW: '₩', SGD: 'S$', HKD: 'HK$',
};

/** 預設匯率（base = TWD）：值 = 外幣單位 per 1 TWD */
const DEFAULT_RATES: Record<Currency, number> = {
  TWD: 1,
  JPY: 4.76,   // 1 TWD ≈ 4.76 JPY  → 1 JPY ≈ 0.21 TWD
  USD: 0.031,  // 1 TWD ≈ 0.031 USD → 1 USD ≈ 32 TWD
  EUR: 0.029,  // 1 TWD ≈ 0.029 EUR → 1 EUR ≈ 34 TWD
  KRW: 41.5,   // 1 TWD ≈ 41.5 KRW  → 1 KRW ≈ 0.024 TWD
  SGD: 0.042,  // 1 TWD ≈ 0.042 SGD → 1 SGD ≈ 24 TWD
  HKD: 0.241,  // 1 TWD ≈ 0.241 HKD → 1 HKD ≈ 4.15 TWD
};

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  readonly currencies: Currency[] = [...CURRENCIES];
  readonly symbols = CURRENCY_SYMBOLS;

  /** rates[X] = X 單位 per 1 TWD（API base=TWD 回傳值） */
  private rates: Record<Currency, number> = { ...DEFAULT_RATES };
  private lastFetched: number | null = null;
  private readonly CACHE_MS = 10 * 60 * 1000; // 10 分鐘快取

  isLoading = false;
  fetchError = false;
  usingDefaults = true; // 尚未成功拉取前都算「預設」

  async fetchRates(): Promise<void> {
    if (this.lastFetched && Date.now() - this.lastFetched < this.CACHE_MS) return;
    this.isLoading = true;
    this.fetchError = false;
    try {
      const symbols = this.currencies.filter(c => c !== 'TWD').join(',');
      const res = await fetch(
        `https://api.frankfurter.app/latest?base=TWD&symbols=${symbols}`,
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data: { rates: Record<string, number> } = await res.json();
      this.rates = { ...DEFAULT_RATES, ...(data.rates as Partial<Record<Currency, number>>) };
      this.lastFetched = Date.now();
      this.usingDefaults = false;
      this.fetchError = false;
    } catch {
      // 拉取失敗：沿用預設匯率，設定 10 分鐘冷卻避免頻繁重試
      this.fetchError = true;
      this.usingDefaults = true;
      this.lastFetched = Date.now();
    } finally {
      this.isLoading = false;
    }
  }

  /** 將 amount（原始幣）轉成 TWD */
  toTwd(amount: number, currency: Currency): number {
    if (currency === 'TWD') return Math.round(amount);
    const rate = this.rates[currency];
    return Math.round(amount / rate);
  }

  /** 1 單位 currency = ? TWD（顯示用） */
  getRate(currency: Currency): number {
    if (currency === 'TWD') return 1;
    const rate = this.rates[currency];
    return Math.round((1 / rate) * 10000) / 10000;
  }

  symbolOf(currency: string): string {
    return this.symbols[currency as Currency] ?? currency;
  }
}
