import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NovaApiService, UserProfile } from '../core/api/nova-api.service';
import { AuthService } from '../core/auth/auth.service';
import { environment } from '../../environments/environment';
import { NavIconComponent, NavIconName } from '../shared/nav-icon.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NavIconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(NovaApiService);

  readonly production = environment.production;

  readonly nav: { path: string; label: string; icon: NavIconName }[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/predictions', label: 'Predictions', icon: 'predictions' },
    { path: '/analytics', label: 'Analytics', icon: 'analytics' },
    { path: '/history', label: 'History', icon: 'history' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  profile: UserProfile | null = null;

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) return;
    this.api.getProfile().subscribe({
      next: (p) => {
        this.profile = p;
      },
      error: () => {
        this.profile = null;
      },
    });
  }

  get userInitials(): string {
    const n = this.profile?.displayName?.trim() || this.profile?.email?.trim() || '';
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }

  logout(): void {
    this.auth.logout();
  }
}
