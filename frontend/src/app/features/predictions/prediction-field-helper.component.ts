import { Component, computed, inject } from '@angular/core';
import { buildHelperPanel } from './prediction-domain-suggestions';
import { retailFeatureLabel } from './prediction-dynamic-form';
import { PredictionFieldHelperContext } from './prediction-field-helper.context';

@Component({
  selector: 'app-prediction-field-helper',
  standalone: true,
  templateUrl: './prediction-field-helper.component.html',
  styleUrl: './prediction-field-helper.component.scss',
})
export class PredictionFieldHelperComponent {
  readonly ctx = inject(PredictionFieldHelperContext);

  readonly panel = computed(() => {
    const ref = this.ctx.activeField();
    if (!ref) return null;
    const rich = buildHelperPanel(ref.feature);
    if (rich) return rich;
    return {
      title: retailFeatureLabel(ref.feature),
      context:
        'No curated hints for this column yet — type a value consistent with your training extract.',
      chips: [] as { label: string; value: string }[],
      source: 'static' as const,
    };
  });

  readonly activeLabel = computed(() => {
    const ref = this.ctx.activeField();
    return ref ? retailFeatureLabel(ref.feature) : null;
  });

  onPanelMouseDown(ev: MouseEvent): void {
    ev.preventDefault();
    this.ctx.holdPanelInteraction();
  }

  pick(value: string, ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.ctx.holdPanelInteraction();
    this.ctx.applyChipValue(value);
  }
}
