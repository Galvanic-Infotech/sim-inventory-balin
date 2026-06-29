import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FitmentService } from '../../../core/services/fitment.service';
import { RbacService } from '../../../core/services/rbac.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { OtpBoxesComponent } from '../../../shared/components/otp-boxes/otp-boxes.component';
import {
  CreateFitmentRequest,
  Fitment,
  FitmentVehicleDetails,
} from '../../../shared/models/fitment.model';
import { EntityRtoItem, VehicleCategory } from '../../../shared/models/rbac.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';

type StepKey = 1 | 2 | 3;

@Component({
  selector: 'app-fitment-create-stepper',
  standalone: true,
  imports: [FormsModule, OtpBoxesComponent, TranslatePipe],
  templateUrl: './fitment-create-stepper.component.html',
  styleUrl: './fitment-create-stepper.component.scss',
})
export class FitmentCreateStepperComponent implements OnInit {
  private readonly fitmentSvc = inject(FitmentService);
  private readonly rbac = inject(RbacService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(TranslationService);

  @Output() done = new EventEmitter<Fitment>();
  @Output() cancel = new EventEmitter<void>();
  @Input() initialSerial: string | null = null;

  readonly currentStep = signal<StepKey>(1);
  readonly steps = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    return [
      { key: 1 as StepKey, label: this.i18n.instant('fitment.create.steps.serial'), icon: 'qr_code_2' },
      { key: 2 as StepKey, label: this.i18n.instant('fitment.create.steps.vehicle'), icon: 'directions_car' },
      { key: 3 as StepKey, label: this.i18n.instant('fitment.create.steps.otp'), icon: 'verified_user' },
    ];
  });

  // ── Step 1 ──
  serialNo = '';
  readonly step1Loading = signal(false);
  readonly step1Error = signal('');
  readonly vehicleDetails = signal<FitmentVehicleDetails | null>(null);
  readonly itemId = signal<string>('');
  readonly itemImei = signal<string>('');
  readonly itemSimProvider = signal<string>('');

  // ── Step 2 ──
  readonly step2Loading = signal(false);
  readonly step2Error = signal('');
  readonly rtos = signal<EntityRtoItem[]>([]);
  readonly categories = signal<VehicleCategory[]>([]);
  readonly mastersLoading = signal(false);

  // RTO combobox state
  readonly rtoSearch = signal('');
  readonly rtoOpen = signal(false);

  readonly filteredRtos = computed(() => {
    const q = this.rtoSearch().trim().toLowerCase();
    const list = this.rtos();
    if (!q) return list;
    return list.filter((r) => {
      const code = (r.rto.rtoCode ?? '').toLowerCase();
      const name = (r.rto.rtoName ?? '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  });

  readonly selectedRtoLabel = signal('');

  form = {
    rtoId: '',
    vehicleCategoryId: '',
    vehicleRegistrationNo: '',
    chassisNo: '',
    engineNo: '',
    vehicleMake: '',
    vehicleModel: '',
    mafYear: new Date().getFullYear(),
    customerName: '',
    mobileNo: '',
    address: '',
  };

  readonly createdFitment = signal<Fitment | null>(null);

  // ── Step 3 ──
  otp = '';
  readonly step3Loading = signal(false);
  readonly step3Error = signal('');
  readonly otpSuccess = signal('');
  readonly resendCooldown = signal(0);
  private resendTimer?: ReturnType<typeof setInterval>;

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

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.clearTimer());
    if (this.initialSerial?.trim()) {
      this.serialNo = this.initialSerial.trim();
      this.fetchVehicle();
    }
  }

  // ── Step navigation ──
  goToStep(s: StepKey): void {
    if (s < this.currentStep()) this.currentStep.set(s);
  }

  // ── Step 1 ──
  fetchVehicle(): void {
    const sn = this.serialNo.trim();
    if (!sn) {
      this.step1Error.set(this.i18n.instant('fitment.errors.enterSerial'));
      return;
    }
    this.step1Loading.set(true);
    this.step1Error.set('');
    this.fitmentSvc.getVehicleDetails(sn).subscribe({
      next: (res) => {
        this.step1Loading.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('fitment.errors.fetchVehicleFailed'));
        if (msg) {
          this.step1Error.set(msg);
          return;
        }
        const data = res.data;
        if (!data?.vehicleDetails || !data?.item?.itemId) {
          this.step1Error.set(this.i18n.instant('fitment.errors.invalidResponse'));
          return;
        }
        this.vehicleDetails.set(data.vehicleDetails);
        this.itemId.set(data.item.itemId);
        this.itemImei.set(data.item.imei ?? '');
        this.itemSimProvider.set(data.item.simProvider ?? '');
        this.prefillForm(data.vehicleDetails);
        this.loadMasters();
        this.currentStep.set(2);
      },
      error: (err) => {
        this.step1Loading.set(false);
        this.step1Error.set(extractApiError(err, this.i18n.instant('fitment.errors.fetchVehicleFailed')));
      },
    });
  }

  private prefillForm(v: FitmentVehicleDetails): void {
    this.form.vehicleRegistrationNo = v.rcNumber ?? '';
    this.form.chassisNo = v.vehiclesChasiNumber ?? '';
    this.form.engineNo = v.vehicleEngineNumber ?? '';
    this.form.vehicleMake = v.makerDescription ?? '';
    this.form.vehicleModel = v.makerModel ?? '';
    const mfgYear = v.manufacturingDateFormatted
      ? new Date(v.manufacturingDateFormatted).getFullYear()
      : new Date().getFullYear();
    this.form.mafYear = mfgYear;
    this.form.customerName = v.ownerName ?? '';
    this.form.address = v.presentAddress ?? '';
    if (v.mobileNumber && !this.form.mobileNo) {
      this.form.mobileNo = v.mobileNumber;
    }
  }

  // ── Step 2 ──
  private loadMasters(): void {
    this.mastersLoading.set(true);
    this.rbac.getEntityRtos().subscribe({
      next: (res) => this.rtos.set(res.data ?? []),
      error: () => this.rtos.set([]),
    });
    this.rbac.getVehicleCategories({ pageSize: 200 }).subscribe({
      next: (res) => {
        this.mastersLoading.set(false);
        this.categories.set(res.data ?? []);
      },
      error: () => {
        this.mastersLoading.set(false);
        this.categories.set([]);
      },
    });
  }

  submitFitment(): void {
    const f = this.form;
    if (!this.itemId() || !f.rtoId || !f.vehicleCategoryId) {
      this.step2Error.set(this.i18n.instant('fitment.errors.selectRtoCategory'));
      return;
    }
    if (!f.vehicleRegistrationNo || !f.chassisNo || !f.engineNo || !f.customerName || !f.mobileNo) {
      this.step2Error.set(this.i18n.instant('fitment.errors.fillRequired'));
      return;
    }
    if (!/^\d{10}$/.test(f.mobileNo)) {
      this.step2Error.set(this.i18n.instant('fitment.errors.invalidMobile'));
      return;
    }

    const body: CreateFitmentRequest = {
      itemId: this.itemId(),
      rtoId: f.rtoId,
      vehicleCategoryId: f.vehicleCategoryId,
      vehicleRegistrationNo: f.vehicleRegistrationNo,
      chassisNo: f.chassisNo,
      engineNo: f.engineNo,
      vehicleMake: f.vehicleMake,
      vehicleModel: f.vehicleModel,
      mafYear: Number(f.mafYear),
      customerName: f.customerName,
      mobileNo: f.mobileNo,
      address: f.address,
    };

    this.step2Loading.set(true);
    this.step2Error.set('');
    this.fitmentSvc.createFitment(body).subscribe({
      next: (res) => {
        this.step2Loading.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('fitment.errors.createFailed'));
        if (msg) {
          this.step2Error.set(msg);
          return;
        }
        if (!res.data?.id) {
          this.step2Error.set(this.i18n.instant('fitment.errors.missingFitmentId'));
          return;
        }
        this.createdFitment.set(res.data);
        this.currentStep.set(3);
        this.startResendTimer();
      },
      error: (err) => {
        this.step2Loading.set(false);
        this.step2Error.set(extractApiError(err, this.i18n.instant('fitment.errors.createFailed')));
      },
    });
  }

  openRto(): void {
    if (this.mastersLoading()) return;
    this.rtoOpen.set(true);
  }

  closeRto(): void {
    this.rtoOpen.set(false);
    this.rtoSearch.set('');
  }

  selectRto(r: EntityRtoItem): void {
    this.form.rtoId = r.rto.id;
    this.selectedRtoLabel.set(`${r.rto.rtoCode} — ${r.rto.rtoName}`);
    this.closeRto();
  }

  clearRto(event?: Event): void {
    event?.stopPropagation();
    this.form.rtoId = '';
    this.selectedRtoLabel.set('');
    this.rtoSearch.set('');
  }

  onlyDigits(e: KeyboardEvent): void {
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  onPasteDigits(e: ClipboardEvent): void {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!/^\d*$/.test(text)) e.preventDefault();
  }

  // ── Step 3 ──
  verifyOtp(): void {
    const f = this.createdFitment();
    if (!f) return;
    const otp = this.otp.trim();
    if (!otp || otp.length < 4) {
      this.step3Error.set(this.i18n.instant('fitment.errors.enterValidOtp'));
      return;
    }
    this.step3Loading.set(true);
    this.step3Error.set('');
    this.otpSuccess.set('');
    this.fitmentSvc.validateOtp({ fitmentId: f.id, otp }).subscribe({
      next: (res) => {
        this.step3Loading.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('fitment.errors.verifyOtpFailed'));
        if (msg) {
          this.handleVerifyFail(msg, f.id);
          return;
        }
        this.otpSuccess.set(res.data?.message || this.i18n.instant('fitment.errors.otpVerifiedSuccess'));
        this.clearTimer();
        setTimeout(() => this.done.emit(f), 800);
      },
      error: (err) => {
        this.step3Loading.set(false);
        const msg = extractApiError(err, this.i18n.instant('fitment.errors.verifyOtpFailed'));
        this.handleVerifyFail(msg, f.id);
      },
    });
  }

  private handleVerifyFail(msg: string, fitmentId: string): void {
    this.step3Error.set(msg);
    if (/otp\s*expired/i.test(msg)) {
      this.otp = '';
      this.fitmentSvc.initiateOtp({ fitmentId }).subscribe({
        next: (res) => {
          const m = getApiResponseError(res, this.i18n.instant('fitment.errors.initiateOtpFailed'));
          if (m) {
            this.step3Error.set(m);
            return;
          }
          this.startResendTimer();
        },
        error: (err) => this.step3Error.set(extractApiError(err, this.i18n.instant('fitment.errors.initiateOtpFailed'))),
      });
    }
  }

  resendOtp(): void {
    const f = this.createdFitment();
    if (!f || !this.canResend()) return;
    this.step3Error.set('');
    this.fitmentSvc.resendOtp({ fitmentId: f.id }).subscribe({
      next: (res) => {
        const msg = getApiResponseError(res, this.i18n.instant('fitment.errors.resendOtpFailed'));
        if (msg) {
          this.step3Error.set(msg);
          return;
        }
        this.startResendTimer();
      },
      error: (err) => {
        this.step3Error.set(extractApiError(err, this.i18n.instant('fitment.errors.resendOtpFailed')));
      },
    });
  }

  skipOtp(): void {
    const f = this.createdFitment();
    if (!f) return;
    this.clearTimer();
    this.done.emit(f);
  }

  private startResendTimer(): void {
    this.clearTimer();
    this.resendCooldown.set(120);
    this.resendTimer = setInterval(() => {
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
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = undefined;
    }
  }
}
