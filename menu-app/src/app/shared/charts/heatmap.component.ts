import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Rows × columns heatmap (weekday × hour). Sequential one-hue scale in 4 steps; empty cells get a
 * neutral gray so "no orders" never reads as "a few". Per-cell tooltip; scale legend below.
 */
@Component({
  selector: 'app-heatmap',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="heat" role="img" [attr.aria-label]="ariaLabel">
      <div class="row" *ngFor="let r of rows; let ri = index">
        <span class="row-label">{{ r }}</span>
        <div class="cells" [style.grid-template-columns]="'repeat(' + cols.length + ', minmax(0, 1fr))'">
          <div class="cell" *ngFor="let c of cols; let ci = index" tabindex="0"
               [ngClass]="'s' + step(values[ri][ci])"
               (pointerenter)="hoverR = ri; hoverC = ci" (pointerleave)="hoverR = -1" (focus)="hoverR = ri; hoverC = ci" (blur)="hoverR = -1">
            <div class="viz-tooltip" *ngIf="hoverR === ri && hoverC === ci" [class.right]="ci > cols.length / 2" [class.up]="ri > rows.length / 2">
              <div class="tt-title">{{ rowNames ? rowNames[ri] : r }} · {{ colNames ? colNames[ci] : c }}</div>
              <div class="tt-row"><span class="tt-value">{{ format(values[ri][ci]) }}</span><span class="tt-name">{{ valueName }}</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="row axis">
        <span class="row-label"></span>
        <div class="cells" [style.grid-template-columns]="'repeat(' + cols.length + ', minmax(0, 1fr))'">
          <span class="col-label" *ngFor="let c of cols; let ci = index">{{ ci % colLabelEvery === 0 ? c : '' }}</span>
        </div>
      </div>
      <div class="scale">
        <span class="scale-item"><span class="sw s0"></span>None</span>
        <span class="scale-item" *ngFor="let b of bands; let i = index"><span class="sw" [ngClass]="'s' + (i + 1)"></span>{{ b }}</span>
      </div>
    </div>
  `,
  styleUrls: ['./heatmap.component.scss']
})
export class HeatmapComponent implements OnChanges {
  @Input({ required: true }) rows: string[] = [];
  @Input() rowNames?: string[];
  @Input({ required: true }) cols: string[] = [];
  @Input() colNames?: string[];
  @Input({ required: true }) values: number[][] = [];
  @Input() colLabelEvery = 3;
  @Input() valueName = '';
  @Input() format: (v: number) => string = v => String(v);
  @Input() ariaLabel = 'Heatmap';

  hoverR = -1;
  hoverC = -1;
  bands: string[] = [];
  private max = 0;

  ngOnChanges(): void {
    this.max = Math.max(0, ...this.values.flat());
    // Four equal-width bands from 1 to max, labelled with their ranges
    const edges = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * this.max));
    this.bands = this.max === 0 ? [] : [1, 2, 3, 4].map(i => {
      const lo = i === 1 ? 1 : edges[i - 1] + 1, hi = edges[i];
      return lo >= hi ? `${hi}` : `${lo}–${hi}`;
    });
  }

  step(v: number): number {
    if (!v || this.max === 0) return 0;
    return Math.min(4, Math.max(1, Math.ceil((v / this.max) * 4)));
  }
}
