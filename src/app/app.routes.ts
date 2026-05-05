import { Routes } from '@angular/router';
import { authGuard, guestGuard, adminGuard } from './guards/auth.guard';
import { NotFoundComponent } from './not-found/not-found';
import { PreciosComponent } from './pages/precios/precios';
import { PagoExitosoComponent } from './pages/pagoexitoso/pagoexitoso';

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
    path: 'solicitar',
    //canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/solicitar/solicitar').then((m) => m.SolicitarComponent),
  },
  {
    path: 'panel',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/panel/panel').then((m) => m.PanelComponent),
  },
  {
    path: 'admin/solicitudes',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin-solicitudes/admin-solicitudes').then(
        (m) => m.AdminSolicitudesComponent
      ),
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

  {
  path: 'precios',
  component: PreciosComponent,
},
{
  path: 'pago-exitoso',
  component: PagoExitosoComponent,
},

  {
  path: '**',
  component: NotFoundComponent,
}

  
];