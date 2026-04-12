import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlightInfo, HotelInfo } from '../../models/types';
import { TripService } from '../../services/trip.service';

type InfoView = 'flights' | 'hotels';

@Component({
  selector: 'app-travel-info',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './travel-info.component.html',
})
export class TravelInfoComponent {
  trip = inject(TripService);

  activeView: InfoView = 'flights';
  modalOpen = false;
  modalType: 'flight' | 'hotel' = 'flight';
  editingId: string | null = null;

  // Flight form
  fDirection: 'outbound' | 'return' = 'outbound';
  fAirline = '';
  fFlightNo = '';
  fDeparture = '';
  fArrival = '';
  fDepartAirport = '';
  fArriveAirport = '';
  fNote = '';

  // Hotel form
  hName = '';
  hCheckIn = '';
  hCheckOut = '';
  hAddress = '';
  hNote = '';
  hUrl = '';

  get flights(): FlightInfo[] { return this.trip.flights; }
  get hotels(): HotelInfo[] { return this.trip.hotels; }

  get outboundFlights(): FlightInfo[] { return this.flights.filter(f => f.direction === 'outbound'); }
  get returnFlights(): FlightInfo[] { return this.flights.filter(f => f.direction === 'return'); }

  /* ── Flight modal ── */
  openAddFlight(): void {
    this.editingId = null;
    this.modalType = 'flight';
    this.fDirection = 'outbound';
    this.fAirline = '';
    this.fFlightNo = '';
    this.fDeparture = '';
    this.fArrival = '';
    this.fDepartAirport = '';
    this.fArriveAirport = '';
    this.fNote = '';
    this.modalOpen = true;
  }

  openEditFlight(f: FlightInfo): void {
    this.editingId = f.id;
    this.modalType = 'flight';
    this.fDirection = f.direction;
    this.fAirline = f.airline;
    this.fFlightNo = f.flightNo;
    this.fDeparture = f.departure;
    this.fArrival = f.arrival;
    this.fDepartAirport = f.departAirport;
    this.fArriveAirport = f.arriveAirport;
    this.fNote = f.note ?? '';
    this.modalOpen = true;
  }

  get canSubmitFlight(): boolean {
    return !!this.fFlightNo.trim() && !!this.fDepartAirport.trim() && !!this.fArriveAirport.trim();
  }

  submitFlight(): void {
    if (!this.canSubmitFlight) return;
    const data = {
      direction: this.fDirection,
      airline: this.fAirline.trim(),
      flightNo: this.fFlightNo.trim(),
      departure: this.fDeparture,
      arrival: this.fArrival,
      departAirport: this.fDepartAirport.trim(),
      arriveAirport: this.fArriveAirport.trim(),
      note: this.fNote.trim() || undefined,
    };
    if (this.editingId) {
      this.trip.updateFlight(this.editingId, data);
    } else {
      this.trip.addFlight(data as Omit<FlightInfo, 'id'>);
    }
    this.closeModal();
  }

  deleteFlight(id: string): void { this.trip.deleteFlight(id); }

  /* ── Hotel modal ── */
  openAddHotel(): void {
    this.editingId = null;
    this.modalType = 'hotel';
    this.hName = '';
    this.hCheckIn = this.trip.activeTrip.startDate;
    this.hCheckOut = this.trip.activeTrip.endDate;
    this.hAddress = '';
    this.hNote = '';
    this.hUrl = '';
    this.modalOpen = true;
  }

  openEditHotel(h: HotelInfo): void {
    this.editingId = h.id;
    this.modalType = 'hotel';
    this.hName = h.name;
    this.hCheckIn = h.checkIn;
    this.hCheckOut = h.checkOut;
    this.hAddress = h.address ?? '';
    this.hNote = h.note ?? '';
    this.hUrl = h.url ?? '';
    this.modalOpen = true;
  }

  get canSubmitHotel(): boolean {
    return !!this.hName.trim() && !!this.hCheckIn && !!this.hCheckOut;
  }

  submitHotel(): void {
    if (!this.canSubmitHotel) return;
    const data = {
      name: this.hName.trim(),
      checkIn: this.hCheckIn,
      checkOut: this.hCheckOut,
      address: this.hAddress.trim() || undefined,
      note: this.hNote.trim() || undefined,
      url: this.hUrl.trim() || undefined,
    };
    if (this.editingId) {
      this.trip.updateHotel(this.editingId, data);
    } else {
      this.trip.addHotel(data as Omit<HotelInfo, 'id'>);
    }
    this.closeModal();
  }

  deleteHotel(id: string): void { this.trip.deleteHotel(id); }

  closeModal(): void {
    this.modalOpen = false;
    this.editingId = null;
  }

  /* ── Helpers ── */
  formatDateTime(dt: string): string {
    if (!dt) return '';
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  nightCount(checkIn: string, checkOut: string): number {
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
  }
}
