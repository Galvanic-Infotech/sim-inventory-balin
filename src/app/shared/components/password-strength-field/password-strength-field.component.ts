import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  generateStrongPassword,
  getPasswordChecks,
  getPasswordStrengthLabel,
} from '../../../core/utils/password-strength.util';

@Component({
  selector: 'app-password-strength-field',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './password-strength-field.component.html',
  styleUrl: './password-strength-field.component.scss',
})
export class PasswordStrengthFieldComponent {
  readonly label = input('Password');
  readonly required = input(false);
  readonly placeholder = input('Enter password');
  readonly autocomplete = input('new-password');
  readonly inputName = input('password');
  readonly icon = input<string | null>(null);

  readonly password = input.required<string>();
  readonly passwordChange = output<string>();
  readonly generated = output<string>();

  readonly showPassword = signal(false);
  readonly passwordChecks = computed(() => getPasswordChecks(this.password()));
  readonly passwordStrengthLabel = computed(() => getPasswordStrengthLabel(this.passwordChecks().passed));

  onInput(value: string): void {
    this.passwordChange.emit(value);
  }

  generate(): void {
    const pwd = generateStrongPassword();
    this.passwordChange.emit(pwd);
    this.generated.emit(pwd);
    this.showPassword.set(true);
  }

  toggleVisibility(): void {
    this.showPassword.update((v) => !v);
  }
}
