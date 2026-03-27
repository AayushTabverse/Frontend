import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReviewService } from '../../services/review.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { SettingsService } from '../../services/settings.service';
import {
  GoogleReview,
  PaginatedReviewsResponse,
  ReviewAnalytics
} from '../../models/api.models';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.scss'
})
export class ReviewsComponent implements OnInit {
  // Sidebar
  sidebarCollapsed = false;
  mobileSidebarOpen = false;
  userName = '';
  logoUrl = '';

  // Tabs
  activeTab: 'reviews' | 'analytics' = 'reviews';

  // Reviews List
  reviewsData?: PaginatedReviewsResponse;
  reviewPage = 1;
  sentimentFilter = '';
  reviewsLoading = false;

  // Reply
  activeReplyId: string | null = null;
  generatingReply = false;
  generatedReply = '';
  editedReply = '';
  postingReply = false;

  // Analytics
  analytics?: ReviewAnalytics;
  analyticsLoading = false;

  constructor(
    private reviewService: ReviewService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService,
    private settingsService: SettingsService
  ) {
    this.authService.currentUser$.subscribe(u => this.userName = u?.fullName || '');
  }

  ngOnInit(): void {
    this.settingsService.getSettings().subscribe({
      next: (s) => this.logoUrl = s.logoUrl || ''
    });
    this.loadReviews();
    this.loadAnalytics();
  }

  // ── Reviews ──
  loadReviews(): void {
    this.reviewsLoading = true;
    this.reviewService.getReviews(this.reviewPage, 15, this.sentimentFilter || undefined).subscribe({
      next: (data) => {
        this.reviewsData = data;
        this.reviewsLoading = false;
      },
      error: () => this.reviewsLoading = false
    });
  }

  filterBySentiment(sentiment: string): void {
    this.sentimentFilter = sentiment;
    this.reviewPage = 1;
    this.loadReviews();
  }

  pageChange(page: number): void {
    this.reviewPage = page;
    this.loadReviews();
  }

  // ── Reply ──
  openReply(review: GoogleReview): void {
    this.activeReplyId = review.id;
    this.generatedReply = '';
    this.editedReply = review.replyText || '';
  }

  cancelReply(): void {
    this.activeReplyId = null;
    this.generatedReply = '';
    this.editedReply = '';
  }

  generateReply(reviewId: string): void {
    this.generatingReply = true;
    this.reviewService.generateReply(reviewId).subscribe({
      next: (reply) => {
        this.generatedReply = reply;
        this.editedReply = reply;
        this.generatingReply = false;
      },
      error: () => this.generatingReply = false
    });
  }

  postReply(reviewId: string): void {
    if (!this.editedReply.trim()) return;
    this.postingReply = true;
    this.reviewService.postReply(reviewId, this.editedReply).subscribe({
      next: (updated) => {
        // Update the review in the list
        if (this.reviewsData) {
          const idx = this.reviewsData.reviews.findIndex(r => r.id === reviewId);
          if (idx >= 0) this.reviewsData.reviews[idx] = updated;
        }
        this.activeReplyId = null;
        this.postingReply = false;
      },
      error: () => this.postingReply = false
    });
  }

  // ── Analytics ──
  loadAnalytics(): void {
    this.analyticsLoading = true;
    this.reviewService.getReviewAnalytics().subscribe({
      next: (data) => {
        this.analytics = data;
        this.analyticsLoading = false;
      },
      error: () => this.analyticsLoading = false
    });
  }

  // ── Helpers ──
  getStars(rating: number): string {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  getSentimentIcon(sentiment: string | undefined): string {
    switch (sentiment) {
      case 'Positive': return '😊';
      case 'Neutral': return '😐';
      case 'Negative': return '😞';
      default: return '❓';
    }
  }

  getSentimentClass(sentiment: string | undefined): string {
    switch (sentiment) {
      case 'Positive': return 'sentiment-positive';
      case 'Neutral': return 'sentiment-neutral';
      case 'Negative': return 'sentiment-negative';
      default: return '';
    }
  }

  getRatingBarWidth(rating: number): number {
    if (!this.analytics || this.analytics.totalReviews === 0) return 0;
    return ((this.analytics.ratingDistribution[rating] || 0) / this.analytics.totalReviews) * 100;
  }

  switchTab(tab: 'reviews' | 'analytics'): void {
    this.activeTab = tab;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
