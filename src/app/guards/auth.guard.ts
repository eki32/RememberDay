import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SupabaseService } from '../services/supabase';

/**
 * Guard para rutas privadas (panel, panel-evento).
 * Si NO hay sesión → redirige a /login pasando la URL original como ?redirect=
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const usuario = await supabase.getUsuarioActual();
  if (usuario) return true;

  // Guardamos la URL a la que querían ir para volver tras login
  router.navigate(['/login'], {
    queryParams: { redirect: state.url },
  });
  return false;
};

/**
 * Guard para rutas de "invitado" (home, login, solicitar).
 * Si SÍ hay sesión → redirige a /panel.
 */
export const guestGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const usuario = await supabase.getUsuarioActual();
  if (!usuario) return true;

  router.navigate(['/panel']);
  return false;
};

/**
 * Guard para rutas de administración.
 * Si no hay sesión → /login con redirect.
 * Si hay sesión pero no es admin → /panel.
 */
export const adminGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const usuario = await supabase.getUsuarioActual();
  if (!usuario) {
    router.navigate(['/login'], {
      queryParams: { redirect: state.url },
    });
    return false;
  }

  const esAdmin = await supabase.esAdmin();
  if (!esAdmin) {
    router.navigate(['/panel']);
    return false;
  }

  return true;
};