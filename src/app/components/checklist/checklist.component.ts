import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ChecklistItem } from '../../models/types';
import { TripService } from '../../services/trip.service';

@Component({
  selector: 'app-checklist',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './checklist.component.html',
})
export class ChecklistComponent {
  @Input() kind: 'packing' | 'gift' = 'packing';
  @Output() editItem = new EventEmitter<{ kind: 'packing' | 'gift'; item: ChecklistItem }>();

  trip = inject(TripService);

  get items(): ChecklistItem[] {
    return this.kind === 'packing' ? this.trip.packing : this.trip.gifts;
  }

  deleteItem(id: string): void {
    this.trip.deleteChecklistItem(this.kind, id);
  }
}
