import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, Menu } from 'lucide-angular';
import { SettingsService } from '../../../services/settings.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, SidebarComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent implements OnInit {
  sidebarCollapsed = SidebarComponent.savedCollapsed();
  mobileSidebarOpen = false;
  restaurantName = '';
  readonly MenuIcon = Menu;

  constructor(private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.settingsService.getSettings().subscribe({
      next: (s) => this.restaurantName = s.name || ''
    });
  }
}
