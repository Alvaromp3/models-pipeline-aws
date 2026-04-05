import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RetailComboboxComponent } from '../../shared/retail-combobox/retail-combobox.component';
import {
  retailFeatureLabel,
  retailFieldHint,
  retailFieldWidget,
  suggestionsForFeature,
  type RetailFieldWidget,
} from './prediction-dynamic-form';
import {
  PredictionFieldHelperContext,
  type FieldValueScope,
} from './prediction-field-helper.context';

@Component({
  selector: 'app-predict-feature-field',
  standalone: true,
  imports: [FormsModule, RetailComboboxComponent],
  templateUrl: './predict-feature-field.component.html',
  styleUrl: './predict-feature-field.component.scss',
})
export class PredictFeatureFieldComponent {
  private readonly helper = inject(PredictionFieldHelperContext);

  @Input({ required: true }) feature!: string;
  @Input({ required: true }) values!: Record<string, string>;
  @Input({ required: true }) idPrefix!: string;
  @Input() valueScope: FieldValueScope = 'shared';

  onFocusIn(): void {
    this.helper.focusField({ feature: this.feature, scope: this.valueScope });
  }

  onFocusOut(): void {
    const mine = { feature: this.feature, scope: this.valueScope };
    queueMicrotask(() => {
      const cur = this.helper.activeField();
      if (cur?.feature !== mine.feature || cur?.scope !== mine.scope) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae?.closest('app-prediction-field-helper')) return;
      if (ae?.closest('.retail-combo__panel')) return;
      this.helper.scheduleClear();
    });
  }

  kind(): RetailFieldWidget {
    return retailFieldWidget(this.feature);
  }

  label(): string {
    return retailFeatureLabel(this.feature);
  }

  hint(): string | null {
    return retailFieldHint(this.feature);
  }

  suggestions(): string[] {
    return suggestionsForFeature(this.feature);
  }

  controlId(): string {
    return `${this.idPrefix}-${this.feature}`;
  }

  fieldName(): string {
    return `${this.idPrefix}_${this.feature}`;
  }
}
