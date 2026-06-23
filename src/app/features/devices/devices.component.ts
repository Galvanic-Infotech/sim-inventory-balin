import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DevicesListPanelComponent } from './panels/devices-list-panel.component';
import { DevicesTransferPanelComponent } from './panels/transfer-panel.component';
import { DevicesActivateRechargePanelComponent } from './panels/activate-recharge-panel.component';
import { DevicesSimStatusPanelComponent } from './panels/sim-status-panel.component';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

interface DevicesTab {
  key: 'devices' | 'transfer' | 'activate-recharge' | 'sim-status';
  labelKey: string;
  icon: string;
}

const VALID_TABS = new Set(['devices', 'transfer', 'activate-recharge', 'sim-status']);

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [
    DevicesListPanelComponent,
    DevicesTransferPanelComponent,
    DevicesActivateRechargePanelComponent,
    DevicesSimStatusPanelComponent,
    TranslatePipe,
  ],
  templateUrl: './devices.component.html',
  styleUrl: './devices.component.scss',
})
export class DevicesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslationService);

  private readonly tabDefs: DevicesTab[] = [
    { key: 'devices', labelKey: 'devices.tabs.devices', icon: 'memory' },
    { key: 'transfer', labelKey: 'devices.tabs.transfer', icon: 'swap_horiz' },
    { key: 'activate-recharge', labelKey: 'devices.tabs.activateRecharge', icon: 'sim_card' },
    { key: 'sim-status', labelKey: 'devices.tabs.simStatus', icon: 'signal_cellular_alt' },
  ];

  readonly tabs = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    return this.tabDefs.map((t) => ({
      ...t,
      label: this.i18n.instant(t.labelKey),
    }));
  });

  readonly activeTab = signal<DevicesTab['key']>('devices');

  constructor() {
    const fromQuery = this.route.snapshot.queryParamMap.get('tab');
    if (fromQuery && VALID_TABS.has(fromQuery)) {
      this.activeTab.set(fromQuery as DevicesTab['key']);
    }
  }

  selectTab(key: DevicesTab['key']): void {
    this.activeTab.set(key);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
