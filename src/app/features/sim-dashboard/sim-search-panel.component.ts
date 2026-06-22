import { Component, inject, OnDestroy, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimService } from '../../core/services/sim.service';
import { PermissionService, PERMS } from '../../core/services/permission.service';
import { TranslationService } from '../../core/services/translation.service';
import {
  SimDetail,
  resolveSimFilterType,
  formatIstDateTime,
  isSimInitial,
  isSimActive,
  isSimTempDisconnected,
  itemStatusChipClass,
} from '../../shared/models/sim.model';
import { itemStatusLabel, normalizeItemStatus } from '../../shared/models/item-status.model';
import { extractApiError } from '../../core/utils/api-error.util';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { SimSmsWhitelistDialogComponent } from './sim-sms-whitelist-dialog.component';

export type ValidTillPreset = '3months' | '6months' | '1year' | 'custom';

interface DetailField {
  icon: string;
  labelKey: string;
  value: string;
}

@Component({
  selector: 'app-sim-search-panel',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SimSmsWhitelistDialogComponent],
  templateUrl: './sim-search-panel.component.html',
  styleUrl: './sim-search-panel.component.scss',
})
export class SimSearchPanelComponent implements OnDestroy {
  private readonly sim = inject(SimService);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);
  private clearCountdownTimer: ReturnType<typeof setInterval> | null = null;

  readonly basketRefresh = output<void>();

  readonly canActivate = this.perm.can(PERMS.SIM_ACTIVATE);
  readonly canTempSuspend = this.perm.can(PERMS.SIM_TEMP_SUSPEND);
  readonly canResume = this.perm.can(PERMS.SIM_RESUME);

  searchValue = '';
  readonly searching = signal(false);
  readonly searchError = signal('');
  readonly hasSearched = signal(false);
  readonly simDetail = signal<SimDetail | null>(null);
  readonly actionLoading = signal(false);
  readonly actionError = signal('');
  readonly actionSuccess = signal('');
  readonly showConfirm = signal<'activate' | 'temp' | 'resume' | null>(null);
  readonly showSmsDialog = signal(false);
  readonly copiedToast = signal(false);
  readonly clearCountdown = signal<number | null>(null);
  readonly statusChecking = signal(false);

  // Activation form fields
  validTillPreset: ValidTillPreset = '1year';
  validTillCustom = '';
  imei = '';
  customerName = '';
  remarks = '';

  readonly isInitial = isSimInitial;
  readonly isActive = isSimActive;
  readonly isTempDisconnected = isSimTempDisconnected;

  ngOnDestroy(): void {
    this.stopClearCountdown();
  }

  detailFields(sim: SimDetail): DetailField[] {
    return [
      { icon: 'sim_card', labelKey: 'simDashboard.search.fields.iccid', value: sim.iccid },
      { icon: 'phone', labelKey: 'simDashboard.search.fields.simPhone', value: sim.simPhone },
      { icon: 'numbers', labelKey: 'simDashboard.search.fields.serialNumber', value: sim.serialNumber },
      { icon: 'info', labelKey: 'simDashboard.search.fields.status', value: this.translatedStatus(sim.status) },
      { icon: 'calendar_today', labelKey: 'simDashboard.search.fields.onboardedAt', value: formatIstDateTime(sim.onboardedAt) },
      { icon: 'check_circle', labelKey: 'simDashboard.search.fields.activationAt', value: formatIstDateTime(sim.activationAt) },
    ];
  }

  translatedStatus(status: string): string {
    const normalized = normalizeItemStatus(status);
    const key = `simInventory.status.${normalized}`;
    const translated = this.i18n.translate(key);
    if (translated !== key) return translated;
    return itemStatusLabel(status);
  }

  search(): void {
    this.stopClearCountdown();

    const value = this.searchValue.trim();
    if (!value) return;

    const filterType = resolveSimFilterType(value);
    if (!filterType) {
      this.searchError.set(this.i18n.translate('simDashboard.search.errors.invalidNumber'));
      this.hasSearched.set(true);
      this.simDetail.set(null);
      return;
    }

    this.searching.set(true);
    this.searchError.set('');
    this.hasSearched.set(true);
    this.simDetail.set(null);
    this.actionSuccess.set('');

    this.sim.searchSim(filterType, value).subscribe({
      next: (sim) => {
        this.searching.set(false);
        this.simDetail.set(sim);
      },
      error: (err) => {
        this.searching.set(false);
        this.searchError.set(
          extractApiError(err, this.i18n.translate('simDashboard.search.errors.requestFailed')),
        );
      },
    });
  }

  openConfirm(type: 'activate' | 'temp' | 'resume'): void {
    if (type === 'activate') {
      this.validTillPreset = '1year';
      this.validTillCustom = '';
      this.imei = '';
      this.customerName = '';
      this.remarks = '';
    }
    this.actionError.set('');
    this.showConfirm.set(type);
  }

  closeConfirm(): void {
    this.showConfirm.set(null);
  }

  get computedValidTill(): string {
    if (this.validTillPreset === 'custom') {
      return this.validTillCustom;
    }
    const today = new Date();
    switch (this.validTillPreset) {
      case '3months':
        today.setMonth(today.getMonth() + 3);
        break;
      case '6months':
        today.setMonth(today.getMonth() + 6);
        break;
      case '1year':
        today.setFullYear(today.getFullYear() + 1);
        break;
    }
    return today.toISOString().split('T')[0];
  }

  get minDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  confirmAction(): void {
    const sim = this.simDetail();
    const type = this.showConfirm();
    if (!sim || !type) return;

    this.actionLoading.set(true);
    this.actionError.set('');
    this.actionSuccess.set('');

    const done = () => {
      this.actionLoading.set(false);
      this.showConfirm.set(null);
      this.basketRefresh.emit();
      this.search();
    };

    if (type === 'activate') {
      const validTill = this.computedValidTill;
      if (!validTill) {
        this.actionLoading.set(false);
        this.actionError.set(this.i18n.translate('simDashboard.search.errors.invalidDate'));
        return;
      }
      this.sim.activateSim({
        iccid: sim.iccid,
        validTill,
        imei: this.imei.trim(),
        customerName: this.customerName.trim(),
        remarks: this.remarks.trim(),
      }).subscribe({
        next: () => {
          this.actionLoading.set(false);
          this.showConfirm.set(null);
          this.basketRefresh.emit();
          this.refreshSimDetail();
          this.actionSuccess.set(this.i18n.translate('simDashboard.search.success.activateInitiated'));
          this.startPostActivateCountdown();
        },
        error: (err) => {
          this.actionLoading.set(false);
          this.actionError.set(
            extractApiError(err, this.i18n.translate('simDashboard.search.errors.requestFailed')),
          );
        },
      });
    } else if (type === 'temp') {
      this.sim.tempDisconnect(sim.iccid, sim.simPhone).subscribe({
        next: () => {
          this.actionSuccess.set(this.i18n.translate('simDashboard.search.success.tempDeactivated'));
          done();
        },
        error: (err) => {
          this.actionLoading.set(false);
          this.actionError.set(
            extractApiError(err, this.i18n.translate('simDashboard.search.errors.requestFailed')),
          );
        },
      });
    } else {
      this.sim.resumeTempDisconnect(sim.iccid, sim.simPhone).subscribe({
        next: () => {
          this.actionSuccess.set(this.i18n.translate('simDashboard.search.success.resumed'));
          done();
        },
        error: (err) => {
          this.actionLoading.set(false);
          this.actionError.set(
            extractApiError(err, this.i18n.translate('simDashboard.search.errors.requestFailed')),
          );
        },
      });
    }
  }

  copyValue(value: string): void {
    if (!value || value === '—') return;
    navigator.clipboard.writeText(value).then(() => {
      this.copiedToast.set(true);
      setTimeout(() => this.copiedToast.set(false), 1500);
    });
  }

  statusClass(status: string): string {
    return itemStatusChipClass(status);
  }

  checkStatus(): void {
    this.fetchSimDetail(false);
  }

  private refreshSimDetail(): void {
    this.fetchSimDetail(true);
  }

  private fetchSimDetail(silent: boolean): void {
    if (!silent && this.statusChecking()) return;

    const value = this.searchValue.trim();
    if (!value) return;

    const filterType = resolveSimFilterType(value);
    if (!filterType) return;

    if (!silent) {
      this.statusChecking.set(true);
      this.searchError.set('');
    }

    this.sim.searchSim(filterType, value).subscribe({
      next: (sim) => {
        if (!silent) this.statusChecking.set(false);
        this.simDetail.set(sim);
      },
      error: (err) => {
        if (!silent) {
          this.statusChecking.set(false);
          this.searchError.set(
            extractApiError(err, this.i18n.translate('simDashboard.search.errors.requestFailed')),
          );
        }
      },
    });
  }

  private startPostActivateCountdown(): void {
    this.stopClearCountdown();
    this.clearCountdown.set(10);

    this.clearCountdownTimer = setInterval(() => {
      const seconds = this.clearCountdown();
      if (seconds === null || seconds <= 1) {
        this.stopClearCountdown();
        this.resetSearch();
        return;
      }
      this.clearCountdown.set(seconds - 1);
    }, 1000);
  }

  private stopClearCountdown(): void {
    if (this.clearCountdownTimer) {
      clearInterval(this.clearCountdownTimer);
      this.clearCountdownTimer = null;
    }
    this.clearCountdown.set(null);
  }

  private resetSearch(): void {
    this.searchValue = '';
    this.hasSearched.set(false);
    this.simDetail.set(null);
    this.actionSuccess.set('');
    this.searchError.set('');
    this.actionError.set('');
  }
}
