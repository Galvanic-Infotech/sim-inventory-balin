import { Component, computed, inject, signal } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { OutstandingTabComponent } from './tabs/outstanding-tab.component';

interface ReportTab {
  labelKey: string;
  icon: string;
  key: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [OutstandingTabComponent, TranslatePipe],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private readonly i18n = inject(TranslationService);

  private readonly tabDefs: ReportTab[] = [
    { labelKey: 'reports.tabs.outstanding', icon: 'account_balance_wallet', key: 'outstanding' },
  ];

  readonly activeTabKey = signal(this.tabDefs[0].key);

  readonly tabs = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    return this.tabDefs.map((tab) => ({ ...tab, label: this.i18n.instant(tab.labelKey) }));
  });

  selectTab(key: string): void {
    this.activeTabKey.set(key);
  }
}
