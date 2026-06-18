import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AlertDialogComponent } from './shared/components/alert-dialog/alert-dialog.component';
import { SessionExpiredService } from './core/services/session-expired.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AlertDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('VahanNewPortal');
  protected readonly sessionExpired = inject(SessionExpiredService);
}
