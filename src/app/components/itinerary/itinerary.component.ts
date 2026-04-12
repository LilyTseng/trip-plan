import { Component, EventEmitter, Output, inject, ElementRef, NgZone, OnDestroy } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ItinEvent } from '../../models/types';
import { TripService } from '../../services/trip.service';

@Component({
  selector: 'app-itinerary',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './itinerary.component.html',
})
export class ItineraryComponent implements OnDestroy {
  @Output() editEvent = new EventEmitter<{ dateKey: string; event: ItinEvent }>();

  trip = inject(TripService);
  private elRef = inject(ElementRef);
  private ngZone = inject(NgZone);

  /* ── Drag state ── */
  dragging = false;
  dragId: string | null = null;
  dragOverIdx = -1;
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private ghost: HTMLElement | null = null;
  private startY = 0;
  private cardEls: HTMLElement[] = [];
  private orderedIds: string[] = [];

  // Bound handlers for cleanup
  private boundTouchMove = (e: TouchEvent) => this.onTouchMove(e);
  private boundTouchEnd = (e: TouchEvent) => this.onTouchEnd(e);
  private boundMouseMove = (e: MouseEvent) => this.onMouseMove(e);
  private boundMouseUp = () => this.onMouseUp();

  get dates() { return this.trip.dates; }
  get activeDate() { return this.trip.activeDate; }
  get activeEvents() { return this.trip.getEvents(this.trip.activeDate); }

  selectDate(d: string): void { this.trip.selectDate(d); }
  deleteEvent(id: string): void { this.trip.deleteItinEvent(this.trip.activeDate, id); }

  /* ── Long-press start ── */
  onPointerDown(ev: TouchEvent | MouseEvent, event: ItinEvent, cardEl: HTMLElement): void {
    // Ignore if tapping a button/link inside the card
    const target = ev.target as HTMLElement;
    if (target.closest('button, a')) return;

    const y = ev instanceof TouchEvent ? ev.touches[0].clientY : ev.clientY;
    this.startY = y;

    this.pressTimer = setTimeout(() => {
      this.ngZone.run(() => this.startDrag(event, cardEl, y));
    }, 400);
  }

  onPointerCancel(): void {
    this.clearPressTimer();
  }

  /* ── Drag logic ── */
  private startDrag(event: ItinEvent, cardEl: HTMLElement, y: number): void {
    this.dragging = true;
    this.dragId = event.id;
    this.orderedIds = this.activeEvents.map(e => e.id);

    // Haptic feedback on supported devices
    if (navigator.vibrate) navigator.vibrate(30);

    // Collect card elements
    const container = this.elRef.nativeElement.querySelector('.event-list') as HTMLElement;
    this.cardEls = Array.from(container.querySelectorAll('[data-event-id]'));

    // Create ghost
    const rect = cardEl.getBoundingClientRect();
    this.ghost = cardEl.cloneNode(true) as HTMLElement;
    this.ghost.style.cssText = `
      position:fixed; left:${rect.left}px; top:${rect.top}px;
      width:${rect.width}px; z-index:9999; pointer-events:none;
      opacity:0.9; transform:scale(1.03); box-shadow:0 12px 40px rgba(0,0,0,0.18);
      transition:transform 0.15s, box-shadow 0.15s;
    `;
    document.body.appendChild(this.ghost);
    this.startY = y;

    // Listen for move/end globally
    document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    document.addEventListener('touchend', this.boundTouchEnd);
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    this.moveGhost(e.touches[0].clientY);
  }

  private onMouseMove(e: MouseEvent): void {
    this.moveGhost(e.clientY);
  }

  private moveGhost(clientY: number): void {
    if (!this.ghost || !this.dragging) return;
    const dy = clientY - this.startY;
    this.ghost.style.top = `${parseFloat(this.ghost.style.top) + dy}px`;
    this.startY = clientY;

    // Determine which card we're hovering over
    const newIdx = this.cardEls.findIndex(el => {
      if (el.dataset['eventId'] === this.dragId) return false;
      const rect = el.getBoundingClientRect();
      return clientY > rect.top && clientY < rect.bottom;
    });
    if (newIdx !== -1) {
      this.ngZone.run(() => { this.dragOverIdx = newIdx; });
    }

    // Auto-scroll near edges
    const scrollContainer = this.elRef.nativeElement.closest('.app-main') as HTMLElement;
    if (scrollContainer) {
      const edge = 60;
      const scrollRect = scrollContainer.getBoundingClientRect();
      if (clientY < scrollRect.top + edge) {
        scrollContainer.scrollTop -= 8;
      } else if (clientY > scrollRect.bottom - edge) {
        scrollContainer.scrollTop += 8;
      }
    }
  }

  private onTouchEnd(_e: TouchEvent): void { this.endDrag(); }
  private onMouseUp(): void { this.endDrag(); }

  private endDrag(): void {
    this.clearPressTimer();
    document.removeEventListener('touchmove', this.boundTouchMove);
    document.removeEventListener('touchend', this.boundTouchEnd);
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);

    if (this.ghost) {
      this.ghost.remove();
      this.ghost = null;
    }

    if (this.dragging && this.dragId && this.dragOverIdx >= 0) {
      const fromIdx = this.orderedIds.indexOf(this.dragId);
      if (fromIdx >= 0 && fromIdx !== this.dragOverIdx) {
        const ids = [...this.orderedIds];
        const [moved] = ids.splice(fromIdx, 1);
        ids.splice(this.dragOverIdx, 0, moved);
        this.trip.reorderItinEvents(this.trip.activeDate, ids);
      }
    }

    this.dragging = false;
    this.dragId = null;
    this.dragOverIdx = -1;
    this.cardEls = [];
    this.orderedIds = [];
  }

  private clearPressTimer(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.endDrag();
  }
}
