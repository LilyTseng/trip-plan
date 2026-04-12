export type Tab = 'itinerary' | 'checklist' | 'ledger' | 'split' | 'more';
export type SheetContext = 'itinerary' | 'packing' | 'gift';
export type EventType = 'SPOT' | 'FOOD' | 'PLAN';
export type SheetStage = 'menu' | 'form';
export type SheetMode = 'add' | 'edit';
export type SheetKind = 'itin-spot' | 'itin-food' | 'itin-plan' | 'packing' | 'gift';
export type ActionMode = 'none' | 'edit' | 'delete';

export interface ItinEvent {
  id: string;
  time: string;
  title: string;
  type: EventType;
  url?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface ExpenseItem {
  id: string;
  jpy: string;
  twd: number;
  time: string;
}

export interface Member {
  id: string;
  name: string;
}

export interface SplitExpense {
  id: string;
  description: string;
  amountOriginal: number; // 原始幣別金額
  currency: string;       // 'TWD' | 'JPY' | 'USD' ...
  exchangeRate: number;   // 記帳當下：1 單位原始幣 = ? TWD
  amountTwd: number;      // = round(amountOriginal * exchangeRate)
  paidBy: string;         // Member.id
  splitWith: string[];    // Member.id[]
  date: string;
}

export interface Settlement {
  from: string;  // Member.id (debtor)
  to: string;    // Member.id (creditor)
  amount: number;
}

export interface FlightInfo {
  id: string;
  direction: 'outbound' | 'return';
  airline: string;
  flightNo: string;
  departure: string;   // "YYYY-MM-DD HH:mm"
  arrival: string;     // "YYYY-MM-DD HH:mm"
  departAirport: string;
  arriveAirport: string;
  note?: string;
}

export interface HotelInfo {
  id: string;
  name: string;
  checkIn: string;   // "YYYY-MM-DD"
  checkOut: string;   // "YYYY-MM-DD"
  address?: string;
  note?: string;
  url?: string;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  itin: Record<string, ItinEvent[]>;
  packing: ChecklistItem[];
  gifts: ChecklistItem[];
  members: Member[];
  splitExpenses: SplitExpense[];
  settledPairKeys: string[]; // "${from}::${to}" 代表該筆已結清
  flights: FlightInfo[];
  hotels: HotelInfo[];
}
