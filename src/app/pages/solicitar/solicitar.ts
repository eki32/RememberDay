import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-solicitar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './solicitar.html',
})
export class SolicitarComponent {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Campos del formulario
  nombre = '';
  email = '';
  telefono = '';
  tipoEvento = '';
  fechaEvento = '';
  mensaje = '';

  cargando = false;
  enviado = false;
  error = '';

  tiposEvento = [
    { valor: 'boda', etiqueta: 'Boda' },
    { valor: 'cumpleanos', etiqueta: 'Cumpleaños' },
    { valor: 'empresa', etiqueta: 'Evento de empresa' },
    { valor: 'comunion', etiqueta: 'Comunión / Bautizo' },
    { valor: 'otro', etiqueta: 'Otro' },
  ];

  async enviar() {
    if (!this.nombre.trim() || !this.email.trim() || !this.tipoEvento) {
      this.error = 'Por favor, rellena los campos obligatorios.';
      return;
    }

    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    const ok = await this.supabase.crearSolicitud({
      nombre: this.nombre.trim(),
      email: this.email.trim(),
      telefono: this.telefono.trim() || null,
      tipo_evento: this.tipoEvento,
      fecha_evento: this.fechaEvento || null,
      mensaje: this.mensaje.trim() || null,
    });

    this.cargando = false;

    if (ok) {
      this.enviado = true;
    } else {
      this.error = 'No se pudo enviar la solicitud. Inténtalo de nuevo.';
    }

    this.cdr.detectChanges();
  }
}