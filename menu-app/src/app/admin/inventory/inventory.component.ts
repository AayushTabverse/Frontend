import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { InventoryService } from '../../services/inventory.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { InventoryItem, InventoryLog, InventorySummary } from '../../models/api.models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  sidebarCollapsed = false;
  mobileSidebarOpen = false;

  // Data
  items: InventoryItem[] = [];
  filteredItems: InventoryItem[] = [];
  logs: InventoryLog[] = [];
  summary?: InventorySummary;
  categories: string[] = [];

  // Filters
  searchQuery = '';
  filterCategory = '';
  filterLowStock = false;
  activeTab: 'items' | 'logs' | 'analytics' = 'items';

  // Loading
  loading = true;
  logsLoading = false;

  // Form
  showForm = false;
  editingItem: InventoryItem | null = null;
  formData = {
    name: '',
    description: '',
    category: '',
    currentQuantity: 0,
    unit: 'Piece',
    minimumQuantity: 0,
    costPerUnit: 0,
    supplier: '',
    supplierContact: ''
  };
  formSubmitting = false;

  // Adjust quantity
  showAdjustDialog = false;
  adjustItem: InventoryItem | null = null;
  adjustData = {
    quantity: 0,
    changeType: 'Restock',
    notes: ''
  };
  adjustSubmitting = false;

  // Log filter
  logDays = 30;
  logItemFilter = '';

  unitOptions = ['Kg', 'Gram', 'Liter', 'Ml', 'Piece', 'Dozen', 'Box', 'Packet', 'Bottle', 'Can', 'Bunch'];

  successMessage = '';
  errorMessage = '';

  constructor(
    private inventoryService: InventoryService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.loadItems();
    this.loadSummary();
    this.loadCategories();
  }

  loadItems(): void {
    this.inventoryService.getItems().subscribe({
      next: (items) => {
        this.items = items;
        this.applyFilters();
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  loadSummary(): void {
    this.inventoryService.getSummary().subscribe({
      next: (s) => this.summary = s
    });
  }

  loadCategories(): void {
    this.inventoryService.getCategories().subscribe({
      next: (c) => this.categories = c
    });
  }

  loadLogs(): void {
    this.logsLoading = true;
    this.inventoryService.getLogs(this.logItemFilter || undefined, this.logDays).subscribe({
      next: (logs) => { this.logs = logs; this.logsLoading = false; },
      error: () => this.logsLoading = false
    });
  }

  // ── Filters ──

  applyFilters(): void {
    let result = [...this.items];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q) || i.supplier?.toLowerCase().includes(q));
    }
    if (this.filterCategory) {
      result = result.filter(i => i.category === this.filterCategory);
    }
    if (this.filterLowStock) {
      result = result.filter(i => i.isLowStock);
    }
    this.filteredItems = result;
  }

  onSearch(): void {
    this.applyFilters();
  }

  // ── CRUD ──

  openAddForm(): void {
    this.editingItem = null;
    this.formData = {
      name: '', description: '', category: '',
      currentQuantity: 0, unit: 'Piece',
      minimumQuantity: 0, costPerUnit: 0,
      supplier: '', supplierContact: ''
    };
    this.showForm = true;
  }

  openEditForm(item: InventoryItem): void {
    this.editingItem = item;
    this.formData = {
      name: item.name,
      description: item.description || '',
      category: item.category || '',
      currentQuantity: item.currentQuantity,
      unit: item.unit,
      minimumQuantity: item.minimumQuantity,
      costPerUnit: item.costPerUnit,
      supplier: item.supplier || '',
      supplierContact: item.supplierContact || ''
    };
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingItem = null;
  }

  saveItem(): void {
    if (!this.formData.name.trim()) return;
    this.formSubmitting = true;

    if (this.editingItem) {
      this.inventoryService.updateItem(this.editingItem.id, {
        name: this.formData.name,
        description: this.formData.description || null,
        category: this.formData.category || null,
        unit: this.formData.unit,
        minimumQuantity: this.formData.minimumQuantity,
        costPerUnit: this.formData.costPerUnit,
        supplier: this.formData.supplier || null,
        supplierContact: this.formData.supplierContact || null
      }).subscribe({
        next: () => {
          this.formSubmitting = false;
          this.showForm = false;
          this.successMessage = 'Item updated!';
          this.loadAll();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: () => {
          this.formSubmitting = false;
          this.errorMessage = 'Failed to update item.';
          setTimeout(() => this.errorMessage = '', 3000);
        }
      });
    } else {
      this.inventoryService.createItem(this.formData).subscribe({
        next: () => {
          this.formSubmitting = false;
          this.showForm = false;
          this.successMessage = 'Item added!';
          this.loadAll();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: () => {
          this.formSubmitting = false;
          this.errorMessage = 'Failed to add item.';
          setTimeout(() => this.errorMessage = '', 3000);
        }
      });
    }
  }

  deleteItem(item: InventoryItem): void {
    if (!confirm(`Delete "${item.name}"?`)) return;
    this.inventoryService.deleteItem(item.id).subscribe({
      next: () => {
        this.successMessage = 'Item deleted.';
        this.loadAll();
        setTimeout(() => this.successMessage = '', 3000);
      }
    });
  }

  // ── Quantity Adjustment ──

  openAdjust(item: InventoryItem): void {
    this.adjustItem = item;
    this.adjustData = { quantity: 0, changeType: 'Restock', notes: '' };
    this.showAdjustDialog = true;
  }

  closeAdjust(): void {
    this.showAdjustDialog = false;
    this.adjustItem = null;
  }

  saveAdjust(): void {
    if (!this.adjustItem || this.adjustData.quantity <= 0) return;
    this.adjustSubmitting = true;
    this.inventoryService.adjustQuantity(this.adjustItem.id, this.adjustData).subscribe({
      next: () => {
        this.adjustSubmitting = false;
        this.showAdjustDialog = false;
        this.successMessage = 'Quantity adjusted!';
        this.loadAll();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: () => {
        this.adjustSubmitting = false;
        this.errorMessage = 'Failed to adjust quantity.';
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  // ── Tab switching ──

  switchTab(tab: 'items' | 'logs' | 'analytics'): void {
    this.activeTab = tab;
    if (tab === 'logs' && this.logs.length === 0) {
      this.loadLogs();
    }
    if (tab === 'analytics') {
      this.loadSummary();
    }
  }

  // ── Helpers ──

  getStockStatus(item: InventoryItem): string {
    if (item.currentQuantity <= 0) return 'out';
    if (item.isLowStock) return 'low';
    return 'ok';
  }

  getChangeTypeColor(type: string): string {
    switch (type) {
      case 'Restock': return '#27ae60';
      case 'Usage': return '#f39c12';
      case 'Wastage': return '#e74c3c';
      case 'Adjustment': return '#3498db';
      default: return '#888';
    }
  }

  getMaxCategoryValue(): number {
    if (!this.summary) return 1;
    return Math.max(...this.summary.categoryBreakdown.map(c => c.totalValue), 1);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
