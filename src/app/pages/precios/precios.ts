import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-precios',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './precios.html',
})
export class PreciosComponent {
  private supabase = inject(SupabaseService);

  cargandoPago = '';

  async elegirPlan(plan: 'evento' | 'pro') {
    this.cargandoPago = plan;

    if (plan === 'evento') {
      await this.supabase.iniciarPago(
        environment.stripePriceEventoUnico,
        'payment'
      );
    } else {
      await this.supabase.iniciarPago(
        environment.stripePricePro,
        'subscription'
      );
    }

    this.cargandoPago = '';
  }
}