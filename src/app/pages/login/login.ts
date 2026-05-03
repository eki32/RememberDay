import { Component, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
})
export class LoginComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  email = '';
  password = '';
  cargando = false;
  error = '';
  redirectTo: string | null = null;

  ngOnInit() {
    // Capturamos a dónde queremos volver tras hacer login
    this.redirectTo = this.route.snapshot.queryParamMap.get('redirect');
  }

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

    // Tras login, ir al destino original o al panel por defecto
    const destino = this.redirectTo || '/panel';
    this.router.navigateByUrl(destino);
  }
}