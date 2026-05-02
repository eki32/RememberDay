import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SupabaseService } from '../services/supabase';

/**
 * Guard para rutas privadas (panel, panel-evento).
 * Si NO hay sesión → redirige a /login.
 */
export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const usuario = await supabase.getUsuarioActual();
  if (usuario) {
    return true; // hay sesión → deja entrar
  }

  router.navigate(['/login']);
  return false; // no hay sesión → bloquea
};

/**
 * Guard para rutas de "invitado" (home, login, registro).
 * Si SÍ hay sesión → redirige a /panel (no tiene sentido verlas logueado).
 */
export const guestGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const usuario = await supabase.getUsuarioActual();
  if (!usuario) {
    return true; // no hay sesión → deja ver login/registro/home
  }

  router.navigate(['/panel']);
  return false; // hay sesión → bloquea
};

/**
 * Guard para rutas de administración.
 * Si no hay sesión → /login.
 * Si hay sesión pero no es admin → /panel (acceso denegado silenciosamente).
 */
export const adminGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const usuario = await supabase.getUsuarioActual();
  if (!usuario) {
    router.navigate(['/login']);
    return false;
  }

  const esAdmin = await supabase.esAdmin();
  if (!esAdmin) {
    // No es admin: lo mandamos al panel normal sin armar escándalo
    router.navigate(['/panel']);
    return false;
  }

  return true;
};