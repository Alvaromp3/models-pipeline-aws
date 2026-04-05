import {
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  Input,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Text field with optional suggestion list: type freely, filter suggestions, scrollable panel.
 */
@Component({
  selector: 'app-retail-combobox',
  standalone: true,
  imports: [],
  templateUrl: './retail-combobox.component.html',
  styleUrl: './retail-combobox.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RetailComboboxComponent),
      multi: true,
    },
  ],
})
export class RetailComboboxComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) label = '';
  @Input() controlId = '';
  @Input() placeholder = '';
  @Input() hint = '';
  /** Short hint list — user can always type values not in the list. */
  @Input() suggestions: string[] = [];
  @Input() autocomplete = 'off';

  value = '';
  open = false;
  disabled = false;

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  get filteredSuggestions(): string[] {
    const q = this.value.trim().toLowerCase();
    if (!q) return this.suggestions;
    return this.suggestions.filter((s) => s.toLowerCase().includes(q));
  }

  writeValue(v: string | null): void {
    this.value = v ?? '';
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(raw: string): void {
    this.value = raw;
    this.onChange(this.value);
    this.open = true;
  }

  onInputEvent(ev: Event): void {
    const t = ev.target as HTMLInputElement | null;
    this.onInput(t?.value ?? '');
  }

  togglePanel(): void {
    if (this.disabled) return;
    this.open = !this.open;
  }

  selectOption(opt: string): void {
    this.value = opt;
    this.onChange(this.value);
    this.open = false;
  }

  onBlurField(): void {
    this.onTouched();
    // Defer close so mousedown on option runs first
    setTimeout(() => {
      this.open = false;
    }, 0);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.open = false;
    }
  }
}
