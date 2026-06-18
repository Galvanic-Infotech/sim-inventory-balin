import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { extractApiError, getApiResponseError } from '../../core/utils/api-error.util';
import { isStrongPassword } from '../../core/utils/password-strength.util';
import { PasswordStrengthFieldComponent } from '../../shared/components/password-strength-field/password-strength-field.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, PasswordStrengthFieldComponent, TranslatePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(TranslationService);

  readonly userName = this.auth.userName;
  readonly profile = this.auth.profile;

  oldPassword = '';
  newPassword = signal('');
  confirmPassword = '';

  showOld = signal(false);
  showConfirm = signal(false);
  changing = signal(false);
  error = signal('');
  success = signal('');

  changePassword(): void {
    this.error.set('');
    this.success.set('');

    const pwd = this.newPassword();

    if (!this.oldPassword || !pwd || !this.confirmPassword) {
      this.error.set(this.i18n.instant('profile.errors.allRequired'));
      return;
    }

    if (!isStrongPassword(pwd)) {
      this.error.set(this.i18n.instant('profile.errors.passwordWeak'));
      return;
    }

    if (pwd !== this.confirmPassword) {
      this.error.set(this.i18n.instant('profile.errors.passwordMismatch'));
      return;
    }

    if (this.oldPassword === pwd) {
      this.error.set(this.i18n.instant('profile.errors.passwordSame'));
      return;
    }

    this.changing.set(true);
    this.auth.changePassword({ oldPassword: this.oldPassword, newPassword: pwd }).subscribe({
      next: (res) => {
        this.changing.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('profile.errors.changeFailed'));
        if (msg) {
          this.error.set(msg);
          return;
        }
        this.success.set(this.i18n.instant('profile.success'));
        this.oldPassword = '';
        this.newPassword.set('');
        this.confirmPassword = '';
      },
      error: (err) => {
        this.changing.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('profile.errors.changeFailed')));
      },
    });
  }
}
