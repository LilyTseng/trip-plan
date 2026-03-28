import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Trip } from '../../models/types';
import { TripService } from '../../services/trip.service';

type Stage = 'list' | 'add' | 'edit';

@Component({
  selector: 'app-trip-manager',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './trip-manager.component.html',
})
export class TripManagerComponent {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() tripSwitched = new EventEmitter<void>();

  trip = inject(TripService);

  stage: Stage = 'list';
  formName = '';
  formStart = '';
  formEnd = '';
  editTripId = '';

  get canSubmit(): boolean {
    return !!this.formName.trim() && !!this.formStart && !!this.formEnd && this.formStart <= this.formEnd;
  }

  close(): void {
    this.stage = 'list';
    this.resetForm();
    this.closed.emit();
  }

  switchAndClose(id: string): void {
    this.trip.switchTrip(id);
    this.tripSwitched.emit();
    this.close();
  }

  deleteTrip(id: string): void {
    this.trip.deleteTrip(id);
  }

  editTrip(t: Trip): void {
    this.editTripId = t.id;
    this.formName = t.name;
    this.formStart = t.startDate;
    this.formEnd = t.endDate;
    this.stage = 'edit';
  }

  submitAdd(): void {
    if (!this.canSubmit) return;
    this.trip.addTrip(this.formName.trim(), this.formStart, this.formEnd);
    this.stage = 'list';
    this.resetForm();
  }

  submitEdit(): void {
    if (!this.canSubmit) return;
    this.trip.updateTrip(this.editTripId, this.formName.trim(), this.formStart, this.formEnd);
    this.stage = 'list';
    this.resetForm();
  }

  formatRange(t: Trip): string {
    const fmt = (d: string) => {
      const [, m, day] = d.split('-');
      return `${Number(m)}/${Number(day)}`;
    };
    return `${fmt(t.startDate)} – ${fmt(t.endDate)}`;
  }

  private resetForm(): void {
    this.formName = '';
    this.formStart = '';
    this.formEnd = '';
    this.editTripId = '';
  }
}
