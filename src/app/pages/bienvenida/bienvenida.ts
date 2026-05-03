import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService, Evento } from '../../services/supabase';

@Component({
  selector: 'app-bienvenida',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bienvenida.html',
})
export class BienvenidaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  logoOrganizador: string | null = null;

  slug = this.route.snapshot.paramMap.get('id') ?? '';
  evento: Evento | null = null;
  cargando = true;
  nombre = '';

async ngOnInit() {
    this.evento = await this.supabase.getEventoPorSlug(this.slug);

    // Cargar logo del organizador (si tiene)
    if (this.evento?.organizador_id) {
      const perfil = await this.supabase.getPerfilOrganizador(
        this.evento.organizador_id
      );
      this.logoOrganizador = perfil?.logo_url ?? null;
    }

    this.cargando = false;
    this.cdr.detectChanges();
  }

  entrar() {
    if (!this.evento) return;

    if (this.nombre.trim()) {
      sessionStorage.setItem('invitado-nombre', this.nombre.trim());
    }
    sessionStorage.setItem('evento-id', this.evento.id);
    this.router.navigate(['/evento', this.slug, 'galeria']);
  }
}