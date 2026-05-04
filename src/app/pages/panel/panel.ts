import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Evento } from '../../services/supabase';

@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './panel.html',
})
export class PanelComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  eventos: Evento[] = [];
  cargando = true;
  mostrandoFormulario = false;
  creando = false;

  nuevoTitulo = '';
  nuevaFecha = '';
  nuevoLugar = '';
  esAdmin = false;

   // Branding
  miPerfil: any = null;
  subiendoLogo = false;
  mostrandoBranding = false;

  async ngOnInit() {
    this.esAdmin = await this.supabase.esAdmin();
    this.miPerfil = await this.supabase.getMiPerfil();
    await this.cargarEventos();
  }

  async cargarEventos() {
    this.cargando = true;
    this.cdr.detectChanges();
    this.eventos = await this.supabase.getMisEventos();
    this.cargando = false;
    this.cdr.detectChanges();
  }

  abrirFormulario() {
    this.mostrandoFormulario = true;
    this.nuevoTitulo = '';
    this.nuevaFecha = '';
    this.nuevoLugar = '';
  }

  cerrarFormulario() {
    this.mostrandoFormulario = false;
  }

async crearEvento() {
    if (!this.nuevoTitulo.trim()) return;

    this.creando = true;
    this.cdr.detectChanges();

    const evento = await this.supabase.crearEvento(
      this.nuevoTitulo,
      this.nuevaFecha,
      this.nuevoLugar,
      'gratuito' // el servicio lo sobreescribe a 'pro' si eres admin
    );

    this.creando = false;

    if (evento) {
      this.cerrarFormulario();
      await this.cargarEventos();
    } else {
      alert('No se pudo crear el evento. Intenta de nuevo.');
    }
  }

  async cerrarSesion() {
    await this.supabase.cerrarSesion();
    this.router.navigate(['/login']);
  }

  abrirBranding() {
    this.mostrandoBranding = true;
  }

  cerrarBranding() {
    this.mostrandoBranding = false;
  }

  async onLogoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const archivo = input.files[0];

    // Validar tamaño (máx 2MB)
    if (archivo.size > 2 * 1024 * 1024) {
      alert('El logo no puede pesar más de 2 MB.');
      input.value = '';
      return;
    }

    // Validar tipo
    if (!archivo.type.startsWith('image/')) {
      alert('El archivo debe ser una imagen.');
      input.value = '';
      return;
    }

    this.subiendoLogo = true;
    this.cdr.detectChanges();

    const url = await this.supabase.subirLogo(archivo);
    if (url) {
      this.miPerfil = { ...this.miPerfil, logo_url: url };
    } else {
      alert('No se pudo subir el logo. Intenta de nuevo.');
    }

    this.subiendoLogo = false;
    input.value = '';
    this.cdr.detectChanges();
  }

  async quitarLogo() {
    const ok = confirm('¿Quitar tu logo? Volverás a usar el de Recuerda tu Día por defecto.');
    if (!ok) return;

    const exito = await this.supabase.eliminarLogo();
    if (exito) {
      this.miPerfil = { ...this.miPerfil, logo_url: null };
      this.cdr.detectChanges();
    } else {
      alert('No se pudo eliminar el logo.');
    }
  }

  
}