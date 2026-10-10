import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ChartTable {
  columns: string[];
  rows: (string | number)[][];
}

/** Card around a chart: title, optional subtitle, and a Chart/Table switch (the accessible twin of every chart). */
@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <header>
        <div class="titles">
          <h3>{{ title }}</h3>
          <p *ngIf="subtitle">{{ subtitle }}</p>
        </div>
        <div class="switch" *ngIf="table" role="group" aria-label="View">
          <button type="button" [class.on]="!showTable" (click)="showTable = false">Chart</button>
          <button type="button" [class.on]="showTable" (click)="showTable = true">Table</button>
        </div>
      </header>
      <div [hidden]="showTable"><ng-content></ng-content></div>
      <div class="table-wrap" *ngIf="showTable && table">
        <table>
          <thead><tr><th *ngFor="let c of table.columns">{{ c }}</th></tr></thead>
          <tbody><tr *ngFor="let r of table.rows"><td *ngFor="let v of r">{{ v }}</td></tr></tbody>
        </table>
      </div>
    </section>
  `,
  styleUrls: ['./chart-card.component.scss']
})
export class ChartCardComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() table: ChartTable | null = null;
  showTable = false;
}
