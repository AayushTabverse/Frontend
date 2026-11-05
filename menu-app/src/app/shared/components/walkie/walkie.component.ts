import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TranslocoDirective } from '@jsverse/transloco';
import { WalkieChannel, WalkieContact, WalkieMessage } from '../../../models/api.models';
import { AuthService } from '../../../services/auth.service';
import { TableService } from '../../../services/table.service';
import { QUICK_CALLS, WALKIE_CHANNELS, WalkieService } from '../../../services/walkie.service';

/**
 * Floating walkie-talkie for staff screens: hold to talk to a channel or one person, one-tap quick
 * calls, and the last 24 hours of messages to replay.
 */
@Component({
  selector: 'app-walkie',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoDirective],
  templateUrl: './walkie.component.html',
  styleUrl: './walkie.component.scss'
})
export class WalkieComponent implements OnInit, OnDestroy {
  readonly channels = WALKIE_CHANNELS;
  readonly quickCalls = QUICK_CALLS;

  open = false;
  unread = 0;
  flash = false;
  messages: WalkieMessage[] = [];
  contacts: WalkieContact[] = [];
  tables: string[] = [];
  quickTable = '';
  recording = false;
  recordSeconds = 0;
  status = '';
  playingId: string | null = null;
  /** Select value: a channel name or "user:<id>". */
  targetValue = 'All';

  private subs: Subscription[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private spaceDown = false;
  /** Talk button is held (the mic may still be opening). */
  private pressing = false;

  constructor(public walkie: WalkieService, private auth: AuthService, private tableService: TableService) {}

  ngOnInit(): void {
    if (!this.auth.getTenantId()) return;
    this.walkie.start();
    this.targetValue = this.walkie.target.channel === 'Direct' ? `user:${this.walkie.target.userId}` : this.walkie.target.channel;
    this.subs.push(
      this.walkie.messages$.subscribe(m => this.messages = m),
      this.walkie.contacts$.subscribe(c => this.contacts = c),
      this.walkie.playing$.subscribe(id => this.playingId = id),
      this.walkie.recording$.subscribe(r => this.recording = r),
      this.walkie.error$.subscribe(key => this.status = `walkie.${key}`),
      this.walkie.incoming$.subscribe(() => {
        if (!this.open) this.unread++;
        this.flash = true;
        setTimeout(() => this.flash = false, 2500);
      })
    );
    // Table numbers for quick calls (kitchen/room service can't list tables; they type it)
    if (this.auth.can('takeOrder')) this.tableService.getTables().subscribe({
      next: t => this.tables = t.filter(x => x.isActive).map(x => x.tableNumber),
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearInterval(this.timer);
    this.walkie.cancelRecording();
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) this.unread = 0;
  }

  setTarget(value: string): void {
    this.targetValue = value;
    if (value.startsWith('user:')) {
      const id = value.slice(5);
      const contact = this.contacts.find(c => c.id === id);
      this.walkie.target = { channel: 'Direct', userId: id, name: contact?.name ?? '' };
    } else {
      this.walkie.target = { channel: value as Exclude<WalkieChannel, 'Direct'> };
    }
  }

  /** Talk to the sender of a message (reply). */
  replyTo(m: WalkieMessage): void {
    if (m.senderUserId === this.walkie.myId) return;
    this.setTarget(`user:${m.senderUserId}`);
  }

  async startTalk(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.walkie.soundEnabled) this.walkie.enableSound();
    this.status = '';
    this.pressing = true;
    try {
      await this.walkie.startRecording();
      // Released while the mic was opening (e.g. the permission prompt): don't send anything
      if (!this.pressing) {
        this.walkie.cancelRecording();
        return;
      }
      this.recordSeconds = 0;
      this.timer = setInterval(() => this.recordSeconds++, 1000);
    } catch (e) {
      this.status = `walkie.${e instanceof Error ? e.message : 'micUnsupported'}`;
    }
  }

  async endTalk(): Promise<void> {
    this.pressing = false;
    if (!this.recording) return;
    clearInterval(this.timer);
    this.status = 'walkie.sending';
    const sent = await this.walkie.stopRecording();
    if (this.status === 'walkie.sending') this.status = sent ? 'walkie.sent' : 'walkie.tooShort';
    setTimeout(() => { if (this.status === 'walkie.sent' || this.status === 'walkie.tooShort') this.status = ''; }, 2500);
  }

  async quick(key: string, needsTable: boolean): Promise<void> {
    if (needsTable && !this.quickTable.trim()) {
      this.status = 'walkie.pickTable';
      return;
    }
    if (!this.walkie.soundEnabled) this.walkie.enableSound();
    try {
      await this.walkie.sendQuick(key, needsTable ? this.quickTable.trim() : undefined);
      this.status = 'walkie.sent';
      setTimeout(() => { if (this.status === 'walkie.sent') this.status = ''; }, 2000);
    } catch {
      this.status = 'walkie.sendFailed';
    }
  }

  /** Hold Space to talk while the panel is open (not while typing). */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (!this.open || e.code !== 'Space' || e.repeat || this.spaceDown || isTyping(e)) return;
    e.preventDefault();
    this.spaceDown = true;
    this.startTalk();
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent): void {
    if (e.code !== 'Space' || !this.spaceDown) return;
    this.spaceDown = false;
    this.endTalk();
  }

  isMine(m: WalkieMessage): boolean {
    return m.senderUserId === this.walkie.myId;
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}
