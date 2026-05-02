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