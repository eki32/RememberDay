import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Evento } from '../../services/supabase';
import { ToastService } from '../../services/toast';

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
  private toast = inject(ToastService);

  eventos: Evento[] = [];
  cargando = true;
  mostrandoFormulario = false;
  creando = false;

  nuevoTitulo = '';
  nuevaFecha = '';
  nuevoLugar = '';
  esAdmin = false;
  perfilCargado = false;

  // Branding
  miPerfil: any = null;
  subiendoLogo = false;
  mostrandoBranding = false;

async ngOnInit() {
  this.esAdmin = await this.supabase.esAdmin();
  this.miPerfil = await this.supabase.getMiPerfil();
  this.perfilCargado = true; // ← AÑADE ESTO
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

    const resultado = await this.supabase.crearEvento(
      this.nuevoTitulo,
      this.nuevaFecha,
      this.nuevoLugar,
      'gratuito'
    );

    this.creando = false;

    if (resultado.evento) {
      this.cerrarFormulario();
      await this.cargarEventos();
    } else {
      this.toast.error(resultado.motivo ?? 'No se pudo crear el evento.');
      this.cdr.detectChanges();
    }
  }

  async cerrarSesion() {
    await this.supabase.cerrarSesion();
    this.router.navigate(['/login']);
  }

   get puedeCrearMasEventos(): boolean {
    if (!this.miPerfil) return false;
    if (this.miPerfil.is_admin || this.miPerfil.plan === 'pro') return true;
    if (this.miPerfil.plan === 'evento_unico') return this.eventos.length < 1;
    if (this.miPerfil.plan === 'gratuito') return this.eventos.length < 1;
    return false;
  }

  abrirBranding() {
    this.mostrandoBranding = true;
  }

  cerrarBranding() {
    this.mostrandoBranding = false;
  }

  async onLogoSeleccionado(event: Event) {
    if (this.miPerfil?.plan !== 'pro') {
      this.toast.error('El logo personalizado solo está disponible en el Plan Pro.');
      return;
    }

    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const archivo = input.files[0];

    // Validar tamaño (máx 2MB)
    if (archivo.size > 2 * 1024 * 1024) {
      this.toast.error('El logo no puede pesar más de 2 MB.');
      input.value = '';
      return;
    }

    // Validar tipo
    if (!archivo.type.startsWith('image/')) {
      this.toast.error('El archivo debe ser una imagen.');
      input.value = '';
      return;
    }

    this.subiendoLogo = true;
    this.cdr.detectChanges();

    const url = await this.supabase.subirLogo(archivo);
    if (url) {
      this.miPerfil = { ...this.miPerfil, logo_url: url };
    } else {
      this.toast.error('No se pudo subir el logo. Intenta de nuevo.');
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
      this.toast.error('No se pudo eliminar el logo.');
    }
  }
}
