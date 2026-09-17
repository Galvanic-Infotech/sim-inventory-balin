import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { NavigationError, Router, provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { baseUrlInterceptor } from './core/interceptors/base-url.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { TranslationService } from './core/services/translation.service';

// ponytail: stale index.html after redeploy points at deleted chunk hashes -> reload once.
// Timestamp (not a bare flag) stops a reload loop but still works on a later redeploy.
const reloadOnStaleChunk = (router: Router) =>
  router.events.subscribe((e) => {
    if (!(e instanceof NavigationError) || !/dynamically imported module/i.test(String(e.error))) return;
    if (Date.now() - Number(sessionStorage.getItem('chunkReload') ?? 0) < 30_000) return;
    sessionStorage.setItem('chunkReload', String(Date.now()));
    location.reload();
  });

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => inject(TranslationService).init()),
    provideAppInitializer(() => { reloadOnStaleChunk(inject(Router)); }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        baseUrlInterceptor,
        authInterceptor,
        errorInterceptor,
      ]),
    ),
    provideAnimationsAsync(),
    providePrimeNG({
      overlayAppendTo: 'body',
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: false,
        },
      },
    }),
  ],
};
