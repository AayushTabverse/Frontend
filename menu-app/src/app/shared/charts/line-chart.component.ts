import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, NgZone,
  OnChanges, OnDestroy, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { niceTicks } from './format';

export interface LineSeries {
  name: string;
  /** One value per label; null = no data (e.g. hours that haven't happened yet). */
  values: (number | null)[];
  /** primary = the story (accent + wash); secondary = a second identity series (orange); compare = context (gray). */
  role: 'primary' | 'secondary' | 'compare';
}

/**
 * One-axis line chart: a primary series with an area wash and an optional gray comparison series.
 * Crosshair + tooltip on hover/keyboard listing every series at that X; the latest primary value is
 * direct-labelled. Legend only when there are two series.
 */
@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend" *ngIf="series.length > 1">
      <span class="legend-item" *ngFor="let s of series">
        <span class="legend-key" [class.compare]="s.role === 'compare'" [class.secondary]="s.role === 'secondary'"></span>{{ s.name }}
      </span>
    </div>
    <div class="plot" #plot (pointermove)="onMove($event)" (pointerleave)="hover = -1"
         tabindex="0" (keydown)="onKey($event)" (blur)="hover = -1" [attr.aria-label]="ariaLabel" role="img">
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" [attr.width]="width" [attr.height]="height" *ngIf="width > 0">
        <!-- grid + y ticks -->
        <g *ngFor="let t of ticks">
          <line class="grid" [attr.x1]="padL" [attr.x2]="width - padR" [attr.y1]="y(t)" [attr.y2]="y(t)" />
          <text class="tick" [attr.x]="padL - 8" [attr.y]="y(t) + 4" text-anchor="end">{{ format(t) }}</text>
        </g>
        <!-- x labels -->
        <text *ngFor="let i of xTickIdx" class="tick" [attr.x]="x(i)" [attr.y]="height - 6"
              [attr.text-anchor]="i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'">{{ labels[i] }}</text>
        <!-- series -->
        <ng-container *ngFor="let s of drawOrder">
          <path *ngIf="s.role === 'primary'" class="area" [attr.d]="areaPath(s)" />
          <path class="line" [class.compare]="s.role === 'compare'" [class.secondary]="s.role === 'secondary'" [attr.d]="linePath(s)" />
        </ng-container>
        <!-- end label on the latest primary point -->
        <ng-container *ngIf="endPoint as e">
          <circle class="dot" [attr.cx]="x(e.i)" [attr.cy]="y(e.v)" r="4" />
          <text class="end-label" [attr.x]="x(e.i) - 8" [attr.y]="y(e.v) - 10" text-anchor="end">{{ format(e.v) }}</text>
        </ng-container>
        <!-- crosshair -->
        <ng-container *ngIf="hover >= 0">
          <line class="crosshair" [attr.x1]="x(hover)" [attr.x2]="x(hover)" [attr.y1]="padT" [attr.y2]="height - padB" />
          <ng-container *ngFor="let s of series">
            <circle *ngIf="s.values[hover] !== null && s.values[hover] !== undefined" class="dot"
                    [class.compare]="s.role === 'compare'" [class.secondary]="s.role === 'secondary'" [attr.cx]="x(hover)" [attr.cy]="y(s.values[hover]!)" r="4" />
          </ng-container>
        </ng-container>
      </svg>
      <div class="viz-tooltip" *ngIf="hover >= 0" [style.left.px]="tipLeft" [style.top.px]="padT">
        <div class="tt-title">{{ (tooltipLabels || labels)[hover] }}</div>
        <div class="tt-row" *ngFor="let s of series">
          <span class="tt-key" [style.background]="s.role === 'compare' ? 'var(--viz-compare)' : s.role === 'secondary' ? 'var(--viz-series-2)' : 'var(--viz-series-1)'"></span>
          <span class="tt-value">{{ s.values[hover] === null || s.values[hover] === undefined ? '—' : format(s.values[hover]!) }}</span>
          <span class="tt-name">{{ s.name }}</span>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./line-chart.component.scss']
})
export class LineChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) labels: string[] = [];
  /** Longer labels for the tooltip (defaults to labels). */
  @Input() tooltipLabels?: string[];
  @Input({ required: true }) series: LineSeries[] = [];
  @Input() height = 240;
  @Input() format: (v: number) => string = v => String(v);
  @Input() ariaLabel = 'Line chart';

  @ViewChild('plot', { static: true }) plot!: ElementRef<HTMLDivElement>;

  width = 0;
  readonly padL = 52;
  readonly padR = 12;
  readonly padT = 14;
  readonly padB = 26;
  hover = -1;
  tipLeft = 0;
  ticks: number[] = [0, 1];
  xTickIdx: number[] = [];
  drawOrder: LineSeries[] = [];
  endPoint: { i: number; v: number } | null = null;
  private max = 1;
  private observer?: ResizeObserver;

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnChanges(): void {
    const values = this.series.flatMap(s => s.values).filter((v): v is number => v !== null && v !== undefined);
    this.ticks = niceTicks(Math.max(...values, 0) || 1);
    this.max = this.ticks[this.ticks.length - 1] || 1;
    this.drawOrder = [...this.series].sort((a, b) => (a.role === 'compare' ? -1 : 1) - (b.role === 'compare' ? -1 : 1));
    const primary = this.series.find(s => s.role === 'primary');
    this.endPoint = null;
    if (primary) {
      for (let i = primary.values.length - 1; i >= 0; i--) {
        const v = primary.values[i];
        if (v !== null && v !== undefined) { this.endPoint = { i, v }; break; }
      }
    }
    this.computeXTicks();
  }

  ngAfterViewInit(): void {
    this.observer = new ResizeObserver(entries => this.zone.run(() => {
      this.width = Math.floor(entries[0].contentRect.width);
      this.computeXTicks();
      this.cdr.markForCheck();
    }));
    this.observer.observe(this.plot.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  x(i: number): number {
    const n = Math.max(this.labels.length - 1, 1);
    return this.padL + (i / n) * (this.width - this.padL - this.padR);
  }

  y(v: number): number {
    return this.padT + (1 - v / this.max) * (this.height - this.padT - this.padB);
  }

  linePath(s: LineSeries): string {
    let d = '';
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null || v === undefined) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${this.x(i).toFixed(1)},${this.y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  areaPath(s: LineSeries): string {
    const pts = s.values.map((v, i) => ({ v, i })).filter(p => p.v !== null && p.v !== undefined);
    if (pts.length < 2) return '';
    const base = this.y(0);
    return `M${this.x(pts[0].i)},${base}` + pts.map(p => `L${this.x(p.i).toFixed(1)},${this.y(p.v!).toFixed(1)}`).join('') +
      `L${this.x(pts[pts.length - 1].i)},${base}Z`;
  }

  onMove(e: PointerEvent): void {
    const rect = this.plot.nativeElement.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const n = this.labels.length;
    if (n === 0) return;
    const ratio = (px - this.padL) / Math.max(this.width - this.padL - this.padR, 1);
    this.setHover(Math.round(Math.min(Math.max(ratio, 0), 1) * (n - 1)));
  }

  onKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const start = this.hover < 0 ? this.labels.length - 1 : this.hover;
    this.setHover(Math.min(Math.max(start + (e.key === 'ArrowRight' ? 1 : -1), 0), this.labels.length - 1));
  }

  private setHover(i: number): void {
    this.hover = i;
    const px = this.x(i);
    this.tipLeft = px > this.width / 2 ? px - 170 : px + 12; // keep the tooltip inside the plot
  }

  private computeXTicks(): void {
    const n = this.labels.length;
    if (n === 0) { this.xTickIdx = []; return; }
    const fit = Math.max(2, Math.floor((this.width || 600) / 70));
    const step = Math.max(1, Math.ceil((n - 1) / (fit - 1)));
    const idx: number[] = [];
    for (let i = 0; i < n; i += step) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) {
      if (n - 1 - idx[idx.length - 1] < step / 2) idx.pop();
      idx.push(n - 1);
    }
    this.xTickIdx = idx;
  }
}
