import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  mensaje: string;
  tipo: 'exito' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);
  private nextId = 0;

  mostrar(mensaje: string, tipo: 'exito' | 'error' | 'info' = 'info', duracion = 4000) {
    const id = this.nextId++;
    this.toasts.update((t) => [...t, { id, mensaje, tipo }]);
    setTimeout(() => this.cerrar(id), duracion);
  }

  exito(mensaje: string) { this.mostrar(mensaje, 'exito'); }
  error(mensaje: string) { this.mostrar(mensaje, 'error', 5000); }
  info(mensaje: string) { this.mostrar(mensaje, 'info'); }

  cerrar(id: number) {
    this.toasts.update((t) => t.filter((toast) => toast.id !== id));
  }
}