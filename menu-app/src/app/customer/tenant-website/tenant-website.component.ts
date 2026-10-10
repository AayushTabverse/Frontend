import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { WebsiteService } from '../../services/website.service';
import { WebsiteContent } from '../../models/api.models';
import { isTenantHost } from '../../shared/site-host';

@Component({
  selector: 'app-tenant-website',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tenant-website.component.html',
  styleUrl: './tenant-website.component.scss'
})
export class TenantWebsiteComponent implements OnInit {
  content: WebsiteContent | null = null;
  loading = true;
  error = '';
  /** The site exists but its owner hasn't published it. */
  notPublished = false;
  tenantId = '';
  navScrolled = false;
  mobileMenuOpen = false;
  activeSection = 'home';

  constructor(
    private route: ActivatedRoute,
    private websiteService: WebsiteService
  ) {}

  private isSubdomainAccess = false;

  ngOnInit(): void {
    // On a restaurant's own host (name.tabverse.in or its own domain) resolve the host;
    // on the main site fall back to /website/:tenantId
    if (isTenantHost()) {
      this.isSubdomainAccess = true;
      this.tenantId = window.location.hostname; // a host, resolved to the tenantId below
    } else {
      // Fallback to route param
      this.tenantId = this.route.snapshot.paramMap.get('tenantId') || '';
    }

    if (this.tenantId) {
      if (this.isSubdomainAccess) {
        // Resolve subdomain → tenantId, then load content
        this.websiteService.resolveHost(this.tenantId).subscribe({
          next: (result) => {
            this.tenantId = result.tenantId;
            this.loadContent();
          },
          error: () => {
            this.error = 'This restaurant website is not available.';
            this.loading = false;
          }
        });
      } else {
        this.loadContent();
      }
    } else {
      this.error = 'Restaurant not found.';
      this.loading = false;
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.navScrolled = window.scrollY > 60;
    this.detectActiveSection();
  }

  private detectActiveSection(): void {
    const sections = ['home', 'about', 'specialties', 'menu', 'gallery', 'testimonials', 'hours', 'contact'];
    for (const s of sections.reverse()) {
      const el = document.getElementById(s);
      if (el && el.getBoundingClientRect().top <= 120) {
        this.activeSection = s;
        break;
      }
    }
  }

  loadContent(): void {
    this.websiteService.getPublicWebsiteContent(this.tenantId).subscribe({
      next: (data) => {
        this.content = data;
        this.loading = false;
        // Apply theme colors as CSS variables
        setTimeout(() => this.applyTheme(), 0);
      },
      error: (err) => {
        this.notPublished = err.status === 404 && (err.error?.errors ?? []).includes('not_published');
        this.error = this.notPublished
          ? "This restaurant's website isn't published yet. Please check back soon."
          : 'This restaurant website is not available.';
        this.loading = false;
      }
    });
  }

  private applyTheme(): void {
    if (!this.content) return;
    const root = document.documentElement;
    if (this.content.primaryColor) root.style.setProperty('--tw-primary', this.content.primaryColor);
    if (this.content.secondaryColor) root.style.setProperty('--tw-secondary', this.content.secondaryColor);
    if (this.content.accentColor) root.style.setProperty('--tw-accent', this.content.accentColor);
    if (this.content.fontFamily) root.style.setProperty('--tw-font', `'${this.content.fontFamily}', serif`);
  }

  scrollTo(sectionId: string): void {
    this.mobileMenuOpen = false;
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  getStarArray(rating: number): number[] {
    return Array(Math.min(rating, 5)).fill(0);
  }

  getEmptyStarArray(rating: number): number[] {
    return Array(Math.max(5 - rating, 0)).fill(0);
  }
}
