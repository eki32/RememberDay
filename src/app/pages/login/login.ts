import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
})
export class LoginComponent {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  email = '';
  password = '';
  cargando = false;
  error = '';

  async entrar() {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    const { error } = await this.supabase.iniciarSesion(
      this.email,
      this.password
    );

    if (error) {
      this.error = 'Email o contraseña incorrectos.';
      this.cargando = false;
      this.cdr.detectChanges();
      return;
    }

    this.router.navigate(['/panel']);
  }
}