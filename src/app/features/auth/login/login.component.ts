import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/services/translation.service';
import { LoginRequest, LoginSearchBy } from '../../../shared/models/auth.model';
import {
  extractApiError,
  extractAttemptsRemaining,
  getApiResponseError,
} from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LangSwitcherComponent } from '../../../shared/components/lang-switcher/lang-switcher.component';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, TranslatePipe, LangSwitcherComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslationService);

  readonly identifier = signal('');
  password = '';
  captchaInput = '';
  showPassword = signal(false);
  loading = signal(false);
  errorMsg = signal('');
  captcha = signal('');
  readonly captchaRequired = signal(true);

  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly MOBILE_RE = /^[6-9]\d{9}$/;

  readonly detectedMode = computed<LoginSearchBy>(() =>
    this.identifier().includes('@') ? 'email' : 'mobile',
  );

  ngOnInit(): void {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      window.location.port === '4200';

    this.captchaRequired.set(!isLocalhost);
    if (this.captchaRequired()) this.refreshCaptcha();
  }

  refreshCaptcha(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.captcha.set(code);
    this.captchaInput = '';
  }

  onSubmit(): void {
    const id = this.identifier().trim();
    const mode = this.detectedMode();

    if (!id || !this.password) {
      this.errorMsg.set(this.i18n.instant('auth.errors.credentialsRequired'));
      return;
    }

    if (mode === 'email' && !this.EMAIL_RE.test(id)) {
      this.errorMsg.set(this.i18n.instant('auth.errors.invalidEmail'));
      return;
    }
    if (mode === 'mobile' && !this.MOBILE_RE.test(id)) {
      this.errorMsg.set(this.i18n.instant('auth.errors.invalidMobile'));
      return;
    }

    if (this.captchaRequired() && this.captchaInput.trim().toUpperCase() !== this.captcha()) {
      this.errorMsg.set(this.i18n.instant('auth.errors.invalidCaptcha'));
      this.refreshCaptcha();
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');

    const payload: LoginRequest = {
      searchBy: mode,
      password: this.password,
      mobile: id,
    };

    this.auth.login(payload).subscribe({
      next: (res) => {
        this.loading.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('auth.errors.invalidCredentials'));
        if (msg) {
          this.errorMsg.set(this.withAttempts(msg, extractAttemptsRemaining(res)));
          this.refreshCaptcha();
          return;
        }
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = extractApiError(err, this.i18n.instant('auth.errors.loginFailed'));
        this.errorMsg.set(this.withAttempts(msg, extractAttemptsRemaining(err)));
        this.refreshCaptcha();
      },
    });
  }

  private withAttempts(msg: string, attempts: number | null): string {
    if (attempts === null) return msg;
    if (attempts <= 0) return this.i18n.instant('auth.errors.accountLocked', { msg });
    const key = attempts === 1 ? 'auth.errors.attemptLeft' : 'auth.errors.attemptsLeft';
    return this.i18n.instant(key, { msg, count: attempts });
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }
}
