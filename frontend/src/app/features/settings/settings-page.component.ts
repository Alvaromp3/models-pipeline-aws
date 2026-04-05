import { Component, OnInit, inject } from '@angular/core';
import { NovaApiService, UserProfile } from '../../core/api/nova-api.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent implements OnInit {
  private readonly api = inject(NovaApiService);

  /** Gobernanza UI; el API puede ampliarse con rol real más adelante. */
  readonly accessRole = 'Retail Analytics · Analyst';

  loading = true;
  error: string | null = null;
  profile: UserProfile | null = null;

  ngOnInit(): void {
    this.api.getProfile().subscribe({
      next: (p) => {
        this.profile = p;
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load profile.';
        this.loading = false;
      },
    });
  }
}
