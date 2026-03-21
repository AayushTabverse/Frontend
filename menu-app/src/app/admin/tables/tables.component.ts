import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { TableService } from '../../services/table.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { SettingsService } from '../../services/settings.service';
import { TableResponse } from '../../models/api.models';

@Component({
  selector: 'app-tables',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './tables.component.html',
  styleUrl: './tables.component.scss'
})
export class TablesComponent implements OnInit {
  tables: TableResponse[] = [];
  loading = true;
  showForm = false;
  formData = { tableNumber: '', label: '', capacity: 4 };
  sidebarCollapsed = false;

  // QR Dialog
  showQrDialog = false;
  selectedTable: TableResponse | null = null;
  qrImageUrl = '';
  qrLoading = false;
  restaurantName = '';
  restaurantLogo = '';

  constructor(
    private tableService: TableService,
    private authService: AuthService,
    private settingsService: SettingsService,
    private router: Router,
    public themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.loadTables();
    this.loadRestaurantInfo();
  }

  loadTables(): void {
    this.tableService.getTables().subscribe({
      next: (tables) => { this.tables = tables; this.loading = false; },
      error: () => this.loading = false
    });
  }

  loadRestaurantInfo(): void {
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.restaurantName = s.name || 'My Restaurant';
        this.restaurantLogo = s.logoUrl || '';
      }
    });
  }

  addTable(): void {
    this.tableService.createTable(this.formData).subscribe({
      next: () => {
        this.showForm = false;
        this.formData = { tableNumber: '', label: '', capacity: 4 };
        this.loadTables();
      }
    });
  }

  deleteTable(id: string): void {
    if (confirm('Delete this table?')) {
      this.tableService.deleteTable(id).subscribe(() => this.loadTables());
    }
  }

  getQrUrl(id: string): string {
    return this.tableService.getQrCode(id);
  }

  openQrDialog(table: TableResponse): void {
    this.selectedTable = table;
    this.showQrDialog = true;
    this.qrLoading = true;
    this.qrImageUrl = '';

    this.tableService.getQrCodeBlob(table.id).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.qrImageUrl = reader.result as string;
          this.qrLoading = false;
        };
        reader.readAsDataURL(blob);
      },
      error: () => {
        this.qrLoading = false;
      }
    });
  }

  closeQrDialog(): void {
    this.showQrDialog = false;
    this.selectedTable = null;
    this.qrImageUrl = '';
  }

  downloadQrTemplate(): void {
    if (!this.selectedTable || !this.qrImageUrl) return;

    const canvas = document.createElement('canvas');
    const w = 900, h = 1200;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Decorative top band
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#e94560');
    grad.addColorStop(1, '#0f3460');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, 8);
    ctx.fillRect(0, h - 8, w, 8);

    // Inner border
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    this.roundRect(ctx, 30, 30, w - 60, h - 60, 20);
    ctx.stroke();

    // Corner accents
    ctx.fillStyle = '#e94560';
    ctx.beginPath(); ctx.arc(60, 60, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w - 60, 60, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(60, h - 60, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w - 60, h - 60, 8, 0, Math.PI * 2); ctx.fill();

    // Restaurant name
    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 48px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.restaurantName, w / 2, 120);

    // Divider line
    const divGrad = ctx.createLinearGradient(150, 0, w - 150, 0);
    divGrad.addColorStop(0, 'transparent');
    divGrad.addColorStop(0.3, '#e94560');
    divGrad.addColorStop(0.7, '#e94560');
    divGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(150, 145); ctx.lineTo(w - 150, 145); ctx.stroke();

    // Table number
    ctx.font = '600 32px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#0f3460';
    ctx.fillText(`Table ${this.selectedTable.tableNumber}`, w / 2, 195);

    // Table label if present
    let qrY = 230;
    if (this.selectedTable.label) {
      ctx.font = '24px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(this.selectedTable.label, w / 2, 230);
      qrY = 260;
    }

    // QR code background circle
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.arc(w / 2, qrY + 240, 230, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Load & draw QR image
    const qrImg = new Image();
    qrImg.onload = () => {
      const qrSize = 360;
      ctx.drawImage(qrImg, (w - qrSize) / 2, qrY + 60, qrSize, qrSize);

      // "Scan to Order" text
      const textY = qrY + 460 + 40;
      ctx.font = 'bold 40px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#1a1a2e';
      ctx.fillText('Scan to Order', w / 2, textY);

      // Subtitle
      ctx.font = '22px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#888888';
      ctx.fillText('Point your phone camera at the QR code', w / 2, textY + 40);
      ctx.fillText('to view our menu and place your order', w / 2, textY + 70);

      // Steps
      const stepsY = textY + 130;
      const steps = ['📱 Open Camera', '📷 Scan QR Code', '🍽️ Browse & Order'];
      ctx.font = '600 22px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#0f3460';
      steps.forEach((step, i) => {
        const stepX = w / 2 - 250 + i * 250;
        ctx.fillText(step, stepX, stepsY);
      });

      // Bottom divider
      ctx.strokeStyle = divGrad;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(150, h - 120); ctx.lineTo(w - 150, h - 120); ctx.stroke();

      // Brand footer
      ctx.font = '18px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('Powered by', w / 2, h - 85);
      ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
      const brandGrad = ctx.createLinearGradient(w / 2 - 80, 0, w / 2 + 80, 0);
      brandGrad.addColorStop(0, '#e94560');
      brandGrad.addColorStop(1, '#0f3460');
      ctx.fillStyle = brandGrad;
      ctx.fillText('TabVerse', w / 2, h - 52);

      // Download
      const link = document.createElement('a');
      link.download = `QR-Table-${this.selectedTable!.tableNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    qrImg.src = this.qrImageUrl;
  }

  printQrTemplate(): void {
    const printArea = document.getElementById('qr-print-area');
    if (!printArea) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html><head><title>QR - Table ${this.selectedTable?.tableNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; font-family: 'Segoe UI', Arial, sans-serif; }
        .print-template { width: 500px; padding: 40px; border: 3px solid #e0e0e0; border-radius: 20px; text-align: center; position: relative; overflow: hidden; }
        .print-template::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #e94560, #0f3460); }
        .print-template::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #e94560, #0f3460); }
        .restaurant-name { font-size: 28px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
        .divider { height: 2px; background: linear-gradient(90deg, transparent, #e94560, transparent); margin: 12px 40px; }
        .table-num { font-size: 22px; font-weight: 600; color: #0f3460; margin-bottom: 4px; }
        .table-label { font-size: 16px; color: #888; margin-bottom: 16px; }
        .qr-frame { display: inline-block; padding: 20px; background: #f8f9fa; border-radius: 50%; border: 3px solid #e94560; margin: 16px 0; }
        .qr-frame img { width: 240px; height: 240px; }
        .scan-title { font-size: 26px; font-weight: 700; color: #1a1a2e; margin-top: 16px; }
        .scan-sub { font-size: 14px; color: #888; margin-top: 6px; line-height: 1.5; }
        .steps { display: flex; justify-content: center; gap: 24px; margin-top: 20px; font-size: 14px; font-weight: 600; color: #0f3460; }
        .brand-footer { margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px; }
        .powered { font-size: 12px; color: #aaa; }
        .brand-name { font-size: 20px; font-weight: 700; background: linear-gradient(90deg, #e94560, #0f3460); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      </style></head><body>
      ${printArea.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); printWindow.close(); };
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
