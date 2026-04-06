import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MenuService } from '../../services/menu.service';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { TableService } from '../../services/table.service';
import { ThemeService } from '../../services/theme.service';
import { TableSessionService } from '../../services/table-session.service';
import { SignalRService } from '../../services/signalr.service';
import { SettingsService } from '../../services/settings.service';
import { FullMenuResponse, MenuCategory, MenuItem, CartItem, OrderResponse } from '../../models/api.models';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent implements OnInit, OnDestroy, AfterViewChecked {
  menu?: FullMenuResponse;
  selectedCategory?: MenuCategory;
  cartCount = 0;
  cartTotal = 0;
  cartItems: CartItem[] = [];
  loading = true;
  tenantId = '';
  tableId = '';
  callingWaiter = false;
  waiterCalled = false;
  activeOrders: OrderResponse[] = [];
  sessionExpired = false;
  searchQuery = '';
  searchResults: MenuItem[] = [];
  isSearching = false;
  vegFilter: 'all' | 'veg' | 'nonveg' = 'all';
  private subs: Subscription[] = [];

  // ── Games ──
  showGames = false;
  activeGame: 'none' | 'tictactoe' | 'colormatch' | 'luckydraw' = 'none';

  // Tic Tac Toe
  tttBoard: ('X' | 'O' | '')[] = Array(9).fill('');
  tttCurrentPlayer: 'X' | 'O' = 'X';
  tttWinner: 'X' | 'O' | 'draw' | null = null;
  tttWinLine: number[] = [];
  tttScores = { X: 0, O: 0 };

  // Color Match
  cmTargetColor = '';
  cmPhase: 'showing' | 'guessing' | 'result' = 'showing';
  cmSelectedColor = '';
  cmScore = 0;
  cmRound = 0;
  cmTotalRounds = 5;
  cmMatchPercent = 0;
  cmHistory: { target: string; picked: string; percent: number }[] = [];
  cmPickerHue = 0;
  cmPickerSat = 100;
  cmPickerLight = 50;
  cmPreviewColor = 'hsl(0, 100%, 50%)';
  private cmTimer: any;
  private cmCanvasReady = false;

  @ViewChild('hueCanvas') hueCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('slCanvas') slCanvasRef!: ElementRef<HTMLCanvasElement>;

  // Lucky Draw
  maxDiscountPercent = 0;
  spinWheelEnabled = false;
  luckyBlocks: { label: string; value: number; type: 'percent' | 'flat' | 'none'; color: string }[] = [];
  luckyHighlightIndex = -1;
  luckyDrawRunning = false;
  luckyResult: { label: string; value: number; type: 'percent' | 'flat' | 'none' } | null = null;
  luckyHasDrawn = false;
  private luckyTimer: any;
  private readonly LUCKY_RESULT_KEY = 'tabverse_lucky_result';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
    private cartService: CartService,
    private orderService: OrderService,
    private tableService: TableService,
    public themeService: ThemeService,
    private sessionService: TableSessionService,
    private signalR: SignalRService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') || '';
    this.tableId = this.route.snapshot.paramMap.get('tableId') || '';

    // Initialize customer session for this table
    if (this.tableId) {
      this.sessionService.initSession(this.tableId);
      this.restoreLuckyResult();
    }

    this.subs.push(
      this.cartService.cart$.subscribe(items => {
        this.cartItems = items;
        this.cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
        this.cartTotal = this.cartService.getTotal();
      })
    );

    // Listen for session cleared (table cleared by admin)
    this.subs.push(
      this.sessionService.sessionCleared$.subscribe(cleared => {
        if (cleared) {
          this.sessionExpired = true;
          this.activeOrders = [];
          this.cartService.clearCart();
        }
      })
    );

    if (this.tableId) {
      this.loadTableOrders();
      this.listenForTableCleared();
      this.menuService.getMenuByTable(this.tableId).subscribe({
        next: (menu) => {
          this.menu = menu;
          this.tenantId = menu.tenantId;
          this.loadMaxDiscount(menu.tenantId);
          if (menu.categories.length > 0) {
            this.selectedCategory = menu.categories[0];
          }
          this.loading = false;
        },
        error: () => this.loading = false
      });
    } else if (this.tenantId) {
      this.loadMaxDiscount(this.tenantId);
      this.menuService.getMenuByTenant(this.tenantId).subscribe({
        next: (menu) => {
          this.menu = menu;
          if (menu.categories.length > 0) {
            this.selectedCategory = menu.categories[0];
          }
          this.loading = false;
        },
        error: () => this.loading = false
      });
    }
  }

  ngAfterViewChecked(): void {
    if (this.activeGame === 'colormatch' && this.cmPhase === 'guessing' && !this.cmCanvasReady) {
      this.initColorPickerCanvases();
    }
  }

  loadTableOrders(): void {
    if (!this.tableId) return;
    const sessionOrderIds = this.sessionService.getOrderIds();
    if (sessionOrderIds.length === 0) {
      this.activeOrders = [];
      return;
    }
    this.orderService.getOrdersByTable(this.tableId).subscribe({
      next: (orders) => {
        // Only show orders that belong to the current customer session
        this.activeOrders = orders.filter(o =>
          sessionOrderIds.includes(o.id) &&
          !['Completed', 'Cancelled'].includes(o.status)
        );
      },
      error: () => {}
    });
  }

  private async listenForTableCleared(): Promise<void> {
    if (!this.tenantId) return;
    await this.signalR.startConnection(this.tenantId);
    this.subs.push(
      this.signalR.tableCleared$.subscribe(data => {
        if (data.tableId === this.tableId) {
          this.sessionService.clearSession();
        }
      })
    );
  }

  startNewSession(): void {
    this.sessionExpired = false;
    this.sessionService.initSession(this.tableId);
  }

  selectCategory(category: MenuCategory): void {
    this.selectedCategory = category;
    this.searchQuery = '';
    this.isSearching = false;
    this.searchResults = [];
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    if (!query.trim()) {
      this.isSearching = false;
      this.searchResults = [];
      return;
    }
    this.isSearching = true;
    const q = query.toLowerCase().trim();
    this.searchResults = [];
    if (this.menu) {
      for (const cat of this.menu.categories) {
        for (const item of cat.items) {
          if (item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)) {
            this.searchResults.push(item);
          }
        }
      }
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.isSearching = false;
    this.searchResults = [];
  }

  get filteredCategoryItems(): MenuItem[] {
    if (!this.selectedCategory) return [];
    return this.applyVegFilter(this.selectedCategory.items);
  }

  get filteredSearchResults(): MenuItem[] {
    return this.applyVegFilter(this.searchResults);
  }

  private applyVegFilter(items: MenuItem[]): MenuItem[] {
    if (this.vegFilter === 'veg') return items.filter(i => i.isVeg);
    if (this.vegFilter === 'nonveg') return items.filter(i => !i.isVeg);
    return items;
  }

  getItemQuantity(item: MenuItem): number {
    const cartItem = this.cartItems.find(c => c.menuItem.id === item.id);
    return cartItem ? cartItem.quantity : 0;
  }

  addToCart(item: MenuItem): void {
    this.cartService.addItem(item);
  }

  incrementItem(item: MenuItem): void {
    this.cartService.addItem(item);
  }

  decrementItem(item: MenuItem): void {
    const qty = this.getItemQuantity(item);
    if (qty > 0) {
      this.cartService.updateQuantity(item.id, qty - 1);
    }
  }

  viewAR(item: MenuItem): void {
    this.router.navigate(['/ar', item.id], {
      queryParams: { model: item.arModelUrl, name: item.name }
    });
  }

  goToCart(): void {
    this.router.navigate(['/cart'], {
      queryParams: { tenantId: this.tenantId, tableId: this.tableId }
    });
  }

  viewOrders(): void {
    this.router.navigate(['/table-orders', this.tableId], {
      queryParams: { tenantId: this.tenantId }
    });
  }

  callWaiter(): void {
    if (!this.tableId || this.callingWaiter) return;
    this.callingWaiter = true;
    this.tableService.callWaiter(this.tableId).subscribe({
      next: () => {
        this.waiterCalled = true;
        this.callingWaiter = false;
        setTimeout(() => this.waiterCalled = false, 5000);
      },
      error: () => this.callingWaiter = false
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.signalR.stopConnection();
    if (this.cmTimer) clearTimeout(this.cmTimer);
    if (this.luckyTimer) clearTimeout(this.luckyTimer);
  }

  // ═══════════════════════════════════════
  //             GAMES
  // ═══════════════════════════════════════

  toggleGames(): void {
    this.showGames = !this.showGames;
    if (!this.showGames) {
      this.activeGame = 'none';
      if (this.cmTimer) clearTimeout(this.cmTimer);
    }
  }

  selectGame(game: 'tictactoe' | 'colormatch' | 'luckydraw'): void {
    this.activeGame = game;
    if (game === 'tictactoe') this.resetTTT();
    if (game === 'colormatch') this.startColorMatch();
    if (game === 'luckydraw') this.initLuckyDraw();
  }

  backToGameList(): void {
    this.activeGame = 'none';
    if (this.cmTimer) clearTimeout(this.cmTimer);
  }

  // ── Tic Tac Toe ──

  resetTTT(): void {
    this.tttBoard = Array(9).fill('');
    this.tttCurrentPlayer = 'X';
    this.tttWinner = null;
    this.tttWinLine = [];
  }

  tttPlay(index: number): void {
    if (this.tttBoard[index] || this.tttWinner) return;
    this.tttBoard[index] = this.tttCurrentPlayer;

    const winner = this.checkTTTWinner();
    if (winner) {
      this.tttWinner = winner;
      if (winner !== 'draw') this.tttScores[winner]++;
    } else {
      this.tttCurrentPlayer = this.tttCurrentPlayer === 'X' ? 'O' : 'X';
    }
  }

  private checkTTTWinner(): 'X' | 'O' | 'draw' | null {
    const lines = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    for (const [a,b,c] of lines) {
      if (this.tttBoard[a] && this.tttBoard[a] === this.tttBoard[b] && this.tttBoard[a] === this.tttBoard[c]) {
        this.tttWinLine = [a,b,c];
        return this.tttBoard[a] as 'X' | 'O';
      }
    }
    if (this.tttBoard.every(cell => cell)) return 'draw';
    return null;
  }

  isTTTWinCell(index: number): boolean {
    return this.tttWinLine.includes(index);
  }

  // ── Color Match ──

  startColorMatch(): void {
    this.cmScore = 0;
    this.cmRound = 0;
    this.cmHistory = [];
    this.nextColorRound();
  }

  private nextColorRound(): void {
    this.cmRound++;
    this.cmSelectedColor = '';
    this.cmMatchPercent = 0;
    this.cmCanvasReady = false;
    this.cmTargetColor = this.randomHSL();
    this.cmPickerHue = 0;
    this.cmPickerSat = 100;
    this.cmPickerLight = 50;
    this.cmPreviewColor = 'hsl(0, 100%, 50%)';
    this.cmPhase = 'showing';

    this.cmTimer = setTimeout(() => {
      this.cmPhase = 'guessing';
      this.cmCanvasReady = false; // trigger canvas init in ngAfterViewChecked
    }, 3000);
  }

  private randomHSL(): string {
    const h = Math.floor(Math.random() * 360);
    const s = 50 + Math.floor(Math.random() * 40);
    const l = 35 + Math.floor(Math.random() * 30);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  private initColorPickerCanvases(): void {
    if (!this.hueCanvasRef?.nativeElement || !this.slCanvasRef?.nativeElement) return;
    this.cmCanvasReady = true;
    this.drawHueBar();
    this.drawSLCanvas();
  }

  private drawHueBar(): void {
    const canvas = this.hueCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 360; i += 30) {
      gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  private drawSLCanvas(): void {
    const canvas = this.slCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;

    // Draw saturation-lightness gradient for the current hue
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const s = (x / w) * 100;
        const l = 100 - (y / h) * 100;
        ctx.fillStyle = `hsl(${this.cmPickerHue}, ${s}%, ${l}%)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  onHueCanvasClick(event: MouseEvent | TouchEvent): void {
    const canvas = this.hueCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const x = clientX - rect.left;
    this.cmPickerHue = Math.round((x / rect.width) * 360) % 360;
    this.updatePickerPreview();
    this.drawSLCanvas();
  }

  onSLCanvasClick(event: MouseEvent | TouchEvent): void {
    const canvas = this.slCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    this.cmPickerSat = Math.round((x / rect.width) * 100);
    this.cmPickerLight = Math.round(100 - (y / rect.height) * 100);
    this.updatePickerPreview();
  }

  private updatePickerPreview(): void {
    this.cmPreviewColor = `hsl(${this.cmPickerHue}, ${this.cmPickerSat}%, ${this.cmPickerLight}%)`;
  }

  cmConfirmColor(): void {
    if (this.cmPhase !== 'guessing') return;
    this.cmSelectedColor = this.cmPreviewColor;
    this.cmMatchPercent = this.calculateColorMatch(this.cmTargetColor, this.cmSelectedColor);
    this.cmScore += this.cmMatchPercent;
    this.cmHistory.push({ target: this.cmTargetColor, picked: this.cmSelectedColor, percent: this.cmMatchPercent });
    this.cmPhase = 'result';
  }

  cmNextOrFinish(): void {
    if (this.cmRound >= this.cmTotalRounds) return;
    this.nextColorRound();
  }

  get cmFinalScore(): number {
    return this.cmHistory.length > 0
      ? Math.round(this.cmScore / this.cmHistory.length)
      : 0;
  }

  get cmIsFinished(): boolean {
    return this.cmRound >= this.cmTotalRounds && this.cmPhase === 'result';
  }

  private calculateColorMatch(c1: string, c2: string): number {
    const parse = (c: string) => {
      const m = c.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      return m ? { h: +m[1], s: +m[2], l: +m[3] } : { h: 0, s: 0, l: 0 };
    };
    const a = parse(c1), b = parse(c2);
    let hDiff = Math.abs(a.h - b.h);
    if (hDiff > 180) hDiff = 360 - hDiff;
    const hScore = Math.max(0, 100 - (hDiff / 180) * 100);
    const sScore = Math.max(0, 100 - Math.abs(a.s - b.s) * 2);
    const lScore = Math.max(0, 100 - Math.abs(a.l - b.l) * 2);
    return Math.round(hScore * 0.6 + sScore * 0.2 + lScore * 0.2);
  }

  // ── Lucky Draw ──

  get canShowLuckyDraw(): boolean {
    return this.spinWheelEnabled && this.maxDiscountPercent > 0 && this.activeOrders.length > 0;
  }

  private loadMaxDiscount(tenantId: string): void {
    this.settingsService.getPublicSettings(tenantId).subscribe({
      next: (s) => {
        this.maxDiscountPercent = s.maxDiscountPercent || 0;
        this.spinWheelEnabled = s.spinWheelEnabled || false;
      },
      error: () => {}
    });
  }

  private restoreLuckyResult(): void {
    const stored = sessionStorage.getItem(this.LUCKY_RESULT_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.luckyResult = data;
        this.luckyHasDrawn = true;
      } catch { /* ignore */ }
    }
  }

  private saveLuckyResult(result: { label: string; value: number; type: 'percent' | 'flat' | 'none' }): void {
    sessionStorage.setItem(this.LUCKY_RESULT_KEY, JSON.stringify(result));
  }

  private buildLuckyBlocks(): void {
    const max = this.maxDiscountPercent;
    const billTotal = this.activeOrders.reduce((s, o) => s + o.totalAmount, 0);
    const maxFlatDiscount = Math.floor(billTotal * max / 100);
    const colors = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#e91e63', '#00bcd4'];
    const blocks: { label: string; value: number; type: 'percent' | 'flat' | 'none'; color: string }[] = [];

    // Percentage discount blocks
    blocks.push({ label: `${max}% OFF`, value: max, type: 'percent', color: colors[0] });
    if (max >= 6) blocks.push({ label: `${Math.round(max / 2)}% OFF`, value: Math.round(max / 2), type: 'percent', color: colors[1] });
    if (max >= 8) blocks.push({ label: `${Math.round(max * 0.3)}% OFF`, value: Math.round(max * 0.3), type: 'percent', color: colors[2] });

    // Flat discount blocks — capped at maxFlatDiscount
    if (maxFlatDiscount >= 10) {
      const candidates: number[] = [];
      const roundValues = [10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];
      for (const rv of roundValues) {
        if (rv <= maxFlatDiscount) candidates.push(rv);
      }
      if (candidates.length >= 2) {
        const top = candidates[candidates.length - 1];
        const mid = candidates[Math.floor(candidates.length / 2)];
        blocks.push({ label: `₹${mid} OFF`, value: mid, type: 'flat', color: colors[3] });
        if (top !== mid) {
          blocks.push({ label: `₹${top} OFF`, value: top, type: 'flat', color: colors[4] });
        }
      } else if (candidates.length === 1) {
        blocks.push({ label: `₹${candidates[0]} OFF`, value: candidates[0], type: 'flat', color: colors[3] });
      }
    }

    // Fill remaining slots with "Better Luck" to make exactly 9
    while (blocks.length < 9) {
      blocks.push({ label: 'Better Luck\nNext Time', value: 0, type: 'none', color: '#95a5a6' });
    }

    // Trim to 9 if somehow more
    blocks.length = 9;

    // Shuffle
    for (let i = blocks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }

    this.luckyBlocks = blocks;
  }

  initLuckyDraw(): void {
    if (this.luckyHasDrawn) return;
    this.luckyResult = null;
    this.luckyHighlightIndex = -1;
    this.buildLuckyBlocks();
  }

  startLuckyDraw(): void {
    if (this.luckyDrawRunning || this.luckyHasDrawn) return;
    this.luckyDrawRunning = true;
    this.luckyResult = null;

    // Pick the winning block
    const winIndex = this.pickWeightedBlock();

    // Build a sequence of block indices to visit:
    // ~2.5s of fast cycling (about 20 full loops at varying speed),
    // then slow down to land exactly on winIndex
    const fastSteps = 9 * 3 + Math.floor(Math.random() * 9); // 3+ full loops
    const steps: number[] = [];
    let idx = 0;
    for (let i = 0; i < fastSteps; i++) {
      steps.push(idx);
      idx = (idx + 1) % 9;
    }
    // Now add the slowdown steps: walk from current idx to winIndex
    // Go around at least once more so it feels natural
    let slowSteps = 9 + winIndex - (idx % 9);
    if (slowSteps < 5) slowSteps += 9; // ensure enough slow steps exist
    for (let i = 0; i < slowSteps; i++) {
      steps.push(idx);
      idx = (idx + 1) % 9;
    }
    // Final landing
    steps.push(winIndex);

    const totalSteps = steps.length;
    let stepIdx = 0;

    const cycle = () => {
      this.luckyHighlightIndex = steps[stepIdx];
      stepIdx++;

      if (stepIdx < totalSteps) {
        // Ease: fast at start, slow at end
        const progress = stepIdx / totalSteps;
        const delay = 60 + Math.pow(progress, 2.5) * 400;
        this.luckyTimer = setTimeout(cycle, delay);
      } else {
        // Done — landed on winner, pause 2s so user can see which block was selected
        this.luckyHighlightIndex = winIndex;
        this.luckyTimer = setTimeout(() => {
          this.luckyDrawRunning = false;
          this.luckyHasDrawn = true;
          const block = this.luckyBlocks[winIndex];
          this.luckyResult = { label: block.label, value: block.value, type: block.type };
          this.saveLuckyResult(this.luckyResult);
          if (block.type !== 'none' && block.value > 0 && this.tableId) {
            this.applyLuckyDiscountToOrders(block);
          }
        }, 2000);
      }
    };

    this.luckyTimer = setTimeout(cycle, 60);
  }

  private pickWeightedBlock(): number {
    const weights = this.luckyBlocks.map(s => {
      if (s.type === 'none') return 3;
      if (s.type === 'flat') {
        return s.value <= 50 ? 3 : s.value <= 100 ? 2 : 1;
      }
      const ratio = s.value / this.maxDiscountPercent;
      if (ratio <= 0.3) return 3;
      if (ratio <= 0.6) return 2;
      return 1;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      rand -= weights[i];
      if (rand <= 0) return i;
    }
    return 0;
  }

  private applyLuckyDiscountToOrders(block: { value: number; type: 'percent' | 'flat' | 'none' }): void {
    this.orderService.applyWheelDiscount(this.tableId, block.value, block.type, this.tenantId).subscribe({
      next: () => {
        this.loadTableOrders();
      },
      error: () => {}
    });
  }
}
