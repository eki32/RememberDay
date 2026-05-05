import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';
import JSZip from 'jszip';
import { SupabaseService, Evento, Foto } from '../../services/supabase';
import { ToastService } from '../../services/toast';


interface FotoConUrl extends Foto {
  url: string;
}

@Component({
  selector: 'app-panel-evento',
  standalone: true,
  imports: [CommonModule,DatePipe, RouterLink, QRCodeComponent],
  templateUrl: './panel-evento.html',
})
export class PanelEventoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);

  @ViewChild('cartelRef') cartelRef!: ElementRef<HTMLDivElement>;

  eventoId = this.route.snapshot.paramMap.get('id') ?? '';
  evento: Evento | null = null;
  fotos: FotoConUrl[] = [];
  cargando = true;
  descargando = false;
  progresoDescarga = { hechas: 0, total: 0 };
  eliminando = false;
  generandoCartel = false;
  logoOrganizador: string | null = null;

  get urlInvitado(): string {
    if (!this.evento) return '';
    return `${window.location.origin}/evento/${this.evento.slug}`;
  }

  async ngOnInit() {
    this.evento = await this.supabase.getEventoPorId(this.eventoId);
    if (this.evento) {
      const fotos = await this.supabase.getFotosDeEvento(this.evento.id);
      this.fotos = fotos.map((f) => ({
        ...f,
        url: this.supabase.getUrlPublica(f.storage_path),
      }));
      // Cargar logo del organizador para el cartel
      const perfil = await this.supabase.getMiPerfil();
      this.logoOrganizador = perfil?.logo_url ?? null;
    }
    this.cargando = false;
    this.cdr.detectChanges();
  }

  get totalFotos(): number {
    return this.fotos.filter((f) => f.tipo === 'foto').length;
  }

  get totalVideos(): number {
    return this.fotos.filter((f) => f.tipo === 'video').length;
  }

  descargarQR() {
    const svg = document.querySelector('qrcode svg') as SVGElement;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 800;
      canvas.height = 800;
      if (!ctx) return;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 800, 800);
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR-${this.evento?.slug}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }

  async copiarUrl() {
    await navigator.clipboard.writeText(this.urlInvitado);
    this.toast.exito('URL copiada al portapapeles');
  }

  /**
   * Genera y descarga el cartel A6 del evento como PNG.
   * Usa html2canvas para convertir el div del cartel a imagen.
   */
  async descargarCartel() {
    if (!this.evento) return;

    if (this.evento.plan === 'gratuito') {
    this.toast.error('El cartel imprimible no está disponible en el plan gratuito. Actualiza tu plan en /precios.');
    return;
  }

    this.generandoCartel = true;
    this.cdr.detectChanges();

    // Pequeña espera para que el DOM se actualice y el cartel sea visible
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).jsPDF;

      const cartelEl = this.cartelRef.nativeElement;

      // Hacer visible temporalmente para capturar
      cartelEl.style.position = 'fixed';
      cartelEl.style.top = '-9999px';
      cartelEl.style.left = '-9999px';
      cartelEl.style.display = 'block';

      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(cartelEl, {
        scale: 3, // Alta resolución para impresión
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      cartelEl.style.display = 'none';
      cartelEl.style.position = '';
      cartelEl.style.top = '';
      cartelEl.style.left = '';

      // A6 = 105 × 148 mm
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a6',
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 105, 148);
      pdf.save(`Cartel-${this.evento.slug}.pdf`);
    } catch (err) {
      console.error('Error generando cartel:', err);
      this.toast.error('No se pudo generar el cartel. Inténtalo de nuevo.');
    }

    this.generandoCartel = false;
    this.cdr.detectChanges();
  }

  async descargarTodasLasFotos() {
    if (this.fotos.length === 0) {
      this.toast.info('No hay fotos para descargar.');
      return;
    }

    if (this.evento?.plan === 'gratuito') {
    this.toast.error('La descarga ZIP no está disponible en el plan gratuito. Actualiza tu plan en /precios.');
    return;
  }

    this.descargando = true;
    this.progresoDescarga = { hechas: 0, total: this.fotos.length };
    this.cdr.detectChanges();

    const zip = new JSZip();

    for (const foto of this.fotos) {
      const blob = await this.supabase.descargarArchivo(foto.storage_path);
      if (blob) {
        const ext = foto.storage_path.split('.').pop() ?? 'bin';
        const fecha = new Date(foto.subido_en).toISOString().slice(0, 10);
        const autor = foto.nombre_invitado ? '-' + foto.nombre_invitado.replace(/\s+/g, '_') : '';
        const nombre = `${fecha}${autor}-${foto.id.slice(0, 6)}.${ext}`;
        zip.file(nombre, blob);
      }
      this.progresoDescarga.hechas++;
      this.cdr.detectChanges();
    }

    const blobZip = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blobZip);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.evento?.slug ?? 'evento'}-fotos.zip`;
    a.click();
    URL.revokeObjectURL(url);

    this.descargando = false;
    this.cdr.detectChanges();
  }

  async eliminarEvento() {
    if (!this.evento) return;
    const confirmacion = confirm(
      `¿Seguro que quieres eliminar "${this.evento.titulo}"? Se borrarán todas las fotos. Esta acción no se puede deshacer.`,
    );
    if (!confirmacion) return;

    this.eliminando = true;
    this.cdr.detectChanges();

    const ok = await this.supabase.eliminarEvento(this.evento.id);
    if (ok) {
      this.router.navigate(['/panel']);
    } else {
      this.toast.error('No se pudo eliminar el evento.');
      this.eliminando = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Compartir por WhatsApp en grupo
   */
  compartirWhatsAppGrupo() {
    if (!this.evento) return;

    const mensaje = `*${this.evento.titulo}*

¡Hola a todos! Para guardar todos los recuerdos de hoy juntos, hemos creado un álbum compartido.

*Cómo subir tus fotos (muy fácil):*
1. Abre este enlace: ${this.urlInvitado}
2. Escribe tu nombre (opcional)
3. Pulsa "Subir fotos" y elige las que quieras

Funciona desde el móvil, sin descargar ninguna app.

¡Gracias a todos y que disfrutéis el día!`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }

  /**
   * Compartir por WhatsApp uno a uno
   */
  compartirWhatsAppIndividual() {
    if (!this.evento) return;

    const mensaje = `Hola!

Te comparto el enlace del álbum de fotos de *${this.evento.titulo}* para que puedas subir tus fotos del día.

${this.urlInvitado}

Es muy fácil:
- Abre el enlace desde tu móvil
- Escribe tu nombre si quieres
- Pulsa el botón para subir tus fotos

No hace falta descargar ninguna app. ¡Gracias!`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }

  estaExpirado(): boolean {
  if (!this.evento?.expira_en) return false;
  return new Date(this.evento.expira_en) < new Date();
}
}
