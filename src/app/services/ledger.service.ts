import { Injectable } from '@angular/core';
import { ExpenseItem } from '../models/types';

@Injectable({ providedIn: 'root' })
export class LedgerService {
  private uid(): string {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  rate = 0.21;
  rateEdit = false;
  jpyInput = '';
  expenses: ExpenseItem[] = [];
  readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', 'C'];

  get twd(): number {
    const jpy = Number.parseFloat(this.jpyInput || '0');
    return Number.isFinite(jpy) ? Math.round(jpy * this.rate) : 0;
  }

  onRateInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    const num = Number.parseFloat(v);
    if (Number.isFinite(num) && num > 0) this.rate = num;
  }

  pressKey(key: string): void {
    if (key === 'C') { this.jpyInput = ''; return; }
    if (key === '.' && this.jpyInput.includes('.')) return;
    this.jpyInput += key;
  }

  saveExpense(): void {
    const cleaned = this.jpyInput.trim();
    if (!cleaned) return;
    this.expenses = [
      { id: this.uid(), jpy: cleaned, twd: this.twd, time: new Date().toLocaleString() },
      ...this.expenses,
    ];
    this.jpyInput = '';
  }

  deleteExpense(id: string): void {
    this.expenses = this.expenses.filter(x => x.id !== id);
  }
}
