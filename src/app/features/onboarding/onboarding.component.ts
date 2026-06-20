import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { PermissionService, PERMS } from '../../core/services/permission.service';
import { RbacService } from '../../core/services/rbac.service';
import { TranslationService } from '../../core/services/translation.service';
import { extractApiError } from '../../core/utils/api-error.util';
import { generateStrongPassword, isStrongPassword } from '../../core/utils/password-strength.util';
import { PasswordStrengthFieldComponent } from '../../shared/components/password-strength-field/password-strength-field.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { OnboardingResult, OnboardingStep } from '../../shared/models/onboarding.model';
import { RbacEntityType } from '../../shared/models/rbac.model';

const DEFAULT_ENTITY_TYPE_NAME = 'WL_CUSTOMER';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, TranslatePipe, PasswordStrengthFieldComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly rbac = inject(RbacService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);

  readonly canRun = computed(() =>
    this.perm.has(PERMS.ENTITY_CREATE) &&
    this.perm.has(PERMS.ROLE_CREATE) &&
    this.perm.has(PERMS.ROLE_PERMISSIONS_MAP) &&
    this.perm.has(PERMS.USER_CREATE),
  );

  readonly entityName = signal('');
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly email = signal('');
  readonly mobile = signal('');
  readonly entityTypeId = signal('');
  readonly entityTypes = signal<RbacEntityType[]>([]);
  readonly loadingEntityTypes = signal(false);
  readonly entityTypesError = signal('');
  roleName = 'Admin';
  readonly password = signal('');

  readonly running = signal(false);
  readonly error = signal('');
  readonly result = signal<OnboardingResult | null>(null);
  readonly steps = signal<OnboardingStep[]>(this.onboarding.initialSteps());

  readonly emailStatus = signal<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  readonly mobileStatus = signal<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');

  private emailTimer?: ReturnType<typeof setTimeout>;
  private mobileTimer?: ReturnType<typeof setTimeout>;
  private emailGen = 0;
  private mobileGen = 0;
  private readonly DEBOUNCE_MS = 400;
  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly MOBILE_RE = /^[6-9]\d{9}$/;

  readonly canSubmit = computed(() => {
    if (this.running()) return false;
    if (
      !this.entityName().trim() ||
      !this.firstName().trim() ||
      !this.email().trim() ||
      !this.mobile().trim()
    ) {
      return false;
    }
    if (!this.entityTypeId()) return false;
    if (this.emailStatus() !== 'available' || this.mobileStatus() !== 'available') return false;
    const pwd = this.password();
    return !!pwd && isStrongPassword(pwd);
  });

  readonly parentEntityName = computed(() => this.auth.selectedEntityName());

  ngOnInit(): void {
    this.loadEntityTypes();
  }

  shortName(name?: string | null): string {
    if (!name) return '—';
    return name.split('(')[0].trim() || name;
  }

  loadEntityTypes(): void {
    this.loadingEntityTypes.set(true);
    this.entityTypesError.set('');
    this.rbac.getEntityTypes({ pageSize: 200 }).subscribe({
      next: (res) => {
        this.loadingEntityTypes.set(false);
        const types = res.data ?? [];
        this.entityTypes.set(types);
        this.entityTypeId.set(this.defaultEntityTypeId(types));
      },
      error: (err) => {
        this.loadingEntityTypes.set(false);
        this.entityTypesError.set(
          extractApiError(err, this.i18n.instant('onboarding.errors.loadEntityTypes')),
        );
      },
    });
  }

  private defaultEntityTypeId(types: RbacEntityType[]): string {
    const match = types.find((t) => t.name.trim().toUpperCase() === DEFAULT_ENTITY_TYPE_NAME);
    return match?.id ?? types[0]?.id ?? '';
  }

  onEmailChange(value: string): void {
    this.email.set(value);
    clearTimeout(this.emailTimer);
    const trimmed = value.trim();
    if (!trimmed) {
      this.emailStatus.set('idle');
      return;
    }
    if (!this.EMAIL_RE.test(trimmed)) {
      this.emailStatus.set('invalid');
      return;
    }
    this.emailStatus.set('checking');
    this.emailTimer = setTimeout(() => {
      const gen = ++this.emailGen;
      this.rbac.checkEmailExists(trimmed).subscribe({
        next: (res) => {
          if (gen !== this.emailGen) return;
          this.emailStatus.set(res.data?.exists ? 'taken' : 'available');
        },
        error: () => {
          if (gen !== this.emailGen) return;
          this.emailStatus.set('idle');
        },
      });
    }, this.DEBOUNCE_MS);
  }

  onMobileChange(value: string): void {
    this.mobile.set(value);
    clearTimeout(this.mobileTimer);
    const trimmed = value.trim();
    if (!trimmed) {
      this.mobileStatus.set('idle');
      return;
    }
    if (!this.MOBILE_RE.test(trimmed)) {
      this.mobileStatus.set('invalid');
      return;
    }
    this.mobileStatus.set('checking');
    this.mobileTimer = setTimeout(() => {
      const gen = ++this.mobileGen;
      this.rbac.checkMobileExists(trimmed).subscribe({
        next: (res) => {
          if (gen !== this.mobileGen) return;
          this.mobileStatus.set(res.data?.exists ? 'taken' : 'available');
        },
        error: () => {
          if (gen !== this.mobileGen) return;
          this.mobileStatus.set('idle');
        },
      });
    }, this.DEBOUNCE_MS);
  }

  generatePassword(): void {
    this.password.set(generateStrongPassword());
  }

  reset(): void {
    this.entityName.set('');
    this.firstName.set('');
    this.lastName.set('');
    this.email.set('');
    this.mobile.set('');
    this.entityTypeId.set(this.defaultEntityTypeId(this.entityTypes()));
    this.roleName = 'Admin';
    this.password.set('');
    this.error.set('');
    this.result.set(null);
    this.steps.set(this.onboarding.initialSteps());
    this.emailStatus.set('idle');
    this.mobileStatus.set('idle');
    clearTimeout(this.emailTimer);
    clearTimeout(this.mobileTimer);
    this.emailGen++;
    this.mobileGen++;
  }

  run(): void {
    if (!this.canSubmit()) return;
    this.running.set(true);
    this.error.set('');
    this.result.set(null);
    this.steps.set(this.onboarding.initialSteps());

    this.onboarding
      .run(
        {
          entityName: this.entityName(),
          firstName: this.firstName(),
          lastName: this.lastName(),
          email: this.email(),
          mobile: this.mobile(),
          password: this.password(),
          entityTypeId: this.entityTypeId(),
          roleName: this.roleName,
        },
        (steps) => this.steps.set([...steps]),
      )
      .subscribe({
        next: (res) => {
          this.running.set(false);
          this.result.set(res);
        },
        error: (err) => {
          this.running.set(false);
          this.error.set(extractApiError(err, this.i18n.instant('onboarding.errors.failed')));
          this.steps.update((list) =>
            list.map((s) => (s.status === 'active' ? { ...s, status: 'error' as const } : s)),
          );
        },
      });
  }

  stepIcon(status: OnboardingStep['status']): string {
    switch (status) {
      case 'done':
        return 'check_circle';
      case 'active':
        return 'hourglass_top';
      case 'error':
        return 'error';
      default:
        return 'radio_button_unchecked';
    }
  }

  copyPassword(): void {
    const pwd = this.result()?.password;
    if (pwd) void navigator.clipboard?.writeText(pwd);
  }
}
