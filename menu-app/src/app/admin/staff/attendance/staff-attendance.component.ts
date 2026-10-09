import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StaffService } from '../../../services/staff.service';
import { AttendanceStatus, DailyAttendance } from '../../../models/api.models';
import { roleDisplayName } from '../../../shared/permissions';
import { toDateKey } from '../../../shared/date-utils';

interface AttendanceRow extends DailyAttendance {
  originalStatus?: AttendanceStatus;
  originalNotes?: string;
}

@Component({
  selector: 'app-staff-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-attendance.component.html',
  styleUrls: ['./staff-attendance.component.scss']
})
export class StaffAttendanceComponent implements OnInit {
  readonly statuses: { value: AttendanceStatus; label: string; title: string }[] = [
    { value: 'Present', label: 'P', title: 'Present' },
    { value: 'Absent', label: 'A', title: 'Absent' },
    { value: 'HalfDay', label: '½', title: 'Half day' },
    { value: 'Leave', label: 'L', title: 'Paid leave' }
  ];

  readonly today = toDateKey(new Date());
  date = this.today;
  rows: AttendanceRow[] = [];
  loading = true;
  saving = false;
  successMessage = '';
  errorMessage = '';

  readonly roleName = roleDisplayName;

  constructor(private staffService: StaffService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.staffService.getAttendance(this.date).subscribe({
      next: (data) => {
        this.rows = data.map(r => ({ ...r, originalStatus: r.status, originalNotes: r.notes }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.showError('Failed to load attendance.');
      }
    });
  }

  changeDate(newDate: string): void {
    if (!newDate || newDate > this.today) return;
    if (this.hasChanges && !confirm('You have unsaved attendance changes. Discard them?')) {
      return;
    }
    this.date = newDate;
    this.load();
  }

  shiftDay(days: number): void {
    const [y, m, d] = this.date.split('-').map(Number);
    this.changeDate(toDateKey(new Date(y, m - 1, d + days)));
  }

  setStatus(row: AttendanceRow, status: AttendanceStatus): void {
    // Clicking the active status again clears it
    row.status = row.status === status ? undefined : status;
  }

  markAllUnmarkedPresent(): void {
    this.rows.filter(r => !r.status).forEach(r => r.status = 'Present');
  }

  isDirty(row: AttendanceRow): boolean {
    return row.status !== row.originalStatus || (row.notes || '') !== (row.originalNotes || '');
  }

  get hasChanges(): boolean {
    return this.rows.some(r => this.isDirty(r));
  }

  get unmarkedCount(): number {
    return this.rows.filter(r => !r.status).length;
  }

  count(status: AttendanceStatus): number {
    return this.rows.filter(r => r.status === status).length;
  }

  save(): void {
    const entries = this.rows
      .filter(r => this.isDirty(r))
      .map(r => ({ userId: r.userId, status: r.status ?? null, notes: r.notes || undefined }));
    if (entries.length === 0) return;

    this.saving = true;
    this.staffService.saveAttendance(this.date, entries).subscribe({
      next: (data) => {
        this.rows = data.map(r => ({ ...r, originalStatus: r.status, originalNotes: r.notes }));
        this.saving = false;
        this.showSuccess(`Attendance saved for ${entries.length} staff member${entries.length > 1 ? 's' : ''}.`);
      },
      error: (err) => {
        this.saving = false;
        this.showError(err.error?.message || 'Failed to save attendance.');
      }
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = '', 3000);
  }

  private showError(msg: string): void {
    this.errorMessage = msg;
    setTimeout(() => this.errorMessage = '', 4000);
  }
}
