import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';



export interface Evento {
  id: string;
  slug: string;
  titulo: string;
  fecha: string | null;
  lugar: string | null;
  organizador_id: string | null;
  creado_en: string;
}

export interface Foto {
  id: string;
  evento_id: string;
  storage_path: string;
  tipo: 'foto' | 'video';
  nombre_invitado: string | null;
  duracion_segundos: number | null;
  subido_en: string;
  subido_por_dispositivo: string | null; // 👈 NUEVO
}

export interface Solicitud {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  tipo_evento: string;
  fecha_evento: string | null;
  mensaje: string | null;
  estado: 'pendiente' | 'contactado' | 'pagado' | 'cuenta_creada' | 'rechazado';
  notas_admin: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface Perfil {
  id: string;
  is_admin: boolean;
  nombre: string | null;
  logo_url: string | null;
  creado_en: string;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private readonly BUCKET = 'fotos-eventos';
  private deviceId: string;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
    this.deviceId = this.obtenerOCrearDeviceId();
  }

  /**
   * Obtiene un ID único para este dispositivo/navegador.
   * Si no existe, lo crea y lo guarda en localStorage.
   * Sirve para que un invitado solo pueda borrar SUS fotos.
   */
  private obtenerOCrearDeviceId(): string {
    const KEY = 'rememberday-device-id';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  /**
   * Devuelve el ID de este dispositivo (para usarlo en componentes).
   */
  getDeviceId(): string {
    return this.deviceId;
  }
  
  /**
   * Buscar un evento por su slug (el que aparece en la URL).
   */
  async getEventoPorSlug(slug: string): Promise<Evento | null> {
    const { data, error } = await this.supabase
      .from('eventos')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('Error al cargar evento:', error);
      return null;
    }
    return data;
  }

  /**
   * Listar todas las fotos/vídeos de un evento, las más recientes primero.
   */
  async getFotosDeEvento(eventoId: string): Promise<Foto[]> {
    const { data, error } = await this.supabase
      .from('fotos')
      .select('*')
      .eq('evento_id', eventoId)
      .order('subido_en', { ascending: false });

    if (error) {
      console.error('Error al cargar fotos:', error);
      return [];
    }
    return data ?? [];
  }

  /**
   * Subir un archivo (foto o vídeo) al Storage y crear la fila en la tabla `fotos`.
   */
  async subirArchivo(
    eventoId: string,
    archivo: File,
    nombreInvitado: string | null
  ): Promise<Foto | null> {
    // Detectar si es foto o vídeo por el MIME type
    const tipo: 'foto' | 'video' = archivo.type.startsWith('video/')
      ? 'video'
      : 'foto';

    // Generar un nombre único: eventoId/timestamp-random.ext
    const extension = archivo.name.split('.').pop() ?? 'bin';
    const nombreUnico = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${extension}`;
    const storagePath = `${eventoId}/${nombreUnico}`;

    // 1. Subir al Storage
    const { error: errorUpload } = await this.supabase.storage
      .from(this.BUCKET)
      .upload(storagePath, archivo, {
        cacheControl: '3600',
        upsert: false,
      });

    if (errorUpload) {
      console.error('Error al subir al Storage:', errorUpload);
      return null;
    }

    // 2. Insertar fila en la tabla
    const { data, error: errorInsert } = await this.supabase
      .from('fotos')
      .insert({
        evento_id: eventoId,
        storage_path: storagePath,
        tipo,
        nombre_invitado: nombreInvitado,
        subido_por_dispositivo: this.deviceId, // 👈 NUEVO
      })
      .select()
      .single();

    if (errorInsert) {
      console.error('Error al guardar en la base de datos:', errorInsert);
      return null;
    }

    return data;
  }

  /**
   * Obtener la URL pública para mostrar una foto/vídeo en el navegador.
   */
  getUrlPublica(storagePath: string): string {
    const { data } = this.supabase.storage
      .from(this.BUCKET)
      .getPublicUrl(storagePath);
    return data.publicUrl;
  }

/**
   * Suscribirse a cambios de fotos en tiempo real (nuevas y borradas).
   * Devuelve un canal — guárdalo para poder desuscribirte después.
   */
  suscribirseACambiosDeFotos(
    eventoId: string,
    callbacks: {
      onNueva: (foto: Foto) => void;
      onBorrada: (fotoId: string) => void;
    }
  ) {
    const canal = this.supabase
      .channel(`fotos:${eventoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fotos',
          filter: `evento_id=eq.${eventoId}`,
        },
        (payload) => {
          console.log('📸 Nueva foto:', payload.new);
          callbacks.onNueva(payload.new as Foto);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'fotos',
          filter: `evento_id=eq.${eventoId}`,
        },
        (payload) => {
          console.log('🗑️ Foto borrada:', payload.old);
          callbacks.onBorrada((payload.old as Foto).id);
        }
      )
      .subscribe((status) => {
        console.log('🔌 Estado del canal:', status);
      });

    return canal;
  }

  /**
   * Cerrar un canal de suscripción cuando ya no se necesite.
   */
  desuscribirse(canal: any) {
    this.supabase.removeChannel(canal);
  }

  // ============================================
  // AUTH (organizadores)
  // ============================================

  /**
   * Registrar un nuevo organizador.
   */
  async registrarse(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  }

  /**
   * Iniciar sesión.
   */
  async iniciarSesion(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }

  /**
   * Cerrar sesión.
   */
  async cerrarSesion() {
    await this.supabase.auth.signOut();
  }

  /**
   * Obtener el usuario actual (o null si no hay sesión).
   */
  async getUsuarioActual() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    return user;
  }

  /**
   * Suscribirse a cambios de sesión (útil para reaccionar al login/logout).
   */
  onCambioSesion(callback: (user: any) => void) {
    return this.supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  }

  // ============================================
  // EVENTOS (panel organizador)
  // ============================================

  /**
   * Listar los eventos del organizador autenticado.
   */
  async getMisEventos(): Promise<Evento[]> {
    const user = await this.getUsuarioActual();
    if (!user) return [];

    const { data, error } = await this.supabase
      .from('eventos')
      .select('*')
      .eq('organizador_id', user.id)
      .order('creado_en', { ascending: false });

    if (error) {
      console.error('Error al cargar mis eventos:', error);
      return [];
    }
    return data ?? [];
  }

  /**
   * Crear un evento nuevo. Genera el slug automáticamente.
   */
  async crearEvento(datos: {
    titulo: string;
    fecha: string;
    lugar: string;
  }): Promise<Evento | null> {
    const user = await this.getUsuarioActual();
    if (!user) return null;

    const slug = this.generarSlug(datos.titulo);

    const { data, error } = await this.supabase
      .from('eventos')
      .insert({
        slug,
        titulo: datos.titulo,
        fecha: datos.fecha,
        lugar: datos.lugar,
        organizador_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear evento:', error);
      return null;
    }
    return data;
  }

  /**
   * Convierte un texto en un slug válido para URL.
   * "Boda de Juan & María 2024" → "boda-de-juan-maria-2024"
   */
  private generarSlug(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD') // descompone tildes
      .replace(/[\u0300-\u036f]/g, '') // quita marcas de tildes
      .replace(/&/g, 'y')
      .replace(/[^a-z0-9\s-]/g, '') // quita símbolos
      .trim()
      .replace(/\s+/g, '-') // espacios → guiones
      .replace(/-+/g, '-') // varios guiones → uno
      + '-' + Math.random().toString(36).slice(2, 6); // sufijo aleatorio para evitar colisiones
  }

  /**
   * Obtener un evento por su id (no por slug).
   * Útil para el panel del organizador.
   */
  async getEventoPorId(id: string): Promise<Evento | null> {
    const { data, error } = await this.supabase
      .from('eventos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error al cargar evento por id:', error);
      return null;
    }
    return data;
  }

  /**
   * Eliminar un evento (y todas sus fotos en cascada por la FK).
   * Solo funciona si el organizador es el dueño (lo controla RLS).
   */
  async eliminarEvento(eventoId: string): Promise<boolean> {
    // Primero borrar los archivos del Storage
    const { data: fotos } = await this.supabase
      .from('fotos')
      .select('storage_path')
      .eq('evento_id', eventoId);

    if (fotos && fotos.length > 0) {
      const paths = fotos.map((f) => f.storage_path);
      await this.supabase.storage.from(this.BUCKET).remove(paths);
    }

    // Luego borrar el evento (las filas de fotos caen en cascada por la FK)
    const { error } = await this.supabase
      .from('eventos')
      .delete()
      .eq('id', eventoId);

    if (error) {
      console.error('Error al eliminar evento:', error);
      return false;
    }
    return true;
  }

  /**
   * Descargar el contenido de un archivo del Storage.
   * Devuelve el Blob para meterlo en el ZIP.
   */
  async descargarArchivo(storagePath: string): Promise<Blob | null> {
    const { data, error } = await this.supabase.storage
      .from(this.BUCKET)
      .download(storagePath);

    if (error) {
      console.error('Error al descargar archivo:', error);
      return null;
    }
    return data;
  }

  /**
   * Eliminar una foto/vídeo de un invitado.
   * Solo funciona si fue subida por este dispositivo Y hace menos de 5 minutos.
   * Devuelve { ok: boolean, motivo?: string }.
   */
  async eliminarFoto(foto: Foto): Promise<{ ok: boolean; motivo?: string }> {
    // 1. Comprobar que el dispositivo coincide
    if (foto.subido_por_dispositivo !== this.deviceId) {
      return { ok: false, motivo: 'Solo puedes borrar fotos que tú hayas subido.' };
    }

    // 2. Comprobar que han pasado menos de 5 minutos
    const subidoEn = new Date(foto.subido_en).getTime();
    const ahora = Date.now();
    const cincoMinutos = 5 * 60 * 1000;
    if (ahora - subidoEn > cincoMinutos) {
      return { ok: false, motivo: 'Ya no puedes borrar esta foto (han pasado más de 5 minutos).' };
    }

    // 3. Borrar el archivo del Storage
    const { error: errorStorage } = await this.supabase.storage
      .from(this.BUCKET)
      .remove([foto.storage_path]);

    if (errorStorage) {
      console.error('Error al borrar del Storage:', errorStorage);
      return { ok: false, motivo: 'No se pudo borrar el archivo.' };
    }

    // 4. Borrar la fila de la BD
    const { error: errorBD } = await this.supabase
      .from('fotos')
      .delete()
      .eq('id', foto.id);

    if (errorBD) {
      console.error('Error al borrar de la BD:', errorBD);
      return { ok: false, motivo: 'No se pudo borrar el registro.' };
    }

    return { ok: true };
  }

  // ============================================
  // SOLICITUDES (acceso a la plataforma)
  // ============================================

  /**
   * Crear una solicitud de acceso (público, sin auth).
   */
  async crearSolicitud(datos: {
    nombre: string;
    email: string;
    telefono: string | null;
    tipo_evento: string;
    fecha_evento: string | null;
    mensaje: string | null;
  }): Promise<boolean> {
    const { error } = await this.supabase
      .from('solicitudes')
      .insert(datos);

    if (error) {
      console.error('Error al crear solicitud:', error);
      return false;
    }
    return true;
  }

  /**
   * Comprueba si el usuario actual es admin.
   * Devuelve false si no hay sesión o si is_admin es false.
   */
  async esAdmin(): Promise<boolean> {
    const usuario = await this.getUsuarioActual();
    if (!usuario) return false;

    const { data, error } = await this.supabase
      .from('perfiles')
      .select('is_admin')
      .eq('id', usuario.id)
      .maybeSingle();

    if (error || !data) {
      console.error('Error al comprobar admin:', error);
      return false;
    }

    return data.is_admin === true;
  }

  /**
   * Listar todas las solicitudes (solo admins por RLS).
   * Más recientes primero.
   */
  async getSolicitudes(): Promise<Solicitud[]> {
    const { data, error } = await this.supabase
      .from('solicitudes')
      .select('*')
      .order('creado_en', { ascending: false });

    if (error) {
      console.error('Error al cargar solicitudes:', error);
      return [];
    }
    return data ?? [];
  }

  /**
   * Cambiar el estado de una solicitud.
   */
  async actualizarEstadoSolicitud(
    id: string,
    estado: Solicitud['estado']
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('solicitudes')
      .update({ estado, actualizado_en: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error al actualizar estado:', error);
      return false;
    }
    return true;
  }

  /**
   * Guardar notas del admin para una solicitud.
   */
  async guardarNotasSolicitud(id: string, notas: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('solicitudes')
      .update({
        notas_admin: notas,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error al guardar notas:', error);
      return false;
    }
    return true;
  }

  /**
   * Crear cuenta de cliente desde una solicitud.
   * Llama a la Edge Function 'crear-cuenta-cliente' que:
   * - Genera password aleatorio
   * - Crea el usuario en Auth
   * - Envía email con credenciales
   * - Actualiza la solicitud a 'cuenta_creada'
   */
  async crearCuentaParaSolicitud(
    solicitudId: string
  ): Promise<{ ok: boolean; error?: string }> {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) {
      return { ok: false, error: 'No hay sesión activa' };
    }

    const { data, error } = await this.supabase.functions.invoke(
      'crear-cuenta-cliente',
      {
        body: { solicitudId },
      }
    );

    if (error) {
      console.error('Error al invocar la function:', error);
      return { ok: false, error: error.message };
    }

    if (data?.error) {
      return { ok: false, error: data.error };
    }

    return { ok: true };
  }

  // ============================================
  // PERFIL DEL ORGANIZADOR (logo, white label)
  // ============================================

  private readonly BUCKET_LOGOS = 'logos-organizadores';

  /**
   * Obtiene el perfil del usuario actual (incluyendo logo_url).
   */
  async getMiPerfil(): Promise<Perfil | null> {
    const usuario = await this.getUsuarioActual();
    if (!usuario) return null;

    const { data, error } = await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', usuario.id)
      .maybeSingle();

    if (error) {
      console.error('Error al cargar perfil:', error);
      return null;
    }
    return data;
  }

  /**
   * Obtiene el perfil de un organizador concreto por su ID
   * (lo usaremos para mostrar el logo en la galería del invitado).
   */
  async getPerfilOrganizador(organizadorId: string): Promise<Perfil | null> {
    const { data, error } = await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', organizadorId)
      .maybeSingle();

    if (error) {
      console.error('Error al cargar perfil del organizador:', error);
      return null;
    }
    return data;
  }

  /**
   * Subir/reemplazar el logo del usuario actual.
   * Devuelve la URL pública del logo o null si falla.
   */
  async subirLogo(archivo: File): Promise<string | null> {
    const usuario = await this.getUsuarioActual();
    if (!usuario) return null;

    // Path: {user-id}/logo.{ext}
    const ext = archivo.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${usuario.id}/logo.${ext}`;

    // Subir (upsert: si ya existe, lo reemplaza)
    const { error: errUpload } = await this.supabase.storage
      .from(this.BUCKET_LOGOS)
      .upload(path, archivo, { upsert: true, cacheControl: '3600' });

    if (errUpload) {
      console.error('Error al subir logo:', errUpload);
      return null;
    }

    // Obtener URL pública (con cache-buster para evitar caché del navegador)
    const { data } = this.supabase.storage
      .from(this.BUCKET_LOGOS)
      .getPublicUrl(path);

    const urlConCacheBuster = `${data.publicUrl}?v=${Date.now()}`;

    // Guardar la URL en la tabla perfiles
    const { error: errUpdate } = await this.supabase
      .from('perfiles')
      .update({ logo_url: urlConCacheBuster })
      .eq('id', usuario.id);

    if (errUpdate) {
      console.error('Error al guardar URL del logo:', errUpdate);
      return null;
    }

    return urlConCacheBuster;
  }

  /**
   * Eliminar el logo del usuario actual.
   */
  async eliminarLogo(): Promise<boolean> {
    const usuario = await this.getUsuarioActual();
    if (!usuario) return false;

    // Borrar todos los archivos en la carpeta del usuario
    const { data: archivos } = await this.supabase.storage
      .from(this.BUCKET_LOGOS)
      .list(usuario.id);

    if (archivos && archivos.length > 0) {
      const paths = archivos.map((f) => `${usuario.id}/${f.name}`);
      await this.supabase.storage.from(this.BUCKET_LOGOS).remove(paths);
    }

    // Quitar la URL del perfil
    const { error } = await this.supabase
      .from('perfiles')
      .update({ logo_url: null })
      .eq('id', usuario.id);

    return !error;
  }
}