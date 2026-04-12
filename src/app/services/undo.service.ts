import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UndoService {
  message = '';
  visible = false;
  private restoreFn: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, restoreFn: () => void): void {
    this.dismiss();
    this.message = message;
    this.restoreFn = restoreFn;
    this.visible = true;
    this.timer = setTimeout(() => this.dismiss(), 4000);
  }

  undo(): void {
    if (this.restoreFn) this.restoreFn();
    this.dismiss();
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.visible = false;
    this.restoreFn = null;
  }
}
