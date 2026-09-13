import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type ChatUser = {
  id: string;
  name?: string;
  profilePhoto?: string | null;
};

type ReviewConversation = {
  id: string;
  coach: ChatUser | null;
  athlete: ChatUser | null;
  lastMessage?: { text: string; createdAt: string; senderRole: string } | null;
  subscriptionStatus?: string | null;
  athleteMessageCount?: number;
  coachMessageCount?: number;
  startedAt?: string;
};

type ChatMessage = {
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

@Component({
  selector: 'app-conversations',
  imports: [FormsModule, DatePipe],
  template: `
    <h1>Conversations</h1>
    <p class="muted">
      Read-only review of all coach ↔ athlete chats. You cannot send messages from here.
    </p>

    @if (error()) {
      <p class="err">{{ error() }}</p>
    }

    <div class="chat-shell card">
      <aside class="chat-list">
        <div class="chat-list-head">
          <strong>Threads</strong>
          <span class="muted count">{{ conversations().length }}</span>
        </div>

        <div class="search pad">
          <input
            type="search"
            [(ngModel)]="search"
            name="search"
            placeholder="Search coach or athlete…"
            (keyup.enter)="loadConversations()"
          />
          <button class="btn sm" type="button" (click)="loadConversations()">Search</button>
        </div>

        <div class="conv-scroll">
          @for (c of conversations(); track c.id) {
            <button
              type="button"
              class="conv-item"
              [class.active]="selectedId() === c.id"
              (click)="selectConversation(c)"
            >
              <div class="conv-top">
                <span class="conv-name">{{ pairLabel(c) }}</span>
                @if (c.subscriptionStatus) {
                  <span class="status" [attr.data-status]="c.subscriptionStatus">
                    {{ c.subscriptionStatus }}
                  </span>
                }
              </div>
              <div class="muted conv-preview">
                {{ c.lastMessage?.text || 'No messages yet' }}
              </div>
              <div class="muted conv-meta">
                @if (c.lastMessage?.createdAt) {
                  {{ c.lastMessage!.createdAt | date: 'short' }}
                }
                · {{ (c.coachMessageCount || 0) + (c.athleteMessageCount || 0) }} msgs
              </div>
            </button>
          } @empty {
            <p class="muted pad">No coach–athlete conversations yet.</p>
          }
        </div>
      </aside>

      <section class="chat-thread">
        @if (!selected()) {
          <div class="empty-thread muted">Select a conversation to review.</div>
        } @else {
          <header class="thread-head">
            <div>
              <strong>{{ pairLabel(selected()!) }}</strong>
              <div class="muted parties">
                <span class="role-tag coach">Coach: {{ selected()!.coach?.name || '—' }}</span>
                <span class="role-tag athlete">Athlete: {{ selected()!.athlete?.name || '—' }}</span>
              </div>
            </div>
            @if (selected()!.subscriptionStatus) {
              <span class="status" [attr.data-status]="selected()!.subscriptionStatus">
                {{ selected()!.subscriptionStatus }}
              </span>
            }
          </header>

          <div class="messages">
            @for (m of messages(); track m.id) {
              <div
                class="bubble"
                [class.coach]="m.senderRole === 'coach'"
                [class.athlete]="m.senderRole === 'athlete'"
              >
                <div class="bubble-role">{{ m.senderRole }}</div>
                <div class="bubble-text">{{ m.text }}</div>
                @for (a of m.attachments || []; track a.url) {
                  <div class="attach">
                    @if (a.type === 'image') {
                      <a [href]="media(a.url)" target="_blank" rel="noopener">
                        <img [src]="media(a.url)" [alt]="a.originalName || 'image'" />
                      </a>
                    } @else {
                      <a [href]="media(a.url)" target="_blank" rel="noopener">
                        {{ a.originalName || 'Attachment' }}
                      </a>
                    }
                  </div>
                }
                <div class="bubble-meta">{{ m.createdAt | date: 'short' }}</div>
              </div>
            } @empty {
              <p class="muted">No messages in this thread.</p>
            }
          </div>

          <div class="readonly-bar muted">Read-only · revision view</div>
        }
      </section>
    </div>
  `,
  styles: `
    .chat-shell {
      display: grid;
      grid-template-columns: 320px 1fr;
      min-height: 70vh;
      overflow: hidden;
    }
    .chat-list {
      border-right: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .chat-list-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--line);
    }
    .count {
      font-size: 0.8rem;
    }
    .search {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.5rem;
      border-bottom: 1px solid var(--line);
    }
    .search input {
      margin: 0;
    }
    .conv-scroll {
      overflow: auto;
      flex: 1;
    }
    .conv-item {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: 0;
      border-bottom: 1px solid var(--line);
      color: inherit;
      padding: 0.75rem 1rem;
      cursor: pointer;
    }
    .conv-item:hover,
    .conv-item.active {
      background: #121920;
    }
    .conv-top {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      align-items: center;
    }
    .conv-name {
      font-weight: 600;
      font-size: 0.9rem;
    }
    .conv-preview {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 0.2rem;
    }
    .conv-meta {
      font-size: 0.75rem;
      margin-top: 0.15rem;
    }
    .status {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      border: 1px solid var(--line);
      color: var(--muted);
      white-space: nowrap;
    }
    .status[data-status='active'] {
      color: #7dcea0;
      border-color: #2d5a40;
    }
    .status[data-status='pending'] {
      color: #f0c674;
      border-color: #6a5520;
    }
    .status[data-status='expired'] {
      color: #e88;
      border-color: #5a2d2d;
    }
    .chat-thread {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .thread-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--line);
    }
    .parties {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      margin-top: 0.25rem;
    }
    .role-tag.coach {
      color: #8eb6e8;
    }
    .role-tag.athlete {
      color: #b8d4a8;
    }
    .empty-thread {
      margin: auto;
      padding: 2rem;
    }
    .messages {
      flex: 1;
      overflow: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .bubble {
      max-width: min(70%, 480px);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 0.55rem 0.75rem;
    }
    .bubble.coach {
      align-self: flex-start;
      background: #152033;
      border-color: #2a4060;
    }
    .bubble.athlete {
      align-self: flex-end;
      background: #1a2818;
      border-color: #355035;
    }
    .bubble-role {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      margin-bottom: 0.2rem;
    }
    .bubble-text {
      white-space: pre-wrap;
      word-break: break-word;
    }
    .bubble-meta {
      margin-top: 0.35rem;
      font-size: 0.7rem;
      color: var(--muted);
    }
    .attach img {
      max-width: 220px;
      border-radius: 8px;
      margin-top: 0.4rem;
      display: block;
    }
    .attach a {
      color: var(--accent);
      font-size: 0.85rem;
    }
    .readonly-bar {
      padding: 0.65rem 1rem;
      border-top: 1px solid var(--line);
      text-align: center;
      font-size: 0.8rem;
    }
    @media (max-width: 900px) {
      .chat-shell {
        grid-template-columns: 1fr;
        min-height: auto;
      }
      .chat-list {
        max-height: 40vh;
      }
      .chat-thread {
        min-height: 50vh;
      }
    }
  `,
})
export class ConversationsComponent implements OnInit {
  private api = inject(ApiService);

  conversations = signal<ReviewConversation[]>([]);
  messages = signal<ChatMessage[]>([]);
  selected = signal<ReviewConversation | null>(null);
  selectedId = signal<string | null>(null);
  error = signal('');
  search = '';

  ngOnInit(): void {
    this.loadConversations();
  }

  media(path?: string | null): string | null {
    return this.api.mediaUrl(path);
  }

  pairLabel(c: ReviewConversation): string {
    const coach = c.coach?.name || 'Coach';
    const athlete = c.athlete?.name || 'Athlete';
    return `${coach} ↔ ${athlete}`;
  }

  loadConversations(): void {
    this.error.set('');
    const q = this.search.trim();
    const path = q
      ? `/api/chat/admin/coach-athlete?q=${encodeURIComponent(q)}`
      : '/api/chat/admin/coach-athlete';

    this.api.get<{ conversations?: ReviewConversation[] }>(path).subscribe({
      next: (r) => this.conversations.set(r.conversations || []),
      error: (e) => this.error.set(e.message),
    });
  }

  selectConversation(c: ReviewConversation): void {
    this.selected.set(c);
    this.selectedId.set(c.id);
    this.error.set('');
    this.messages.set([]);

    this.api
      .get<{ conversation?: ReviewConversation; messages?: ChatMessage[] }>(
        `/api/chat/admin/coach-athlete/${c.id}/messages?page=1&limit=100`
      )
      .subscribe({
        next: (r) => {
          if (r.conversation) this.selected.set(r.conversation);
          this.messages.set(r.messages || []);
        },
        error: (e) => this.error.set(e.message),
      });
  }
}
