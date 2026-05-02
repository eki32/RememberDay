import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './registro.html',
})
export class RegistroComponent {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  email = '';
  password = '';
  cargando = false;
  error = '';

  async registrarse() {
    if (this.password.length < 6) {
      this.error = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    const { error } = await this.supabase.registrarse(this.email, this.password);

    if (error) {
      this.error = error.message;
      this.cargando = false;
      this.cdr.detectChanges();
      return;
    }

    await this.supabase.iniciarSesion(this.email, this.password);
    this.router.navigate(['/panel']);
  }
}