import { Component, Input, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlightInfo, HotelInfo } from '../../models/types';
import { TripService } from '../../services/trip.service';
import { FlightLookupService } from '../../services/flight-lookup.service';

type InfoView = 'flights' | 'hotels';

@Component({
  selector: 'app-travel-info',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './travel-info.component.html',
})
export class TravelInfoComponent {
  @Input() listVisible = true;

  trip = inject(TripService);
  flightLookup = inject(FlightLookupService);
  lookupLoading = false;
  lookupError = '';
  fLookupDate = '';

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
  fDepartTerminal = '';
  fArriveTerminal = '';
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
    this.fDepartTerminal = '';
    this.fArriveTerminal = '';
    this.fNote = '';
    this.fLookupDate = this.trip.activeTrip.startDate;
    this.lookupError = '';
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
    this.fDepartTerminal = f.departTerminal ?? '';
    this.fArriveTerminal = f.arriveTerminal ?? '';
    this.fNote = f.note ?? '';
    this.fLookupDate = f.departure ? f.departure.substring(0, 10) : this.trip.activeTrip.startDate;
    this.lookupError = '';
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
      departTerminal: this.fDepartTerminal.trim() || undefined,
      arriveTerminal: this.fArriveTerminal.trim() || undefined,
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

  /* ── Flight lookup ── */
  async lookupFlight(): Promise<void> {
    if (!this.fFlightNo.trim() || !this.fLookupDate) return;
    this.lookupLoading = true;
    this.lookupError = '';
    try {
      const result = await this.flightLookup.lookup(this.fFlightNo.trim(), this.fLookupDate);
      if (result) {
        this.fAirline = result.airline || this.fAirline;
        this.fFlightNo = result.flightNo || this.fFlightNo;
        this.fDepartAirport = result.departAirport || this.fDepartAirport;
        this.fArriveAirport = result.arriveAirport || this.fArriveAirport;
        this.fDepartTerminal = result.departTerminal ?? this.fDepartTerminal;
        this.fArriveTerminal = result.arriveTerminal ?? this.fArriveTerminal;
        this.fDeparture = result.departure || this.fDeparture;
        this.fArrival = result.arrival || this.fArrival;
      } else {
        this.lookupError = '查無此航班，請確認航班號與日期';
      }
    } catch {
      this.lookupError = '查詢失敗，請稍後再試';
    }
    this.lookupLoading = false;
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
