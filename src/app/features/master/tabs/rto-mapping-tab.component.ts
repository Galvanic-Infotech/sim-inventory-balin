import { Component, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RbacService } from '../../../core/services/rbac.service';
import { AuthService } from '../../../core/services/auth.service';
import { EntityRtoItem } from '../../../shared/models/rbac.model';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface RtoOpt {
  id: string;
  rtoCode: string;
  rtoName: string;
  districtName: string;
}
interface StateGroup {
  stateId: string;
  stateName: string;
  rtos: RtoOpt[];
}
interface MappedGroup {
  stateId: string;
  stateName: string;
  items: EntityRtoItem[];
}

@Component({
  selector: 'app-rto-mapping-tab',
  standalone: true,
  imports: [FormsModule, DeleteConfirmDialogComponent, TranslatePipe],
  template: `
    <div class="tab-toolbar">
      <div class="tab-toolbar-left">
        <h3>{{ 'master.rto.title' | translate }}</h3>
        <span class="count-badge">{{ filtered().length }}</span>
      </div>
      <div class="tab-toolbar-right">
        <div class="input-wrapper rto-search">
          <span class="material-icons input-icon">search</span>
          <input
            class="form-control form-control--icon-left"
            [placeholder]="'master.rto.searchPlaceholder' | translate"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
          />
        </div>
        <button class="btn btn-primary btn-sm" (click)="openAdd()">
          <span class="material-icons">add</span> {{ 'master.rto.addRto' | translate }}
        </button>
      </div>
    </div>

    @if (errMsg()) {
      <div class="alert alert-danger" style="margin: var(--space-md) 0;">{{ errMsg() }}</div>
    }

    @if (loading()) {
      <div style="text-align:center; padding: var(--space-2xl);"><span class="spinner"></span></div>
    } @else if (filtered().length === 0) {
      <div class="empty-state">
        <span class="material-icons">location_on</span>
        <p>{{ 'master.rto.empty' | translate }}</p>
        <button class="btn btn-primary btn-sm" (click)="openAdd()" style="margin-top: var(--space-md);">
          <span class="material-icons">add</span> {{ 'master.rto.addFirst' | translate }}
        </button>
      </div>
    } @else {
      <div class="rto-grid">
        @for (m of filtered(); track m.rto.id) {
          <div class="rto-card">
            <div class="rto-card__head">
              <span class="rto-code">{{ m.rto.rtoCode }}</span>
              <button
                class="icon-btn icon-btn--danger"
                type="button"
                [title]="'master.rto.removeTitle' | translate"
                (click)="requestRemoveMapped(m.rto.id, m.rto.rtoCode + ' — ' + m.rto.rtoName)"
                [disabled]="saving()"
              >
                <span class="material-icons">delete</span>
              </button>
            </div>
            <div class="rto-name">{{ m.rto.rtoName }}</div>
            <div class="rto-meta">
              <div class="meta-row">
                <span class="material-icons">place</span>
                <span>{{ m.rto.district.districtName }}</span>
              </div>
              <div class="meta-row">
                <span class="material-icons">public</span>
                <span>{{ m.rto.district.state.stateName }} ({{ m.rto.district.state.stateCode }})</span>
              </div>
            </div>
          </div>
        }
      </div>
    }

    @if (showAdd()) {
      <div class="drawer-backdrop" (click)="closeAdd()"></div>
      <div class="drawer-panel drawer-panel--wide">
        <div class="dialog-header">
          <h3>{{ 'master.rto.editTitle' | translate }}</h3>
          <button class="btn btn-ghost btn-sm" (click)="closeAdd()">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="dialog-body">
          @if (addErr()) {
            <div class="alert alert-danger">{{ addErr() }}</div>
          }

          <div class="section-head">
            <strong>{{ 'master.rto.currentMappings' | translate }}</strong>
            <span class="count-badge">{{ mapped().length }}</span>
          </div>
          @if (mapped().length === 0) {
            <div class="picker-hint">{{ 'master.rto.noMappedYet' | translate }}</div>
          } @else {
            @for (group of mappedGrouped(); track group.stateId) {
              <div class="mapped-state">
                <div class="mapped-state-label">{{ group.stateName }}</div>
                <div class="mapped-chips">
                  @for (m of group.items; track m.rto.id) {
                    <span class="mapped-chip">
                      {{ m.rto.rtoCode }} — {{ m.rto.rtoName }}
                      <button
                        class="chip-x"
                        type="button"
                        (click)="requestRemoveMapped(m.rto.id, m.rto.rtoCode + ' — ' + m.rto.rtoName)"
                        [disabled]="saving()"
                      >
                        <span class="material-icons">close</span>
                      </button>
                    </span>
                  }
                </div>
              </div>
            }
          }

          <div class="section-divider"></div>

          <div class="section-head">
            <strong>{{ 'master.rto.assignRemove' | translate }}</strong>
          </div>

          <div class="input-wrapper pool-search">
            <span class="material-icons input-icon">search</span>
            <input
              class="form-control form-control--icon-left"
              [placeholder]="'master.rto.searchPlaceholder' | translate"
              [ngModel]="poolSearch()"
              (ngModelChange)="poolSearch.set($event)"
            />
            @if (poolSearch()) {
              <button class="pool-search-clear" type="button" (click)="poolSearch.set('')" [attr.aria-label]="'common.clear' | translate">
                <span class="material-icons">close</span>
              </button>
            }
          </div>

          @if (loadingPool()) {
            <div class="picker-hint"><span class="spinner"></span></div>
          } @else if (parentPool().length === 0) {
            <div class="picker-hint">{{ 'master.rto.noPool' | translate }}</div>
          } @else if (poolByState().length === 0) {
            <div class="picker-hint">{{ 'master.rto.noSearchResults' | translate }}</div>
          } @else {
            @for (state of poolByState(); track state.stateId) {
              <div class="perm-group">
                <button class="perm-group-head" type="button" (click)="toggleState(state.stateId)">
                  <input
                    type="checkbox"
                    [checked]="groupAllPicked(state.rtos)"
                    [indeterminate]="groupSomePicked(state.rtos)"
                    (click)="$event.stopPropagation()"
                    (change)="toggleGroup(state.rtos, $event)"
                  />
                  <span class="material-icons chev">{{ isStateOpen(state.stateId) ? 'expand_more' : 'chevron_right' }}</span>
                  <strong>{{ state.stateName }}</strong>
                  <span class="group-count">{{ state.rtos.length }}</span>
                </button>
                @if (isStateOpen(state.stateId)) {
                  <div class="perm-group-body">
                    @for (r of state.rtos; track r.id) {
                      <label class="perm-row" [class.perm-row--mapped]="isMapped(r.id)">
                        <input
                          type="checkbox"
                          [checked]="isPicked(r.id) || isMapped(r.id)"
                          [disabled]="isMapped(r.id)"
                          (change)="togglePick(r.id, $event)"
                        />
                        <div class="perm-row-meta">
                          <strong>{{ r.rtoCode }} — {{ r.rtoName }}</strong>
                          <small>
                            {{ r.districtName }}
                            @if (isMapped(r.id)) { · <span class="mapped-tag">{{ 'master.rto.mapped' | translate }}</span> }
                          </small>
                        </div>
                      </label>
                    }
                  </div>
                }
              </div>
            }
          }
        </div>
        <div class="dialog-footer">
          <span class="footer-count">{{ 'master.rto.toAdd' | translate: { count: pickedIds().size } }}</span>
          <button class="btn btn-ghost" (click)="closeAdd()" [disabled]="saving()">
            {{ 'common.cancel' | translate }}
          </button>
          <button class="btn btn-primary" (click)="save()" [disabled]="saving() || pickedIds().size === 0">
            {{ saving() ? ('common.saving' | translate) : ('common.save' | translate) }}
          </button>
        </div>
      </div>
    }

    <app-delete-confirm-dialog
      [open]="removeTarget() !== null"
      [title]="'master.rto.removeTitle' | translate"
      [message]="'master.rto.removeMessage' | translate"
      [targetName]="removeTarget()?.name ?? null"
      [loading]="saving()"
      (confirm)="confirmRemoveMapped()"
      (cancel)="removeTarget.set(null)"
    />

    <style>
      .rto-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: var(--space-md);
        margin-top: var(--space-md);
      }
      .rto-card {
        background: var(--color-bg-card);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-md);
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        transition: box-shadow 0.15s ease, transform 0.15s ease;
      }
      .rto-card:hover {
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
      }
      .rto-card__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .rto-code {
        display: inline-block;
        padding: 4px 10px;
        background: var(--color-primary-bg);
        color: var(--color-primary);
        border-radius: var(--radius-md);
        font-weight: 700;
        font-size: var(--font-sm);
        letter-spacing: 0.5px;
      }
      .rto-name {
        font-weight: 600;
        color: var(--color-text-primary);
        font-size: var(--font-md);
      }
      .rto-meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-top: var(--space-sm);
        border-top: 1px dashed var(--color-border);
      }
      .meta-row {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--font-xs);
        color: var(--color-text-muted);
      }
      .meta-row .material-icons { font-size: 14px; }
      .icon-btn {
        background: transparent; border: none; cursor: pointer;
        width: 28px; height: 28px;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: var(--radius-md);
        color: var(--color-text-secondary);
      }
      .icon-btn .material-icons { font-size: 16px; }
      .icon-btn:hover { background: var(--color-bg-page); }
      .icon-btn--danger:hover { background: var(--color-danger-bg); color: var(--color-danger); }
      .icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      .rto-search { min-width: 280px; }
      .rto-search .form-control { padding-left: 38px; }

      .pool-search {
        position: relative;
        margin-bottom: var(--space-sm);
      }
      .pool-search .form-control { padding-left: 38px; padding-right: 36px; }
      .pool-search-clear {
        position: absolute;
        top: 50%;
        right: 8px;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--color-text-muted);
        width: 24px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }
      .pool-search-clear:hover { background: var(--color-bg-page); color: var(--color-text-primary); }
      .pool-search-clear .material-icons { font-size: 16px; }

      .empty-state {
        text-align: center;
        padding: var(--space-2xl);
        color: var(--color-text-muted);
      }
      .empty-state .material-icons { font-size: 48px; opacity: 0.4; }
      .empty-state p { margin-top: var(--space-sm); }

      .drawer-panel--wide { width: min(720px, 95vw); }

      .section-head {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin: var(--space-md) 0 var(--space-sm);
        font-size: var(--font-sm);
        color: var(--color-text-primary);
      }
      .section-head .count-badge {
        background: var(--color-primary-bg);
        color: var(--color-primary);
        font-weight: 600;
        font-size: var(--font-xs);
      }
      .section-divider {
        height: 1px;
        background: var(--color-border);
        margin: var(--space-lg) 0 var(--space-md);
      }
      .picker-hint {
        text-align: center;
        padding: var(--space-md);
        color: var(--color-text-muted);
        font-size: var(--font-sm);
      }

      .mapped-state { margin-bottom: var(--space-sm); }
      .mapped-state-label {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        font-weight: 600;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .mapped-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .mapped-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 4px 4px 10px;
        background: var(--color-primary-bg);
        color: var(--color-primary);
        border-radius: var(--radius-full);
        font-size: var(--font-xs);
        font-weight: 600;
      }
      .chip-x {
        background: transparent; border: none; cursor: pointer;
        width: 20px; height: 20px;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 50%;
        color: inherit;
      }
      .chip-x:hover { background: rgba(0,0,0,0.08); }
      .chip-x:disabled { opacity: 0.4; cursor: not-allowed; }
      .chip-x .material-icons { font-size: 14px; }

      .perm-group {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        margin-bottom: var(--space-sm);
        background: var(--color-bg-card);
        overflow: hidden;
      }
      .perm-group-head {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        width: 100%;
        padding: var(--space-sm) var(--space-md);
        background: var(--color-bg-page);
        border: none;
        cursor: pointer;
        font-family: var(--font-family);
        font-size: var(--font-sm);
        text-align: left;
      }
      .perm-group-head .chev { font-size: 18px; color: var(--color-text-muted); }
      .perm-group-head strong { color: var(--color-text-primary); flex: 1; }
      .group-count {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        background: var(--color-bg-card);
        padding: 2px 8px;
        border-radius: var(--radius-full);
      }
      .perm-group-body {
        border-top: 1px solid var(--color-border);
      }
      .perm-row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md) var(--space-sm) calc(var(--space-md) + 24px);
        border-bottom: 1px solid var(--color-border);
        cursor: pointer;
      }
      .perm-row:last-child { border-bottom: none; }
      .perm-row:hover:not(.perm-row--mapped) { background: var(--color-bg-page); }
      .perm-row--mapped { background: var(--color-bg-page); cursor: not-allowed; }
      .perm-row input[type="checkbox"] { flex-shrink: 0; }
      .perm-row-meta { display: flex; flex-direction: column; }
      .perm-row-meta strong { font-size: var(--font-sm); color: var(--color-text-primary); }
      .perm-row-meta small { font-size: var(--font-xs); color: var(--color-text-muted); }
      .mapped-tag {
        color: var(--color-primary);
        font-weight: 600;
      }

      .footer-count {
        margin-right: auto;
        font-size: var(--font-xs);
        color: var(--color-text-muted);
      }

      .btn-sm { padding: 6px 10px; font-size: var(--font-xs); }
    </style>
  `,
})
export class RtoMappingTabComponent {
  private readonly rbac = inject(RbacService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(TranslationService);

  readonly mapped = signal<EntityRtoItem[]>([]);
  readonly loading = signal(false);
  readonly errMsg = signal('');
  readonly saving = signal(false);

  readonly search = signal('');

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.mapped();
    return this.mapped().filter(
      (m) =>
        m.rto.rtoCode.toLowerCase().includes(q) ||
        m.rto.rtoName.toLowerCase().includes(q) ||
        m.rto.district.districtName.toLowerCase().includes(q),
    );
  });

  readonly mappedIdSet = computed(() => new Set(this.mapped().map((m) => m.rto.id)));

  readonly showAdd = signal(false);
  readonly addErr = signal('');
  readonly removeTarget = signal<{ id: string; name: string } | null>(null);
  readonly loadingPool = signal(false);
  readonly parentPool = signal<EntityRtoItem[]>([]);
  readonly pickedIds = signal(new Set<string>());
  readonly openStates = signal(new Set<string>());

  readonly poolSearch = signal('');

  readonly poolByState = computed<StateGroup[]>(() => {
    const q = this.poolSearch().toLowerCase().trim();
    const match = (r: RtoOpt, stateName: string) =>
      !q ||
      r.rtoCode.toLowerCase().includes(q) ||
      r.rtoName.toLowerCase().includes(q) ||
      r.districtName.toLowerCase().includes(q) ||
      stateName.toLowerCase().includes(q);

    const map = new Map<string, StateGroup>();
    this.parentPool().forEach((p) => {
      const s = p.rto.district.state;
      const opt: RtoOpt = {
        id: p.rto.id,
        rtoCode: p.rto.rtoCode,
        rtoName: p.rto.rtoName,
        districtName: p.rto.district.districtName,
      };
      if (!match(opt, s.stateName)) return;
      if (!map.has(s.id)) map.set(s.id, { stateId: s.id, stateName: s.stateName, rtos: [] });
      map.get(s.id)!.rtos.push(opt);
    });
    const groups = Array.from(map.values()).sort((a, b) => a.stateName.localeCompare(b.stateName));
    groups.forEach((g) => g.rtos.sort((a, b) => a.rtoCode.localeCompare(b.rtoCode)));
    return groups;
  });

  readonly mappedGrouped = computed<MappedGroup[]>(() => {
    const map = new Map<string, MappedGroup>();
    this.mapped().forEach((m) => {
      const s = m.rto.district.state;
      if (!map.has(s.id)) map.set(s.id, { stateId: s.id, stateName: s.stateName, items: [] });
      map.get(s.id)!.items.push(m);
    });
    return Array.from(map.values()).sort((a, b) => a.stateName.localeCompare(b.stateName));
  });

  constructor() {
    effect(() => {
      this.auth.entityId();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.errMsg.set('');
    this.rbac.getEntityRtos().subscribe({
      next: (res) => {
        const apiErr = getApiResponseError(res, '');
        if (apiErr) {
          this.errMsg.set(apiErr);
          this.mapped.set([]);
        } else {
          this.mapped.set(res.data ?? []);
        }
        this.loading.set(false);
      },
      error: (e) => {
        this.errMsg.set(extractApiError(e, this.i18n.instant('master.rto.errors.load')));
        this.loading.set(false);
      },
    });
  }

  openAdd(): void {
    this.pickedIds.set(new Set());
    this.poolSearch.set('');
    this.addErr.set('');
    this.showAdd.set(true);
    if (this.parentPool().length === 0) this.loadParentPool();
    else this.expandAllStates();
  }

  closeAdd(): void {
    if (this.saving()) return;
    this.showAdd.set(false);
  }

  private loadParentPool(): void {
    this.loadingPool.set(true);
    this.rbac.getParentEntityRtos().subscribe({
      next: (res) => {
        this.parentPool.set(res.data ?? []);
        this.loadingPool.set(false);
        this.expandAllStates();
      },
      error: (e) => {
        this.addErr.set(extractApiError(e, this.i18n.instant('master.rto.errors.loadPool')));
        this.loadingPool.set(false);
      },
    });
  }

  private expandAllStates(): void {
    this.openStates.set(new Set(this.poolByState().map((s) => s.stateId)));
  }

  isStateOpen(stateId: string): boolean {
    // Force-expand while searching so matches are visible without extra clicks.
    if (this.poolSearch().trim()) return true;
    return this.openStates().has(stateId);
  }

  toggleState(stateId: string): void {
    const next = new Set(this.openStates());
    if (next.has(stateId)) next.delete(stateId);
    else next.add(stateId);
    this.openStates.set(next);
  }

  groupAllPicked(rtos: RtoOpt[]): boolean {
    return rtos.every((r) => this.isMapped(r.id) || this.isPicked(r.id));
  }

  groupSomePicked(rtos: RtoOpt[]): boolean {
    if (this.groupAllPicked(rtos)) return false;
    return rtos.some((r) => this.isPicked(r.id));
  }

  toggleGroup(rtos: RtoOpt[], e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    const next = new Set(this.pickedIds());
    rtos.forEach((r) => {
      if (this.isMapped(r.id)) return;
      if (checked) next.add(r.id);
      else next.delete(r.id);
    });
    this.pickedIds.set(next);
  }

  isMapped(id: string): boolean {
    return this.mappedIdSet().has(id);
  }

  isPicked(id: string): boolean {
    return this.pickedIds().has(id);
  }

  togglePick(id: string, e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    const next = new Set(this.pickedIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.pickedIds.set(next);
  }

  save(): void {
    const ids = [...this.mapped().map((m) => m.rto.id), ...this.pickedIds()];
    this.saving.set(true);
    this.addErr.set('');
    this.rbac.assignEntityRtos({ rtoIds: ids }).subscribe({
      next: (res) => {
        const apiErr = getApiResponseError(res, '');
        if (apiErr) {
          this.addErr.set(apiErr);
          this.saving.set(false);
          return;
        }
        this.saving.set(false);
        this.showAdd.set(false);
        this.load();
      },
      error: (e) => {
        this.addErr.set(extractApiError(e, this.i18n.instant('master.rto.errors.save')));
        this.saving.set(false);
      },
    });
  }

  requestRemoveMapped(rtoId: string, name: string): void {
    this.removeTarget.set({ id: rtoId, name });
  }

  confirmRemoveMapped(): void {
    const target = this.removeTarget();
    if (!target) return;
    this.remove(target.id, () => this.removeTarget.set(null));
  }

  remove(rtoId: string, onDone?: () => void): void {
    const ids = this.mapped().map((m) => m.rto.id).filter((id) => id !== rtoId);
    this.saving.set(true);
    this.errMsg.set('');
    this.rbac.assignEntityRtos({ rtoIds: ids }).subscribe({
      next: (res) => {
        const apiErr = getApiResponseError(res, '');
        if (apiErr) {
          this.errMsg.set(apiErr);
          this.saving.set(false);
          return;
        }
        this.saving.set(false);
        this.load();
        onDone?.();
      },
      error: (e) => {
        this.errMsg.set(extractApiError(e, this.i18n.instant('master.rto.errors.remove')));
        this.saving.set(false);
      },
    });
  }
}
