import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { WebsiteService } from '../../services/website.service';
import { AuthService } from '../../services/auth.service';
import { UploadService } from '../../services/upload.service';
import {
  WebsiteContent,
  UpdateWebsiteContent,
  Specialty,
  GalleryImage,
  Testimonial,
  OperatingHour,
  SubdomainSuggestion,
  SubdomainResponse,
  CheckSubdomainResponse,
  WebsiteStatus,
  CustomDomainStatus,
  DnsRecordInstruction
} from '../../models/api.models';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-website-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './website-editor.component.html',
  styleUrl: './website-editor.component.scss'
})
export class WebsiteEditorComponent implements OnInit, OnDestroy {
  content: WebsiteContent | null = null;
  loading = true;
  saving = false;
  successMessage = '';
  errorMessage = '';
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

  // Website status (what visitors can see right now, and why not yet)
  status: WebsiteStatus | null = null;
  statusChecking = false;
  linkCopied = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollCount = 0;
  private static readonly POLL_MS = 20_000;
  private static readonly MAX_POLLS = 45; // ~15 minutes, then the owner can press "Check now"

  // Bring-your-own domain
  customDomain: CustomDomainStatus | null = null;
  customDomainInput = '';
  customDomainEditing = false;
  customDomainBusy = false;
  customDomainChecking = false;
  customDomainError = '';
  copiedKey = '';
  private cdPollTimer: ReturnType<typeof setTimeout> | null = null;
  private cdPollCount = 0;
  private static readonly CD_POLL_MS = 30_000;
  private static readonly CD_MAX_POLLS = 60; // ~30 minutes
  uploading: { [key: string]: boolean } = {};

  constructor(
    private websiteService: WebsiteService,
    private authService: AuthService,
    private uploadService: UploadService
  ) {}

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

    // Load subdomain info and the website's live status
    this.loadSubdomainInfo();
    this.loadStatus();
    this.loadCustomDomain();

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

  save(refreshStatus = false): void {
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
        this.successMessage = refreshStatus
          ? (this.isPublished ? 'Website published.' : 'Website unpublished — visitors now see "Coming soon".')
          : 'Website content saved successfully!';
        setTimeout(() => this.successMessage = '', 4000);
        if (refreshStatus) this.loadStatus(true);
      },
      error: (err) => {
        this.saving = false;
        if (refreshStatus) this.isPublished = !this.isPublished; // revert the toggle
        this.errorMessage = err.error?.message || 'Failed to save website content.';
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  togglePublish(): void {
    this.isPublished = !this.isPublished;
    this.save(true);
  }

  // ── Website status ──

  loadStatus(refresh = false): void {
    this.statusChecking = true;
    this.websiteService.getWebsiteStatus(refresh).subscribe({
      next: (s) => this.applyStatus(s),
      error: () => this.statusChecking = false
    });
  }

  /** Manual "Check now": restarts automatic re-checking too. */
  checkNow(): void {
    this.pollCount = 0;
    this.loadStatus(true);
  }

  private applyStatus(s: WebsiteStatus): void {
    this.status = s;
    this.statusChecking = false;
    this.isPublished = s.isPublished;
    this.schedulePoll();
  }

  private schedulePoll(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    if (!this.status?.shouldRecheck || this.pollCount >= WebsiteEditorComponent.MAX_POLLS) return;
    this.pollTimer = setTimeout(() => {
      this.pollCount++;
      this.loadStatus(true);
    }, WebsiteEditorComponent.POLL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.cdPollTimer) clearTimeout(this.cdPollTimer);
  }

  // ── Bring-your-own domain ──

  loadCustomDomain(refresh = false): void {
    this.customDomainChecking = true;
    this.websiteService.getCustomDomainStatus(refresh).subscribe({
      next: (s) => this.applyCustomDomain(s),
      error: () => this.customDomainChecking = false
    });
  }

  connectCustomDomain(): void {
    const domain = this.customDomainInput.trim();
    if (!domain) return;
    this.customDomainBusy = true;
    this.customDomainError = '';
    this.websiteService.connectCustomDomain(domain).subscribe({
      next: (s) => {
        this.customDomainBusy = false;
        this.customDomainEditing = false;
        this.cdPollCount = 0;
        this.applyCustomDomain(s);
      },
      error: (err) => {
        this.customDomainBusy = false;
        this.customDomainError = err.error?.message || 'Could not connect this domain.';
      }
    });
  }

  removeCustomDomain(): void {
    if (!this.customDomain?.domain) return;
    if (!confirm(`Disconnect ${this.customDomain.domain}? Visitors using it won't reach your website any more.`)) return;
    this.customDomainBusy = true;
    this.websiteService.removeCustomDomain().subscribe({
      next: () => {
        this.customDomainBusy = false;
        this.customDomainInput = '';
        this.loadCustomDomain(true);
      },
      error: (err) => {
        this.customDomainBusy = false;
        this.customDomainError = err.error?.message || 'Could not disconnect the domain.';
      }
    });
  }

  checkCustomDomainNow(): void {
    this.cdPollCount = 0;
    this.loadCustomDomain(true);
  }

  startChangeCustomDomain(): void {
    this.customDomainEditing = true;
    this.customDomainInput = this.customDomain?.domain ?? '';
    this.customDomainError = '';
  }

  private applyCustomDomain(s: CustomDomainStatus): void {
    this.customDomain = s;
    this.customDomainChecking = false;
    if (this.cdPollTimer) clearTimeout(this.cdPollTimer);
    this.cdPollTimer = null;
    if (s.shouldRecheck && this.cdPollCount < WebsiteEditorComponent.CD_MAX_POLLS) {
      this.cdPollTimer = setTimeout(() => {
        this.cdPollCount++;
        this.loadCustomDomain(true);
      }, WebsiteEditorComponent.CD_POLL_MS);
    }
  }

  copy(text: string, key: string): void {
    navigator.clipboard?.writeText(text).then(() => {
      this.copiedKey = key;
      setTimeout(() => { if (this.copiedKey === key) this.copiedKey = ''; }, 1500);
    });
  }

  customDomainTone(): 'ok' | 'wait' | 'bad' | 'idle' {
    switch (this.customDomain?.state) {
      case 'live': return 'ok';
      case 'activating': return 'wait';
      case 'dns_pending': return this.customDomain.records.some(r => r.status === 'wrong') ? 'bad' : 'wait';
      default: return 'idle';
    }
  }

  recordPurpose(r: DnsRecordInstruction): string {
    return r.purpose === 'ownership' ? 'Proves you own the domain'
      : r.purpose === 'pointing' ? 'Sends visitors to your Tabverse website'
      : 'Lets our hosting accept your domain';
  }

  retryDns(): void {
    this.subdomainPublishing = true;
    this.subdomainError = '';
    this.websiteService.retryDns().subscribe({
      next: (s) => {
        this.subdomainPublishing = false;
        this.pollCount = 0;
        this.applyStatus(s);
      },
      error: (err) => {
        this.subdomainPublishing = false;
        this.subdomainError = err.error?.message || 'Retry failed. Please try again.';
      }
    });
  }

  copyLink(): void {
    if (!this.status?.url) return;
    navigator.clipboard?.writeText(this.status.url).then(() => {
      this.linkCopied = true;
      setTimeout(() => this.linkCopied = false, 2000);
    });
  }

  /** True when the address typed differs from the one already reserved. */
  get subdomainChanged(): boolean {
    return !!this.subdomainInput && this.subdomainInput !== (this.status?.subdomain ?? '');
  }

  get publishLabel(): string {
    if (!this.status?.subdomain) return '🚀 Publish website';
    if (this.subdomainChanged) return '🔁 Switch to this address';
    return this.status.isPublished ? '🔄 Publish again' : '🚀 Publish website';
  }

  statusTone(): 'ok' | 'wait' | 'bad' | 'idle' {
    switch (this.status?.state) {
      case 'live': return 'ok';
      case 'connecting':
      case 'unreachable':
      case 'published_no_domain': return 'wait';
      case 'dns_failed':
      case 'dns_not_configured': return 'bad';
      default: return 'idle';
    }
  }

  statusIcon(): string {
    return { ok: '🟢', wait: '🟡', bad: '🔴', idle: '⚪' }[this.statusTone()];
  }

  stepIcon(status: string): string {
    return status === 'done' ? '✅' : status === 'pending' ? '⏳' : status === 'failed' ? '❌' : '◻️';
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

  /** Reserve the chosen address (setting up DNS) and publish the website in one step. */
  publishSubdomain(): void {
    if (!this.subdomainInput || this.subdomainInput.length < 3) return;
    if (this.subdomainCheckResult && !this.subdomainCheckResult.isAvailable) return;

    this.subdomainPublishing = true;
    this.subdomainMessage = '';
    this.subdomainError = '';

    this.websiteService.publishWebsite(this.subdomainInput).subscribe({
      next: (s) => {
        this.subdomainPublishing = false;
        this.pollCount = 0;
        this.applyStatus(s);
        this.loadSubdomainInfo();
      },
      error: (err) => {
        this.subdomainPublishing = false;
        this.subdomainError = err.error?.message || 'Failed to publish. Please try again.';
      }
    });
  }

  releaseSubdomain(): void {
    if (!this.currentSubdomain?.subdomain) return;
    if (!confirm(`Remove ${this.currentSubdomain.fullDomain}? People using this link won't reach your website, and someone else could take the name.`)) return;

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
        this.loadStatus(true);
        setTimeout(() => this.subdomainMessage = '', 5000);
      },
      error: (err) => {
        this.subdomainPublishing = false;
        this.subdomainError = err.error?.message || 'Failed to release subdomain.';
        setTimeout(() => this.subdomainError = '', 5000);
      }
    });
  }

  onFileSelected(event: Event, target: string, index?: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading[target] = true;
    this.uploadService.uploadImage(file, 'website').subscribe({
      next: (url) => {
        if (target === 'hero') this.heroImageUrl = url;
        else if (target === 'about') this.aboutImageUrl = url;
        else if (target === 'chef') this.chefImageUrl = url;
        else if (target === 'gallery' && index !== undefined) this.galleryImages[index].url = url;
        else if (target === 'testimonial' && index !== undefined) this.testimonials[index].avatarUrl = url;
        this.uploading[target] = false;
      },
      error: () => {
        this.errorMessage = 'Failed to upload image. Please try again.';
        this.uploading[target] = false;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }
}
