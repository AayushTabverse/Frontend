import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, OnDestroy {
  scrolled = false;
  activeFeature = 0;
  currentYear = new Date().getFullYear();
  activePolicy: string | null = null;

  private featureInterval: any;

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled = window.scrollY > 50;
  }

  ngOnInit(): void {
    this.featureInterval = setInterval(() => {
      this.activeFeature = (this.activeFeature + 1) % 9;
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.featureInterval) clearInterval(this.featureInterval);
  }

  selectFeature(index: number): void {
    this.activeFeature = index;
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  openPolicy(type: string): void {
    this.activePolicy = type;
    document.body.style.overflow = 'hidden';
  }

  closePolicy(): void {
    this.activePolicy = null;
    document.body.style.overflow = '';
  }

  getPolicyTitle(): string {
    switch (this.activePolicy) {
      case 'privacy': return 'Privacy Policy';
      case 'terms': return 'Terms of Service';
      case 'cookies': return 'Cookie Policy';
      default: return '';
    }
  }
}
