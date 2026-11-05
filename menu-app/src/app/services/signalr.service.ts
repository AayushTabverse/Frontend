import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { OrderResponse, WalkieMessage } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class SignalRService implements OnDestroy {
  private hubConnection?: signalR.HubConnection;
  private starting?: Promise<void>;
  private stopping?: Promise<void>;

  /**
   * Hub groups this client has joined. The server forgets a connection's groups when it drops,
   * so they are re-joined after every reconnect.
   */
  private joinedGroups = new Map<string, { method: string; args: string[] }>();

  private reconnectedSubject = new Subject<void>();

  private newOrderSubject = new Subject<OrderResponse>();
  private statusUpdateSubject = new Subject<OrderResponse>();
  private kitchenAlertSubject = new Subject<{ orderId: string; status: string }>();
  private waiterCalledSubject = new Subject<{ tableId: string; tableNumber: string }>();
  private waiterCallDismissedSubject = new Subject<{ tableId: string; tableNumber: string }>();
  private tableClearedSubject = new Subject<{ tableId: string; tableNumber: string }>();
  private waitlistUpdatedSubject = new Subject<void>();
  private waitlistEntryUpdatedSubject = new Subject<string>();
  private waitlistQueueChangedSubject = new Subject<void>();
  private tablesChangedSubject = new Subject<void>();
  private reservationsUpdatedSubject = new Subject<void>();
  private reservationRequestedSubject = new Subject<{ id: string; customerName: string; partySize: number; reservedFor: string }>();
  private reservationUpdatedSubject = new Subject<string>();
  private tableBoardChangedSubject = new Subject<void>();
  private tableSessionEndedSubject = new Subject<void>();
  private partySettledSubject = new Subject<string[]>();
  private notificationsChangedSubject = new Subject<void>();
  private inventoryChangedSubject = new Subject<void>();
  private billRequestedSubject = new Subject<{ tableId: string; tableNumber: string; requestedBy?: string }>();
  private printJobCreatedSubject = new Subject<void>();
  private roomsChangedSubject = new Subject<void>();
  private walkieMessageSubject = new Subject<WalkieMessage>();

  newOrder$ = this.newOrderSubject.asObservable();
  statusUpdate$ = this.statusUpdateSubject.asObservable();
  kitchenAlert$ = this.kitchenAlertSubject.asObservable();
  waiterCalled$ = this.waiterCalledSubject.asObservable();
  waiterCallDismissed$ = this.waiterCallDismissedSubject.asObservable();
  tableCleared$ = this.tableClearedSubject.asObservable();
  waitlistUpdated$ = this.waitlistUpdatedSubject.asObservable();
  waitlistEntryUpdated$ = this.waitlistEntryUpdatedSubject.asObservable();
  waitlistQueueChanged$ = this.waitlistQueueChangedSubject.asObservable();
  /** Tables merged, un-merged, transferred or reserved. */
  tablesChanged$ = this.tablesChangedSubject.asObservable();
  reservationsUpdated$ = this.reservationsUpdatedSubject.asObservable();
  /** New booking request from the restaurant website. */
  reservationRequested$ = this.reservationRequestedSubject.asObservable();
  /** Customer booking page: this reservation changed. */
  reservationUpdated$ = this.reservationUpdatedSubject.asObservable();
  /** Customer menu: the followed table was billed and cleared. */
  tableSessionEnded$ = this.tableSessionEndedSubject.asObservable();
  /** Customer menu: these parties (session ids) at a shared table were billed; others are still eating. */
  partySettled$ = this.partySettledSubject.asObservable();
  /** Waitlist status page: a table became free/occupied/reserved (for the customer table board). */
  tableBoardChanged$ = this.tableBoardChangedSubject.asObservable();
  /** Staff: a notification was raised, updated, acknowledged or resolved. */
  notificationsChanged$ = this.notificationsChangedSubject.asObservable();
  /** Staff: stock quantities changed. */
  inventoryChanged$ = this.inventoryChangedSubject.asObservable();
  /** Staff: a waiter marked a table ready for its bill. */
  billRequested$ = this.billRequestedSubject.asObservable();
  /** Print Station: a KOT is waiting. */
  printJobCreated$ = this.printJobCreatedSubject.asObservable();
  /** Hotel: a guest checked in or out. */
  roomsChanged$ = this.roomsChangedSubject.asObservable();
  /** Staff walkie-talkie: a voice clip or quick call was sent. */
  walkieMessage$ = this.walkieMessageSubject.asObservable();
  /** Connection came back after a drop; events sent meanwhile were missed, so screens should reload. */
  reconnected$ = this.reconnectedSubject.asObservable();

  constructor(private authService: AuthService) {}

  /**
   * Staff screens: connect and receive all of the restaurant's events. Needs a staff login for
   * this restaurant (the server refuses everyone else).
   */
  async startConnection(tenantId: string): Promise<void> {
    await this.ensureConnected();
    await this.join('JoinTenantGroup', tenantId);
  }

  /**
   * Customer pages: connect without joining the restaurant's staff group, then follow their own
   * table, order, waitlist entry or reservation.
   */
  async connectPublic(): Promise<void> {
    await this.ensureConnected();
  }

  private async ensureConnected(): Promise<void> {
    // A page being left may still be tearing the connection down
    await this.stopping;
    if (this.hubConnection && this.hubConnection.state !== signalR.HubConnectionState.Disconnected) {
      await this.starting;
      return;
    }
    this.starting = this.connect();
    await this.starting;
  }

  private async connect(): Promise<void> {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.hubUrl}`, {
        accessTokenFactory: () => this.authService.getToken() ?? ''
      })
      // Default policy gives up after ~40s; phones asleep in a queue are offline far longer
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: ctx => Math.min(30_000, 1000 * 2 ** ctx.previousRetryCount)
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.hubConnection.onreconnected(async () => {
      await this.rejoinGroups();
      this.reconnectedSubject.next();
    });

    // Register event handlers
    this.hubConnection.on('NewOrder', (order: OrderResponse) => {
      this.newOrderSubject.next(order);
    });

    this.hubConnection.on('OrderStatusUpdated', (order: OrderResponse) => {
      this.statusUpdateSubject.next(order);
    });

    this.hubConnection.on('KitchenAlert', (alert: { orderId: string; status: string }) => {
      this.kitchenAlertSubject.next(alert);
    });

    this.hubConnection.on('WaiterCalled', (data: { tableId: string; tableNumber: string }) => {
      this.waiterCalledSubject.next(data);
    });

    this.hubConnection.on('WaiterCallDismissed', (data: { tableId: string; tableNumber: string }) => {
      this.waiterCallDismissedSubject.next(data);
    });

    this.hubConnection.on('TableCleared', (tableId: string, tableNumber: string) => {
      this.tableClearedSubject.next({ tableId, tableNumber });
    });

    this.hubConnection.on('WaitlistUpdated', () => {
      this.waitlistUpdatedSubject.next();
    });

    this.hubConnection.on('WaitlistEntryUpdated', (entryId: string) => {
      this.waitlistEntryUpdatedSubject.next(entryId);
    });

    this.hubConnection.on('WaitlistQueueChanged', () => {
      this.waitlistQueueChangedSubject.next();
    });

    this.hubConnection.on('TablesChanged', () => {
      this.tablesChangedSubject.next();
    });

    this.hubConnection.on('ReservationsUpdated', () => {
      this.reservationsUpdatedSubject.next();
    });

    this.hubConnection.on('ReservationRequested', (data: { id: string; customerName: string; partySize: number; reservedFor: string }) => {
      this.reservationRequestedSubject.next(data);
    });

    this.hubConnection.on('ReservationUpdated', (id: string) => {
      this.reservationUpdatedSubject.next(id);
    });

    this.hubConnection.on('TableSessionEnded', () => {
      this.tableSessionEndedSubject.next();
    });

    this.hubConnection.on('PartySettled', (sessionIds: string[]) => {
      this.partySettledSubject.next(sessionIds);
    });

    this.hubConnection.on('TableBoardChanged', () => {
      this.tableBoardChangedSubject.next();
    });

    this.hubConnection.on('NotificationsChanged', () => {
      this.notificationsChangedSubject.next();
    });

    this.hubConnection.on('BillRequested', (data: { tableId: string; tableNumber: string; requestedBy?: string }) => {
      this.billRequestedSubject.next(data);
    });

    this.hubConnection.on('PrintJobCreated', () => {
      this.printJobCreatedSubject.next();
    });

    this.hubConnection.on('WalkieMessage', (message: WalkieMessage) => {
      this.walkieMessageSubject.next(message);
    });

    this.hubConnection.on('RoomsChanged', () => {
      this.roomsChangedSubject.next();
    });

    this.hubConnection.on('InventoryChanged', () => {
      this.inventoryChangedSubject.next();
    });

    try {
      await this.hubConnection.start();
      console.log('SignalR Connected');
      await this.rejoinGroups();
    } catch (err) {
      console.error('SignalR Connection Error:', err);
    }
  }

  async trackOrder(orderId: string): Promise<void> {
    await this.join('TrackOrder', orderId);
  }

  /** Customer menu: follow the table (told when it is cleared, so the session ends). */
  async followTable(tableId: string): Promise<void> {
    await this.join('JoinTableGroup', tableId);
  }

  /** Customer status page: follow one waitlist entry and its restaurant's queue. */
  async followWaitlistEntry(entryId: string, tenantId: string): Promise<void> {
    await this.join('JoinWaitlistEntry', entryId);
    await this.join('JoinWaitlistQueue', tenantId);
  }

  /** Customer booking page: follow one reservation. */
  async followReservation(reservationId: string): Promise<void> {
    await this.join('JoinReservation', reservationId);
  }

  /** Joins a hub group now (if connected) and again after every reconnect. */
  private async join(method: string, ...args: string[]): Promise<void> {
    this.joinedGroups.set(`${method}:${args.join(':')}`, { method, args });
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.hubConnection.invoke(method, ...args);
      } catch (err) {
        console.error(`SignalR ${method} failed:`, err);
      }
    }
  }

  private async rejoinGroups(): Promise<void> {
    for (const { method, args } of this.joinedGroups.values()) {
      try {
        await this.hubConnection?.invoke(method, ...args);
      } catch (err) {
        console.error(`SignalR ${method} failed:`, err);
      }
    }
  }

  async stopConnection(): Promise<void> {
    this.joinedGroups.clear();
    if (this.hubConnection) {
      this.stopping = this.hubConnection.stop();
      await this.stopping;
    }
  }

  ngOnDestroy(): void {
    this.stopConnection();
  }
}
