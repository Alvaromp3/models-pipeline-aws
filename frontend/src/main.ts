import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
/** Side-effect import: keeps api-url in the Angular compiler graph (avoids intermittent Ivy errors). */
import './app/core/api-url';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
