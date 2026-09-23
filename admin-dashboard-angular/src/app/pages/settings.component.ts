import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  template: `
    <h1>Settings</h1>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }

    <h2>App version</h2>
    <form class="card form" (ngSubmit)="saveVersion()">
      <label>Latest version</label>
      <input name="latestVersion" [(ngModel)]="latestVersion" />
      <label>Minimum version</label>
      <input name="minimumVersion" [(ngModel)]="minimumVersion" />
      <label class="chk"><input type="checkbox" name="forceUpdate" [(ngModel)]="forceUpdate" /> Force update</label>
      <label>Android store URL</label>
      <input name="android" [(ngModel)]="android" />
      <label>iOS store URL</label>
      <input name="ios" [(ngModel)]="ios" />
      <label>Release notes</label>
      <textarea name="releaseNotes" [(ngModel)]="releaseNotes" rows="4"></textarea>
      <button class="btn" type="submit">Save</button>
    </form>

    <h2>Chat free trial</h2>
    <form class="card form" (ngSubmit)="saveChatSettings()">
      <label>Free trial message limit</label>
      <input
        name="freeTrialMessageLimit"
        type="number"
        min="1"
        step="1"
        [(ngModel)]="freeTrialMessageLimit"
      />
      <button class="btn" type="submit">Save</button>
    </form>
  `,
})
export class SettingsComponent implements OnInit {
  private api = inject(ApiService);
  latestVersion = '';
  minimumVersion = '';
  forceUpdate = false;
  android = '';
  ios = '';
  releaseNotes = '';
  freeTrialMessageLimit = 25;
  error = signal('');
  msg = signal('');

  ngOnInit() {
    this.api
      .get<{
        data?: {
          latestVersion?: string;
          minimumVersion?: string;
          forceUpdate?: boolean;
          storeUrls?: { android?: string; ios?: string };
          releaseNotes?: string;
        };
      }>('/api/app/version')
      .subscribe({
        next: (r) => {
          const d = r.data;
          if (!d) return;
          this.latestVersion = d.latestVersion || '';
          this.minimumVersion = d.minimumVersion || '';
          this.forceUpdate = !!d.forceUpdate;
          this.android = d.storeUrls?.android || '';
          this.ios = d.storeUrls?.ios || '';
          this.releaseNotes = d.releaseNotes || '';
        },
        error: (e) => this.error.set(e.message),
      });

    this.api
      .get<{ data?: { freeTrialMessageLimit?: number } }>('/api/admin/chat/settings')
      .subscribe({
        next: (r) => {
          const limit = r.data?.freeTrialMessageLimit;
          if (typeof limit === 'number' && limit >= 1) {
            this.freeTrialMessageLimit = limit;
          }
        },
        error: (e) => this.error.set(e.message),
      });
  }

  saveVersion() {
    this.api
      .put('/api/admin/app/version', {
        latestVersion: this.latestVersion,
        minimumVersion: this.minimumVersion,
        forceUpdate: this.forceUpdate,
        storeUrls: { android: this.android, ios: this.ios },
        releaseNotes: this.releaseNotes,
      })
      .subscribe({
        next: () => this.msg.set('App version saved'),
        error: (e) => this.error.set(e.message),
      });
  }

  saveChatSettings() {
    this.api
      .put<{ data?: { freeTrialMessageLimit?: number } }>('/api/admin/chat/settings', {
        freeTrialMessageLimit: Number(this.freeTrialMessageLimit),
      })
      .subscribe({
        next: (r) => {
          const limit = r.data?.freeTrialMessageLimit;
          if (typeof limit === 'number') {
            this.freeTrialMessageLimit = limit;
          }
          this.msg.set('Chat settings saved');
        },
        error: (e) => this.error.set(e.message),
      });
  }
}
