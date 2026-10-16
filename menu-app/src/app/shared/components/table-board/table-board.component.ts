import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicTableStatus } from '../../../models/api.models';

/** Customer-facing live board of table numbers: Free / Occupied / Reserved. No customer details. */
@Component({
  selector: 'app-table-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="tb" *ngIf="tables?.length">
      <div class="tb-head">
        <span class="tb-title">Tables right now</span>
        <span class="tb-summary">{{ count('Free') }} free · {{ count('Occupied') }} occupied<ng-container *ngIf="count('Reserved')"> · {{ count('Reserved') }} reserved</ng-container></span>
      </div>
      <div class="tb-grid">
        <div class="tb-table" *ngFor="let t of tables" [ngClass]="'tb-' + t.status.toLowerCase()"
             [attr.aria-label]="'Table ' + t.tableNumber + ': ' + t.status">
          <span class="tb-number">{{ t.tableNumber }}</span>
          <span class="tb-status">{{ t.status === 'Reserved' && t.reservedAt ? (t.reservedAt | date:'h:mm a') : t.status }}</span>
          <span class="tb-seats">{{ t.capacity }} seats</span>
        </div>
      </div>
      <div class="tb-legend">
        <span><i class="dot tb-free"></i>Free</span>
        <span><i class="dot tb-occupied"></i>Occupied</span>
        <span><i class="dot tb-reserved"></i>Reserved</span>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .tb {
      margin-top: 16px; padding: 14px; border-radius: 14px; text-align: left;
      background: var(--ui-surface-muted, rgba(26,26,46,0.035)); border: 1px solid var(--ui-border, rgba(26,26,46,0.08));
    }
    .tb-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .tb-title { font-weight: 700; font-size: 0.9rem; color: var(--ui-text, #1f2937); }
    .tb-summary { font-size: 0.75rem; color: var(--ui-text-2, #4b5563); }
    .tb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; }
    .tb-table {
      display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 8px 4px; border-radius: 10px;
      border: 1.5px solid transparent; text-align: center;
    }
    .tb-number { font-weight: 800; font-size: 1rem; }
    .tb-status { font-size: 0.68rem; font-weight: 600; }
    .tb-seats { font-size: 0.62rem; opacity: 0.75; }
    .tb-free { background: var(--ui-success-soft, rgba(22,163,74,0.11)); color: var(--ui-success-text, #15803d); border-color: var(--ui-success-soft, rgba(22,163,74,0.2)); }
    .tb-occupied { background: var(--ui-neutral-soft, rgba(26,26,46,0.06)); color: var(--ui-text-2, #4b5563); }
    .tb-reserved { background: var(--ui-accent-soft, rgba(233,69,96,0.1)); color: var(--ui-accent-text, #c42e4b); border-color: var(--ui-accent-soft, rgba(233,69,96,0.2)); }
    .tb-legend { display: flex; gap: 14px; margin-top: 10px; font-size: 0.7rem; color: var(--ui-text-2, #4b5563); }
    .tb-legend span { display: inline-flex; align-items: center; gap: 5px; }
    .dot { width: 9px; height: 9px; border-radius: 3px; display: inline-block; border: none; }
  `]
})
export class TableBoardComponent {
  @Input() tables?: PublicTableStatus[];

  count(status: PublicTableStatus['status']): number {
    return this.tables?.filter(t => t.status === status).length ?? 0;
  }
}
