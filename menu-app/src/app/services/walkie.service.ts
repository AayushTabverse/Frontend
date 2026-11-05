import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, firstValueFrom, map } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { ApiResponse, WalkieChannel, WalkieContact, WalkieMessage } from '../models/api.models';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SignalRService } from './signalr.service';

export type WalkieTarget = { channel: Exclude<WalkieChannel, 'Direct'> } | { channel: 'Direct'; userId: string; name: string };

/** Quick calls: one tap, read aloud on each device in its own language. */
export const QUICK_CALLS: { key: string; needsTable: boolean }[] = [
  { key: 'foodReady', needsTable: true },
  { key: 'pickUp', needsTable: false },
  { key: 'needWater', needsTable: true },
  { key: 'cleanTable', needsTable: true },
  { key: 'billPlease', needsTable: true },
  { key: 'callingWaiter', needsTable: true },
  { key: 'comeCounter', needsTable: false },
  { key: 'comeKitchen', needsTable: false },
  { key: 'guestsWaiting', needsTable: false },
  { key: 'itemFinished', needsTable: false },
  { key: 'urgent', needsTable: false },
  { key: 'ok', needsTable: false }
];

export const WALKIE_CHANNELS: Exclude<WalkieChannel, 'Direct'>[] = ['All', 'Kitchen', 'Floor', 'Counter', 'Hotel'];

/** Channels each role hears by default (staff can change theirs on the device). */
function defaultListening(role: string | null): WalkieChannel[] {
  switch (role) {
    case 'Kitchen': return ['All', 'Kitchen'];
    case 'Waiter':
    case 'Captain': return ['All', 'Floor'];
    case 'Cashier': return ['All', 'Counter', 'Kitchen'];
    case 'FrontDesk': return ['All', 'Hotel', 'Counter'];
    case 'RoomService': return ['All', 'Hotel'];
    default: return ['All', 'Kitchen', 'Floor', 'Counter', 'Hotel'];
  }
}

/** Who each role usually talks to. */
function defaultTarget(role: string | null): WalkieTarget {
  switch (role) {
    case 'Kitchen': return { channel: 'Floor' };
    case 'Waiter':
    case 'Captain':
    case 'Cashier': return { channel: 'Kitchen' };
    case 'FrontDesk':
    case 'RoomService': return { channel: 'Hotel' };
    default: return { channel: 'All' };
  }
}

const MAX_CLIP_MS = 15_000;
const MIN_CLIP_MS = 400;
const SPEECH_LANG: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };

/**
 * Staff walkie-talkie: hold to record a short clip, release to send to a channel or one person.
 * Incoming clips and quick calls play automatically (after one tap to allow sound) in arrival order.
 */
@Injectable({ providedIn: 'root' })
export class WalkieService {
  private readonly apiUrl = `${environment.apiUrl}/walkie`;

  messages$ = new BehaviorSubject<WalkieMessage[]>([]);
  contacts$ = new BehaviorSubject<WalkieContact[]>([]);
  /** A message for this device arrived (panel flashes / unread badge). */
  incoming$ = new Subject<WalkieMessage>();
  /** Message playing now, if any. */
  playing$ = new BehaviorSubject<string | null>(null);
  recording$ = new BehaviorSubject<boolean>(false);
  /** Translation key of a problem to show (sendFailed, …). */
  error$ = new Subject<string>();

  soundEnabled = false;
  target: WalkieTarget = { channel: 'All' };
  listening = new Set<WalkieChannel>();

  private started = false;
  private queue: WalkieMessage[] = [];
  private playingNow = false;
  private stream: MediaStream | null = null;
  private releaseTimer?: ReturnType<typeof setTimeout>;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recordStart = 0;
  private autoStop?: ReturnType<typeof setTimeout>;
  private audioCtx: AudioContext | null = null;

  constructor(private http: HttpClient, private auth: AuthService, private signalR: SignalRService, private transloco: TranslocoService) {}

  get myId(): string | null {
    return this.auth.getUserId();
  }

  /** Connects and loads recent messages. Safe to call from every staff screen. */
  async start(): Promise<void> {
    const tenantId = this.auth.getTenantId();
    if (this.started || !tenantId) return;
    this.started = true;

    const role = this.auth.getRole();
    this.listening = new Set(this.savedListening() ?? defaultListening(role));
    this.target = defaultTarget(role);

    this.signalR.walkieMessage$.subscribe(m => this.receive(m));
    this.signalR.reconnected$.subscribe(() => this.loadRecent());
    this.loadRecent();
    this.http.get<ApiResponse<WalkieContact[]>>(`${this.apiUrl}/contacts`).pipe(map(r => r.data ?? []))
      .subscribe({ next: c => this.contacts$.next(c), error: () => {} });
    await this.signalR.startConnection(tenantId);
  }

  /** Browsers only play sound after a tap: call from a click. */
  enableSound(): void {
    this.soundEnabled = true;
    try {
      this.audioCtx ??= new AudioContext();
      this.audioCtx.resume();
      // Unlock speech on iOS with a silent utterance
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch { /* not supported */ }
    this.playNext();
  }

  toggleListening(channel: WalkieChannel): void {
    if (this.listening.has(channel)) this.listening.delete(channel);
    else this.listening.add(channel);
    try { localStorage.setItem(this.listenKey(), JSON.stringify([...this.listening])); } catch { /* private mode */ }
  }

  /** Is this message for this device? */
  isForMe(m: WalkieMessage): boolean {
    if (m.senderUserId === this.myId) return false;
    if (m.channel === 'Direct') return m.recipientUserId === this.myId;
    return this.listening.has(m.channel);
  }

  /** What a quick call says, in this device's language. */
  quickText(m: Pick<WalkieMessage, 'quickKey' | 'quickTable'>): string {
    return this.transloco.translate(`walkie.quick.${m.quickKey}`, { table: m.quickTable ?? '' });
  }

  replay(m: WalkieMessage): void {
    this.enableSound();
    this.queue.unshift(m);
    this.playNext();
  }

  // ── Recording ──

  async startRecording(): Promise<void> {
    if (this.recorder) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      throw new Error('micUnsupported');
    clearTimeout(this.releaseTimer);
    try {
      this.stream ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      throw new Error('micDenied');
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 24_000 } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
    this.recorder.start();
    this.recordStart = Date.now();
    this.recording$.next(true);
    this.chirp(880);
    this.autoStop = setTimeout(() => this.stopRecording(), MAX_CLIP_MS);
  }

  /** Stops and sends. Resolves false when the clip was too short to send. */
  stopRecording(): Promise<boolean> {
    const recorder = this.recorder;
    if (!recorder) return Promise.resolve(false);
    clearTimeout(this.autoStop);
    this.recorder = null;
    this.recording$.next(false);
    const duration = Date.now() - this.recordStart;

    return new Promise(resolve => {
      recorder.onstop = async () => {
        this.releaseMicSoon();
        if (duration < MIN_CLIP_MS || !this.chunks.length) { resolve(false); return; }
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        const form = new FormData();
        form.append('audio', blob, blob.type.includes('mp4') ? 'clip.m4a' : 'clip.webm');
        form.append('channel', this.target.channel);
        if (this.target.channel === 'Direct') form.append('recipientUserId', this.target.userId);
        form.append('durationMs', String(duration));
        try {
          const sent = await firstValueFrom(this.http.post<ApiResponse<WalkieMessage>>(`${this.apiUrl}/voice`, form).pipe(map(r => r.data!)));
          this.add(sent);
          this.chirp(660);
          resolve(true);
        } catch {
          this.error$.next('sendFailed');
          resolve(false);
        }
      };
      recorder.stop();
    });
  }

  cancelRecording(): void {
    if (!this.recorder) return;
    clearTimeout(this.autoStop);
    this.recorder.onstop = () => this.releaseMicSoon();
    this.recorder.stop();
    this.recorder = null;
    this.recording$.next(false);
  }

  async sendQuick(key: string, table?: string): Promise<void> {
    const body = {
      channel: this.target.channel,
      recipientUserId: this.target.channel === 'Direct' ? this.target.userId : undefined,
      quickKey: key,
      quickTable: table || undefined
    };
    const sent = await firstValueFrom(this.http.post<ApiResponse<WalkieMessage>>(`${this.apiUrl}/quick`, body).pipe(map(r => r.data!)));
    this.add(sent);
  }

  // ── Receiving and playback ──

  private loadRecent(): void {
    this.http.get<ApiResponse<WalkieMessage[]>>(`${this.apiUrl}/recent`).pipe(map(r => r.data ?? []))
      .subscribe({ next: m => this.messages$.next(m), error: () => {} });
  }

  private receive(m: WalkieMessage): void {
    if (this.messages$.value.some(x => x.id === m.id)) return;
    this.add(m);
    if (!this.isForMe(m)) return;
    this.incoming$.next(m);
    try { navigator.vibrate?.([120, 60, 120]); } catch { /* not supported */ }
    this.queue.push(m);
    this.playNext();
  }

  private add(m: WalkieMessage): void {
    if (this.messages$.value.some(x => x.id === m.id)) return;
    this.messages$.next([m, ...this.messages$.value].slice(0, 50));
  }

  /** Plays queued messages one after another (never over someone talking). */
  private async playNext(): Promise<void> {
    if (this.playingNow || !this.soundEnabled || this.recorder) return;
    const m = this.queue.shift();
    if (!m) return;
    this.playingNow = true;
    this.playing$.next(m.id);
    try {
      this.chirp(1040);
      await wait(180);
      if (m.hasAudio) await this.playClip(m);
      else if (m.quickKey) await this.speak(`${m.senderName}: ${this.quickText(m)}`);
    } catch { /* blocked or failed: it stays in the list to replay */ }
    this.playingNow = false;
    this.playing$.next(null);
    this.playNext();
  }

  private async playClip(m: WalkieMessage): Promise<void> {
    const blob = await firstValueFrom(this.http.get(`${this.apiUrl}/${m.id}/audio`, { responseType: 'blob' }));
    const url = URL.createObjectURL(blob);
    try {
      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('playback'));
        audio.play().catch(reject);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Reads a quick call aloud; falls back to English when the phone has no voice for the language. */
  private speak(text: string): Promise<void> {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) { resolve(); return; }
      const lang = SPEECH_LANG[this.transloco.getActiveLang()] ?? 'en-IN';
      const voices = speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang === lang) ?? voices.find(v => v.lang.startsWith(lang.slice(0, 2)));
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = voice?.lang ?? lang;
      if (voice) utter.voice = voice;
      utter.rate = 0.95;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      speechSynthesis.speak(utter);
      setTimeout(resolve, 12_000); // never get stuck
    });
  }

  /** Short walkie-style beep. */
  private chirp(freq: number): void {
    if (!this.soundEnabled) return;
    try {
      this.audioCtx ??= new AudioContext();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.09);
    } catch { /* not supported */ }
  }

  /** Keep the mic open a minute between clips (so the first word isn't cut), then let go. */
  private releaseMicSoon(): void {
    clearTimeout(this.releaseTimer);
    this.releaseTimer = setTimeout(() => {
      this.stream?.getTracks().forEach(t => t.stop());
      this.stream = null;
    }, 60_000);
    this.playNext();
  }

  private listenKey(): string {
    return `tabverse.walkie.listen.${this.myId}`;
  }

  private savedListening(): WalkieChannel[] | null {
    try {
      const raw = localStorage.getItem(this.listenKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
