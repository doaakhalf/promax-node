import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-coming-soon',
  template: `
    <h1>{{ title }}</h1>
    <div class="card pad">
      <p>Coming soon — no admin API.</p>
      <p class="muted">This screen is disabled until a backend endpoint exists. PromaxNode was not changed.</p>
    </div>
  `,
})
export class ComingSoonComponent {
  private route = inject(ActivatedRoute);
  title = this.route.snapshot.paramMap.get('feature') || 'Feature';
}
