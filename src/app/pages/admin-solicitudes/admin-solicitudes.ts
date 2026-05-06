import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Solicitud } from '../../services/supabase';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-admin-solicitudes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-solicitudes.html',
})
export class AdminSolicitudesComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);

  solicitudes: Solicitud[] = [];
  cargando = true;
  filtroEstado: string = 'todos';

  seleccionada: Solicitud | null = null;
  notasEdit = '';
  guardandoNotas = false;
  creandoCuenta = false;

  estados: { valor: Solicitud['estado']; etiqueta: string; color: string }[] = [
    { valor: 'pendiente', etiqueta: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
    { valor: 'contactado', etiqueta: 'Contactado', color: 'bg-blue-100 text-blue-800' },
    { valor: 'pagado', etiqueta: 'Pagado', color: 'bg-purple-100 text-purple-800' },
    { valor: 'cuenta_creada', etiqueta: 'Cuenta creada', color: 'bg-green-100 text-green-800' },
    { valor: 'rechazado', etiqueta: 'Rechazado', color: 'bg-red-100 text-red-800' },
  ];

  estadosContacto = [
    { valor: 'pendiente' as Solicitud['estado'], etiqueta: 'Nuevo', color: 'bg-blue-100 text-blue-800' },
    { valor: 'contactado' as Solicitud['estado'], etiqueta: 'Respondido', color: 'bg-green-100 text-green-800' },
    { valor: 'rechazado' as Solicitud['estado'], etiqueta: 'Archivado', color: 'bg-stone-100 text-stone-600' },
  ];

  tiposEvento: Record<string, string> = {
    boda: 'Boda',
    cumpleanos: 'Cumpleaños',
    empresa: 'Evento de empresa',
    comunion: 'Comunión / Bautizo',
    contacto: '💬 Consulta',
    otro: 'Otro',
  };

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.cargando = true;
    this.cdr.detectChanges();
    this.solicitudes = await this.supabase.getSolicitudes();
    this.cargando = false;
    this.cdr.detectChanges();
  }

  get solicitudesFiltradas(): Solicitud[] {
    if (this.filtroEstado === 'todos') return this.solicitudes;
    return this.solicitudes.filter((s) => s.estado === this.filtroEstado);
  }

  get contadorPorEstado(): Record<string, number> {
    const conteo: Record<string, number> = { todos: this.solicitudes.length };
    for (const estado of this.estados) {
      conteo[estado.valor] = this.solicitudes.filter(
        (s) => s.estado === estado.valor
      ).length;
    }
    return conteo;
  }

  get estadosParaMostrar() {
    if (this.seleccionada?.tipo_evento === 'contacto') {
      return this.estadosContacto;
    }
    return this.estados;
  }

  estiloEstado(solicitud: Solicitud): string {
    if (solicitud.tipo_evento === 'contacto') {
      const estado = this.estadosContacto.find((e) => e.valor === solicitud.estado);
      return estado?.color ?? 'bg-stone-100 text-stone-600';
    }
    return this.estados.find((e) => e.valor === solicitud.estado)?.color ?? 'bg-stone-100 text-stone-800';
  }

  etiquetaEstado(solicitud: Solicitud): string {
    if (solicitud.tipo_evento === 'contacto') {
      const etiquetas: Record<string, string> = {
        pendiente: 'Nuevo',
        contactado: 'Respondido',
        rechazado: 'Archivado',
      };
      return etiquetas[solicitud.estado] ?? solicitud.estado;
    }
    return this.estados.find((e) => e.valor === solicitud.estado)?.etiqueta ?? solicitud.estado;
  }

  etiquetaTipoEvento(valor: string): string {
    return this.tiposEvento[valor] ?? valor;
  }

  abrirDetalle(solicitud: Solicitud) {
    this.seleccionada = solicitud;
    this.notasEdit = solicitud.notas_admin ?? '';
  }

  cerrarDetalle() {
    this.seleccionada = null;
    this.notasEdit = '';
  }

  async cambiarEstado(nuevoEstado: Solicitud['estado']) {
    if (!this.seleccionada) return;

    const ok = await this.supabase.actualizarEstadoSolicitud(
      this.seleccionada.id,
      nuevoEstado
    );

    if (ok) {
      this.seleccionada.estado = nuevoEstado;
      const idx = this.solicitudes.findIndex((s) => s.id === this.seleccionada!.id);
      if (idx !== -1) this.solicitudes[idx].estado = nuevoEstado;
      this.cdr.detectChanges();
    } else {
      this.toast.error('No se pudo cambiar el estado.');
    }
  }

  async guardarNotas() {
    if (!this.seleccionada) return;

    this.guardandoNotas = true;
    this.cdr.detectChanges();

    const ok = await this.supabase.guardarNotasSolicitud(
      this.seleccionada.id,
      this.notasEdit
    );

    if (ok) {
      this.seleccionada.notas_admin = this.notasEdit;
      const idx = this.solicitudes.findIndex((s) => s.id === this.seleccionada!.id);
      if (idx !== -1) this.solicitudes[idx].notas_admin = this.notasEdit;
      this.toast.exito('Notas guardadas.');
    } else {
      this.toast.error('No se pudieron guardar las notas.');
    }

    this.guardandoNotas = false;
    this.cdr.detectChanges();
  }

  async crearCuenta() {
    if (!this.seleccionada) return;

    const confirmado = confirm(
      `¿Crear cuenta para ${this.seleccionada.nombre}?\n\n` +
      `Se generará una contraseña automática y se enviará por email a:\n` +
      `${this.seleccionada.email}`
    );
    if (!confirmado) return;

    this.creandoCuenta = true;
    this.cdr.detectChanges();

    const resultado = await this.supabase.crearCuentaParaSolicitud(
      this.seleccionada.id
    );

    this.creandoCuenta = false;

    if (resultado.ok) {
      this.seleccionada.estado = 'cuenta_creada';
      const idx = this.solicitudes.findIndex(
        (s) => s.id === this.seleccionada!.id
      );
      if (idx !== -1) this.solicitudes[idx].estado = 'cuenta_creada';
      this.cdr.detectChanges();
      this.toast.exito('Cuenta creada y email enviado al cliente.');
    } else {
      this.toast.error(resultado.error ?? 'No se pudo crear la cuenta.');
      this.cdr.detectChanges();
    }
  }

  async cerrarSesion() {
    await this.supabase.cerrarSesion();
    this.router.navigate(['/login']);
  }

  formatearFecha(fecha: string | null): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatearFechaCompleta(fecha: string): string {
    return new Date(fecha).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}