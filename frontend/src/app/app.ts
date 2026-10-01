import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DatePipe, DecimalPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {

  private http = inject(HttpClient);

  protected readonly title = signal('frontend');

  factura: any = null;
  error: string | null = null;

  ngOnInit(): void {
    this.cargarFactura();
  }

  cargarFactura(): void {
    this.http
      .get('http://localhost:3000/api/facturas/2')
      .subscribe({
        next: (respuesta) => {
          console.log('Factura recibida:', respuesta);
          this.factura = respuesta;
        },
        error: (err) => {
          console.error('Error al consultar factura:', err);
          this.error = 'No se pudo cargar la factura.';
        }
      });
  }
}