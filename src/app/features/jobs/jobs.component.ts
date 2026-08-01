import { Component } from '@angular/core';
import { JobsListPanelComponent } from './panels/jobs-list-panel.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [JobsListPanelComponent, TranslatePipe],
  templateUrl: './jobs.component.html',
  styleUrl: './jobs.component.scss',
})
export class JobsComponent {}
