import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { StaffImportRow, StaffResponse } from '../../models/api.models';
import { AppRole, ROLE_LABELS, manageableRoles, roleDisplayName } from '../../shared/permissions';
import { StaffAttendanceComponent } from './attendance/staff-attendance.component';
import { StaffPayrollComponent } from './payroll/staff-payroll.component';
import { StaffService } from '../../services/staff.service';
import { ExcelImportComponent, ExcelImportConfig } from '../../shared/components/excel-import/excel-import.component';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StaffAttendanceComponent, StaffPayrollComponent, ExcelImportComponent],
  templateUrl: './staff.component.html',
  styleUrls: ['./staff.component.scss']
})
export class StaffComponent implements OnInit {
  activeTab: 'team' | 'attendance' | 'salary' = 'team';

  readonly roleLabels = ROLE_LABELS;
  readonly roleHints: Record<string, string> = {
    Manager: 'Runs the floor: menu, tables, staff, inventory, bills. No settings, website or subscription.',
    Cashier: 'Takes orders, settles bills and handles udhaar.',
    Captain: 'Takes orders on any table. Cannot settle bills.',
    Waiter: 'Takes orders on assigned tables.',
    Kitchen: 'Sees the kitchen display only.',
    Helper: 'For cleaners, dishwashers, security etc. No login — only tracked in attendance and salary.'
  };
  assignableRoles: AppRole[] = [];
  canSeeSalary = false;
  private myUserId: string | null = null;
  staff: StaffResponse[] = [];
  loading = true;

  // Add user form
  showAddForm = false;
  newUser = { fullName: '', email: '', password: '', phone: '', jobTitle: '', role: 'Waiter' };
  adding = false;
  formError = '';
  successMessage = '';
  staffSubmitted = false;

  showImport = false;
  readonly importConfig: ExcelImportConfig<StaffImportRow> = {
    title: 'Import staff from Excel',
    noun: ['staff member', 'staff members'],
    templateFileName: 'tabverse-staff-template.xlsx',
    downloadTemplate: () => this.staffService.downloadImportTemplate(),
    runImport: (file, updateExisting, apply) => this.staffService.importStaff(file, updateExisting, apply),
    updateExistingLabel: 'Update staff who are already on the team (matched by email, or by name for payroll-only staff)',
    updateExistingHint: 'Updates name, phone, job title and salary. Roles and passwords are never changed by an import.',
    columns: [
      { header: 'Name', value: r => r.fullName, kind: 'strong' },
      { header: 'Role', value: r => r.role ? roleDisplayName(r.role) : '' },
      { header: 'Email', value: r => r.email ?? (r.role === 'Helper' ? 'No app login' : ''), kind: 'muted' },
      { header: 'Job title', value: r => r.jobTitle },
      { header: 'Salary', value: r => r.monthlySalary, kind: 'money' }
    ],
    warning: 'The sheet contains login passwords. Delete the file after uploading and ask staff to change their password.'
  };

  constructor(
    private authService: AuthService,
    private staffService: StaffService
  ) {}

  ngOnInit(): void {
    this.assignableRoles = manageableRoles(this.authService.getRole());
    this.canSeeSalary = this.authService.can('staffSalary');
    this.myUserId = this.authService.getUserId();
    this.loadStaff();
  }

  loadStaff(): void {
    this.loading = true;
    this.authService.getStaff().subscribe({
      next: (data) => {
        const order: string[] = ['SuperAdmin', 'RestaurantAdmin', 'Manager', 'Cashier', 'Captain', 'Waiter', 'Kitchen', 'Helper'];
        this.staff = data.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.fullName.localeCompare(b.fullName));
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  openAddForm(): void {
    this.showAddForm = true;
    this.newUser = { fullName: '', email: '', password: '', phone: '', jobTitle: '', role: 'Waiter' };
    this.formError = '';
    this.staffSubmitted = false;
  }

  cancelAdd(): void {
    this.showAddForm = false;
    this.formError = '';
  }

  addUser(): void {
    this.staffSubmitted = true;
    if (!this.newUser.fullName) {
      this.formError = 'Name is required.';
      return;
    }
    if (!this.isPayrollOnly) {
      if (!this.newUser.email || !this.newUser.password) {
        this.formError = 'Email and password are required for staff who use the app.';
        return;
      }
      if (!this.isValidEmail(this.newUser.email)) {
        this.formError = 'Please enter a valid email address.';
        return;
      }
      if (this.newUser.password.length < 6) {
        this.formError = 'Password must be at least 6 characters.';
        return;
      }
    }
    if (this.newUser.phone && this.newUser.phone.length !== 10) {
      this.formError = 'Phone number must be exactly 10 digits.';
      return;
    }

    this.adding = true;
    this.formError = '';

    const tenantId = this.authService.getTenantId()!;
    this.authService.registerUser({
      fullName: this.newUser.fullName,
      email: this.isPayrollOnly ? undefined : this.newUser.email,
      password: this.isPayrollOnly ? undefined : this.newUser.password,
      phone: this.newUser.phone || undefined,
      jobTitle: this.newUser.jobTitle.trim() || undefined,
      role: this.newUser.role,
      tenantId
    }).subscribe({
      next: () => {
        this.adding = false;
        this.showAddForm = false;
        const as = this.newUser.jobTitle.trim() || this.roleBadge(this.newUser.role);
        this.successMessage = `${this.newUser.fullName} added as ${as}.`;
        this.loadStaff();
        setTimeout(() => this.successMessage = '', 4000);
      },
      error: (err) => {
        this.adding = false;
        this.formError = err.error?.message || 'Failed to add user.';
      }
    });
  }

  toggleActive(user: StaffResponse): void {
    this.authService.toggleUserActive(user.id).subscribe({
      next: () => {
        user.isActive = !user.isActive;
        this.successMessage = `${user.fullName} is now ${user.isActive ? 'active' : 'inactive'}.`;
        setTimeout(() => this.successMessage = '', 3000);
      }
    });
  }

  deleteUser(user: StaffResponse): void {
    if (!confirm(`Delete ${user.fullName}? This cannot be undone.`)) return;

    this.authService.deleteUser(user.id).subscribe({
      next: () => {
        this.staff = this.staff.filter(s => s.id !== user.id);
        this.successMessage = `${user.fullName} has been removed.`;
        setTimeout(() => this.successMessage = '', 3000);
      }
    });
  }

  /** Payroll-only staff ('Helper') get no email or password and cannot log in. */
  get isPayrollOnly(): boolean {
    return this.newUser.role === 'Helper';
  }

  roleBadge(role: string): string {
    if (role === 'RestaurantAdmin') return 'Owner';
    if (role === 'Helper') return 'Payroll only';
    return role;
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'RestaurantAdmin': return 'role-admin';
      case 'Manager': return 'role-manager';
      case 'Cashier': return 'role-cashier';
      case 'Captain': return 'role-captain';
      case 'Waiter': return 'role-waiter';
      case 'Kitchen': return 'role-kitchen';
      case 'Helper': return 'role-helper';
      default: return '';
    }
  }

  /** Mirrors the backend rule: owners manage all staff, managers manage roles below manager, nobody manages themselves. */
  canManage(user: StaffResponse): boolean {
    return user.id !== this.myUserId && (this.assignableRoles as string[]).includes(user.role);
  }

  isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }

  onlyNumbers(event: KeyboardEvent): void {
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }
}
