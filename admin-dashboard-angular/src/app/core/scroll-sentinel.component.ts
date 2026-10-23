import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';

/**
 * Invisible marker placed after a list. Emits `reached` whenever it comes
 * within 200px of the viewport — including after `disabled` flips back to
 * false (i.e. a page just finished loading) while it is still on screen,
 * which keeps short pages filling the viewport instead of stalling.
 *
 * Usage:
 *   <app-scroll-sentinel
 *     [disabled]="list.loading() || !list.hasMore()"
 *     (reached)="list.loadMore()"
 *   />
 */
@Component({
  selector: 'app-scroll-sentinel',
  template: `<div #sentinel class="scroll-sentinel" aria-hidden="true"></div>`,
  styles: `
    :host { display: block; }
    .scroll-sentinel { height: 1px; width: 100%; }
  `,
})
export class ScrollSentinelComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() disabled = false;
  @Output() reached = new EventEmitter<void>();

  @ViewChild('sentinel') private sentinel?: ElementRef<HTMLElement>;
  private observer: IntersectionObserver | null = null;

  ngAfterViewInit() {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) this.emitReached();
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    if (this.sentinel?.nativeElement) {
      this.observer.observe(this.sentinel.nativeElement);
    }
  }

  ngOnChanges() {
    // A fetch just finished (disabled true -> false): if the sentinel is
    // still visible the observer won't fire again on its own, so re-check.
    if (!this.disabled) queueMicrotask(() => this.checkIfVisible());
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  private checkIfVisible() {
    const el = this.sentinel?.nativeElement;
    if (!el || this.disabled) return;
    const rect = el.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 200 && rect.bottom >= -200) {
      this.emitReached();
    }
  }

  private emitReached() {
    if (!this.disabled) this.reached.emit();
  }
}
