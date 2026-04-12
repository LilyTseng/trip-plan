import { Injectable } from '@angular/core';

export interface FlightLookupResult {
  airline: string;
  flightNo: string;
  departAirport: string;
  arriveAirport: string;
  departTerminal?: string;
  arriveTerminal?: string;
  departure: string;  // "YYYY-MM-DDTHH:mm"
  arrival: string;
}

@Injectable({ providedIn: 'root' })
export class FlightLookupService {
  // AeroDataBox via RapidAPI (free tier: 150 req/month)
  private apiHost = 'aerodatabox.p.rapidapi.com';
  private apiKey = '';  // User sets this in settings

  get hasApiKey(): boolean { return !!this.apiKey; }

  constructor() {
    this.apiKey = localStorage.getItem('flight_api_key') ?? '';
  }

  setApiKey(key: string): void {
    this.apiKey = key.trim();
    localStorage.setItem('flight_api_key', this.apiKey);
  }

  /**
   * Lookup flight by number and date.
   * @param flightNo e.g. "NH852"
   * @param date e.g. "2025-01-23"
   */
  async lookup(flightNo: string, date: string): Promise<FlightLookupResult | null> {
    if (!this.apiKey) return null;
    const no = flightNo.trim().toUpperCase();
    if (!no || !date) return null;

    try {
      const url = `https://${this.apiHost}/flights/number/${encodeURIComponent(no)}/${date}`;
      const resp = await fetch(url, {
        headers: {
          'x-rapidapi-host': this.apiHost,
          'x-rapidapi-key': this.apiKey,
        },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const flight = Array.isArray(data) ? data[0] : data;
      if (!flight) return null;

      const dep = flight.departure ?? {};
      const arr = flight.arrival ?? {};

      return {
        airline: flight.airline?.name ?? '',
        flightNo: no,
        departAirport: dep.airport?.iata ?? '',
        arriveAirport: arr.airport?.iata ?? '',
        departTerminal: dep.terminal ?? undefined,
        arriveTerminal: arr.terminal ?? undefined,
        departure: this.toLocalDateTime(dep.scheduledTime?.local ?? dep.scheduledTimeLocal ?? ''),
        arrival: this.toLocalDateTime(arr.scheduledTime?.local ?? arr.scheduledTimeLocal ?? ''),
      };
    } catch {
      return null;
    }
  }

  /** Convert "2025-01-23 08:30+09:00" or "2025-01-23T08:30" to "YYYY-MM-DDTHH:mm" */
  private toLocalDateTime(s: string): string {
    if (!s) return '';
    // Remove timezone offset, keep date and time
    const match = s.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    return match ? `${match[1]}T${match[2]}` : '';
  }
}
