import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { LedgerService } from '../../services/ledger.service';

@Component({
  selector: 'app-ledger',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './ledger.component.html',
})
export class LedgerComponent {
  ledger = inject(LedgerService);
}
