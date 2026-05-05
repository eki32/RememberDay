import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  private cdr = inject(ChangeDetectorRef);

  nombre = '';
  email = '';
  mensaje = '';

  cargando = false;
  enviado = false;
  error = '';

  async enviar() {
    if (!this.nombre.trim() || !this.email.trim() || !this.mensaje.trim()) {
      this.error = 'Por favor, rellena todos los campos.';
      return;
    }

    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    // Reutilizamos la tabla solicitudes con tipo_evento = 'contacto'
    const ok = await this.supabase.crearSolicitud({
      nombre: this.nombre.trim(),
      email: this.email.trim(),
      telefono: null,
      tipo_evento: 'contacto',
      fecha_evento: null,
      mensaje: this.mensaje.trim(),
    });

    this.cargando = false;

    if (ok) {
      this.enviado = true;
    } else {
      this.error = 'No se pudo enviar el mensaje. Inténtalo de nuevo.';
    }

    this.cdr.detectChanges();
  }
}