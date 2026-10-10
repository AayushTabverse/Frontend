import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../../services/inventory.service';
import { InventoryAnalytics } from '../../../models/api.models';
import { parseDateKey } from '../../../shared/date-utils';
import { LineChartComponent, LineSeries } from '../../../shared/charts/line-chart.component';
import { StatTileComponent } from '../../../shared/charts/stat-tile.component';
import { BarListComponent, BarRow } from '../../../shared/charts/bar-list.component';
import { ChartCardComponent, ChartTable } from '../../../shared/charts/chart-card.component';
import { inr, inrCompact, num } from '../../../shared/charts/format';

/** Inventory analytics tab: stock health now, how long stock will last, and where stock money goes. */
@Component({
  selector: 'app-inventory-analytics',
  standalone: true,
  imports: [CommonModule, LineChartComponent, StatTileComponent, BarListComponent, ChartCardComponent],
  templateUrl: './inventory-analytics.component.html',
  styleUrls: ['./inventory-analytics.component.scss']
})
export class InventoryAnalyticsComponent implements OnInit {
  /** Ask the parent page to open its Restock dialog for an item. */
  @Output() restock = new EventEmitter<string>();

  readonly ranges = [7, 30, 90];
  days = 30;
  data: InventoryAnalytics | null = null;
  loading = false;
  error = '';

  compareLabel = '';
  labels: string[] = [];
  tooltipLabels: string[] = [];
  series: LineSeries[] = [];
  usedSpark: number[] = [];
  usedRows: BarRow[] = [];
  wastedRows: BarRow[] = [];
  categoryRows: BarRow[] = [];
  valueRows: BarRow[] = [];
  tables: Record<string, ChartTable> = {};

  readonly inr = inr;
  readonly inrCompact = inrCompact;
  readonly num = num;

  constructor(private inventory: InventoryService) {}

  ngOnInit(): void {
    this.load();
  }

  setRange(d: number): void {
    if (d === this.days && this.data) return;
    this.days = d;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.inventory.getAnalytics(this.days).subscribe({
      next: (d) => { this.data = d; this.build(d); this.loading = false; },
      error: () => { this.loading = false; this.error = 'Could not load inventory analytics.'; }
    });
  }

  private build(d: InventoryAnalytics): void {
    const short = (s: string) => parseDateKey(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    this.compareLabel = `vs previous ${d.days} days`;
    this.labels = d.daily.map(p => short(p.date));
    this.tooltipLabels = d.daily.map(p => parseDateKey(p.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }));
    this.series = [
      { name: 'Stock used', values: d.daily.map(p => p.usedValue), role: 'primary' },
      { name: 'Restocked', values: d.daily.map(p => p.restockedValue), role: 'secondary' }
    ];
    this.usedSpark = d.daily.map(p => p.usedValue);

    const q = (v: number, unit: string) => `${num(v, 1)} ${unit}`;
    this.usedRows = d.topUsed.map(i => ({ label: i.name, value: i.value, display: inrCompact(i.value), sub: `${q(i.quantity, i.unit)} · ${i.sharePct}%` }));
    this.wastedRows = d.topWasted.map(i => ({ label: i.name, value: i.value, display: inr(i.value), sub: q(i.quantity, i.unit) }));
    this.categoryRows = d.valueByCategory.filter(c => c.totalValue > 0).map(c => ({ label: c.category, value: c.totalValue, display: inrCompact(c.totalValue), sub: `${c.itemCount} item${c.itemCount === 1 ? '' : 's'}` }));
    this.valueRows = d.topValue.map(i => ({ label: i.name, value: i.value, display: `${inrCompact(i.value)} · ${i.sharePct}%`, sub: q(i.quantity, i.unit) }));

    this.tables = {
      trend: { columns: ['Date', 'Stock used', 'Wasted', 'Restocked'], rows: d.daily.map((p, i) => [this.tooltipLabels[i], inr(p.usedValue), inr(p.wastedValue), inr(p.restockedValue)]) },
      used: { columns: ['Item', 'Quantity', 'Value', 'Share'], rows: d.topUsed.map(i => [i.name, q(i.quantity, i.unit), inr(i.value), `${i.sharePct}%`]) },
      wasted: { columns: ['Item', 'Quantity', 'Value'], rows: d.topWasted.map(i => [i.name, q(i.quantity, i.unit), inr(i.value)]) },
      category: { columns: ['Category', 'Items', 'Stock value'], rows: d.valueByCategory.map(c => [c.category, c.itemCount, inr(c.totalValue)]) },
      value: { columns: ['Item', 'In stock', 'Value', 'Share'], rows: d.topValue.map(i => [i.name, q(i.quantity, i.unit), inr(i.value), `${i.sharePct}%`]) }
    };
  }

  runsOut(days: number): string {
    if (days <= 0) return 'Out now';
    if (days < 1) return 'Today';
    return `${num(days, 1)} day${days === 1 ? '' : 's'}`;
  }

  urgency(days: number): 'critical' | 'warning' {
    return days < 2 ? 'critical' : 'warning';
  }
}
