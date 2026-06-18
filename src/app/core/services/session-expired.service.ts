import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SessionExpiredService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly visible = signal(false);
  private handling = false;

  handle(): void {
    if (this.handling) return;
    this.handling = true;
    this.auth.logout({ navigate: false });
    this.visible.set(true);
  }

  dismiss(): void {
    this.visible.set(false);
    this.handling = false;
    this.router.navigate(['/login']);
  }
}
