import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { OrderResponse } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class SignalRService implements OnDestroy {
  private hubConnection?: signalR.HubConnection;

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

  constructor(private authService: AuthService) {}

  async startConnection(tenantId: string): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const token = this.authService.getToken();

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.hubUrl}`, {
        accessTokenFactory: () => token ?? ''
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

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

    try {
      await this.hubConnection.start();
      console.log('SignalR Connected');
      await this.hubConnection.invoke('JoinTenantGroup', tenantId);
    } catch (err) {
      console.error('SignalR Connection Error:', err);
    }
  }

  async trackOrder(orderId: string): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('TrackOrder', orderId);
    }
  }

  /** Customer status page: follow one waitlist entry and its restaurant's queue. */
  async followWaitlistEntry(entryId: string, tenantId: string): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('JoinWaitlistEntry', entryId);
      await this.hubConnection.invoke('JoinWaitlistQueue', tenantId);
    }
  }

  /** Customer booking page: follow one reservation. */
  async followReservation(reservationId: string): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('JoinReservation', reservationId);
    }
  }

  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
    }
  }

  ngOnDestroy(): void {
    this.stopConnection();
  }
}
