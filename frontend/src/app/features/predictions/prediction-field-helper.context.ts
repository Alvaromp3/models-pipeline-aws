import { Injectable, signal } from '@angular/core';

export type FieldValueScope = 'shared' | 'rev' | 'stock';

export type ActiveFieldRef = {
  feature: string;
  scope: FieldValueScope;
};

/**
 * Per–prediction-page focus state so the helper sidebar tracks the active field
 * and applies click-to-fill without extra payload keys.
 */
@Injectable()
export class PredictionFieldHelperContext {
  private readonly active = signal<ActiveFieldRef | null>(null);
  private clearTimer: ReturnType<typeof setTimeout> | null = null;
  private pickHandler: ((ref: ActiveFieldRef, value: string) => void) | null = null;

  readonly activeField = this.active.asReadonly();

  registerPickHandler(handler: (ref: ActiveFieldRef, value: string) => void): void {
    this.pickHandler = handler;
  }

  focusField(ref: ActiveFieldRef): void {
    this.cancelScheduledClear();
    this.active.set(ref);
  }

  scheduleClear(): void {
    this.cancelScheduledClear();
    this.clearTimer = setTimeout(() => {
      this.active.set(null);
      this.clearTimer = null;
    }, 200);
  }

  cancelScheduledClear(): void {
    if (this.clearTimer !== null) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
  }

  /** Keep helper open when interacting with the sidebar (mousedown before blur completes). */
  holdPanelInteraction(): void {
    this.cancelScheduledClear();
  }

  applyChipValue(value: string): void {
    const ref = this.active();
    if (ref && this.pickHandler) {
      this.pickHandler(ref, value);
    }
  }
}
