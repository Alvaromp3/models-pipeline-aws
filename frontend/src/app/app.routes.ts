import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { AnalyticsPageComponent } from './features/analytics/analytics-page.component';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import { HistoryPageComponent } from './features/history/history-page.component';
import { PredictionsPageComponent } from './features/predictions/predictions-page.component';
import { SettingsPageComponent } from './features/settings/settings-page.component';
import { ShellComponent } from './layout/shell.component';
import { AuthCallbackComponent } from './pages/auth-callback.component';
import { LoginComponent } from './pages/login.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'predictions', component: PredictionsPageComponent },
      { path: 'analytics', component: AnalyticsPageComponent },
      { path: 'history', component: HistoryPageComponent },
      { path: 'settings', component: SettingsPageComponent },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
