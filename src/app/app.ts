import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { ChecklistItem, ItinEvent, SheetContext, Tab } from './models/types';
import { TripService } from './services/trip.service';
import { UndoService } from './services/undo.service';
import { ItineraryComponent } from './components/itinerary/itinerary.component';
import { ChecklistComponent } from './components/checklist/checklist.component';
import { LedgerComponent } from './components/ledger/ledger.component';
import { BottomSheetComponent } from './components/bottom-sheet/bottom-sheet.component';
import { TripManagerComponent } from './components/trip-manager/trip-manager.component';
import { SplitComponent } from './components/split/split.component';
import { TravelInfoComponent } from './components/travel-info/travel-info.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, ItineraryComponent, ChecklistComponent, LedgerComponent, BottomSheetComponent, TripManagerComponent, SplitComponent, TravelInfoComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent {
  tripSvc = inject(TripService);
  undoSvc = inject(UndoService);

  activeTab: Tab = 'itinerary';
  checklistKind: 'packing' | 'gift' = 'packing';
  sheetOpen = false;
  tripManagerOpen = false;
  editItinContext: { dateKey: string; event: ItinEvent } | null = null;
  editListContext: { kind: 'packing' | 'gift'; item: ChecklistItem } | null = null;
  darkMode = false;
  shareLink = '';
  shareCopied = false;

  constructor() {
    const saved = localStorage.getItem('trip_plan_theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      this.darkMode = true;
    }
    this.applyTheme();
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    localStorage.setItem('trip_plan_theme', this.darkMode ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
  }

  generateShareLink(): void {
    this.shareLink = this.tripSvc.getShareLink();
    this.shareCopied = false;
  }

  async copyShareLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.shareLink);
      this.shareCopied = true;
      setTimeout(() => { this.shareCopied = false; }, 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = this.shareLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      this.shareCopied = true;
      setTimeout(() => { this.shareCopied = false; }, 2000);
    }
  }

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

}
