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

  async ngOnInit() {
    // Ya no comprobamos sesión — lo hace authGuard
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

    const evento = await this.supabase.crearEvento({
      titulo: this.nuevoTitulo,
      fecha: this.nuevaFecha,
      lugar: this.nuevoLugar,
    });

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
}