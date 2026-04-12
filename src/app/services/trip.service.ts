import { Injectable, NgZone, inject } from '@angular/core';
import { loadFirebase, type FirebaseInstance } from '../firebase.config';
import { ChecklistItem, EventType, ExpenseItem, ItinEvent, Member, Settlement, SplitExpense, Trip } from '../models/types';
import { UndoService } from './undo.service';

const LOCAL_KEY  = 'trip_plan_v2'; // v2: ISO date keys + per-trip checklists
const FIRESTORE_DOC = 'main';

interface StoredState {
  trips: Trip[];
  activeTripId: string;
  activeDate: string;
  ledgerExpenses: ExpenseItem[];
  ledgerRate: number;
  updatedAt?: number;
}

interface RoomData {
  trips: Trip[];
  ledgerExpenses: ExpenseItem[];
  ledgerRate: number;
  updatedAt: number;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline';

@Injectable({ providedIn: 'root' })
export class TripService {
  private ngZone = inject(NgZone);
  private undoSvc = inject(UndoService);
  private uid(): string { return `${Date.now()}_${Math.random().toString(16).slice(2)}`; }
  private readonly chineseDays = ['日','一','二','三','四','五','六'];

  /* ── Shared state ── */
  trips: Trip[] = [];
  activeTripId = '';
  activeDate = '';
  ledgerExpenses: ExpenseItem[] = [];
  ledgerRate = 0.21;

  /* ── Cloud sync ── */
  syncStatus: SyncStatus = 'offline';
  private firebase: FirebaseInstance | null = null;
  private firestoreMod: typeof import('firebase/firestore') | null = null;
  private unsubFirestore: (() => void) | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private localUpdatedAt = 0;

  constructor() {
    const saved = this.loadLocal();
    if (saved) {
      this.trips           = saved.trips;
      this.activeTripId    = saved.activeTripId;
      this.activeDate      = saved.activeDate;
      this.ledgerExpenses  = saved.ledgerExpenses ?? [];
      this.ledgerRate      = saved.ledgerRate ?? 0.21;
      this.localUpdatedAt  = saved.updatedAt ?? 0;
    } else {
      // 嘗試從 v1 遷移
      const migrated = this.migrateV1();
      if (!migrated) this.initDefaults();
    }
    this.initFirebase();
  }

  /* ── V1 → V2 Migration ── */
  private migrateV1(): boolean {
    try {
      const raw = localStorage.getItem('trip_plan_v1');
      if (!raw) return false;
      const v1 = JSON.parse(raw) as any;
      if (!v1.trips?.length) return false;

      // Migrate each trip: convert itin keys to ISO, add per-trip packing/gifts
      for (const trip of v1.trips) {
        trip.itin = this.migrateItinKeys(trip);
        trip.packing = trip.packing ?? v1.packing ?? [];
        trip.gifts = trip.gifts ?? v1.gifts ?? [];
      }

      this.trips          = v1.trips;
      this.activeTripId   = v1.activeTripId;
      this.ledgerExpenses = v1.ledgerExpenses ?? [];
      this.ledgerRate     = v1.ledgerRate ?? 0.21;

      // Migrate activeDate
      this.activeDate = this.migrateActiveDateKey(v1.activeDate, this.activeTrip);
      this.localUpdatedAt = v1.updatedAt ?? 0;

      // Save as v2 and remove v1
      this.saveLocal();
      localStorage.removeItem('trip_plan_v1');
      return true;
    } catch { return false; }
  }

  private migrateItinKeys(trip: any): Record<string, ItinEvent[]> {
    const oldItin = trip.itin as Record<string, ItinEvent[]>;
    const newItin: Record<string, ItinEvent[]> = {};
    const start = trip.startDate as string;
    const end = trip.endDate as string;

    // Build mapping: old display key → ISO key
    const oldKeys = this.generateDisplayKeys(start, end);
    const isoKeys = this.generateDateKeys(start, end);

    for (let i = 0; i < oldKeys.length; i++) {
      const events = oldItin[oldKeys[i]] ?? oldItin[isoKeys[i]] ?? [];
      newItin[isoKeys[i]] = events;
    }

    // Preserve any keys that didn't match (safety net)
    for (const [key, events] of Object.entries(oldItin)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        if (!newItin[key]) newItin[key] = events;
      }
    }

    return newItin;
  }

  private migrateActiveDateKey(oldKey: string, trip: Trip): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(oldKey)) return oldKey; // Already ISO
    // Try to find matching ISO key
    const displayKeys = this.generateDisplayKeys(trip.startDate, trip.endDate);
    const isoKeys = this.generateDateKeys(trip.startDate, trip.endDate);
    const idx = displayKeys.indexOf(oldKey);
    return idx >= 0 ? isoKeys[idx] : isoKeys[0] ?? '';
  }

  /** Old-style display keys for migration only */
  private generateDisplayKeys(startDate: string, endDate: string): string[] {
    const keys: string[] = [];
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate  + 'T00:00:00');
    while (cur <= end) {
      keys.push(`${cur.getMonth()+1}/${cur.getDate()}（${this.chineseDays[cur.getDay()]}）`);
      cur.setDate(cur.getDate() + 1);
    }
    return keys;
  }

  /* ── Firebase ── */
  private async initFirebase(): Promise<void> {
    try {
      const [fb, mod] = await Promise.all([
        loadFirebase(),
        import('firebase/firestore'),
      ]);
      this.firebase = fb;
      this.firestoreMod = mod;
      this.connectFirestore();
    } catch {
      this.syncStatus = 'offline';
    }
  }

  private connectFirestore(): void {
    if (!this.firebase || !this.firestoreMod) return;
    const { doc, onSnapshot } = this.firestoreMod;
    const { db } = this.firebase;
    this.syncStatus = 'syncing';
    this.unsubFirestore = onSnapshot(
      doc(db, 'rooms', FIRESTORE_DOC),
      (snap) => {
        if (snap.metadata.hasPendingWrites) return;
        if (!snap.exists()) { this.pushToFirestore(); return; }
        this.ngZone.run(() => {
          this.applyRemoteData(snap.data() as RoomData);
          this.syncStatus = 'synced';
          this.saveLocal();
        });
      },
      () => { this.ngZone.run(() => { this.syncStatus = 'offline'; }); }
    );
  }

  private async pushToFirestore(): Promise<void> {
    if (!this.firebase || !this.firestoreMod) return;
    const { doc, setDoc } = this.firestoreMod;
    const { db } = this.firebase;
    this.syncStatus = 'syncing';
    try {
      await setDoc(doc(db, 'rooms', FIRESTORE_DOC), {
        trips: this.trips,
        ledgerExpenses: this.ledgerExpenses,
        ledgerRate: this.ledgerRate,
        updatedAt: Date.now(),
      });
      this.syncStatus = 'synced';
    } catch { this.syncStatus = 'offline'; }
  }

  private applyRemoteData(data: RoomData): void {
    if ((data.updatedAt ?? 0) < this.localUpdatedAt) return;
    this.trips           = data.trips           ?? this.trips;
    this.ledgerExpenses  = data.ledgerExpenses  ?? this.ledgerExpenses;
    this.ledgerRate      = data.ledgerRate      ?? this.ledgerRate;
    if (!this.trips.find(t => t.id === this.activeTripId)) {
      this.activeTripId = this.trips[0]?.id ?? '';
      this.activeDate   = this.dates[0] ?? '';
    }
  }

  /* ── Persistence ── */
  private save(): void {
    this.localUpdatedAt = Date.now();
    this.syncStatus = 'syncing';
    this.saveLocal();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.pushToFirestore(), 600);
  }

  private saveLocal(): void {
    const state: StoredState = {
      trips: this.trips, activeTripId: this.activeTripId,
      activeDate: this.activeDate,
      ledgerExpenses: this.ledgerExpenses, ledgerRate: this.ledgerRate,
      updatedAt: this.localUpdatedAt,
    };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  }

  private loadLocal(): StoredState | null {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) as StoredState : null;
    } catch { return null; }
  }

  /* ── Defaults ── */
  private initDefaults(): void {
    const defaultTrip: Trip = {
      id: this.uid(), name: '日本東京',
      startDate: '2025-01-23', endDate: '2025-01-27',
      itin: this.makeDefaultItin(),
      packing: [
        { id: this.uid(), label: '護照 / 在留卡',    done: false },
        { id: this.uid(), label: '充電器 / 行動電源', done: false },
        { id: this.uid(), label: '雨傘 / 雨衣',       done: false },
        { id: this.uid(), label: '保暖外套',           done: false },
      ],
      gifts: [
        { id: this.uid(), label: '薯條三兄弟',     done: false },
        { id: this.uid(), label: '藥妝（家人）',   done: false },
        { id: this.uid(), label: '朋友伴手禮',     done: false },
      ],
      members: [], splitExpenses: [], settledPairKeys: [],
    };
    this.trips        = [defaultTrip];
    this.activeTripId = defaultTrip.id;
    this.activeDate   = this.dates[0];
  }

  /** ISO date keys: "2025-01-23" */
  generateDateKeys(startDate: string, endDate: string): string[] {
    const keys: string[] = [];
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate  + 'T00:00:00');
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      keys.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }
    return keys;
  }

  /** 將 ISO key 格式化為顯示用 "1/23（五）" */
  formatDateKey(isoKey: string): string {
    const d = new Date(isoKey + 'T00:00:00');
    return `${d.getMonth()+1}/${d.getDate()}（${this.chineseDays[d.getDay()]}）`;
  }

  private makeDefaultItin(): Record<string, ItinEvent[]> {
    return {
      '2025-01-23': [
        { id: this.uid(), time: '22:30', title: '✈️ 落地', type: 'PLAN' },
        { id: this.uid(), time: '晚餐', title: '🍢 Yakitori TORIICHIZU Akihabara', type: 'FOOD', url: 'https://maps.app.goo.gl/bT9PwiA7bSJKdTTo6' },
      ],
      '2025-01-24': [
        { id: this.uid(), time: '09:00', title: '⛩ 淺草雷門',  type: 'SPOT' },
        { id: this.uid(), time: '11:30', title: '🍚 豬排丼屋 瑞兆', type: 'FOOD' },
        { id: this.uid(), time: '19:00', title: '🍶 SAKE MARKET Akihabara', type: 'FOOD' },
      ],
      '2025-01-25': [{ id: this.uid(), time: '全天', title: '🎆 河口湖一日遊＋冬花火', type: 'PLAN' }],
      '2025-01-26': [{ id: this.uid(), time: '夜晚', title: '🌃 銀座 / 東京鐵塔', type: 'SPOT' }],
      '2025-01-27': [{ id: this.uid(), time: '全天', title: '🎢 東京迪士尼樂園', type: 'SPOT' }],
    };
  }

  /* ── Getters ── */
  get activeTrip(): Trip { return this.trips.find(t => t.id === this.activeTripId) ?? this.trips[0]; }
  get itin(): Record<string, ItinEvent[]> { return this.activeTrip.itin; }
  get packing(): ChecklistItem[] { return this.activeTrip.packing; }
  set packing(v: ChecklistItem[]) { this.activeTrip.packing = v; }
  get gifts(): ChecklistItem[] { return this.activeTrip.gifts; }
  set gifts(v: ChecklistItem[]) { this.activeTrip.gifts = v; }
  get dates(): string[] {
    return Object.keys(this.activeTrip.itin).sort();
  }

  /* ── Trip CRUD ── */
  switchTrip(id: string): void {
    this.activeTripId = id;
    this.activeDate   = this.dates[0] ?? '';
    this.save();
  }

  addTrip(name: string, startDate: string, endDate: string): Trip {
    const itin: Record<string, ItinEvent[]> = {};
    this.generateDateKeys(startDate, endDate).forEach(k => { itin[k] = []; });
    const trip: Trip = {
      id: this.uid(), name, startDate, endDate, itin,
      packing: [], gifts: [],
      members: [], splitExpenses: [], settledPairKeys: [],
    };
    this.trips = [...this.trips, trip];
    this.save();
    return trip;
  }

  updateTrip(id: string, name: string, startDate: string, endDate: string): void {
    const trip = this.trips.find(t => t.id === id);
    if (!trip) return;
    trip.name = name;
    if (trip.startDate !== startDate || trip.endDate !== endDate) {
      const newKeys = this.generateDateKeys(startDate, endDate);
      const newItin: Record<string, ItinEvent[]> = {};
      for (const key of newKeys) { newItin[key] = trip.itin[key] ?? []; }
      trip.itin = newItin;
      trip.startDate = startDate;
      trip.endDate   = endDate;
      if (this.activeTripId === id) this.activeDate = newKeys[0] ?? '';
    }
    this.save();
  }

  deleteTrip(id: string): void {
    if (this.trips.length <= 1) return;
    const idx = this.trips.findIndex(t => t.id === id);
    if (idx < 0) return;
    const deleted = this.trips[idx];
    const prevActiveId = this.activeTripId;
    const prevActiveDate = this.activeDate;
    this.trips = this.trips.filter(t => t.id !== id);
    if (this.activeTripId === id) {
      this.activeTripId = this.trips[0].id;
      this.activeDate   = this.dates[0] ?? '';
    }
    this.save();
    this.undoSvc.show(`已刪除「${deleted.name}」`, () => {
      this.trips = [...this.trips.slice(0, idx), deleted, ...this.trips.slice(idx)];
      this.activeTripId = prevActiveId;
      this.activeDate = prevActiveDate;
      this.save();
    });
  }

  /* ── Date navigation ── */
  selectDate(d: string): void { this.activeDate = d; this.saveLocal(); }

  /* ── Itinerary CRUD ── */
  getEvents(dateKey: string): ItinEvent[] { return this.itin[dateKey] ?? []; }

  addItinEvent(dateKey: string, time: string, title: string, type: EventType, url?: string): void {
    const cur = [...(this.itin[dateKey] ?? [])];
    cur.push({ id: this.uid(), time, title, type, url: url || undefined });
    this.itin[dateKey] = this.sortByTime(cur);
    this.save();
  }

  reorderItinEvents(dateKey: string, orderedIds: string[]): void {
    const events = this.itin[dateKey] ?? [];
    const map = new Map(events.map(e => [e.id, e]));
    this.itin[dateKey] = orderedIds.map(id => map.get(id)!).filter(Boolean);
    this.save();
  }

  moveItinEvent(fromDate: string, toDate: string, id: string, time: string, title: string, type: EventType, url?: string): void {
    this.itin[fromDate] = (this.itin[fromDate] ?? []).filter(x => x.id !== id);
    const target = [...(this.itin[toDate] ?? [])];
    target.push({ id, time, title, type, url: url || undefined });
    this.itin[toDate] = this.sortByTime(target);
    this.save();
  }

  updateItinEvent(dateKey: string, id: string, time: string, title: string, type: EventType, url?: string): void {
    const cur = [...(this.itin[dateKey] ?? [])];
    const idx = cur.findIndex(x => x.id === id);
    if (idx >= 0) cur[idx] = { ...cur[idx], time, title, type, url: url || undefined };
    this.itin[dateKey] = cur;
    this.save();
  }

  deleteItinEvent(dateKey: string, id: string): void {
    const events = this.itin[dateKey] ?? [];
    const idx = events.findIndex(x => x.id === id);
    if (idx < 0) return;
    const deleted = events[idx];
    this.itin[dateKey] = events.filter(x => x.id !== id);
    this.save();
    this.undoSvc.show(`已刪除「${deleted.title}」`, () => {
      const cur = [...(this.itin[dateKey] ?? [])];
      cur.splice(idx, 0, deleted);
      this.itin[dateKey] = cur;
      this.save();
    });
  }

  /* ── Checklist CRUD (per-trip) ── */
  addChecklistItem(kind: 'packing' | 'gift', label: string, pos: number): void {
    const arr = kind === 'packing' ? [...this.packing] : [...this.gifts];
    arr.splice(Math.max(0, Math.min(pos - 1, arr.length)), 0, { id: this.uid(), label, done: false });
    if (kind === 'packing') this.packing = arr; else this.gifts = arr;
    this.save();
  }

  updateChecklistItem(kind: 'packing' | 'gift', id: string, label: string): void {
    const up = (arr: ChecklistItem[]) => arr.map(x => x.id === id ? { ...x, label } : x);
    if (kind === 'packing') this.packing = up(this.packing); else this.gifts = up(this.gifts);
    this.save();
  }

  deleteChecklistItem(kind: 'packing' | 'gift', id: string): void {
    const arr = kind === 'packing' ? this.packing : this.gifts;
    const idx = arr.findIndex(x => x.id === id);
    if (idx < 0) return;
    const deleted = arr[idx];
    if (kind === 'packing') this.packing = this.packing.filter(x => x.id !== id);
    else this.gifts = this.gifts.filter(x => x.id !== id);
    this.save();
    this.undoSvc.show(`已刪除「${deleted.label}」`, () => {
      const cur = kind === 'packing' ? [...this.packing] : [...this.gifts];
      cur.splice(idx, 0, deleted);
      if (kind === 'packing') this.packing = cur; else this.gifts = cur;
      this.save();
    });
  }

  toggleChecklistDone(kind: 'packing' | 'gift', id: string): void {
    const toggle = (arr: ChecklistItem[]) => arr.map(x => x.id === id ? { ...x, done: !x.done } : x);
    if (kind === 'packing') this.packing = toggle(this.packing); else this.gifts = toggle(this.gifts);
    this.save();
  }

  /* ── Member CRUD ── */
  get members(): Member[] { return this.activeTrip.members; }

  addMember(name: string): void {
    const trimmed = name.trim();
    if (!trimmed || this.members.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) return;
    this.activeTrip.members = [...this.members, { id: this.uid(), name: trimmed }];
    this.save();
  }

  deleteMember(id: string): void {
    this.activeTrip.members = this.members.filter(m => m.id !== id);
    this.save();
  }

  getMemberName(id: string): string {
    return this.members.find(m => m.id === id)?.name ?? '(已移除)';
  }

  /* ── SplitExpense CRUD ── */
  get splitExpenses(): SplitExpense[] { return this.activeTrip.splitExpenses; }

  addSplitExpense(description: string, amountOriginal: number, currency: string, exchangeRate: number, amountTwd: number, paidBy: string, splitWith: string[], date: string): void {
    if (!description.trim() || amountTwd <= 0 || !paidBy || splitWith.length === 0) return;
    this.activeTrip.splitExpenses = [
      { id: this.uid(), description: description.trim(), amountOriginal, currency, exchangeRate, amountTwd, paidBy, splitWith, date },
      ...this.splitExpenses,
    ];
    this.save();
  }

  updateSplitExpense(id: string, description: string, amountOriginal: number, currency: string, exchangeRate: number, amountTwd: number, paidBy: string, splitWith: string[], date: string): void {
    this.activeTrip.splitExpenses = this.splitExpenses.map(e =>
      e.id === id ? { ...e, description: description.trim(), amountOriginal, currency, exchangeRate, amountTwd, paidBy, splitWith, date } : e
    );
    this.save();
  }

  deleteSplitExpense(id: string): void {
    const idx = this.splitExpenses.findIndex(x => x.id === id);
    if (idx < 0) return;
    const deleted = this.splitExpenses[idx];
    this.activeTrip.splitExpenses = this.splitExpenses.filter(x => x.id !== id);
    this.save();
    this.undoSvc.show(`已刪除「${deleted.description}」`, () => {
      const cur = [...this.activeTrip.splitExpenses];
      cur.splice(idx, 0, deleted);
      this.activeTrip.splitExpenses = cur;
      this.save();
    });
  }

  /* ── Settlement ── */
  isSettled(from: string, to: string): boolean {
    return this.activeTrip.settledPairKeys.includes(`${from}::${to}`);
  }

  toggleSettled(from: string, to: string): void {
    const key  = `${from}::${to}`;
    const keys = this.activeTrip.settledPairKeys;
    this.activeTrip.settledPairKeys = keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key];
    this.save();
  }

  calculateSettlements(): Settlement[] {
    const members = this.members;
    if (members.length < 2) return [];
    const balance: Record<string, number> = {};
    for (const m of members) balance[m.id] = 0;
    for (const exp of this.splitExpenses) {
      const n = exp.splitWith.length;
      if (n === 0) continue;
      const share = exp.amountTwd / n;
      if (balance[exp.paidBy] !== undefined) balance[exp.paidBy] += exp.amountTwd;
      for (const pid of exp.splitWith) { if (balance[pid] !== undefined) balance[pid] -= share; }
    }
    const creditors = members.filter(m => balance[m.id] >  0.005).map(m => ({ id: m.id, amount:  balance[m.id] })).sort((a,b) => b.amount - a.amount);
    const debtors   = members.filter(m => balance[m.id] < -0.005).map(m => ({ id: m.id, amount: -balance[m.id] })).sort((a,b) => b.amount - a.amount);
    const result: Settlement[] = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const c = creditors[ci], d = debtors[di];
      const t = Math.min(c.amount, d.amount);
      result.push({ from: d.id, to: c.id, amount: Math.round(t) });
      c.amount -= t; d.amount -= t;
      if (c.amount < 0.005) ci++;
      if (d.amount < 0.005) di++;
    }
    return result;
  }

  /* ── Ledger CRUD ── */
  addLedgerExpense(jpy: string, twd: number): void {
    this.ledgerExpenses = [
      { id: this.uid(), jpy, twd, time: new Date().toLocaleString() },
      ...this.ledgerExpenses,
    ];
    this.save();
  }

  deleteLedgerExpense(id: string): void {
    const idx = this.ledgerExpenses.findIndex(x => x.id === id);
    if (idx < 0) return;
    const deleted = this.ledgerExpenses[idx];
    this.ledgerExpenses = this.ledgerExpenses.filter(x => x.id !== id);
    this.save();
    this.undoSvc.show('已刪除記帳紀錄', () => {
      const cur = [...this.ledgerExpenses];
      cur.splice(idx, 0, deleted);
      this.ledgerExpenses = cur;
      this.save();
    });
  }

  updateLedgerRate(rate: number): void {
    this.ledgerRate = rate;
    this.save();
  }

  /* ── Time sorting ── */
  private sortByTime(list: ItinEvent[]): ItinEvent[] {
    return [...list].map((e,idx) => ({ e, idx, score: this.timeScore(e.time) }))
      .sort((a,b) => a.score - b.score || a.idx - b.idx).map(x => x.e);
  }
  private timeScore(raw: string): number {
    const s = (raw||'').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return Number(m[1])*60 + Number(m[2]);
    const map: Record<string,number> = { '早餐':480,'早上':540,'上午':600,'中午':720,'午餐':730,'下午':900,'傍晚':1050,'晚餐':1110,'晚上':1200,'夜晚':1260,'深夜':1380,'全天':1440 };
    return map[s] ?? 1410;
  }
}
