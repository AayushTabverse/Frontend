import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { TranslocoHttpLoader } from './i18n/transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideTransloco({
      config: {
        availableLangs: ['en', 'hi', 'gu'],
        defaultLang: 'en',
        fallbackLang: 'en',
        // A key not translated yet shows the English text instead of the key
        missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
        reRenderOnLangChange: true,
        prodMode: !isDevMode()
      },
      loader: TranslocoHttpLoader
    })
  ]
};
