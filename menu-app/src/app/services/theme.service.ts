import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private darkMode = new BehaviorSubject<boolean>(this.loadTheme());
  darkMode$ = this.darkMode.asObservable();

  constructor() {
    this.applyTheme(this.darkMode.value);
  }

  toggle(): void {
    const newValue = !this.darkMode.value;
    this.darkMode.next(newValue);
    this.applyTheme(newValue);
    localStorage.setItem('darkMode', JSON.stringify(newValue));
  }

  isDark(): boolean {
    return this.darkMode.value;
  }

  private loadTheme(): boolean {
    const stored = localStorage.getItem('darkMode');
    return stored ? JSON.parse(stored) : false;
  }

  private applyTheme(dark: boolean): void {
    if (dark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }
}
