import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimService } from '../../core/services/sim.service';
import { PermissionService, PERMS } from '../../core/services/permission.service';
import {
  SimDetail,
  resolveSimFilterType,
  simStatusLabel,
  formatIstDateTime,
  isSimInitial,
  isSimActive,
  isSimTempDisconnected,
  itemStatusChipClass,
} from '../../shared/models/sim.model';
import { extractApiError } from '../../core/utils/api-error.util';
import { SimSmsWhitelistDialogComponent } from './sim-sms-whitelist-dialog.component';

export type ValidTillPreset = '3months' | '6months' | '1year' | 'custom';

@Component({
  selector: 'app-sim-search-panel',
  standalone: true,
  imports: [FormsModule, SimSmsWhitelistDialogComponent],
  templateUrl: './sim-search-panel.component.html',
  styleUrl: './sim-search-panel.component.scss',
})
export class SimSearchPanelComponent {
  private readonly sim = inject(SimService);
  readonly perm = inject(PermissionService);

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

  // Activation form fields
  validTillPreset: ValidTillPreset = '1year';
  validTillCustom = '';
  imei = '';
  customerName = '';
  remarks = '';

  readonly statusLabel = simStatusLabel;
  readonly formatDate = formatIstDateTime;
  readonly isInitial = isSimInitial;
  readonly isActive = isSimActive;
  readonly isTempDisconnected = isSimTempDisconnected;

  search(): void {
    const value = this.searchValue.trim();
    if (!value) return;

    const filterType = resolveSimFilterType(value);
    if (!filterType) {
      this.searchError.set('Enter a valid SIM number (899…) or MSISDN (57…)');
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
        this.searchError.set(extractApiError(err, 'Request failed'));
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
        this.actionError.set('Please select a valid date');
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
          this.actionSuccess.set('SIM activation initiated successfully.');
          done();
        },
        error: (err) => {
          this.actionLoading.set(false);
          this.actionError.set(extractApiError(err, 'Request failed'));
        },
      });
    } else if (type === 'temp') {
      this.sim.tempDisconnect(sim.iccid, sim.simPhone).subscribe({
        next: () => {
          this.actionSuccess.set('SIM temporarily deactivated.');
          done();
        },
        error: (err) => {
          this.actionLoading.set(false);
          this.actionError.set(extractApiError(err, 'Request failed'));
        },
      });
    } else {
      this.sim.resumeTempDisconnect(sim.iccid, sim.simPhone).subscribe({
        next: () => {
          this.actionSuccess.set('SIM connection resumed.');
          done();
        },
        error: (err) => {
          this.actionLoading.set(false);
          this.actionError.set(extractApiError(err, 'Request failed'));
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
}
