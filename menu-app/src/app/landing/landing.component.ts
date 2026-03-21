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

  stats = [
    { value: 0, target: 500, suffix: '+', label: 'Restaurants' },
    { value: 0, target: 1, suffix: 'M+', label: 'Orders Served' },
    { value: 0, target: 99.9, suffix: '%', label: 'Uptime' },
    { value: 0, target: 4.9, suffix: '★', label: 'Rating' }
  ];

  private featureInterval: any;
  private statsAnimated = false;

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled = window.scrollY > 50;

    if (!this.statsAnimated) {
      const statsSection = document.querySelector('.stats-section');
      if (statsSection) {
        const rect = statsSection.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.8) {
          this.animateStats();
          this.statsAnimated = true;
        }
      }
    }
  }

  ngOnInit(): void {
    this.featureInterval = setInterval(() => {
      this.activeFeature = (this.activeFeature + 1) % 6;
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.featureInterval) clearInterval(this.featureInterval);
  }

  animateStats(): void {
    this.stats.forEach((stat, i) => {
      const duration = 2000;
      const steps = 60;
      const increment = stat.target / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= stat.target) {
          current = stat.target;
          clearInterval(timer);
        }
        this.stats[i] = { ...stat, value: Math.round(current * 10) / 10 };
      }, duration / steps);
    });
  }

  selectFeature(index: number): void {
    this.activeFeature = index;
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
