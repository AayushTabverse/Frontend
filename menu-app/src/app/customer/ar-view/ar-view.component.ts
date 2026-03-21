import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-ar-view',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="ar-page">
      <header class="ar-header">
        <button class="back-btn" (click)="goBack()">← Back</button>
        <h1>{{ itemName }}</h1>
      </header>

      <div class="ar-container" *ngIf="modelUrl; else noModel">
        <!-- Loading indicator -->
        <div class="loading-overlay" *ngIf="loading">
          <div class="spinner"></div>
          <p>Loading 3D model...</p>
        </div>

        <!-- Error state -->
        <div class="error-state" *ngIf="loadError">
          <p>⚠️ Could not load 3D model.</p>
          <p class="error-detail">Check the model URL or try a different browser.</p>
          <a [href]="modelUrl" target="_blank" class="model-link">Open model file directly →</a>
        </div>

        <model-viewer
          #viewer
          [attr.src]="modelUrl"
          [attr.alt]="itemName"
          ar
          ar-modes="webxr scene-viewer quick-look"
          camera-controls
          touch-action="pan-y"
          auto-rotate
          shadow-intensity="1"
          environment-image="neutral"
          exposure="1"
          [style.display]="loadError ? 'none' : 'block'"
          style="width: 100%; height: 70vh; background: #f5f5f5; border-radius: 12px;">

          <button slot="ar-button" class="ar-cta-btn">
            📱 View in your space
          </button>
        </model-viewer>

        <div class="ar-instructions" *ngIf="!loading && !loadError">
          <p class="ar-hint">🖱️ Drag to rotate · Scroll to zoom · Pinch on mobile</p>
          <p class="ar-hint" *ngIf="isArSupported">📱 Tap <strong>"View in your space"</strong> to see it in AR!</p>
          <p class="ar-hint desktop-hint" *ngIf="!isArSupported">💡 Open this page on a mobile device for the full AR experience.</p>
        </div>
      </div>

      <ng-template #noModel>
        <div class="error-state">
          <p>No model URL provided.</p>
          <button class="back-link" (click)="goBack()">← Go back to menu</button>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .ar-page { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; min-height: 100vh; background: #fafafa; }
    .ar-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px; background: #1a1a2e; color: white;
      h1 { font-size: 1.1rem; margin: 0; }
      .back-btn { background: none; border: none; color: white; cursor: pointer; font-size: 1rem; padding: 4px 8px; }
    }
    .ar-container { padding: 16px; text-align: center; }

    .loading-overlay {
      padding: 40px; color: #666;
      .spinner {
        width: 40px; height: 40px; border: 4px solid #eee;
        border-top-color: #e94560; border-radius: 50%;
        animation: spin 0.8s linear infinite; margin: 0 auto 12px;
      }
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .error-state {
      padding: 40px 20px; color: #666; text-align: center;
      .error-detail { font-size: 0.85rem; color: #999; }
      .model-link {
        display: inline-block; margin-top: 12px; color: #e94560;
        font-weight: 600; text-decoration: none;
        &:hover { text-decoration: underline; }
      }
    }

    .ar-cta-btn {
      position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
      background: #e94560; color: white; border: none;
      padding: 10px 24px; border-radius: 24px;
      font-size: 0.95rem; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 12px rgba(233,69,96,0.4);
    }

    .ar-instructions { margin-top: 12px; }
    .ar-hint { color: #666; font-size: 0.85rem; margin: 4px 0; }
    .desktop-hint { color: #e94560; font-weight: 500; }

    .back-link {
      background: none; border: 1px solid #ddd; padding: 8px 20px;
      border-radius: 8px; cursor: pointer; color: #333; margin-top: 12px;
    }
  `]
})
export class ArViewComponent implements OnInit, AfterViewInit {
  modelUrl = '';
  itemName = '';
  loading = true;
  loadError = false;
  isArSupported = false;

  @ViewChild('viewer') viewerRef!: ElementRef;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.modelUrl = this.route.snapshot.queryParamMap.get('model') || '';
    this.itemName = this.route.snapshot.queryParamMap.get('name') || 'AR View';

    if (!this.modelUrl) {
      this.loading = false;
    }
  }

  ngAfterViewInit(): void {
    if (!this.modelUrl) return;

    // Give model-viewer time to initialize
    setTimeout(() => {
      const viewer = this.viewerRef?.nativeElement;
      if (!viewer) {
        this.loading = false;
        this.loadError = true;
        return;
      }

      // Listen for load/error events
      viewer.addEventListener('load', () => {
        this.loading = false;
        this.loadError = false;
      });

      viewer.addEventListener('error', () => {
        this.loading = false;
        this.loadError = true;
      });

      // Check AR support
      viewer.addEventListener('ar-status', (e: any) => {
        this.isArSupported = e.detail.status !== 'failed';
      });

      // If canActivateAR exists, use it
      if (typeof viewer.canActivateAR !== 'undefined') {
        this.isArSupported = viewer.canActivateAR;
      }

      // Fallback timeout — if nothing fires in 10s, hide loading
      setTimeout(() => {
        if (this.loading) {
          this.loading = false;
        }
      }, 10000);
    }, 500);
  }

  goBack(): void {
    history.back();
  }
}
