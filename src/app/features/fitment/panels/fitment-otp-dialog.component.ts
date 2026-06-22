import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FitmentService } from '../../../core/services/fitment.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { Fitment } from '../../../shared/models/fitment.model';
import { OtpBoxesComponent } from '../../../shared/components/otp-boxes/otp-boxes.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-fitment-otp-dialog',
  standalone: true,
  imports: [FormsModule, OtpBoxesComponent, TranslatePipe],
  templateUrl: './fitment-otp-dialog.component.html',
  styleUrl: './fitment-otp-dialog.component.scss',
})
export class FitmentOtpDialogComponent {
  private readonly fitmentSvc = inject(FitmentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(TranslationService);

  readonly open = input(false);
  readonly fitment = input<Fitment | null>(null);

  readonly success = output<void>();
  readonly cancel = output<void>();

  otp = '';
  readonly verifying = signal(false);
  readonly initiating = signal(false);
  readonly error = signal('');
  readonly successMsg = signal('');
  readonly resendCooldown = signal(0);

  private timer?: ReturnType<typeof setInterval>;

  readonly canResend = computed(() => this.resendCooldown() === 0);
  readonly resendLabel = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    const s = this.resendCooldown();
    if (s === 0) return this.i18n.instant('fitment.otp.resendOtp');
    const m = Math.floor(s / 60);
    const r = s % 60;
    return this.i18n.instant('fitment.otp.resendIn', { time: `${m}:${String(r).padStart(2, '0')}` });
  });

  readonly isExpired = computed(() => this.fitment()?.status === 'Expired');

  constructor() {
    effect(() => {
      const o = this.open();
      const f = this.fitment();
      if (o && f) {
        this.resetState();
        this.initiateFreshOtp(f.id);
      } else {
        this.clearTimer();
      }
    });

    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  private resetState(): void {
    this.otp = '';
    this.error.set('');
    this.successMsg.set('');
    this.verifying.set(false);
    this.initiating.set(false);
    this.resendCooldown.set(0);
  }

  private initiateFreshOtp(fitmentId: string): void {
    this.initiating.set(true);
    this.fitmentSvc.initiateOtp({ fitmentId }).subscribe({
      next: (res) => {
        this.initiating.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('fitment.errors.initiateOtpFailed'));
        if (msg) {
          this.error.set(msg);
          this.applyCooldownFromMessage(msg);
          return;
        }
        this.startResendTimer();
      },
      error: (err) => {
        this.initiating.set(false);
        const msg = extractApiError(err, this.i18n.instant('fitment.errors.initiateOtpFailed'));
        this.error.set(msg);
        this.applyCooldownFromMessage(msg);
      },
    });
  }

  private applyCooldownFromMessage(msg: string): void {
    const m = msg.match(/(\d+)\s*seconds?/i);
    if (m) {
      const secs = parseInt(m[1], 10);
      if (secs > 0) this.startResendTimer(secs + 2);
    }
  }

  verify(): void {
    const f = this.fitment();
    if (!f) return;
    const otp = this.otp.trim();
    if (!otp || otp.length < 4) {
      this.error.set(this.i18n.instant('fitment.errors.enterValidOtp'));
      return;
    }
    this.verifying.set(true);
    this.error.set('');
    this.successMsg.set('');
    this.fitmentSvc.validateOtp({ fitmentId: f.id, otp }).subscribe({
      next: (res) => {
        this.verifying.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('fitment.errors.verifyOtpFailed'));
        if (msg) {
          this.handleVerifyFailure(msg, f.id);
          return;
        }
        this.successMsg.set(res.data?.message || this.i18n.instant('fitment.errors.otpVerifiedSuccess'));
        this.clearTimer();
        setTimeout(() => this.success.emit(), 800);
      },
      error: (err) => {
        this.verifying.set(false);
        const msg = extractApiError(err, this.i18n.instant('fitment.errors.verifyOtpFailed'));
        this.handleVerifyFailure(msg, f.id);
      },
    });
  }

  private handleVerifyFailure(msg: string, fitmentId: string): void {
    this.error.set(msg);
    if (/otp\s*expired/i.test(msg)) {
      this.otp = '';
      this.initiateFreshOtp(fitmentId);
    }
  }

  resend(): void {
    const f = this.fitment();
    if (!f || !this.canResend()) return;
    this.error.set('');
    this.fitmentSvc.resendOtp({ fitmentId: f.id }).subscribe({
      next: (res) => {
        const msg = getApiResponseError(res, this.i18n.instant('fitment.errors.resendOtpFailed'));
        if (msg) {
          this.error.set(msg);
          this.applyCooldownFromMessage(msg);
          return;
        }
        this.startResendTimer();
      },
      error: (err) => {
        const msg = extractApiError(err, this.i18n.instant('fitment.errors.resendOtpFailed'));
        this.error.set(msg);
        this.applyCooldownFromMessage(msg);
      },
    });
  }

  onCancel(): void {
    this.clearTimer();
    this.cancel.emit();
  }

  private startResendTimer(seconds = 120): void {
    this.clearTimer();
    this.resendCooldown.set(seconds);
    this.timer = setInterval(() => {
      const v = this.resendCooldown();
      if (v <= 1) {
        this.resendCooldown.set(0);
        this.clearTimer();
      } else {
        this.resendCooldown.set(v - 1);
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
