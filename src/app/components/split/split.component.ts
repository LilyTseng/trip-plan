import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Settlement, SplitExpense } from '../../models/types';
import { TripService } from '../../services/trip.service';
import { Currency, ExchangeRateService } from '../../services/exchange-rate.service';

type SplitView = 'expenses' | 'settlement';

@Component({
  selector: 'app-split',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './split.component.html',
})
export class SplitComponent {
  trip = inject(TripService);
  fx = inject(ExchangeRateService);

  activeView: SplitView = 'expenses';
  newMemberName = '';

  expenseModalOpen = false;
  editingExpenseId: string | null = null; // null = 新增，有值 = 編輯

  formDesc = '';
  formAmount = '';
  formCurrency: Currency = 'TWD';
  formRate = 0; // 1 單位外幣 = ? TWD，可手動調整
  formPaidBy = '';
  formDate = '';
  formSplitWith: Record<string, boolean> = {};

  get members() { return this.trip.members; }
  get expenses() { return this.trip.splitExpenses; }
  get settlements(): Settlement[] { return this.trip.calculateSettlements(); }
  get isEditing(): boolean { return this.editingExpenseId !== null; }

  get totalExpenseTwd(): number {
    return this.expenses.reduce((sum, e) => sum + e.amountTwd, 0);
  }

  get perPersonAvg(): number {
    const n = this.members.length;
    return n > 0 ? Math.round(this.totalExpenseTwd / n) : 0;
  }

  /** 即時 TWD 預覽（使用 formRate，支援手動調整） */
  get twdPreview(): number {
    if (this.formCurrency === 'TWD') {
      const amount = Number.parseFloat(this.formAmount);
      return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
    }
    const amount = Number.parseFloat(this.formAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !this.formRate) return 0;
    return Math.round(amount * this.formRate);
  }

  /** 幣別切換時同步更新 formRate */
  onCurrencyChange(): void {
    this.formRate = this.fx.getRate(this.formCurrency);
  }

  /* ── Member management ── */
  addMember(): void {
    if (!this.newMemberName.trim()) return;
    this.trip.addMember(this.newMemberName);
    this.newMemberName = '';
  }

  deleteMember(id: string): void {
    this.trip.deleteMember(id);
    delete this.formSplitWith[id];
  }

  /* ── Expense modal ── */
  async openAddExpense(): Promise<void> {
    this.editingExpenseId = null;
    this.formDesc = '';
    this.formAmount = '';
    this.formCurrency = 'TWD';
    this.formRate = 1;
    this.formPaidBy = this.members[0]?.id ?? '';
    this.formDate = new Date().toISOString().slice(0, 10);
    this.formSplitWith = {};
    for (const m of this.members) this.formSplitWith[m.id] = true;
    this.expenseModalOpen = true;
    await this.fx.fetchRates();
    // fetch 完成後用最新匯率更新（不覆蓋使用者已手動修改的值）
    this.formRate = this.fx.getRate(this.formCurrency);
  }

  async openEditExpense(expense: SplitExpense): Promise<void> {
    this.editingExpenseId = expense.id;
    this.formDesc = expense.description;
    this.formAmount = expense.amountOriginal.toString();
    this.formCurrency = expense.currency as Currency;
    this.formRate = expense.exchangeRate; // 沿用記帳當時的匯率，使用者可再調整
    this.formPaidBy = expense.paidBy;
    this.formDate = expense.date;
    this.formSplitWith = {};
    for (const m of this.members) {
      this.formSplitWith[m.id] = expense.splitWith.includes(m.id);
    }
    this.expenseModalOpen = true;
    await this.fx.fetchRates();
  }

  closeExpenseModal(): void {
    this.expenseModalOpen = false;
    this.editingExpenseId = null;
  }

  get canSubmitExpense(): boolean {
    const amount = Number.parseFloat(this.formAmount);
    const amountOk = this.formCurrency === 'TWD'
      ? (Number.isFinite(amount) && amount > 0)
      : (this.twdPreview > 0 && this.formRate > 0);
    return (
      !!this.formDesc.trim() &&
      amountOk &&
      !!this.formPaidBy &&
      Object.values(this.formSplitWith).some(v => v)
    );
  }

  submitExpense(): void {
    if (!this.canSubmitExpense) return;
    const amountOriginal = Math.round(Number.parseFloat(this.formAmount));
    const exchangeRate = this.formCurrency === 'TWD' ? 1 : this.formRate;
    const amountTwd = this.formCurrency === 'TWD' ? amountOriginal : this.twdPreview;
    const splitWith = Object.entries(this.formSplitWith)
      .filter(([, checked]) => checked)
      .map(([id]) => id);

    if (this.editingExpenseId) {
      this.trip.updateSplitExpense(
        this.editingExpenseId,
        this.formDesc, amountOriginal, this.formCurrency,
        exchangeRate, amountTwd, this.formPaidBy, splitWith, this.formDate,
      );
    } else {
      this.trip.addSplitExpense(
        this.formDesc, amountOriginal, this.formCurrency,
        exchangeRate, amountTwd, this.formPaidBy, splitWith, this.formDate,
      );
    }
    this.closeExpenseModal();
  }

  deleteExpense(id: string): void {
    this.trip.deleteSplitExpense(id);
  }

  isSettled(from: string, to: string): boolean {
    return this.trip.isSettled(from, to);
  }

  toggleSettled(from: string, to: string): void {
    this.trip.toggleSettled(from, to);
  }

  /* ── Display helpers ── */
  getMemberName(id: string): string { return this.trip.getMemberName(id); }

  getSplitWithNames(expense: SplitExpense): string {
    return expense.splitWith.map(id => this.getMemberName(id)).join('、');
  }

  getPerPersonShare(expense: SplitExpense): number {
    const n = expense.splitWith.length;
    return n > 0 ? Math.round(expense.amountTwd / n) : 0;
  }

  formatAmount(expense: SplitExpense): string {
    const sym = this.fx.symbolOf(expense.currency);
    if (expense.currency === 'TWD') return `NT$${expense.amountTwd.toLocaleString()}`;
    return `${sym}${expense.amountOriginal.toLocaleString()} ≈ NT$${expense.amountTwd.toLocaleString()}`;
  }
}
