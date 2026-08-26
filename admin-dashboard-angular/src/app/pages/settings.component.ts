import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  template: `
    <h1>App version</h1>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }
    <form class="card form" (ngSubmit)="save()">
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
  }

  save() {
    this.api
      .put('/api/admin/app/version', {
        latestVersion: this.latestVersion,
        minimumVersion: this.minimumVersion,
        forceUpdate: this.forceUpdate,
        storeUrls: { android: this.android, ios: this.ios },
        releaseNotes: this.releaseNotes,
      })
      .subscribe({
        next: () => this.msg.set('Saved'),
        error: (e) => this.error.set(e.message),
      });
  }
}
