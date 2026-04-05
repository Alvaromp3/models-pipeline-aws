import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * JSON compacto con resaltado básico para tablas de auditoría (estilo IDE ligero).
 */
@Pipe({
  name: 'jsonHighlight',
  standalone: true,
})
export class JsonHighlightPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: unknown): SafeHtml {
    let raw: string;
    try {
      raw = JSON.stringify(value);
    } catch {
      raw = String(value);
    }
    let h = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    h = h.replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="jh-k">$1</span>:');
    h = h.replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="jh-s">$1</span>');
    h = h.replace(/:\s*(-?\d+\.?\d*)([,\]}])/g, ': <span class="jh-n">$1</span>$2');
    h = h.replace(/:\s*(true|false|null)([,\]}])/g, ': <span class="jh-w">$1</span>$2');
    return this.sanitizer.bypassSecurityTrustHtml(`<span class="jh">${h}</span>`);
  }
}
