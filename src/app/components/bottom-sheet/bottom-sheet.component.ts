import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChecklistItem, EventType, ItinEvent, SheetContext, SheetKind, SheetMode, SheetStage } from '../../models/types';
import { TripService } from '../../services/trip.service';

@Component({
  selector: 'app-bottom-sheet',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './bottom-sheet.component.html',
})
export class BottomSheetComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() sheetContext: SheetContext = 'itinerary';
  @Input() editItinContext: { dateKey: string; event: ItinEvent } | null = null;
  @Input() editListContext: { kind: 'packing' | 'gift'; item: ChecklistItem } | null = null;
  @Output() closed = new EventEmitter<void>();

  trip = inject(TripService);

  sheetStage: SheetStage = 'menu';
  sheetMode: SheetMode = 'add';
  sheetKind: SheetKind = 'itin-spot';

  formTime = '';
  formTitle = '';
  formUrl = '';
  formLabel = '';
  formPos = 1;
  formMoveDate = ''; // 移動到其他天

  ngOnChanges(): void {
    if (!this.isOpen) return;

    if (this.editItinContext) {
      const ev = this.editItinContext.event;
      this.sheetStage = 'form';
      this.sheetMode = 'edit';
      this.sheetKind = ev.type === 'FOOD' ? 'itin-food' : ev.type === 'PLAN' ? 'itin-plan' : 'itin-spot';
      this.formTime = ev.time;
      this.formTitle = ev.title;
      this.formUrl = ev.url ?? '';
      this.formMoveDate = this.editItinContext.dateKey;
      this.formLabel = '';
    } else if (this.editListContext) {
      this.sheetStage = 'form';
      this.sheetMode = 'edit';
      this.sheetKind = this.editListContext.kind;
      this.formLabel = this.editListContext.item.label;
      this.formTime = '';
      this.formTitle = '';
      this.formUrl = '';
    } else {
      this.sheetStage = 'menu';
      this.sheetMode = 'add';
      this.sheetKind = this.sheetContext === 'packing' ? 'packing'
                     : this.sheetContext === 'gift' ? 'gift'
                     : 'itin-spot';
      this.resetForm();
    }
  }

  get positionOptions(): number[] {
    if (this.sheetKind === 'packing' && this.sheetMode === 'add') {
      return Array.from({ length: this.trip.packing.length + 1 }, (_, i) => i + 1);
    }
    if (this.sheetKind === 'gift' && this.sheetMode === 'add') {
      return Array.from({ length: this.trip.gifts.length + 1 }, (_, i) => i + 1);
    }
    return [1];
  }

  goAdd(kind: SheetKind): void {
    this.sheetKind = kind;
    this.sheetStage = 'form';
    this.sheetMode = 'add';
    this.resetForm();
    if (kind === 'packing') this.formPos = this.trip.packing.length + 1;
    if (kind === 'gift') this.formPos = this.trip.gifts.length + 1;
  }

  backToMenu(): void {
    this.sheetStage = 'menu';
    this.resetForm();
  }

  close(): void {
    this.resetForm();
    this.closed.emit();
  }

  submit(): void {
    if (this.sheetKind.startsWith('itin')) {
      const time = this.formTime.trim();
      const title = this.formTitle.trim();
      if (!time || !title) return;

      const type: EventType =
        this.sheetKind === 'itin-food' ? 'FOOD' :
        this.sheetKind === 'itin-plan' ? 'PLAN' : 'SPOT';
      const url = this.formUrl.trim() || undefined;
      const dateKey = this.editItinContext?.dateKey ?? this.trip.activeDate;

      if (this.sheetMode === 'add') {
        this.trip.addItinEvent(dateKey, time, title, type, url);
      } else if (this.editItinContext) {
        const origDateKey = this.editItinContext.dateKey;
        const targetDateKey = this.formMoveDate || origDateKey;
        if (targetDateKey !== origDateKey) {
          // 移動到其他天
          this.trip.moveItinEvent(origDateKey, targetDateKey, this.editItinContext.event.id, time, title, type, url);
        } else {
          this.trip.updateItinEvent(dateKey, this.editItinContext.event.id, time, title, type, url);
        }
      }
      this.close();
      return;
    }

    if (this.sheetKind === 'packing' || this.sheetKind === 'gift') {
      const label = this.formLabel.trim();
      if (!label) return;

      if (this.sheetMode === 'add') {
        this.trip.addChecklistItem(this.sheetKind, label, this.formPos);
      } else if (this.editListContext) {
        this.trip.updateChecklistItem(this.sheetKind, this.editListContext.item.id, label);
      }
      this.close();
    }
  }

  private resetForm(): void {
    this.formTime = '';
    this.formTitle = '';
    this.formUrl = '';
    this.formLabel = '';
    this.formPos = 1;
    this.formMoveDate = '';
  }
}
