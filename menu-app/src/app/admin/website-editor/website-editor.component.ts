import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { WebsiteService } from '../../services/website.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import {
  WebsiteContent,
  UpdateWebsiteContent,
  Specialty,
  GalleryImage,
  Testimonial,
  OperatingHour,
  SubdomainSuggestion,
  SubdomainResponse,
  CheckSubdomainResponse
} from '../../models/api.models';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-website-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './website-editor.component.html',
  styleUrl: './website-editor.component.scss'
})
export class WebsiteEditorComponent implements OnInit {
  content: WebsiteContent | null = null;
  loading = true;
  saving = false;
  successMessage = '';
  errorMessage = '';
  userName = '';
  sidebarCollapsed = false;
  activeTab = 'domain';

  // Editable fields bound to form
  heroTitle = '';
  heroSubtitle = '';
  heroImageUrl = '';
  heroCtaText = '';
  heroCtaLink = '';

  aboutTitle = '';
  aboutDescription = '';
  aboutImageUrl = '';
  chefName = '';
  chefImageUrl = '';
  chefQuote = '';

  specialties: Specialty[] = [];
  galleryImages: GalleryImage[] = [];
  testimonials: Testimonial[] = [];
  operatingHours: OperatingHour[] = [];

  primaryColor = '#e94560';
  secondaryColor = '#1a1a2e';
  accentColor = '#f39c12';
  fontFamily = 'Playfair Display';

  metaTitle = '';
  metaDescription = '';
  announcementText = '';
  showAnnouncement = false;
  isPublished = false;

  fontOptions = [
    'Playfair Display',
    'Poppins',
    'Montserrat',
    'Lora',
    'Merriweather',
    'Raleway',
    'Cormorant Garamond',
    'Cinzel'
  ];

  tabs = [
    { id: 'domain', label: '🔗 Domain', name: 'Domain' },
    { id: 'hero', label: '🖼️ Hero', name: 'Hero' },
    { id: 'about', label: '📖 About', name: 'About' },
    { id: 'specialties', label: '⭐ Specialties', name: 'Specialties' },
    { id: 'gallery', label: '📸 Gallery', name: 'Gallery' },
    { id: 'testimonials', label: '💬 Reviews', name: 'Reviews' },
    { id: 'hours', label: '🕐 Hours', name: 'Hours' },
    { id: 'theme', label: '🎨 Theme', name: 'Theme' },
    { id: 'seo', label: '🔍 SEO', name: 'SEO' }
  ];

  // Subdomain state
  subdomainInput = '';
  subdomainSuggestions: SubdomainSuggestion[] = [];
  subdomainCheckResult: CheckSubdomainResponse | null = null;
  currentSubdomain: SubdomainResponse | null = null;
  subdomainLoading = false;
  subdomainChecking = false;
  subdomainPublishing = false;
  subdomainMessage = '';
  subdomainError = '';
  private subdomainCheck$ = new Subject<string>();

  constructor(
    private websiteService: WebsiteService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService
  ) {
    this.authService.currentUser$.subscribe(u => this.userName = u?.fullName || '');
  }

  ngOnInit(): void {
    this.websiteService.getWebsiteContent().subscribe({
      next: (data) => {
        this.content = data;
        this.populateForm(data);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load website content.';
        this.loading = false;
      }
    });

    // Load subdomain info
    this.loadSubdomainInfo();

    // Debounced subdomain availability check
    this.subdomainCheck$.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(value => {
        if (!value || value.length < 3) {
          this.subdomainCheckResult = null;
          return of(null);
        }
        this.subdomainChecking = true;
        return this.websiteService.checkSubdomainAvailability(value);
      })
    ).subscribe({
      next: (result) => {
        this.subdomainCheckResult = result;
        this.subdomainChecking = false;
      },
      error: () => {
        this.subdomainChecking = false;
      }
    });
  }

  private populateForm(data: WebsiteContent): void {
    this.heroTitle = data.heroTitle || '';
    this.heroSubtitle = data.heroSubtitle || '';
    this.heroImageUrl = data.heroImageUrl || '';
    this.heroCtaText = data.heroCtaText || '';
    this.heroCtaLink = data.heroCtaLink || '';

    this.aboutTitle = data.aboutTitle || '';
    this.aboutDescription = data.aboutDescription || '';
    this.aboutImageUrl = data.aboutImageUrl || '';
    this.chefName = data.chefName || '';
    this.chefImageUrl = data.chefImageUrl || '';
    this.chefQuote = data.chefQuote || '';

    this.specialties = data.specialties?.length ? [...data.specialties] : [
      { title: '', description: '', icon: '🍽️' },
      { title: '', description: '', icon: '👨‍🍳' },
      { title: '', description: '', icon: '✨' }
    ];

    this.galleryImages = data.galleryImages?.length ? [...data.galleryImages] : [];
    this.testimonials = data.testimonials?.length ? [...data.testimonials] : [];
    this.operatingHours = data.operatingHours?.length ? [...data.operatingHours] : this.getDefaultHours();

    this.primaryColor = data.primaryColor || '#e94560';
    this.secondaryColor = data.secondaryColor || '#1a1a2e';
    this.accentColor = data.accentColor || '#f39c12';
    this.fontFamily = data.fontFamily || 'Playfair Display';

    this.metaTitle = data.metaTitle || '';
    this.metaDescription = data.metaDescription || '';
    this.announcementText = data.announcementText || '';
    this.showAnnouncement = data.showAnnouncement || false;
    this.isPublished = data.isPublished || false;
  }

  private getDefaultHours(): OperatingHour[] {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => ({
      day,
      openTime: '11:00 AM',
      closeTime: '10:00 PM',
      isClosed: false
    }));
  }

  // Gallery helpers
  addGalleryImage(): void {
    this.galleryImages.push({ url: '', caption: '' });
  }

  removeGalleryImage(index: number): void {
    this.galleryImages.splice(index, 1);
  }

  // Testimonial helpers
  addTestimonial(): void {
    this.testimonials.push({ name: '', text: '', rating: 5, avatarUrl: '' });
  }

  removeTestimonial(index: number): void {
    this.testimonials.splice(index, 1);
  }

  save(): void {
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    const payload: UpdateWebsiteContent = {
      heroTitle: this.heroTitle,
      heroSubtitle: this.heroSubtitle,
      heroImageUrl: this.heroImageUrl,
      heroCtaText: this.heroCtaText,
      heroCtaLink: this.heroCtaLink,
      aboutTitle: this.aboutTitle,
      aboutDescription: this.aboutDescription,
      aboutImageUrl: this.aboutImageUrl,
      chefName: this.chefName,
      chefImageUrl: this.chefImageUrl,
      chefQuote: this.chefQuote,
      specialties: this.specialties,
      galleryImages: this.galleryImages.filter(g => g.url),
      testimonials: this.testimonials.filter(t => t.name && t.text),
      operatingHours: this.operatingHours,
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
      accentColor: this.accentColor,
      fontFamily: this.fontFamily,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      announcementText: this.announcementText,
      showAnnouncement: this.showAnnouncement,
      isPublished: this.isPublished
    };

    this.websiteService.updateWebsiteContent(payload).subscribe({
      next: (data) => {
        this.content = data;
        this.populateForm(data);
        this.saving = false;
        this.successMessage = 'Website content saved successfully!';
        setTimeout(() => this.successMessage = '', 4000);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err.error?.message || 'Failed to save website content.';
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  togglePublish(): void {
    this.isPublished = !this.isPublished;
    this.save();
  }

  previewWebsite(): void {
    const tenantId = this.authService.getTenantId();
    if (tenantId) {
      window.open(`/website/${tenantId}`, '_blank');
    }
  }

  // ── Subdomain Methods ──

  loadSubdomainInfo(): void {
    this.subdomainLoading = true;
    this.websiteService.getCurrentSubdomain().subscribe({
      next: (res) => {
        this.currentSubdomain = res;
        if (res.subdomain) {
          this.subdomainInput = res.subdomain;
        }
        this.subdomainLoading = false;
        // Load suggestions after getting current state
        this.loadSuggestions();
      },
      error: () => {
        this.subdomainLoading = false;
        this.loadSuggestions();
      }
    });
  }

  loadSuggestions(): void {
    this.websiteService.getSubdomainSuggestions().subscribe({
      next: (res) => {
        this.subdomainSuggestions = res.suggestions;
      },
      error: () => {}
    });
  }

  onSubdomainInput(): void {
    const cleaned = this.subdomainInput.toLowerCase().replace(/[^a-z0-9-]/g, '');
    this.subdomainInput = cleaned;
    this.subdomainCheck$.next(cleaned);
  }

  selectSuggestion(suggestion: SubdomainSuggestion): void {
    if (suggestion.isAvailable) {
      this.subdomainInput = suggestion.subdomain;
      this.onSubdomainInput();
    }
  }

  publishSubdomain(): void {
    if (!this.subdomainInput || this.subdomainInput.length < 3) return;
    if (this.subdomainCheckResult && !this.subdomainCheckResult.isAvailable) return;

    this.subdomainPublishing = true;
    this.subdomainMessage = '';
    this.subdomainError = '';

    this.websiteService.claimSubdomain(this.subdomainInput).subscribe({
      next: (res) => {
        this.currentSubdomain = res;
        this.subdomainPublishing = false;
        this.subdomainMessage = res.message || 'Subdomain published successfully!';
        // Refresh suggestions availability
        this.loadSuggestions();
        setTimeout(() => this.subdomainMessage = '', 5000);
      },
      error: (err) => {
        this.subdomainPublishing = false;
        this.subdomainError = err.error?.message || 'Failed to publish subdomain.';
        setTimeout(() => this.subdomainError = '', 5000);
      }
    });
  }

  releaseSubdomain(): void {
    if (!this.currentSubdomain?.subdomain) return;

    this.subdomainPublishing = true;
    this.subdomainMessage = '';
    this.subdomainError = '';

    this.websiteService.releaseSubdomain().subscribe({
      next: (res) => {
        this.currentSubdomain = res;
        this.subdomainInput = '';
        this.subdomainCheckResult = null;
        this.subdomainPublishing = false;
        this.subdomainMessage = res.message || 'Subdomain released.';
        this.loadSuggestions();
        setTimeout(() => this.subdomainMessage = '', 5000);
      },
      error: (err) => {
        this.subdomainPublishing = false;
        this.subdomainError = err.error?.message || 'Failed to release subdomain.';
        setTimeout(() => this.subdomainError = '', 5000);
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
