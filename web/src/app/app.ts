import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

interface StatsResponse {
  meta: {
    from: string | null;
    to: string | null;
    entries: number;
    days: number;
    total: number;
    granularity: 'daily' | 'hourly';
  };
  series: Array<{ bucket: string; total: number; dayIntegral: number }>;
}

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements AfterViewInit {
  @ViewChild('chartCanvas')
  chartCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  from = '';
  to = '';
  total = 0;
  days = 0;
  entries = 0;
  avg = '0';
  granularity: 'daily' | 'hourly' = 'daily';
  rows: Array<{ bucket: string; total: number; dayIntegral: number }> = [];

  private readonly apiBase = 'http://127.0.0.1:8787';

  ngAfterViewInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    const params = new URLSearchParams();
    if (this.from) params.set('from', this.from);
    if (this.to) params.set('to', this.to);

    const query = params.toString();
    const url = `${this.apiBase}/api/stats${query ? `?${query}` : ''}`;
    const data = await firstValueFrom(this.http.get<StatsResponse>(url));

    this.granularity = data.meta.granularity || 'daily';
    this.total = data.meta.total;
    this.days = data.meta.days;
    this.entries = data.meta.entries;
    this.avg = this.days ? (this.total / this.days).toFixed(1) : '0';
    this.rows = data.series ?? [];

    if (isPlatformBrowser(this.platformId) && !this.isJestJsdom()) {
      queueMicrotask(() => this.drawChart());
    }
  }

  async loadAll(): Promise<void> {
    this.from = '';
    this.to = '';
    await this.load();
  }

  fmtBucket(bucket: string): string {
    if (this.granularity === 'hourly') {
      const dt = new Date(`${bucket}:00`);
      return dt.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return new Date(bucket).toLocaleDateString('de-DE');
  }

  private shortBucket(bucket: string): string {
    if (this.granularity === 'hourly') {
      const dt = new Date(`${bucket}:00`);
      return dt.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
      });
    }
    return bucket.slice(5);
  }

  private isJestJsdom(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      navigator.userAgent.toLowerCase().includes('jsdom')
    );
  }

  private drawChart(): void {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const series = this.rows;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#10131c';
    ctx.fillRect(0, 0, w, h);

    if (!series.length) {
      ctx.fillStyle = '#9aa8bf';
      ctx.font = '16px Inter, system-ui, sans-serif';
      ctx.fillText('Keine Daten im gewählten Zeitraum.', 20, 34);
      return;
    }

    const pad = { l: 52, r: 18, t: 20, b: 46 };
    const cw = w - pad.l - pad.r;
    const ch = h - pad.t - pad.b;
    const max = Math.max(...series.map((d) => Math.max(d.total || 0, d.dayIntegral || 0)), 1);
    const bw = Math.max(6, Math.min(44, (cw / series.length) * 0.55));
    const step = cw / Math.max(series.length, 1);

    ctx.strokeStyle = '#2c3445';
    ctx.lineWidth = 1;
    ctx.font = '12px Inter, system-ui, sans-serif';
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ch * (i / 4);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      const val = Math.round(max * (1 - i / 4));
      ctx.fillStyle = '#93a2ba';
      ctx.fillText(String(val), 8, y + 4);
    }

    series.forEach((d, i) => {
      const x = pad.l + step * i + step / 2;
      const y = pad.t + ch - ((d.total || 0) / max) * ch;
      const bx = x - bw / 2;
      const bh = pad.t + ch - y;
      ctx.fillStyle = '#4f8cff88';
      ctx.fillRect(bx, y, bw, bh);

      if (series.length <= 16 || i % Math.ceil(series.length / 16) === 0) {
        ctx.fillStyle = '#d0dcf5';
        ctx.save();
        ctx.translate(x, h - 8);
        ctx.rotate(-0.45);
        ctx.fillText(this.shortBucket(d.bucket), 0, 0);
        ctx.restore();
      }
    });

    ctx.strokeStyle = '#ffb74d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    series.forEach((d, i) => {
      const x = pad.l + step * i + step / 2;
      const y = pad.t + ch - ((d.dayIntegral || 0) / max) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}
