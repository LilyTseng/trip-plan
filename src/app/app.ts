import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChecklistItem, ItinEvent, SheetContext, Tab } from './models/types';
import { TripService } from './services/trip.service';
import { ItineraryComponent } from './components/itinerary/itinerary.component';
import { ChecklistComponent } from './components/checklist/checklist.component';
import { LedgerComponent } from './components/ledger/ledger.component';
import { BottomSheetComponent } from './components/bottom-sheet/bottom-sheet.component';
import { TripManagerComponent } from './components/trip-manager/trip-manager.component';
import { SplitComponent } from './components/split/split.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, FormsModule, ItineraryComponent, ChecklistComponent, LedgerComponent, BottomSheetComponent, TripManagerComponent, SplitComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent {
  tripSvc = inject(TripService);

  activeTab: Tab = 'itinerary';
  checklistKind: 'packing' | 'gift' = 'packing';
  sheetOpen = false;
  tripManagerOpen = false;
  editItinContext: { dateKey: string; event: ItinEvent } | null = null;
  editListContext: { kind: 'packing' | 'gift'; item: ChecklistItem } | null = null;

  private readonly cnToEn: [RegExp, string][] = [
    [/日本/g, 'Japan'], [/東京/g, 'Tokyo'], [/大阪/g, 'Osaka'],
    [/京都/g, 'Kyoto'], [/沖繩/g, 'Okinawa'], [/北海道/g, 'Hokkaido'],
    [/福岡/g, 'Fukuoka'], [/名古屋/g, 'Nagoya'], [/奈良/g, 'Nara'],
    [/韓國/g, 'Korea'], [/首爾/g, 'Seoul'], [/釜山/g, 'Busan'],
    [/泰國/g, 'Thailand'], [/曼谷/g, 'Bangkok'], [/清邁/g, 'Chiang Mai'],
    [/台灣/g, 'Taiwan'], [/台北/g, 'Taipei'], [/高雄/g, 'Kaohsiung'],
    [/香港/g, 'HongKong'], [/澳門/g, 'Macao'],
    [/新加坡/g, 'Singapore'], [/馬來西亞/g, 'Malaysia'], [/吉隆坡/g, 'KL'],
    [/越南/g, 'Vietnam'], [/河內/g, 'Hanoi'], [/胡志明/g, 'Saigon'],
    [/美國/g, 'USA'], [/紐約/g, 'New York'], [/洛杉磯/g, 'LA'],
    [/歐洲/g, 'Europe'], [/法國/g, 'France'], [/巴黎/g, 'Paris'],
    [/英國/g, 'UK'], [/倫敦/g, 'London'], [/義大利/g, 'Italy'],
    [/羅馬/g, 'Rome'], [/西班牙/g, 'Spain'], [/巴塞隆納/g, 'Barcelona'],
    [/澳洲/g, 'Australia'], [/雪梨/g, 'Sydney'], [/墨爾本/g, 'Melbourne'],
  ];

  get tripEnglishTitle(): string {
    const name = this.tripSvc.activeTrip.name;
    let result = name;
    for (const [pat, en] of this.cnToEn) {
      result = result.replace(pat, ' ' + en);
    }
    result = result.replace(/[\u4e00-\u9fff\u3040-\u30ff]/g, '').replace(/\s+/g, ' ').trim();
    return result || 'Travel';
  }

  get headerDateLabel(): string {
    const t = this.tripSvc.activeTrip;
    const fmt = (d: string) => {
      const [, m, day] = d.split('-');
      return `${Number(m)}/${Number(day)}`;
    };
    return `${fmt(t.startDate)} – ${fmt(t.endDate)}`;
  }

  get showFab(): boolean {
    return this.activeTab === 'itinerary' || this.activeTab === 'checklist';
  }

  get bottomSheetContext(): SheetContext {
    if (this.activeTab === 'itinerary') return 'itinerary';
    return this.checklistKind;
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
  }

  openFab(): void {
    this.editItinContext = null;
    this.editListContext = null;
    this.sheetOpen = true;
  }

  onEditItinEvent(ctx: { dateKey: string; event: ItinEvent }): void {
    this.editItinContext = ctx;
    this.editListContext = null;
    this.sheetOpen = true;
  }

  onEditChecklistItem(ctx: { kind: 'packing' | 'gift'; item: ChecklistItem }): void {
    this.editListContext = ctx;
    this.editItinContext = null;
    this.sheetOpen = true;
  }

  onSheetClosed(): void {
    this.sheetOpen = false;
    this.editItinContext = null;
    this.editListContext = null;
  }

  onTripSwitched(): void {
    this.activeTab = 'itinerary';
  }

  /* ── Cloud sync UI ── */
  joinCodeInput = '';
  joinState: 'idle' | 'loading' | 'error' | 'success' = 'idle';

  copyRoomCode(): void {
    navigator.clipboard.writeText(this.tripSvc.roomCode).catch(() => {});
  }

  async joinRoom(): Promise<void> {
    if (!this.joinCodeInput.trim()) return;
    this.joinState = 'loading';
    const ok = await this.tripSvc.joinRoom(this.joinCodeInput);
    this.joinState = ok ? 'success' : 'error';
    if (ok) { this.joinCodeInput = ''; this.activeTab = 'itinerary'; }
    setTimeout(() => { if (this.joinState !== 'loading') this.joinState = 'idle'; }, 3000);
  }

  async createNewRoom(): Promise<void> {
    await this.tripSvc.createNewRoom();
  }
}
