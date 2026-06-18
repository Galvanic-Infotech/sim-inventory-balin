import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { STORAGE_KEYS } from '../../core/constants/api.constants';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  private readonly auth = inject(AuthService);

  sidebarCollapsed = signal(
    localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true',
  );

  ngOnInit(): void {
    // Fetch profile, permissions, entities on shell init (handles page refresh)
    this.auth.bootstrap();
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(collapsed));
  }
}
