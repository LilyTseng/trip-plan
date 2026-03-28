import { Component, EventEmitter, Output, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ItinEvent } from '../../models/types';
import { TripService } from '../../services/trip.service';

@Component({
  selector: 'app-itinerary',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './itinerary.component.html',
})
export class ItineraryComponent {
  @Output() editEvent = new EventEmitter<{ dateKey: string; event: ItinEvent }>();

  trip = inject(TripService);

  get dates() { return this.trip.dates; }
  get activeDate() { return this.trip.activeDate; }
  get activeEvents() { return this.trip.getEvents(this.trip.activeDate); }

  selectDate(d: string): void { this.trip.selectDate(d); }
  deleteEvent(id: string): void { this.trip.deleteItinEvent(this.trip.activeDate, id); }
}
