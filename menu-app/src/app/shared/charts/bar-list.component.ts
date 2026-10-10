import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BarRow {
  label: string;
  value: number;
  /** Text shown at the bar tip (defaults to the value). */
  display?: string;
  /** Secondary text under the label. */
  sub?: string;
}

/** Ranked horizontal bars, one hue, value at the tip. Long labels wrap rather than clip. */
@Component({
  selector: 'app-bar-list',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="bars" [class.ranked]="ranked">
      <li *ngFor="let r of rows; let i = index">
        <span class="rank" *ngIf="ranked">{{ i + 1 }}</span>
        <div class="text">
          <span class="name">{{ r.label }}</span>
          <span class="sub" *ngIf="r.sub">{{ r.sub }}</span>
        </div>
        <div class="track">
          <div class="fill" [style.width.%]="max ? r.value / max * 100 : 0"></div>
          <span class="val">{{ r.display ?? r.value }}</span>
        </div>
      </li>
    </ol>
    <p class="empty" *ngIf="!rows.length">{{ emptyText }}</p>
  `,
  styleUrls: ['./bar-list.component.scss']
})
export class BarListComponent implements OnChanges {
  @Input({ required: true }) rows: BarRow[] = [];
  @Input() ranked = false;
  @Input() emptyText = 'No data for this period.';
  max = 0;

  ngOnChanges(): void {
    this.max = Math.max(0, ...this.rows.map(r => r.value));
  }
}
