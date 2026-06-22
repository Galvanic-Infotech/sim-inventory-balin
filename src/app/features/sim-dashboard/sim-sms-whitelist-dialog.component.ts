import { Component, inject, input, output, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimService } from '../../core/services/sim.service';
import { TranslationService } from '../../core/services/translation.service';
import { extractApiError } from '../../core/utils/api-error.util';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import {
  SmsWhitelisting,
  SmsWhitelistType,
  emptySmsWhitelisting,
} from '../../shared/models/sim.model';

const WHITELIST_TYPES: { value: SmsWhitelistType; labelKey: string }[] = [
  { value: null, labelKey: 'simDashboard.smsWhitelist.none' },
  { value: 'INCOMING', labelKey: 'simDashboard.smsWhitelist.incoming' },
  { value: 'OUTGOING', labelKey: 'simDashboard.smsWhitelist.outgoing' },
  { value: 'INCOMINGANDOUTGOING', labelKey: 'simDashboard.smsWhitelist.incomingOutgoing' },
];

@Component({
  selector: 'app-sim-sms-whitelist-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <div class="dialog-card dialog-card--wide" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h2>{{ 'simDashboard.smsWhitelist.title' | translate }}</h2>
          <button type="button" class="btn btn-ghost" (click)="closed.emit()">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="dialog-body">
          @if (loading()) {
            <div class="tab-loading">
              <span class="spinner spinner--dark spinner--lg"></span>
            </div>
          } @else if (error()) {
            <div class="alert alert-danger">{{ error() }}</div>
          } @else {
            @if (data()?.basketName) {
              <p class="text-muted sms-meta">
                {{ 'simDashboard.smsWhitelist.basket' | translate }}: {{ data()!.basketName }}
                @if (data()!.remainingOrderCount) {
                  · {{ 'simDashboard.smsWhitelist.remainingOrders' | translate }}: {{ data()!.remainingOrderCount }}
                }
              </p>
            }
            @for (entry of entries(); track $index) {
              <div class="sms-row">
                <div class="form-group">
                  <label>{{ 'simDashboard.smsWhitelist.whitelistNumber' | translate: { index: $index + 1 } }}</label>
                  <input
                    class="form-control"
                    type="text"
                    inputmode="numeric"
                    [ngModel]="entry.number"
                    (ngModelChange)="updateNumber($index, $event)"
                  />
                </div>
                <div class="form-group">
                  <label>{{ 'simDashboard.smsWhitelist.type' | translate }}</label>
                  <select
                    class="form-control"
                    [ngModel]="entry.type"
                    (ngModelChange)="updateType($index, $event)"
                  >
                    @for (t of whitelistTypes; track t.labelKey) {
                      <option [ngValue]="t.value">{{ t.labelKey | translate }}</option>
                    }
                  </select>
                </div>
              </div>
            }
            @if (saveError()) {
              <div class="alert alert-danger">{{ saveError() }}</div>
            }
            @if (saveSuccess()) {
              <div class="alert alert-success">{{ 'simDashboard.smsWhitelist.saved' | translate }}</div>
            }
          }
        </div>
        <div class="dialog-footer">
          <button type="button" class="btn btn-outline" (click)="closed.emit()">{{ 'common.cancel' | translate }}</button>
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="saving() || loading()"
            (click)="save()"
          >
            @if (saving()) {
              <span class="spinner"></span>
            }
            {{ 'simDashboard.smsWhitelist.save' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .sms-meta {
      margin: 0 0 var(--space-md);
      font-size: var(--font-sm);
    }
    .sms-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-md);
      margin-bottom: var(--space-md);
    }
    @media (max-width: 600px) {
      .sms-row {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class SimSmsWhitelistDialogComponent {
  private readonly sim = inject(SimService);
  private readonly i18n = inject(TranslationService);

  readonly iccid = input.required<string>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly whitelistTypes = WHITELIST_TYPES;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saveError = signal('');
  readonly saveSuccess = signal(false);
  readonly data = signal<SmsWhitelisting | null>(null);
  readonly entries = signal<{ number: string | null; type: string | null }[]>([]);

  constructor() {
    effect(() => {
      const iccid = this.iccid();
      if (iccid) this.load(iccid);
    });
  }

  private load(iccid: string): void {
    this.loading.set(true);
    this.error.set('');
    this.sim.fetchSmsWhitelisting(iccid).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.data.set(res);
        this.entries.set(
          res.entries.map((e) => ({
            number: e.number,
            type: e.type,
          })),
        );
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          extractApiError(err, this.i18n.translate('simDashboard.search.errors.requestFailed')),
        );
        this.data.set(emptySmsWhitelisting());
        this.entries.set(
          emptySmsWhitelisting().entries.map((e) => ({
            number: e.number,
            type: e.type,
          })),
        );
      },
    });
  }

  updateNumber(index: number, value: string): void {
    this.entries.update((list) => {
      const next = [...list];
      next[index] = { ...next[index], number: value || null };
      return next;
    });
  }

  updateType(index: number, value: string | null): void {
    this.entries.update((list) => {
      const next = [...list];
      next[index] = { ...next[index], type: value || null };
      return next;
    });
  }

  save(): void {
    const d = this.data();
    const msisdn = d?.msisdn;
    if (!msisdn) {
      this.saveError.set(this.i18n.translate('simDashboard.smsWhitelist.errors.msisdnUnavailable'));
      return;
    }
    const e = this.entries();
    this.saving.set(true);
    this.saveError.set('');
    this.saveSuccess.set(false);
    this.sim
      .patchSmsWhitelisting({
        msisdn,
        whitelistNumber1: e[0]?.number ?? null,
        whitelistNumber2: e[1]?.number ?? null,
        whitelistNumber3: e[2]?.number ?? null,
        whitelistNumber4: e[3]?.number ?? null,
        whitelistNumberType1: e[0]?.type ?? null,
        whitelistNumberType2: e[1]?.type ?? null,
        whitelistNumberType3: e[2]?.type ?? null,
        whitelistNumberType4: e[3]?.type ?? null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saveSuccess.set(true);
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(
            extractApiError(err, this.i18n.translate('simDashboard.search.errors.requestFailed')),
          );
        },
      });
  }

}
