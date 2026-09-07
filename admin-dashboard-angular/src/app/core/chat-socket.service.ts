import { Injectable, inject, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type ChatNewMessageEvent = {
  conversationId: string;
  message: {
    id: string;
    conversationId: string;
    text: string;
    senderId: string;
    senderRole: string;
    createdAt: string;
    attachments?: Array<{
      url: string;
      type: string;
      originalName?: string | null;
    }>;
  };
};

export type ChatTypingEvent = {
  conversationId: string;
  userId: string;
  isTyping: boolean;
};

@Injectable({ providedIn: 'root' })
export class ChatSocketService implements OnDestroy {
  private auth = inject(AuthService);
  private socket: Socket | null = null;
  private newMessage$ = new Subject<ChatNewMessageEvent>();
  private typing$ = new Subject<ChatTypingEvent>();

  connect(): void {
    const token = this.auth.token();
    if (!token || this.socket?.connected) return;

    const url = environment.apiBase || window.location.origin;
    this.socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      path: '/socket.io',
    });

    this.socket.on('chat:new_message', (payload: ChatNewMessageEvent) => {
      this.newMessage$.next(payload);
    });

    this.socket.on('chat:typing', (payload: ChatTypingEvent) => {
      this.typing$.next(payload);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  onNewMessage(): Observable<ChatNewMessageEvent> {
    return this.newMessage$.asObservable();
  }

  onTyping(): Observable<ChatTypingEvent> {
    return this.typing$.asObservable();
  }

  emitTyping(conversationId: string, isTyping: boolean): void {
    this.socket?.emit('chat:typing', { conversationId, isTyping });
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.newMessage$.complete();
    this.typing$.complete();
  }
}
