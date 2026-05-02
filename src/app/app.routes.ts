import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'registro',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/registro/registro').then((m) => m.RegistroComponent),
  },
  {
    path: 'panel',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/panel/panel').then((m) => m.PanelComponent),
  },
  {
    path: 'evento/:id',
    loadComponent: () =>
      import('./pages/bienvenida/bienvenida').then(
        (m) => m.BienvenidaComponent
      ),
  },
  {
    path: 'evento/:id/galeria',
    loadComponent: () =>
      import('./pages/galeria/galeria').then((m) => m.GaleriaComponent),
  },
  {
    path: 'panel/evento/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/panel-evento/panel-evento').then(
        (m) => m.PanelEventoComponent
      ),
  },
];