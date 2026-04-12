import { Injectable, inject } from '@angular/core';
import { ExpenseItem } from '../models/types';
import { TripService } from './trip.service';

@Injectable({ providedIn: 'root' })
export class LedgerService {
  private trip = inject(TripService);

  rateEdit = false;
  jpyInput = '';
  readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', 'C'];

  get rate(): number { return this.trip.ledgerRate; }
  set rate(v: number) { this.trip.updateLedgerRate(v); }

  get expenses(): ExpenseItem[] { return this.trip.ledgerExpenses; }

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
    this.trip.addLedgerExpense(cleaned, this.twd);
    this.jpyInput = '';
  }

  deleteExpense(id: string): void {
    this.trip.deleteLedgerExpense(id);
  }
}
