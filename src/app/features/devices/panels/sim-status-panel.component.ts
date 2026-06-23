import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RbacService } from '../../../core/services/rbac.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { translatedItemStatusMeta } from '../../../core/utils/item-status-i18n.util';
import { TranslationService } from '../../../core/services/translation.service';
import { FetchSimStatusData, SimCardProvider } from '../../../shared/models/rbac.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-devices-sim-status-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, TranslatePipe],
  templateUrl: './sim-status-panel.component.html',
  styleUrls: ['./panel-shared.scss', './sim-status-panel.component.scss'],
})
export class DevicesSimStatusPanelComponent implements OnInit {
  private readonly rbac = inject(RbacService);
  private readonly i18n = inject(TranslationService);

  readonly simProviders = signal<SimCardProvider[]>([]);
  readonly providersLoading = signal(false);
  readonly providersError = signal('');

  readonly simProviderId = signal('');
  readonly iccid = signal('');

  readonly fetching = signal(false);
  readonly fetchError = signal('');
  readonly result = signal<FetchSimStatusData | null>(null);

  readonly canFetch = computed(
    () => !!this.simProviderId().trim() && !!this.iccid().trim() && !this.fetching(),
  );

  readonly statusMeta = computed(() => {
    const data = this.result();
    if (!data?.status) return null;
    this.i18n.lang();
    this.i18n.revision();
    return translatedItemStatusMeta(data.status, (k) => this.i18n.instant(k));
  });

  ngOnInit(): void {
    this.loadProviders();
  }

  fetch(): void {
    const provider = this.simProviders().find((p) => p.id === this.simProviderId());
    const iccid = this.iccid().trim();
    if (!provider || !iccid) return;

    this.fetching.set(true);
    this.fetchError.set('');
    this.result.set(null);

    this.rbac.fetchSimStatus(provider.name.toLowerCase(), iccid).subscribe({
      next: (res) => {
        this.fetching.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('devices.errors.requestFailed'));
        if (msg) {
          this.fetchError.set(msg);
          return;
        }
        this.result.set(res.data ?? null);
      },
      error: (err) => {
        this.fetching.set(false);
        this.fetchError.set(extractApiError(err, this.i18n.instant('devices.errors.requestFailed')));
      },
    });
  }

  private loadProviders(): void {
    this.providersLoading.set(true);
    this.providersError.set('');

    this.rbac.getSimCardProviders({ pageNumber: 1, pageSize: 200 }).subscribe({
      next: (res) => {
        this.providersLoading.set(false);
        this.simProviders.set((res.data ?? []).filter((p) => p.isActive !== false));
      },
      error: (err) => {
        this.providersLoading.set(false);
        this.providersError.set(
          extractApiError(err, this.i18n.instant('devices.simStatus.loadProvidersFailed')),
        );
        this.simProviders.set([]);
      },
    });
  }
}
