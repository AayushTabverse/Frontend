import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MenuService } from '../../services/menu.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { MenuCategory, MenuItem } from '../../models/api.models';

@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './menu-management.component.html',
  styleUrl: './menu-management.component.scss'
})
export class MenuManagementComponent implements OnInit {
  categories: MenuCategory[] = [];
  loading = true;
  sidebarCollapsed = false;
  mobileSidebarOpen = false;

  // Category form
  showCategoryForm = false;
  editingCategory: MenuCategory | null = null;
  categoryForm = { name: '', description: '', imageUrl: '', sortOrder: 0 };

  // Item form
  showItemForm = false;
  editingItem: MenuItem | null = null;
  itemForm: any = {
    name: '', description: '', price: 0, imageUrl: '', isAvailable: true,
    isVeg: false, sortOrder: 0, arModelUrl: '', preparationTimeMinutes: 15, categoryId: ''
  };

  constructor(
    private menuService: MenuService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.menuService.getCategories().subscribe({
      next: (cats) => { this.categories = cats; this.loading = false; },
      error: () => this.loading = false
    });
  }

  // ── Category CRUD ──

  openAddCategory(): void {
    this.editingCategory = null;
    this.categoryForm = { name: '', description: '', imageUrl: '', sortOrder: 0 };
    this.showCategoryForm = true;
  }

  openEditCategory(cat: MenuCategory): void {
    this.editingCategory = cat;
    this.categoryForm = { name: cat.name, description: cat.description || '', imageUrl: cat.imageUrl || '', sortOrder: cat.sortOrder };
    this.showCategoryForm = true;
  }

  saveCategory(): void {
    if (this.editingCategory) {
      this.menuService.updateCategory(this.editingCategory.id, { ...this.categoryForm, isActive: true }).subscribe(() => {
        this.showCategoryForm = false;
        this.loadCategories();
      });
    } else {
      this.menuService.createCategory(this.categoryForm).subscribe(() => {
        this.showCategoryForm = false;
        this.loadCategories();
      });
    }
  }

  deleteCategory(id: string): void {
    if (confirm('Delete this category?')) {
      this.menuService.deleteCategory(id).subscribe(() => this.loadCategories());
    }
  }

  // ── Item CRUD ──

  openAddItem(categoryId: string): void {
    this.editingItem = null;
    this.itemForm = {
      name: '', description: '', price: 0, imageUrl: '', isAvailable: true,
      isVeg: false, sortOrder: 0, arModelUrl: '', preparationTimeMinutes: 15, categoryId
    };
    this.showItemForm = true;
  }

  openEditItem(item: MenuItem): void {
    this.editingItem = item;
    this.itemForm = { ...item };
    this.showItemForm = true;
  }

  saveItem(): void {
    if (this.editingItem) {
      this.menuService.updateItem(this.editingItem.id, this.itemForm).subscribe(() => {
        this.showItemForm = false;
        this.loadCategories();
      });
    } else {
      this.menuService.createItem(this.itemForm).subscribe(() => {
        this.showItemForm = false;
        this.loadCategories();
      });
    }
  }

  deleteItem(id: string): void {
    if (confirm('Delete this item?')) {
      this.menuService.deleteItem(id).subscribe(() => this.loadCategories());
    }
  }

  cancelForm(): void {
    this.showCategoryForm = false;
    this.showItemForm = false;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
