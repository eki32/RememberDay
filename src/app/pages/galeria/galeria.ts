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
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  slug = this.route.snapshot.paramMap.get('id') ?? '';
  evento: Evento | null = null;
  fotos: FotoConUrl[] = [];
  cargando = true;
  subiendo = false;
  progresoSubida = { hechas: 0, total: 0 };
  nombreInvitado: string | null = null;
  miDeviceId = '';
  borrandoIds = new Set<string>();

  // Para refrescar la UI cada minuto y que el botón "borrar" desaparezca solo
  private intervalo: any = null;

  // Canal de tiempo real — lo guardamos para cerrarlo al salir
  private canalRealtime: any = null;

  async ngOnInit() {
    this.nombreInvitado = sessionStorage.getItem('invitado-nombre');
    this.miDeviceId = this.supabase.getDeviceId();

    this.evento = await this.supabase.getEventoPorSlug(this.slug);
    if (this.evento) {
      await this.cargarFotos();
      this.suscribirseATiempoReal();
    }
    this.cargando = false;
    this.cdr.detectChanges();

    // Refrescar la UI cada 30 segundos para que los botones de borrar
    // desaparezcan automáticamente al pasar los 5 minutos
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
      alert(resultado.motivo ?? 'No se pudo borrar la foto.');
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

    for (const archivo of archivos) {
      await this.supabase.subirArchivo(
        this.evento.id,
        archivo,
        this.nombreInvitado
      );
      this.progresoSubida.hechas++;
      this.cdr.detectChanges();
    }

    this.subiendo = false;
    input.value = '';
    this.cdr.detectChanges();
  }
}