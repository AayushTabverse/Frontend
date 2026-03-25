import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { StaffResponse } from '../../models/api.models';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './staff.component.html',
  styleUrls: ['./staff.component.scss']
})
export class StaffComponent implements OnInit {
  staff: StaffResponse[] = [];
  loading = true;
  userName = '';
  sidebarCollapsed = false;
  mobileSidebarOpen = false;

  // Add user form
  showAddForm = false;
  newUser = { fullName: '', email: '', password: '', phone: '', role: 'Waiter' };
  adding = false;
  formError = '';
  successMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService
  ) {
    this.authService.currentUser$.subscribe(u => this.userName = u?.fullName || '');
  }

  ngOnInit(): void {
    this.loadStaff();
  }

  loadStaff(): void {
    this.loading = true;
    this.authService.getStaff().subscribe({
      next: (data) => {
        this.staff = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  openAddForm(): void {
    this.showAddForm = true;
    this.newUser = { fullName: '', email: '', password: '', phone: '', role: 'Waiter' };
    this.formError = '';
  }

  cancelAdd(): void {
    this.showAddForm = false;
    this.formError = '';
  }

  addUser(): void {
    if (!this.newUser.fullName || !this.newUser.email || !this.newUser.password) {
      this.formError = 'Name, email and password are required.';
      return;
    }
    if (this.newUser.password.length < 6) {
      this.formError = 'Password must be at least 6 characters.';
      return;
    }

    this.adding = true;
    this.formError = '';

    const tenantId = this.authService.getTenantId()!;
    this.authService.registerUser({
      fullName: this.newUser.fullName,
      email: this.newUser.email,
      password: this.newUser.password,
      phone: this.newUser.phone || undefined,
      role: this.newUser.role,
      tenantId
    }).subscribe({
      next: () => {
        this.adding = false;
        this.showAddForm = false;
        this.successMessage = `${this.newUser.role} "${this.newUser.fullName}" added successfully!`;
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

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'RestaurantAdmin': return 'role-admin';
      case 'Waiter': return 'role-waiter';
      case 'Kitchen': return 'role-kitchen';
      default: return '';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
