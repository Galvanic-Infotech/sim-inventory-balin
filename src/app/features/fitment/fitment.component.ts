import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FitmentListPanelComponent } from './panels/fitment-list-panel.component';
import { FitmentCreateStepperComponent } from './panels/fitment-create-stepper.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

type View = 'list' | 'create';

@Component({
  selector: 'app-fitment',
  standalone: true,
  imports: [FitmentListPanelComponent, FitmentCreateStepperComponent, TranslatePipe],
  templateUrl: './fitment.component.html',
  styleUrl: './fitment.component.scss',
})
export class FitmentComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly view = signal<View>('list');
  readonly initialSerial = signal<string | null>(null);
  private cameFromDevices = false;

  constructor() {
    const serial = this.route.snapshot.queryParamMap.get('serial');
    if (serial?.trim()) {
      this.initialSerial.set(serial.trim());
      this.cameFromDevices = true;
      this.view.set('create');
    }
  }

  openCreate(): void {
    this.initialSerial.set(null);
    this.cameFromDevices = false;
    this.view.set('create');
  }

  backToList(): void {
    if (this.cameFromDevices) {
      this.cameFromDevices = false;
      void this.router.navigate(['/devices'], { queryParams: { tab: 'devices' } });
      return;
    }
    this.initialSerial.set(null);
    this.view.set('list');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { serial: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
