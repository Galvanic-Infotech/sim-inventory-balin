import { Component, computed, inject, OnDestroy, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimService } from '../../core/services/sim.service';
import { PermissionService, PERMS } from '../../core/services/permission.service';
import { TranslationService } from '../../core/services/translation.service';
import { APP_CONFIG } from '../../core/constants/api.constants';
import {
  SimDetail,
  resolveSimFilterType,
  formatIstDateTime,
  isSimInitial,
  isSimActive,
  isSimTempDisconnected,
  itemStatusChipClass,
} from '../../shared/models/sim.model';
import { SimInventoryItem } from '../../shared/models/sim-inventory.model';
import { itemStatusLabel, normalizeItemStatus } from '../../shared/models/item-status.model';
import { extractApiError } from '../../core/utils/api-error.util';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { SimSmsWhitelistDialogComponent } from './sim-sms-whitelist-dialog.component';

export type ValidTillPreset = '3months' | '6months' | '1year' | 'custom';

const MIN_SUGGEST_LEN = 3;
const SUGGEST_PAGE_SIZE = 8;

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
  private suggestTimer?: ReturnType<typeof setTimeout>;
  private suggestBlurTimer?: ReturnType<typeof setTimeout>;
  private suggestGen = 0;

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
  readonly actionsLocked = computed(() => this.clearCountdown() !== null);
  readonly suggestions = signal<SimInventoryItem[]>([]);
  readonly suggestionsLoading = signal(false);
  readonly showSuggestions = signal(false);

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
    this.clearSuggestTimer();
    clearTimeout(this.suggestBlurTimer);
  }

  onInputChange(value: string): void {
    this.searchValue = value;
    if (this.actionsLocked()) return;

    this.clearSuggestTimer();
    const term = value.trim();
    if (term.length < MIN_SUGGEST_LEN) {
      this.closeSuggestions();
      return;
    }

    this.showSuggestions.set(true);
    this.suggestTimer = setTimeout(() => this.fetchSuggestions(term), APP_CONFIG.DEBOUNCE_MS);
  }

  onInputFocus(): void {
    if (this.actionsLocked()) return;
    const term = this.searchValue.trim();
    if (term.length >= MIN_SUGGEST_LEN && this.suggestions().length) {
      this.showSuggestions.set(true);
    }
  }

  onInputBlur(): void {
    clearTimeout(this.suggestBlurTimer);
    this.suggestBlurTimer = setTimeout(() => this.closeSuggestions(), 150);
  }

  selectSuggestion(item: SimInventoryItem): void {
    clearTimeout(this.suggestBlurTimer);
    this.closeSuggestions();
    const value = this.suggestionSearchValue(item);
    if (!value) return;
    this.searchValue = value;
    this.search();
  }

  suggestionSearchValue(item: SimInventoryItem): string {
    const mobile = item.mobileNo?.trim();
    const iccid = item.iccid?.trim();
    if (mobile && resolveSimFilterType(mobile)) return mobile;
    if (iccid && resolveSimFilterType(iccid)) return iccid;
    return mobile || iccid || '';
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
    if (this.actionsLocked()) return;
    this.closeSuggestions();
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
    if (this.actionsLocked()) return;
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
          this.onActionSuccess(this.i18n.translate('simDashboard.search.success.activateInitiated'));
        },
        error: (err) => this.onActionError(err),
      });
    } else if (type === 'temp') {
      this.sim.tempDisconnect(sim.iccid, sim.simPhone).subscribe({
        next: () => {
          this.onActionSuccess(this.i18n.translate('simDashboard.search.success.tempDeactivated'));
        },
        error: (err) => this.onActionError(err),
      });
    } else {
      this.sim.resumeTempDisconnect(sim.iccid, sim.simPhone).subscribe({
        next: () => {
          this.onActionSuccess(this.i18n.translate('simDashboard.search.success.resumed'));
        },
        error: (err) => this.onActionError(err),
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

  private onActionSuccess(message: string): void {
    this.actionLoading.set(false);
    this.showConfirm.set(null);
    this.basketRefresh.emit();
    this.actionSuccess.set(message);
    this.startPostActionCountdown();
  }

  private onActionError(err: unknown): void {
    this.actionLoading.set(false);
    this.actionError.set(
      extractApiError(err, this.i18n.translate('simDashboard.search.errors.requestFailed')),
    );
  }

  private startPostActionCountdown(): void {
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
    this.closeSuggestions();
  }

  private fetchSuggestions(term: string): void {
    const gen = ++this.suggestGen;
    this.suggestionsLoading.set(true);

    this.sim
      .fetchSimInventory({
        pageNumber: 1,
        pageSize: SUGGEST_PAGE_SIZE,
        searchTerm: term,
        sortBy: 'activationAt',
        sortOrder: 'desc',
      })
      .subscribe({
        next: ({ items }) => {
          if (gen !== this.suggestGen) return;
          this.suggestionsLoading.set(false);
          this.suggestions.set(items);
          this.showSuggestions.set(true);
        },
        error: () => {
          if (gen !== this.suggestGen) return;
          this.suggestionsLoading.set(false);
          this.suggestions.set([]);
        },
      });
  }

  private closeSuggestions(): void {
    this.clearSuggestTimer();
    this.showSuggestions.set(false);
    this.suggestions.set([]);
    this.suggestionsLoading.set(false);
    this.suggestGen++;
  }

  private clearSuggestTimer(): void {
    clearTimeout(this.suggestTimer);
    this.suggestTimer = undefined;
  }
}
