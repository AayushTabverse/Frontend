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

  newOrder$ = this.newOrderSubject.asObservable();
  statusUpdate$ = this.statusUpdateSubject.asObservable();
  kitchenAlert$ = this.kitchenAlertSubject.asObservable();
  waiterCalled$ = this.waiterCalledSubject.asObservable();
  waiterCallDismissed$ = this.waiterCallDismissedSubject.asObservable();
  tableCleared$ = this.tableClearedSubject.asObservable();

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

  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
    }
  }

  ngOnDestroy(): void {
    this.stopConnection();
  }
}
