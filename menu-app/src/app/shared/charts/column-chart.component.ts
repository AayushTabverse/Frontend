import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { niceTicks } from './format';

/** Single-series columns (e.g. orders by hour). Only the peak is direct-labelled; every bar has a tooltip. */
@Component({
  selector: 'app-column-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cols" [style.height.px]="height" role="img" [attr.aria-label]="ariaLabel">
      <div class="y-axis">
        <span *ngFor="let t of ticksDesc">{{ format(t) }}</span>
      </div>
      <div class="plot">
        <div class="gridline" *ngFor="let t of ticksDesc" [style.bottom.%]="t / max * 100"></div>
        <div class="col" *ngFor="let v of values; let i = index" tabindex="0"
             (pointerenter)="hover = i" (pointerleave)="hover = -1" (focus)="hover = i" (blur)="hover = -1">
          <div class="peak-label" *ngIf="i === peak && v > 0" [style.bottom.%]="v / max * 100">{{ format(v) }}</div>
          <div class="bar" [class.dim]="hover >= 0 && hover !== i" [style.height.%]="v / max * 100"></div>
          <div class="viz-tooltip" *ngIf="hover === i" [class.right]="i > values.length / 2">
            <div class="tt-title">{{ (tooltipLabels || labels)[i] }}</div>
            <div class="tt-row"><span class="tt-value">{{ format(v) }}</span><span class="tt-name">{{ valueName }}</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="x-labels">
      <span *ngFor="let l of labels; let i = index" [class.hidden]="i % labelEvery !== 0">{{ l }}</span>
    </div>
  `,
  styleUrls: ['./column-chart.component.scss']
})
export class ColumnChartComponent implements OnChanges {
  @Input({ required: true }) labels: string[] = [];
  @Input() tooltipLabels?: string[];
  @Input({ required: true }) values: number[] = [];
  @Input() height = 180;
  @Input() labelEvery = 1;
  @Input() valueName = '';
  @Input() format: (v: number) => string = v => String(v);
  @Input() ariaLabel = 'Column chart';

  hover = -1;
  max = 1;
  peak = -1;
  ticksDesc: number[] = [];

  ngOnChanges(): void {
    const ticks = niceTicks(Math.max(...this.values, 0) || 1, 3);
    this.max = ticks[ticks.length - 1] || 1;
    this.ticksDesc = [...ticks].reverse();
    this.peak = this.values.indexOf(Math.max(...this.values));
  }
}
