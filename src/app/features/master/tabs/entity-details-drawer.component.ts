import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RbacService } from '../../../core/services/rbac.service';
import { TranslationService } from '../../../core/services/translation.service';
import { PermissionService, PERMS } from '../../../core/services/permission.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import {
  EntityAttributesUpdate,
  EntityBasicDetails,
  EntityContact,
  EntityVts,
} from '../../../shared/models/rbac.model';

interface FormState {
  basicDetails: Required<Pick<EntityBasicDetails, 'code' | 'manufactureName' | 'cinNumber' | 'gstnNumber'>> & {
    establishmentYear: string;
    address: {
      houseNo: string;
      street: string;
      city: string;
      district: string;
      state: string;
      pinCode: string;
    };
  };
  contacts: Required<Pick<EntityContact, 'personName' | 'email' | 'mobileNumber' | 'landLine' | 'fax' | 'isPrimary'>>[];
  vts: { userId: string; excludeSubUser: number[] };
  basketId: string;
  telegramChatId: string;
}

function emptyContact(): FormState['contacts'][number] {
  return { personName: '', email: '', mobileNumber: '', landLine: '', fax: '', isPrimary: false };
}

function emptyForm(): FormState {
  return {
    basicDetails: {
      code: '',
      manufactureName: '',
      cinNumber: '',
      gstnNumber: '',
      establishmentYear: '',
      address: { houseNo: '', street: '', city: '', district: '', state: '', pinCode: '' },
    },
    contacts: [],
    vts: { userId: '', excludeSubUser: [] },
    basketId: '',
    telegramChatId: '',
  };
}

@Component({
  selector: 'app-entity-details-drawer',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './entity-details-drawer.component.html',
  styleUrl: './entity-details-drawer.component.scss',
})
export class EntityDetailsDrawerComponent {
  private readonly rbac = inject(RbacService);
  private readonly i18n = inject(TranslationService);
  private readonly perm = inject(PermissionService);

  readonly entityId = input<string | null>(null);
  readonly entityName = input<string>('');
  readonly closed = output<boolean>();

  readonly canEdit = this.perm.can(PERMS.ENTITY_UPDATE);

  readonly form = signal<FormState>(emptyForm());
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  readonly hasContacts = computed(() => this.form().contacts.length > 0);

  constructor() {
    effect(() => {
      const id = this.entityId();
      if (id) this.fetch(id);
    });
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.rbac.getEntityAttributes(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        const data = res.data ?? {};
        const bd = data.basicDetails ?? {};
        const addr = bd.address ?? {};
        this.form.set({
          basicDetails: {
            code: bd.code ?? '',
            manufactureName: bd.manufactureName ?? '',
            cinNumber: bd.cinNumber ?? '',
            gstnNumber: bd.gstnNumber ?? '',
            establishmentYear: bd.establishmentYear != null ? String(bd.establishmentYear) : '',
            address: {
              houseNo: addr.houseNo ?? '',
              street: addr.street ?? '',
              city: addr.city ?? '',
              district: addr.district ?? '',
              state: addr.state ?? '',
              pinCode: addr.pinCode ?? '',
            },
          },
          contacts: (data.contacts ?? []).map((c) => ({
            personName: c.personName ?? '',
            email: c.email ?? '',
            mobileNumber: c.mobileNumber ?? '',
            landLine: c.landLine ?? '',
            fax: c.fax ?? '',
            isPrimary: !!c.isPrimary,
          })),
          vts: {
            userId: data.vts?.userId != null ? String(data.vts.userId) : '',
            excludeSubUser: data.vts?.excludeSubUser ?? [],
          },
          basketId: data.basketId != null ? String(data.basketId) : '',
          telegramChatId: data.telegramChatId ?? '',
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('master.entityDetails.loadFailed')));
      },
    });
  }

  setBasic<K extends keyof FormState['basicDetails']>(key: K, value: FormState['basicDetails'][K]): void {
    this.form.update((f) => ({ ...f, basicDetails: { ...f.basicDetails, [key]: value } }));
  }

  setAddress<K extends keyof FormState['basicDetails']['address']>(
    key: K,
    value: FormState['basicDetails']['address'][K],
  ): void {
    this.form.update((f) => ({
      ...f,
      basicDetails: {
        ...f.basicDetails,
        address: { ...f.basicDetails.address, [key]: value },
      },
    }));
  }

  setContact<K extends keyof FormState['contacts'][number]>(
    idx: number,
    key: K,
    value: FormState['contacts'][number][K],
  ): void {
    this.form.update((f) => ({
      ...f,
      contacts: f.contacts.map((c, i) => (i === idx ? { ...c, [key]: value } : c)),
    }));
  }

  togglePrimary(idx: number): void {
    this.form.update((f) => ({
      ...f,
      contacts: f.contacts.map((c, i) => ({ ...c, isPrimary: i === idx ? !c.isPrimary : c.isPrimary })),
    }));
  }

  addContact(): void {
    this.form.update((f) => ({ ...f, contacts: [...f.contacts, emptyContact()] }));
  }

  removeContact(idx: number): void {
    this.form.update((f) => ({ ...f, contacts: f.contacts.filter((_, i) => i !== idx) }));
  }

  setVts<K extends keyof FormState['vts']>(key: K, value: FormState['vts'][K]): void {
    this.form.update((f) => ({ ...f, vts: { ...f.vts, [key]: value } }));
  }

  setBasketId(value: string): void {
    this.form.update((f) => ({ ...f, basketId: value }));
  }

  setTelegram(value: string): void {
    this.form.update((f) => ({ ...f, telegramChatId: value }));
  }

  save(): void {
    const id = this.entityId();
    if (!id) return;
    const body = this.buildPayload();
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.rbac.updateEntityAttributes(id, body).subscribe({
      next: (res) => {
        this.saving.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('master.entityDetails.saveFailed'));
        if (msg) {
          this.error.set(msg);
          return;
        }
        this.success.set(this.i18n.instant('master.entityDetails.saved'));
        this.closed.emit(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('master.entityDetails.saveFailed')));
      },
    });
  }

  private buildPayload(): EntityAttributesUpdate {
    const f = this.form();
    const basic: EntityBasicDetails = {
      code: f.basicDetails.code || undefined,
      manufactureName: f.basicDetails.manufactureName || undefined,
      cinNumber: f.basicDetails.cinNumber || undefined,
      gstnNumber: f.basicDetails.gstnNumber || undefined,
      establishmentYear: f.basicDetails.establishmentYear
        ? Number(f.basicDetails.establishmentYear)
        : undefined,
      address: {
        houseNo: f.basicDetails.address.houseNo || undefined,
        street: f.basicDetails.address.street || undefined,
        city: f.basicDetails.address.city || undefined,
        district: f.basicDetails.address.district || undefined,
        state: f.basicDetails.address.state || undefined,
        pinCode: f.basicDetails.address.pinCode || undefined,
      },
    };

    const contacts: EntityContact[] = f.contacts.map((c) => ({
      personName: c.personName || undefined,
      email: c.email || undefined,
      mobileNumber: c.mobileNumber || undefined,
      landLine: c.landLine || undefined,
      fax: c.fax || undefined,
      isPrimary: c.isPrimary,
    }));

    const vts: EntityVts = {
      userId: f.vts.userId ? Number(f.vts.userId) : null,
      excludeSubUser: f.vts.excludeSubUser,
    };

    return {
      basicDetails: basic,
      contacts,
      vts,
      basketId: f.basketId ? Number(f.basketId) : null,
      telegramChatId: f.telegramChatId || null,
    };
  }

  cancel(): void {
    if (this.saving()) return;
    this.closed.emit(false);
  }
}
