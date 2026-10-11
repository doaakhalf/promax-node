import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ChatSocketService } from '../core/chat-socket.service';

type ChatUser = {
  id: string;
  name?: string;
  profilePhoto?: string | null;
  isOnline?: boolean;
};

type Conversation = {
  id: string;
  type?: string;
  coachId?: string | null;
  athleteId?: string | null;
  adminId?: string | null;
  otherUser: ChatUser;
  lastMessage?: { text: string; createdAt: string; senderRole: string } | null;
  unreadCount?: number;
};

type ChatReply = {
  id: string;
  senderRole: string;
  text: string;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  text: string;
  senderId: string;
  senderRole: string;
  createdAt: string;
  replyTo?: ChatReply | null;
  attachments?: Array<{
    url: string;
    type: string;
    originalName?: string | null;
  }>;
};

type CoachOption = { id: string; name?: string };
type AthleteOption = { id: string; athleteName?: string };

@Component({
  selector: 'app-chat',
  imports: [FormsModule, DatePipe],
  template: `
    <h1>Chat</h1>
    <p class="muted">Message coaches and athletes. Conversations are 1:1 with your admin account.</p>

    @if (error()) {
      <p class="err">{{ error() }}</p>
    }

    <div class="chat-shell card">
      <aside class="chat-list">
        <div class="chat-list-head">
          <strong>Conversations</strong>
          <button class="btn sm" type="button" (click)="showComposer.set(!showComposer())">
            {{ showComposer() ? 'Close' : 'New' }}
          </button>
        </div>

        @if (showComposer()) {
          <div class="composer pad">
            <label class="muted">Start with</label>
            <select [(ngModel)]="startRole" (ngModelChange)="loadStartOptions()">
              <option value="coach">Coach</option>
              <option value="athlete">Athlete</option>
            </select>
            <select [(ngModel)]="startTargetId">
              <option value="">Select {{ startRole }}…</option>
              @for (opt of startOptions(); track opt.id) {
                <option [value]="opt.id">{{ opt.label }}</option>
              }
            </select>
            <button
              class="btn sm"
              type="button"
              [disabled]="!startTargetId || starting()"
              (click)="startConversation()"
            >
              {{ starting() ? 'Starting…' : 'Start chat' }}
            </button>
          </div>
        }

        <div class="conv-scroll">
          @for (c of conversations(); track c.id) {
            <button
              type="button"
              class="conv-item"
              [class.active]="selectedId() === c.id"
              (click)="selectConversation(c)"
            >
              <div class="conv-top">
                <span class="conv-name">{{ c.otherUser.name || 'User' }}</span>
                @if (c.unreadCount) {
                  <span class="badge">{{ c.unreadCount }}</span>
                }
              </div>
              <div class="muted conv-preview">
                {{ c.lastMessage?.text || 'No messages yet' }}
              </div>
              <div class="muted conv-meta">{{ peerRoleLabel(c) }}</div>
            </button>
          } @empty {
            <p class="muted pad">No conversations yet.</p>
          }
        </div>
      </aside>

      <section class="chat-thread">
        @if (!selected()) {
          <div class="empty-thread muted">Select a conversation or start a new one.</div>
        } @else {
          <header class="thread-head">
            <div>
              <strong>{{ selected()!.otherUser.name }}</strong>
              <div class="muted">{{ peerRoleLabel(selected()!) }}</div>
            </div>
            @if (peerTyping()) {
              <span class="muted">typing…</span>
            }
          </header>

          <div class="messages">
            @for (m of messages(); track m.id) {
              <div class="bubble" [class.mine]="m.senderRole === 'admin'">
                @if (m.replyTo) {
                  <div class="reply-quote">{{ m.replyTo.text }}</div>
                }
                <div class="bubble-text">{{ m.text }}</div>
                @for (a of m.attachments || []; track a.url) {
                  <div class="attach">
                    @if (a.type === 'image') {
                      <a [href]="media(a.url)" target="_blank" rel="noopener">
                        <img [src]="media(a.url)" [alt]="a.originalName || 'image'" />
                      </a>
                    } @else if (a.type === 'audio') {
                      <audio controls [src]="media(a.url)"></audio>
                    } @else if (a.type === 'video') {
                      <video controls playsinline [src]="media(a.url)"></video>
                    } @else {
                      <a [href]="media(a.url)" target="_blank" rel="noopener">
                        {{ a.originalName || 'Attachment' }}
                      </a>
                    }
                  </div>
                }
                <div class="bubble-foot">
                  <div class="bubble-meta">{{ m.createdAt | date: 'short' }}</div>
                  <button class="reply-btn" type="button" (click)="startReply(m)">Reply</button>
                </div>
              </div>
            } @empty {
              <p class="muted">No messages yet. Say hello.</p>
            }
          </div>

          @if (replyingTo()) {
            <div class="reply-bar">
              <span>{{ replyingTo()!.text }}</span>
              <button class="reply-btn" type="button" (click)="cancelReply()">Cancel</button>
            </div>
          }

          <form class="send-row" (ngSubmit)="send()">
            <input
              #fileInput
              type="file"
              multiple
              accept="image/*,application/pdf,audio/*,video/mp4,video/quicktime,video/webm,video/3gpp,.mp3,.m4a,.aac,.wav,.ogg,.webm,.mp4,.mov,.3gp"
              (change)="onFiles($event)"
            />
            <input
              [(ngModel)]="draft"
              name="draft"
              placeholder="Type a message…"
              (input)="onTypingInput()"
              autocomplete="off"
            />
            <button class="btn" type="submit" [disabled]="sending() || (!draft.trim() && !files.length)">
              Send
            </button>
          </form>
          @if (files.length) {
            <p class="muted pad-files">{{ files.length }} attachment(s) selected</p>
          }
        }
      </section>
    </div>
  `,
  styles: `
    .chat-shell {
      display: grid;
      grid-template-columns: 300px 1fr;
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
    .composer {
      border-bottom: 1px solid var(--line);
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
    .badge {
      background: var(--accent);
      color: #fff;
      border-radius: 999px;
      font-size: 0.7rem;
      padding: 0.1rem 0.45rem;
      font-weight: 700;
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
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--line);
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
      align-self: flex-start;
      background: #121920;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 0.6rem 0.75rem;
    }
    .bubble.mine {
      align-self: flex-end;
      background: #1c3358;
      border-color: #2d4d7a;
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
    .bubble-foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .reply-quote,
    .reply-bar {
      border-inline-start: 2px solid var(--accent);
      color: var(--muted);
      font-size: 0.78rem;
    }
    .reply-quote {
      padding: 0.15rem 0.45rem;
      margin-bottom: 0.35rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .reply-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      margin: 0.5rem 1rem 0;
      padding: 0.4rem 0.6rem;
      background: #121920;
    }
    .reply-bar span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .reply-btn {
      background: none;
      border: 0;
      color: var(--muted);
      font-size: 0.72rem;
      cursor: pointer;
      padding: 0;
    }
    .attach img,
    .attach video {
      max-width: 220px;
      border-radius: 8px;
      margin-top: 0.4rem;
      display: block;
    }
    .attach audio {
      display: block;
      width: 220px;
      max-width: 100%;
      margin-top: 0.4rem;
    }
    .attach a {
      color: var(--accent);
      font-size: 0.85rem;
    }
    .send-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--line);
      align-items: center;
    }
    .send-row input[type='file'] {
      width: auto;
      margin: 0;
      max-width: 140px;
    }
    .send-row input[name='draft'] {
      margin: 0;
    }
    .pad-files {
      padding: 0 1rem 0.75rem;
      margin: 0;
    }
    @media (max-width: 900px) {
      .chat-shell {
        grid-template-columns: minmax(0, 1fr);
        min-height: auto;
        min-width: 0;
        max-width: 100%;
      }
      .chat-list {
        max-height: 40vh;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }
      .chat-thread {
        min-height: 50vh;
        min-width: 0;
      }
      .thread-head {
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 0.5rem;
      }
      .thread-head > div {
        min-width: 0;
      }
      .thread-head strong {
        overflow-wrap: anywhere;
      }
      .send-row {
        grid-template-columns: 1fr;
      }
      .send-row input[type='file'] {
        max-width: 100%;
        width: 100%;
      }
      .bubble {
        max-width: 90%;
      }
      .attach img,
      .attach video,
      .attach audio {
        max-width: 100%;
      }
    }
  `,
})
export class ChatComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private sockets = inject(ChatSocketService);

  conversations = signal<Conversation[]>([]);
  messages = signal<ChatMessage[]>([]);
  selected = signal<Conversation | null>(null);
  selectedId = signal<string | null>(null);
  error = signal('');
  showComposer = signal(false);
  startOptions = signal<Array<{ id: string; label: string }>>([]);
  starting = signal(false);
  sending = signal(false);
  peerTyping = signal(false);
  replyingTo = signal<ChatReply | null>(null);

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  startRole: 'coach' | 'athlete' = 'coach';
  startTargetId = '';
  draft = '';
  files: File[] = [];

  private subs = new Subscription();
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private adminId = this.auth.user()?.id || '';

  ngOnInit(): void {
    this.sockets.connect();
    this.loadConversations();
    this.loadStartOptions();

    this.subs.add(
      this.sockets.onNewMessage().subscribe((evt) => {
        if (this.selectedId() === evt.conversationId) {
          const exists = this.messages().some((m) => m.id === evt.message.id);
          if (!exists) {
            this.messages.update((list) => [...list, evt.message]);
          }
        }
        this.loadConversations();
      })
    );

    this.subs.add(
      this.sockets.onTyping().subscribe((evt) => {
        if (this.selectedId() !== evt.conversationId) return;
        if (evt.userId === this.adminId) return;
        this.peerTyping.set(!!evt.isTyping);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.sockets.disconnect();
  }

  media(path?: string | null): string | null {
    return this.api.mediaUrl(path);
  }

  peerRoleLabel(c: Conversation): string {
    if (c.type === 'admin_coach') return 'Coach';
    if (c.type === 'admin_athlete') return 'Athlete';
    if (c.coachId && !c.athleteId) return 'Coach';
    if (c.athleteId && !c.coachId) return 'Athlete';
    return 'User';
  }

  loadConversations(): void {
    this.api.get<{ conversations?: Conversation[] }>('/api/chat/conversations').subscribe({
      next: (r) => this.conversations.set(r.conversations || []),
      error: (e) => this.error.set(e.message),
    });
  }

  loadStartOptions(): void {
    this.startTargetId = '';
    if (this.startRole === 'coach') {
      this.api.get<{ coaches?: CoachOption[] }>('/api/coaches?status=active&page=1&edit=true').subscribe({
        next: (r) =>
          this.startOptions.set(
            (r.coaches || []).map((c) => ({ id: c.id, label: c.name || c.id }))
          ),
        error: (e) => this.error.set(e.message),
      });
    } else {
      this.api.get<{ data?: AthleteOption[] }>('/api/athlete/all?page=1&limit=50').subscribe({
        next: (r) =>
          this.startOptions.set(
            (r.data || [])
              .filter((a) => !!a.id)
              .map((a) => ({ id: a.id!, label: a.athleteName || a.id! }))
          ),
        error: (e) => this.error.set(e.message),
      });
    }
  }

  startConversation(): void {
    if (!this.startTargetId) return;
    this.starting.set(true);
    this.error.set('');
    const body =
      this.startRole === 'coach'
        ? { coachId: this.startTargetId }
        : { athleteId: this.startTargetId };

    this.api.post<{ conversation: Conversation }>('/api/chat/conversations', body).subscribe({
      next: (r) => {
        this.starting.set(false);
        this.showComposer.set(false);
        this.loadConversations();
        this.selectConversation(r.conversation);
      },
      error: (e) => {
        this.starting.set(false);
        this.error.set(e.message);
      },
    });
  }

  selectConversation(c: Conversation): void {
    this.selected.set(c);
    this.selectedId.set(c.id);
    this.peerTyping.set(false);
    this.draft = '';
    this.clearFiles();
    this.replyingTo.set(null);
    this.error.set('');

    this.api
      .get<{ messages?: ChatMessage[] }>(`/api/chat/conversations/${c.id}/messages?page=1&limit=100`)
      .subscribe({
        next: (r) => {
          this.messages.set(r.messages || []);
          this.loadConversations();
        },
        error: (e) => this.error.set(e.message),
      });
  }

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.files = input.files ? Array.from(input.files) : [];
  }

  private clearFiles(): void {
    this.files = [];
    if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
  }

  onTypingInput(): void {
    const id = this.selectedId();
    if (!id) return;
    this.sockets.emitTyping(id, true);
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.sockets.emitTyping(id, false), 1200);
  }

  startReply(message: ChatMessage): void {
    this.replyingTo.set({
      id: message.id,
      senderRole: message.senderRole,
      text: this.quoteText(message),
    });
  }

  cancelReply(): void {
    this.replyingTo.set(null);
  }

  private quoteText(message: ChatMessage): string {
    const text = (message.text || '').trim();
    if (text) return text;
    const type = message.attachments?.[0]?.type;
    if (type === 'image') return 'Photo';
    if (type === 'audio') return 'Voice message';
    if (type === 'video') return 'Video';
    if (type === 'pdf') return 'Attachment';
    return 'Message';
  }

  send(): void {
    const id = this.selectedId();
    if (!id || this.sending()) return;
    if (!this.draft.trim() && !this.files.length) return;

    this.sending.set(true);
    this.error.set('');
    const form = new FormData();
    if (this.draft.trim()) form.append('text', this.draft.trim());
    const reply = this.replyingTo();
    if (reply) form.append('replyTo', reply.id);
    for (const file of this.files) {
      form.append('attachments', file);
    }

    this.api
      .postFormData<{ message: ChatMessage; conversation: Conversation }>(
        `/api/chat/conversations/${id}/messages`,
        form
      )
      .subscribe({
        next: (r) => {
          this.sending.set(false);
          this.draft = '';
          this.clearFiles();
          this.replyingTo.set(null);
          const exists = this.messages().some((m) => m.id === r.message.id);
          if (!exists) {
            this.messages.update((list) => [...list, r.message]);
          }
          if (r.conversation) {
            this.selected.set(r.conversation);
          }
          this.loadConversations();
          this.sockets.emitTyping(id, false);
        },
        error: (e) => {
          this.sending.set(false);
          this.error.set(e.message);
        },
      });
  }
}
