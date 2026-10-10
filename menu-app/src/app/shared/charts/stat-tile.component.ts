import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Stat tile: label · value · signed delta vs a named period · optional sparkline.
 * Delta colour = direction × whether up is good; it always carries ▲/▼ and text, never colour alone.
 */
@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tile" [class.hero]="hero">
      <div class="label">{{ label }}</div>
      <div class="value">{{ value }}</div>
      <div class="delta-row" *ngIf="showDelta || vs">
        <span class="delta" *ngIf="showDelta && delta !== null && delta !== undefined" [class.good]="tone === 'good'" [class.bad]="tone === 'bad'">
          {{ delta > 0 ? '▲' : delta < 0 ? '▼' : '•' }} {{ abs(delta) | number:'1.0-1' }}%
        </span>
        <span class="delta none" *ngIf="showDelta && (delta === null || delta === undefined)">No earlier data</span>
        <span class="vs" *ngIf="vs">{{ vs }}</span>
      </div>
      <svg class="spark" *ngIf="sparkPath" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
        <path [attr.d]="sparkPath" />
        <circle [attr.cx]="sparkEnd.x" [attr.cy]="sparkEnd.y" r="2.2" />
      </svg>
      <div class="note" *ngIf="note">{{ note }}</div>
    </div>
  `,
  styleUrls: ['./stat-tile.component.scss']
})
export class StatTileComponent implements OnChanges {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value = '';
  @Input() delta: number | null | undefined = null;
  /** Up is good for revenue; down is good for cancellations or prep time. */
  @Input() upIsGood = true;
  @Input() vs = '';
  @Input() spark: number[] | null = null;
  @Input() note = '';
  @Input() hero = false;
  /** False for tiles that have nothing to compare against. */
  @Input() showDelta = true;

  sparkPath = '';
  sparkEnd = { x: 0, y: 0 };
  tone: 'good' | 'bad' | 'flat' = 'flat';

  abs = Math.abs;

  ngOnChanges(): void {
    const d = this.delta ?? 0;
    this.tone = Math.abs(d) < 0.5 ? 'flat' : (d > 0) === this.upIsGood ? 'good' : 'bad';
    const s = (this.spark ?? []).filter(v => v !== null && v !== undefined);
    if (s.length < 2) { this.sparkPath = ''; return; }
    const max = Math.max(...s), min = Math.min(...s);
    const span = max - min || 1;
    const pts = s.map((v, i) => ({ x: (i / (s.length - 1)) * 98 + 1, y: 26 - ((v - min) / span) * 22 }));
    this.sparkPath = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
    this.sparkEnd = pts[pts.length - 1];
  }
}
