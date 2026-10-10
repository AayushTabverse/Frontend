import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ImportAction, ImportResult, ImportRow } from '../../../models/api.models';

/** A preview-table column. `kind` controls formatting. */
export interface ImportColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
  kind?: 'text' | 'strong' | 'number' | 'money' | 'veg' | 'muted';
}

/** What a page passes in to get an Excel import dialog for its data. */
export interface ExcelImportConfig<T extends ImportRow> {
  title: string;
  /** Singular / plural noun for messages, e.g. ['item', 'items']. */
  noun: [string, string];
  templateFileName: string;
  downloadTemplate: () => Observable<Blob>;
  /** apply = false → preview only; apply = true → save valid rows. */
  runImport: (file: File, updateExisting: boolean, apply: boolean) => Observable<ImportResult<T>>;
  updateExistingLabel: string;
  updateExistingHint: string;
  columns: ImportColumn<T>[];
  /** Extra lines shown above the preview table, e.g. "New categories: …". */
  summaryNotes?: (result: ImportResult<T>) => string[];
  /** Shown on the first step, e.g. a reminder that the sheet contains passwords. */
  warning?: string;
}

/**
 * Bulk import from Excel: download template → choose file → preview (nothing saved) → import.
 * The server parses and validates; the preview shows exactly what will be created or changed.
 */
@Component({
  selector: 'app-excel-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './excel-import.component.html',
  styleUrls: ['./excel-import.component.scss']
})
export class ExcelImportComponent<T extends ImportRow = ImportRow> {
  @Input({ required: true }) config!: ExcelImportConfig<T>;
  @Output() closed = new EventEmitter<void>();
  /** Emitted after a successful import so the parent can reload its data. */
  @Output() imported = new EventEmitter<void>();

  readonly maxBytes = 5 * 1024 * 1024;

  step: 'choose' | 'preview' | 'done' = 'choose';
  file: File | null = null;
  updateExisting = true;
  dragOver = false;
  busy = false;
  downloading = false;
  error = '';

  preview: ImportResult<T> | null = null;
  result: ImportResult<T> | null = null;
  notes: string[] = [];
  onlyProblems = false;

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.busy) return;
    if (this.step === 'done') this.imported.emit();
    this.closed.emit();
  }

  downloadTemplate(): void {
    this.downloading = true;
    this.config.downloadTemplate().subscribe({
      next: (blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = this.config.templateFileName;
        a.click();
        URL.revokeObjectURL(a.href);
        this.downloading = false;
      },
      error: () => {
        this.downloading = false;
        this.error = 'Could not download the template.';
      }
    });
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFile(input.files?.[0] ?? null);
    input.value = ''; // allow re-selecting the same file after editing it
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    this.setFile(event.dataTransfer?.files?.[0] ?? null);
  }

  private setFile(file: File | null): void {
    this.error = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.error = 'Choose an Excel .xlsx file. In Excel: File → Save As → Excel Workbook (.xlsx).';
      return;
    }
    if (file.size > this.maxBytes) {
      this.error = 'File is larger than 5 MB.';
      return;
    }
    this.file = file;
  }

  runPreview(): void {
    if (!this.file) return;
    this.busy = true;
    this.error = '';
    this.config.runImport(this.file, this.updateExisting, false).subscribe({
      next: (res) => {
        this.preview = res;
        this.notes = this.config.summaryNotes?.(res) ?? [];
        this.onlyProblems = false;
        this.step = 'preview';
        this.busy = false;
      },
      error: (err) => {
        this.busy = false;
        this.error = err.error?.message || 'Could not read the file.';
      }
    });
  }

  confirmImport(): void {
    if (!this.file || !this.preview || this.importableCount === 0) return;
    this.busy = true;
    this.error = '';
    this.config.runImport(this.file, this.updateExisting, true).subscribe({
      next: (res) => {
        this.result = res;
        this.step = 'done';
        this.busy = false;
      },
      error: (err) => {
        this.busy = false;
        this.error = err.error?.message || 'Import failed. Nothing was saved.';
      }
    });
  }

  back(): void {
    this.step = 'choose';
    this.preview = null;
    this.error = '';
  }

  get importableCount(): number {
    return this.preview ? this.preview.createCount + this.preview.updateCount : 0;
  }

  get visibleRows(): T[] {
    const rows = this.preview?.rows ?? [];
    return this.onlyProblems ? rows.filter(r => r.action === 'Error') : rows;
  }

  noun(count: number): string {
    return count === 1 ? this.config.noun[0] : this.config.noun[1];
  }

  display(col: ImportColumn<T>, row: T): string {
    const v = col.value(row);
    if (v === null || v === undefined || v === '') return '—';
    if (col.kind === 'money' && typeof v === 'number') return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    if (col.kind === 'number' && typeof v === 'number') return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    return String(v);
  }

  actionLabel(action: ImportAction): string {
    switch (action) {
      case 'Create': return 'New';
      case 'Update': return 'Update';
      case 'Unchanged': return 'No change';
      case 'Skip': return 'Exists — skipped';
      case 'Error': return 'Error';
    }
  }

  fileSize(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
