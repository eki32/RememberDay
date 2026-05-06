import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Evento, Foto, SupabaseService } from '../../services/supabase';
import { ToastService } from '../../services/toast';

interface FotoConUrl extends Foto {
  url: string;
}

@Component({
  selector: 'app-galeria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './galeria.html',
})
export class GaleriaComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);

  logoOrganizador: string | null = null;

  slug = this.route.snapshot.paramMap.get('id') ?? '';
  evento: Evento | null = null;
  fotos: FotoConUrl[] = [];
  cargando = true;
  subiendo = false;
  eventoExpirado = false;
  eventoLimiteFotos = false;
  progresoSubida = { hechas: 0, total: 0 };
  nombreInvitado: string | null = null;
  miDeviceId = '';
  borrandoIds = new Set<string>();

  // Para refrescar la UI cada minuto y que el botón "borrar" desaparezca solo
  private intervalo: any = null;

  // Canal de tiempo real — lo guardamos para cerrarlo al salir
  private canalRealtime: any = null;

  // Lightbox
  lightboxFoto: FotoConUrl | null = null;
  lightboxIndex = -1;

  get fotosSolo(): FotoConUrl[] {
    return this.fotos.filter(f => f.tipo === 'foto');
  }

  abrirLightbox(foto: FotoConUrl) {
    if (foto.tipo !== 'foto') return;
    this.lightboxIndex = this.fotosSolo.findIndex(f => f.id === foto.id);
    this.lightboxFoto = foto;
    this.cdr.detectChanges();
  }

  cerrarLightbox() {
    this.lightboxFoto = null;
    this.lightboxIndex = -1;
    this.cdr.detectChanges();
  }

  lightboxAnterior() {
    if (this.lightboxIndex <= 0) return;
    this.lightboxIndex--;
    this.lightboxFoto = this.fotosSolo[this.lightboxIndex];
    this.cdr.detectChanges();
  }

  lightboxSiguiente() {
    if (this.lightboxIndex >= this.fotosSolo.length - 1) return;
    this.lightboxIndex++;
    this.lightboxFoto = this.fotosSolo[this.lightboxIndex];
    this.cdr.detectChanges();
  }

  onLightboxKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') this.lightboxAnterior();
    else if (event.key === 'ArrowRight') this.lightboxSiguiente();
    else if (event.key === 'Escape') this.cerrarLightbox();
  }

async ngOnInit() {
    this.nombreInvitado = sessionStorage.getItem('invitado-nombre');
    this.miDeviceId = this.supabase.getDeviceId();

    this.evento = await this.supabase.getEventoPorSlug(this.slug);


    if (this.evento) {
      // Verificar expiración (solo plan gratuito)
      if (this.evento.expira_en) {
        this.eventoExpirado = new Date(this.evento.expira_en) < new Date();
      }

      // Aviso si está cerca del límite (plan gratuito, 24+ fotos = 80%)
      if (this.evento.plan === 'gratuito' && !this.eventoExpirado) {
        const fotosActuales = await this.supabase.getFotosDeEvento(this.evento.id);
        this.eventoLimiteFotos = fotosActuales.length >= 24;
      }

      // Cargar el logo del organizador (white label)
      if (this.evento.organizador_id) {
        const perfil = await this.supabase.getPerfilOrganizador(
          this.evento.organizador_id
        );
        this.logoOrganizador = perfil?.logo_url ?? null;
      }

      await this.cargarFotos();
      this.suscribirseATiempoReal();
    }
    this.cargando = false;
    this.cdr.detectChanges();

    this.intervalo = setInterval(() => this.cdr.detectChanges(), 30_000);
  }

  ngOnDestroy() {
    if (this.canalRealtime) {
      this.supabase.desuscribirse(this.canalRealtime);
    }
    if (this.intervalo) {
      clearInterval(this.intervalo);
    }
  }

  private suscribirseATiempoReal() {
    if (!this.evento) return;

    this.canalRealtime = this.supabase.suscribirseACambiosDeFotos(
      this.evento.id,
      {
        onNueva: (nuevaFoto) => {
          // Evitar duplicados
          const yaExiste = this.fotos.some((f) => f.id === nuevaFoto.id);
          if (yaExiste) return;

          // Añadir al principio (las más recientes primero)
          const fotoConUrl: FotoConUrl = {
            ...nuevaFoto,
            url: this.supabase.getUrlPublica(nuevaFoto.storage_path),
          };
          this.fotos = [fotoConUrl, ...this.fotos];
          this.cdr.detectChanges();
        },
        onBorrada: (fotoId) => {
          // Quitar la foto del array
          this.fotos = this.fotos.filter((f) => f.id !== fotoId);
          this.cdr.detectChanges();
        },
      }
    );
  }

  async cargarFotos() {
    if (!this.evento) return;
    const fotos = await this.supabase.getFotosDeEvento(this.evento.id);
    this.fotos = fotos.map((f) => ({
      ...f,
      url: this.supabase.getUrlPublica(f.storage_path),
    }));
    this.cdr.detectChanges();
  }

  get iniciales(): string {
    if (!this.nombreInvitado) return '?';
    return this.nombreInvitado
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  get totalFotos(): number {
    return this.fotos.filter((f) => f.tipo === 'foto').length;
  }

  get totalVideos(): number {
    return this.fotos.filter((f) => f.tipo === 'video').length;
  }

  /**
   * Indica si el invitado actual puede borrar esta foto:
   * - La subió este dispositivo
   * - Hace menos de 5 minutos
   */
  puedoBorrar(foto: Foto): boolean {
    if (foto.subido_por_dispositivo !== this.miDeviceId) return false;
    const subidoEn = new Date(foto.subido_en).getTime();
    return Date.now() - subidoEn < 5 * 60 * 1000;
  }

  async borrarFoto(foto: FotoConUrl, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    const confirmado = confirm('¿Seguro que quieres borrar esta foto?');
    if (!confirmado) return;

    this.borrandoIds.add(foto.id);
    this.cdr.detectChanges();

    const resultado = await this.supabase.eliminarFoto(foto);

    if (!resultado.ok) {
      this.toast.error(resultado.motivo ?? 'No se pudo borrar la foto.');
      this.borrandoIds.delete(foto.id);
      this.cdr.detectChanges();
    }
    // Si OK, el realtime se encargará de quitarla del array
    // (también para el resto de invitados conectados)
  }

  async onArchivosSeleccionados(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.evento) return;

    const archivos = Array.from(input.files);
    this.subiendo = true;
    this.progresoSubida = { hechas: 0, total: archivos.length };
    this.cdr.detectChanges();

    const errores: string[] = [];

    for (const archivo of archivos) {
      const resultado = await this.supabase.subirArchivo(
        this.evento.id,
        archivo,
        this.nombreInvitado
      );

      if (!resultado.ok) {
        errores.push(`${archivo.name}: ${resultado.motivo}`);
      }

      this.progresoSubida.hechas++;
      this.cdr.detectChanges();
    }

    this.subiendo = false;
    input.value = '';
    this.cdr.detectChanges();

    // Si hubo errores, avisar al invitado
    if (errores.length > 0) {
      const mensaje =
        errores.length === 1
          ? `No se pudo subir 1 archivo:\n\n${errores[0]}`
          : `No se pudieron subir ${errores.length} archivos:\n\n${errores
              .slice(0, 5)
              .join('\n')}${errores.length > 5 ? '\n…' : ''}`;
      this.toast.error(mensaje);
    }
  }
}