import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../services/ai.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { SettingsService } from '../../services/settings.service';
import {
  GeneratedPost,
  MarketingPost,
  PaginatedPostsResponse,
  ContentCalendarItem,
  SocialConnection
} from '../../models/api.models';

@Component({
  selector: 'app-ai-marketing',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './ai-marketing.component.html',
  styleUrl: './ai-marketing.component.scss'
})
export class AiMarketingComponent implements OnInit {
  // Sidebar
  sidebarCollapsed = false;
  mobileSidebarOpen = false;
  userName = '';
  logoUrl = '';

  // Tabs
  activeTab: 'generate' | 'calendar' | 'history' | 'connections' = 'generate';

  // Generator
  contentType = 'social';
  platform = 'both';
  customPrompt = '';
  generating = false;
  generatedPost?: GeneratedPost;
  editMode = false;
  editedText = '';
  editedCaption = '';
  scheduleDate = '';
  approving = false;

  // History
  postHistory?: PaginatedPostsResponse;
  historyPage = 1;
  historyFilter = '';
  historyLoading = false;

  // Calendar
  calendarItems: ContentCalendarItem[] = [];
  calendarMonth: number;
  calendarYear: number;
  calendarLoading = false;
  calendarDays: { date: number; posts: MarketingPost[]; isCurrentMonth: boolean }[] = [];

  // Connections
  connections: SocialConnection[] = [];
  connectionsLoading = false;
  connectingPlatform = '';
  publishingPostId = '';

  constructor(
    private aiService: AiService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    public themeService: ThemeService,
    private settingsService: SettingsService
  ) {
    const now = new Date();
    this.calendarMonth = now.getMonth() + 1;
    this.calendarYear = now.getFullYear();
    this.authService.currentUser$.subscribe(u => this.userName = u?.fullName || '');
  }

  ngOnInit(): void {
    this.settingsService.getSettings().subscribe({
      next: (s) => this.logoUrl = s.logoUrl || ''
    });
    this.loadHistory();

    // Handle OAuth callback from popup
    this.route.queryParams.subscribe(params => {
      const oauth = params['oauth'];
      const code = params['code'];
      if (oauth && code) {
        this.handleOAuthCallback(oauth, code);
      }
    });
  }

  // ── Generate ──
  generate(): void {
    this.generating = true;
    this.generatedPost = undefined;
    this.aiService.generatePost({
      contentType: this.contentType,
      platform: this.platform,
      customPrompt: this.customPrompt || undefined
    }).subscribe({
      next: (post) => {
        this.generatedPost = post;
        this.editedText = post.contentText;
        this.editedCaption = post.suggestedCaption;
        this.generating = false;
      },
      error: () => this.generating = false
    });
  }

  approve(): void {
    if (!this.generatedPost) return;
    this.approving = true;
    this.aiService.approvePost(this.generatedPost.id, {
      editedText: this.editMode ? this.editedText : undefined,
      editedCaption: this.editMode ? this.editedCaption : undefined,
      scheduledAt: this.scheduleDate || undefined
    }).subscribe({
      next: () => {
        this.approving = false;
        this.generatedPost = undefined;
        this.editMode = false;
        this.loadHistory();
      },
      error: () => this.approving = false
    });
  }

  reject(): void {
    if (!this.generatedPost) return;
    this.aiService.rejectPost(this.generatedPost.id).subscribe({
      next: () => {
        this.generatedPost = undefined;
        this.editMode = false;
      }
    });
  }

  regenerate(): void {
    if (this.generatedPost) {
      this.reject();
    }
    this.generate();
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
  }

  // ── History ──
  loadHistory(): void {
    this.historyLoading = true;
    this.aiService.getPostHistory(this.historyPage, 10, this.historyFilter || undefined).subscribe({
      next: (data) => {
        this.postHistory = data;
        this.historyLoading = false;
      },
      error: () => this.historyLoading = false
    });
  }

  historyPageChange(page: number): void {
    this.historyPage = page;
    this.loadHistory();
  }

  filterHistory(status: string): void {
    this.historyFilter = status;
    this.historyPage = 1;
    this.loadHistory();
  }

  // ── Calendar ──
  loadCalendar(): void {
    this.calendarLoading = true;
    this.aiService.getContentCalendar(this.calendarMonth, this.calendarYear).subscribe({
      next: (items) => {
        this.calendarItems = items;
        this.buildCalendarGrid();
        this.calendarLoading = false;
      },
      error: () => this.calendarLoading = false
    });
  }

  prevMonth(): void {
    this.calendarMonth--;
    if (this.calendarMonth < 1) { this.calendarMonth = 12; this.calendarYear--; }
    this.loadCalendar();
  }

  nextMonth(): void {
    this.calendarMonth++;
    if (this.calendarMonth > 12) { this.calendarMonth = 1; this.calendarYear++; }
    this.loadCalendar();
  }

  buildCalendarGrid(): void {
    const firstDay = new Date(this.calendarYear, this.calendarMonth - 1, 1);
    const lastDay = new Date(this.calendarYear, this.calendarMonth, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    this.calendarDays = [];

    // Fill empty days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      this.calendarDays.push({ date: 0, posts: [], isCurrentMonth: false });
    }

    // Fill month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${this.calendarYear}-${String(this.calendarMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayItem = this.calendarItems.find(ci => ci.date.startsWith(dateStr));
      this.calendarDays.push({
        date: d,
        posts: dayItem?.posts || [],
        isCurrentMonth: true
      });
    }
  }

  getMonthName(): string {
    return new Date(this.calendarYear, this.calendarMonth - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });
  }

  // ── Connections ──
  loadConnections(): void {
    this.connectionsLoading = true;
    this.aiService.getSocialConnections().subscribe({
      next: (conns) => {
        this.connections = conns;
        this.connectionsLoading = false;
      },
      error: () => this.connectionsLoading = false
    });
  }

  connectPlatform(platform: string): void {
    this.connectingPlatform = platform;
    const getUrl$ = platform === 'google'
      ? this.aiService.getGoogleAuthUrl()
      : this.aiService.getFacebookAuthUrl();

    getUrl$.subscribe({
      next: (authUrl) => {
        // Open OAuth popup
        const popup = window.open(authUrl, `${platform}_oauth`, 'width=600,height=700,scrollbars=yes');

        // Poll for popup redirect back to our app with the code
        const interval = setInterval(() => {
          try {
            if (!popup || popup.closed) {
              clearInterval(interval);
              this.connectingPlatform = '';
              return;
            }
            const popupUrl = popup.location.href;
            if (popupUrl.includes('code=')) {
              clearInterval(interval);
              const url = new URL(popupUrl);
              const code = url.searchParams.get('code');
              popup.close();
              if (code) {
                this.handleOAuthCallback(platform, code);
              } else {
                this.connectingPlatform = '';
              }
            }
          } catch {
            // Cross-origin — popup hasn't redirected back yet, keep polling
          }
        }, 500);
      },
      error: () => this.connectingPlatform = ''
    });
  }

  handleOAuthCallback(platform: string, code: string): void {
    this.connectingPlatform = platform;
    const callback$ = platform === 'google'
      ? this.aiService.googleCallback(code)
      : this.aiService.facebookCallback(code);

    callback$.subscribe({
      next: () => {
        this.connectingPlatform = '';
        this.loadConnections();
        // Clean URL query params
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      },
      error: () => {
        this.connectingPlatform = '';
        alert(`Failed to connect ${platform}. Please try again.`);
      }
    });
  }

  publishPost(postId: string): void {
    this.publishingPostId = postId;
    this.aiService.publishPost(postId).subscribe({
      next: (result) => {
        this.publishingPostId = '';
        if (result.success) {
          this.loadHistory();
        } else {
          alert(`Publish failed: ${result.error}`);
        }
      },
      error: () => {
        this.publishingPostId = '';
        alert('Failed to publish post.');
      }
    });
  }

  disconnectPlatform(platform: string): void {
    if (!confirm(`Disconnect ${platform}?`)) return;
    this.aiService.disconnectSocial(platform).subscribe({
      next: () => this.loadConnections()
    });
  }

  // ── Tab Switch ──
  switchTab(tab: 'generate' | 'calendar' | 'history' | 'connections'): void {
    this.activeTab = tab;
    if (tab === 'calendar') this.loadCalendar();
    if (tab === 'connections') this.loadConnections();
    if (tab === 'history') this.loadHistory();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Draft': return 'badge-draft';
      case 'Approved': return 'badge-approved';
      case 'Scheduled': return 'badge-scheduled';
      case 'Posted': return 'badge-posted';
      case 'Rejected': return 'badge-rejected';
      case 'Failed': return 'badge-failed';
      default: return '';
    }
  }

  getPlatformIcon(platform: string): string {
    switch (platform) {
      case 'instagram': return '📸';
      case 'facebook': return '📘';
      case 'google': return '🔍';
      default: return '📱';
    }
  }

  getContentTypeLabel(type: string): string {
    switch (type) {
      case 'social': return 'Social Post';
      case 'festival': return 'Festival Promo';
      case 'menu-highlight': return 'Menu Highlight';
      case 'testimonial': return 'Testimonial';
      case 'weekly-special': return 'Weekly Special';
      default: return type;
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
