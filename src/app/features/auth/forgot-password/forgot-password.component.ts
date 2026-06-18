import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/services/translation.service';
import { isStrongPassword } from '../../../core/utils/password-strength.util';
import { PasswordStrengthFieldComponent } from '../../../shared/components/password-strength-field/password-strength-field.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LangSwitcherComponent } from '../../../shared/components/lang-switcher/lang-switcher.component';

type Step = 'mobile' | 'otp' | 'reset' | 'done';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink, PasswordStrengthFieldComponent, TranslatePipe, LangSwitcherComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslationService);

  step = signal<Step>('mobile');
  loading = signal(false);
  errorMsg = signal('');
  successMsg = signal('');

  mobile = '';
  otp = '';
  newPassword = signal('');
  confirmPassword = '';
  showConfirmPassword = signal(false);

  captchaInput = '';
  captcha = signal('');
  readonly captchaRequired = signal(true);

  private requestId = '';
  resendCooldown = signal(0);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

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

  onInitiate(): void {
    if (!this.mobile) {
      this.errorMsg.set(this.i18n.instant('auth.errors.mobileRequired'));
      return;
    }

    if (this.captchaRequired() && this.captchaInput.trim().toUpperCase() !== this.captcha()) {
      this.errorMsg.set(this.i18n.instant('auth.errors.invalidCaptcha'));
      this.refreshCaptcha();
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.forgotPasswordInitiate({ mobileNumber: this.mobile }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.requestId = res.data.requestId;
          this.step.set('otp');
          this.successMsg.set(this.i18n.instant('auth.errors.otpSent'));
          this.startCooldown();
        } else {
          this.errorMsg.set(res.message || this.i18n.instant('auth.errors.sendOtpFailed'));
          if (this.captchaRequired()) this.refreshCaptcha();
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message || this.i18n.instant('auth.errors.sendOtpRetry'));
        if (this.captchaRequired()) this.refreshCaptcha();
      },
    });
  }

  onResendOtp(): void {
    if (this.resendCooldown() > 0) return;

    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.forgotPasswordResendOtp(this.requestId).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.requestId = res.data.requestId;
          this.successMsg.set(this.i18n.instant('auth.errors.otpResent'));
          this.startCooldown();
        } else {
          this.errorMsg.set(res.message || this.i18n.instant('auth.errors.resendOtpFailed'));
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message || this.i18n.instant('auth.errors.resendOtpFailed'));
      },
    });
  }

  onVerifyOtp(): void {
    if (!this.otp) {
      this.errorMsg.set(this.i18n.instant('auth.errors.enterOtp'));
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    this.auth.forgotPasswordVerifyOtp({ requestId: this.requestId, otp: this.otp }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.step.set('reset');
        } else {
          this.errorMsg.set(res.message || this.i18n.instant('auth.errors.invalidOtp'));
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message || this.i18n.instant('auth.errors.otpVerifyFailed'));
      },
    });
  }

  onResetPassword(): void {
    const pwd = this.newPassword();
    if (!pwd || !this.confirmPassword) {
      this.errorMsg.set(this.i18n.instant('auth.errors.bothFieldsRequired'));
      return;
    }
    if (!isStrongPassword(pwd)) {
      this.errorMsg.set(this.i18n.instant('auth.errors.passwordNotStrong'));
      return;
    }
    if (pwd !== this.confirmPassword) {
      this.errorMsg.set(this.i18n.instant('auth.errors.passwordsMismatch'));
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.forgotPasswordReset({ requestId: this.requestId, newPassword: pwd }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.step.set('done');
        } else {
          this.errorMsg.set(res.message || this.i18n.instant('auth.errors.resetFailed'));
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message || this.i18n.instant('auth.errors.resetFailed'));
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  private startCooldown(): void {
    this.resendCooldown.set(30);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown.update((v) => {
        if (v <= 1) {
          clearInterval(this.cooldownTimer!);
          this.cooldownTimer = null;
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }
}
