import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Tab = 'home' | 'itinerary' | 'ledger' | 'packing' | 'gifts';
type EventType = 'SPOT' | 'FOOD' | 'PLAN';

type ItinEvent = {
  id: string;
  time: string;
  title: string;
  type: EventType;
  url?: string;
};

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

type ExpenseItem = {
  id: string;
  jpy: string;
  twd: number;
  time: string;
};

type SheetStage = 'menu' | 'form';
type SheetMode = 'add' | 'edit';
type SheetKind = 'itin-spot' | 'itin-food' | 'itin-plan' | 'packing' | 'gift' | 'expense';

type ActionMode = 'none' | 'edit' | 'delete';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent {
  /* ================= Tabs ================= */
  activeTab: Tab = 'home';
  setTab(tab: Tab): void {
    this.activeTab = tab;
    // 換頁就退出編輯/刪除模式，避免誤觸
    this.actionMode = 'none';
  }

  /* ================= Bottom action mode ================= */
  actionMode: ActionMode = 'none';

  toggleEditMode(): void {
    this.actionMode = this.actionMode === 'edit' ? 'none' : 'edit';
  }

  toggleDeleteMode(): void {
    this.actionMode = this.actionMode === 'delete' ? 'none' : 'delete';
  }

  /* ================= Utils ================= */
  private uid(): string {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  /* ================= Ledger ================= */
  rate = 0.21;
  rateEdit = false;

  onRateInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    const num = Number.parseFloat(v);
    if (Number.isFinite(num) && num > 0) this.rate = num;
  }

  jpyInput = '';
  keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', 'C'];

  get twd(): number {
    const jpy = Number.parseFloat(this.jpyInput || '0');
    return Number.isFinite(jpy) ? Math.round(jpy * this.rate) : 0;
  }

  pressKey(key: string): void {
    if (key === 'C') {
      this.jpyInput = '';
      return;
    }
    if (key === '.' && this.jpyInput.includes('.')) return;
    this.jpyInput += key;
  }

  expenses: ExpenseItem[] = [];

  saveExpense(): void {
    const cleaned = this.jpyInput.trim();
    if (!cleaned) return;

    const item: ExpenseItem = {
      id: this.uid(),
      jpy: cleaned,
      twd: this.twd,
      time: new Date().toLocaleString(),
    };

    this.expenses = [item, ...this.expenses];
    this.jpyInput = '';
  }

  deleteExpense(id: string): void {
    this.expenses = this.expenses.filter(x => x.id !== id);
  }

  /* ================= Packing / Gifts ================= */
  packing: ChecklistItem[] = [
    { id: this.uid(), label: '護照 / 在留卡', done: false },
    { id: this.uid(), label: '充電器 / 行動電源', done: false },
    { id: this.uid(), label: '雨傘 / 雨衣', done: false },
    { id: this.uid(), label: '保暖外套', done: false },
  ];

  gifts: ChecklistItem[] = [
    { id: this.uid(), label: '薯條三兄弟', done: false },
    { id: this.uid(), label: '藥妝（家人）', done: false },
    { id: this.uid(), label: '朋友伴手禮', done: false },
  ];

  deleteChecklist(kind: 'packing' | 'gift', id: string): void {
    if (kind === 'packing') this.packing = this.packing.filter(x => x.id !== id);
    else this.gifts = this.gifts.filter(x => x.id !== id);
  }

  /* ================= Itinerary ================= */
  itin: Record<string, ItinEvent[]> = {
    '1/23（五）': [
      { id: this.uid(), time: '22:30', title: '✈️ 落地', type: 'PLAN' },
      {
        id: this.uid(),
        time: '晚餐',
        title: '🍢 Yakitori TORIICHIZU Akihabara',
        type: 'FOOD',
        url: 'https://maps.app.goo.gl/bT9PwiA7bSJKdTTo6',
      },
    ],
    '1/24（六）': [
      { id: this.uid(), time: '09:00', title: '⛩ 淺草雷門', type: 'SPOT' },
      { id: this.uid(), time: '11:30', title: '🍚 豬排丼屋 瑞兆', type: 'FOOD' },
      { id: this.uid(), time: '19:00', title: '🍶 SAKE MARKET Akihabara', type: 'FOOD' },
    ],
    '1/25（日）': [{ id: this.uid(), time: '全天', title: '🎆 河口湖一日遊＋冬花火', type: 'PLAN' }],
    '1/26（一）': [{ id: this.uid(), time: '夜晚', title: '🌃 銀座 / 東京鐵塔', type: 'SPOT' }],
    '1/27（二）': [{ id: this.uid(), time: '全天', title: '🎢 東京迪士尼樂園', type: 'SPOT' }],
  };

  dates = Object.keys(this.itin);
  activeDate = this.dates[0];

  selectDate(d: string): void {
    this.activeDate = d;
  }

  get activeEvents(): ItinEvent[] {
    return this.sortEventsByTime(this.itin[this.activeDate] ?? []);
  }

  deleteItinEvent(dateKey: string, id: string): void {
    const cur = this.itin[dateKey] ?? [];
    this.itin[dateKey] = cur.filter(x => x.id !== id);
  }

  /* ================= Bottom Sheet (Add / Edit) ================= */
  sheetOpen = false;
  sheetStage: SheetStage = 'menu';
  sheetMode: SheetMode = 'add';
  sheetKind: SheetKind = 'itin-spot';

  editItinDateKey: string | null = null;
  editId: string | null = null;

  formTime = '';
  formTitle = '';
  formUrl = '';
  formLabel = '';
  formJpy = '';
  formPos = 1;

  get showBottomBar(): boolean {
    // 只在 itinerary/packing/gifts 顯示底部三顆按鈕
    return this.activeTab === 'itinerary' || this.activeTab === 'packing' || this.activeTab === 'gifts';
  }

  openAddSheet(): void {
    this.sheetOpen = true;
    this.sheetStage = 'menu';
    this.sheetMode = 'add';
    this.resetForm();
  }

  closeSheet(): void {
    this.sheetOpen = false;
    this.sheetStage = 'menu';
    this.sheetMode = 'add';
    this.sheetKind = 'itin-spot';
    this.editItinDateKey = null;
    this.editId = null;
    this.resetForm();
  }

  backToMenu(): void {
    this.sheetStage = 'menu';
    this.sheetMode = 'add';
    this.sheetKind = 'itin-spot';
    this.editItinDateKey = null;
    this.editId = null;
    this.resetForm();
  }

  goAdd(kind: SheetKind): void {
    this.sheetKind = kind;
    this.sheetStage = 'form';
    this.sheetMode = 'add';
    this.editItinDateKey = null;
    this.editId = null;
    this.resetForm();

    if (kind === 'packing') this.formPos = this.packing.length + 1;
    if (kind === 'gift') this.formPos = this.gifts.length + 1;
  }

  openEditItinerary(ev: ItinEvent): void {
    this.sheetOpen = true;
    this.sheetStage = 'form';
    this.sheetMode = 'edit';
    this.sheetKind =
      ev.type === 'FOOD' ? 'itin-food' :
      ev.type === 'PLAN' ? 'itin-plan' :
      'itin-spot';

    this.editItinDateKey = this.activeDate;
    this.editId = ev.id;

    this.formTime = ev.time;
    this.formTitle = ev.title;
    this.formUrl = ev.url ?? '';
  }

  openEditChecklist(kind: 'packing' | 'gift', item: ChecklistItem): void {
    this.sheetOpen = true;
    this.sheetStage = 'form';
    this.sheetMode = 'edit';
    this.sheetKind = kind === 'packing' ? 'packing' : 'gift';
    this.editId = item.id;

    this.formLabel = item.label;
  }

  // packing/gift 新增才有插入位置
  get positionOptions(): number[] {
    if (this.sheetKind === 'packing' && this.sheetMode === 'add') {
      return Array.from({ length: this.packing.length + 1 }, (_, i) => i + 1);
    }
    if (this.sheetKind === 'gift' && this.sheetMode === 'add') {
      return Array.from({ length: this.gifts.length + 1 }, (_, i) => i + 1);
    }
    return [1];
  }

  submitSheet(): void {
    // itinerary
    if (this.sheetKind.startsWith('itin')) {
      const time = this.formTime.trim();
      const title = this.formTitle.trim();
      const url = this.formUrl.trim();
      if (!time || !title) return;

      const type: EventType =
        this.sheetKind === 'itin-food' ? 'FOOD' :
        this.sheetKind === 'itin-plan' ? 'PLAN' :
        'SPOT';

      const dateKey = this.editItinDateKey ?? this.activeDate;
      const cur = [...(this.itin[dateKey] ?? [])];

      if (this.sheetMode === 'add') {
        cur.push({ id: this.uid(), time, title, type, url: url || undefined });
      } else {
        const id = this.editId;
        if (!id) return;
        const idx = cur.findIndex(x => x.id === id);
        if (idx < 0) return;
        cur[idx] = { ...cur[idx], time, title, type, url: url || undefined };
      }

      this.itin[dateKey] = cur;
      this.closeSheet();
      return;
    }

    // packing
    if (this.sheetKind === 'packing') {
      const label = this.formLabel.trim();
      if (!label) return;

      if (this.sheetMode === 'add') {
        const pos = Math.max(1, Math.min(this.formPos, this.packing.length + 1));
        const idx = pos - 1;
        const next = [...this.packing];
        next.splice(idx, 0, { id: this.uid(), label, done: false });
        this.packing = next;
      } else {
        const id = this.editId;
        if (!id) return;
        this.packing = this.packing.map(x => (x.id === id ? { ...x, label } : x));
      }

      this.closeSheet();
      return;
    }

    // gift
    if (this.sheetKind === 'gift') {
      const label = this.formLabel.trim();
      if (!label) return;

      if (this.sheetMode === 'add') {
        const pos = Math.max(1, Math.min(this.formPos, this.gifts.length + 1));
        const idx = pos - 1;
        const next = [...this.gifts];
        next.splice(idx, 0, { id: this.uid(), label, done: false });
        this.gifts = next;
      } else {
        const id = this.editId;
        if (!id) return;
        this.gifts = this.gifts.map(x => (x.id === id ? { ...x, label } : x));
      }

      this.closeSheet();
      return;
    }
  }

  private resetForm(): void {
    this.formTime = '';
    this.formTitle = '';
    this.formUrl = '';
    this.formLabel = '';
    this.formJpy = '';
    this.formPos = 1;
  }

  /* ================= Time sorting ================= */
  private sortEventsByTime(list: ItinEvent[]): ItinEvent[] {
    return [...list]
      .map((e, idx) => ({ e, idx, score: this.timeScore(e.time) }))
      .sort((a, b) => (a.score - b.score) || (a.idx - b.idx))
      .map(x => x.e);
  }

  private timeScore(raw: string): number {
    const s = (raw || '').trim();

    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);

    const map: Record<string, number> = {
      '早餐': 8 * 60,
      '早上': 9 * 60,
      '上午': 10 * 60,
      '中午': 12 * 60,
      '午餐': 12 * 60 + 10,
      '下午': 15 * 60,
      '傍晚': 17 * 60 + 30,
      '晚餐': 18 * 60 + 30,
      '晚上': 20 * 60,
      '夜晚': 21 * 60,
      '深夜': 23 * 60,
      '全天': 24 * 60,
    };

    if (map[s] !== undefined) return map[s];
    return 23 * 60 + 30;
  }
}
