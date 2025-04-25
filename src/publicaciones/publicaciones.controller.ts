import { 
  scrapeBBC, 
  scrapeElPais, 
  scrapeLeMonde, 
  scrapeElPeruano, 
  scrapeElPeruanoCategorias, 
  scrapeElPeruanoNoticiasPorCategoria, 
  scrapeElPeruanoNoticiasDeSeccion, 
  NewsItem, 
  scrapeDeporCategoriaResumen, 
  scrapeDeporCategoriaCompleto, 
  scrapeJornada, 
  scrapeJornadaCategoriaSimple,
  scrapeJornadaCategoriasSimple,
  formatDateToIsoPeru
} from '../scraper/scrape';
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';

// Formato especial para ping: ms, o "Xs" si es más de un segundo
function formatPing(ms: number): string {
  return ms > 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

@Controller('publicaciones')
export class PublicacionesController {
  @Get('categorias')
  async getCategorias(@Query('site') site?: string): Promise<any> {
    const t0 = Date.now();
    let categorias: any[] = [];
    if (site === 'elperuano') {
      const rawCategorias = await scrapeElPeruanoCategorias();
      categorias = rawCategorias.map((c, idx) => ({ ...c, id: idx + 1 }));
      const t1 = Date.now();
      return { status: 'ok', ping: formatPing(t1 - t0), data: categorias };
    }
    if (site === 'jornada') {
      const rawCategorias = await scrapeJornadaCategoriasSimple();
      categorias = rawCategorias.map((c, idx) => ({ ...c, id: idx + 1 }));
      const t1 = Date.now();
      return { status: 'ok', ping: formatPing(t1 - t0), data: categorias };
    }
    // Aquí puedes agregar otros sitios en el futuro
    return { status: 'error', ping: formatPing(0), data: [], message: 'Sitio no soportado' };
  }

  @Get('noticias')
  async getNoticias(
    @Query('site') site: string,
    @Query('categoria') categoria: string,
    @Query('limit') limit?: string
  ) {
    const t0 = Date.now();
    let noticias: any[] = [];
    if (site === 'eldepor') {
      let url = '';
      if (categoria === 'peruano') {
        url = 'https://depor.com/futbol-peruano/';
      } else if (categoria === 'internacional') {
        url = 'https://depor.com/futbol-internacional/';
      } else {
        throw new BadRequestException('Categoría no soportada para eldepor');
      }
      const lim = limit ? Math.max(1, Math.min(Number(limit), 50)) : 20;
      const rawNoticias = await scrapeDeporCategoriaCompleto(url, lim);
      noticias = rawNoticias.map((n, idx) => ({ ...n, id: idx + 1 }));
      const t1 = Date.now();
      return { status: 'ok', ping: formatPing(t1 - t0), data: noticias };
    }
    if (site === 'elperuano') {
      let url = categoria;
      if (!url) {
        throw new BadRequestException('Debes proporcionar la categoría o URL de sección para elperuano');
      }
      if (!url.startsWith('https://elperuano.pe/')) {
        url = `https://elperuano.pe/${url}`;
      }
      const rawNoticias = await scrapeElPeruanoNoticiasDeSeccion(url);
      noticias = rawNoticias.map((n, idx) => ({ ...n, id: idx + 1 }));
      const t1 = Date.now();
      return { status: 'ok', ping: formatPing(t1 - t0), data: noticias };
    }
    if (site === 'bbc') {
      // BBC solo soporta noticias generales, ignora categoria
      const lim = limit ? Math.max(1, Math.min(Number(limit), 50)) : 10;
      const rawNoticias = await scrapeBBC();
      // Si scrapeBBC no trae fecha, la agregamos con la hora de Perú (ahora)
      const nowPeru = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().replace('Z', '-05:00');
      noticias = rawNoticias.slice(0, lim).map((n, idx) => ({
        ...n,
        id: idx + 1,
        date: n.date ? formatDateToIsoPeru(n.date) : nowPeru,
        summary: n.summary || '',
        titulo_detalle: n.title,
        subtitulo: '',
        contenido: '',
      }));
      const t1 = Date.now();
      return { status: 'ok', ping: formatPing(t1 - t0), data: noticias };
    }
    if (site === 'jornada') {
      if (categoria) {
        const rawNoticias = await scrapeJornadaCategoriaSimple(categoria);
        noticias = rawNoticias.map((n, idx) => ({ ...n, id: idx + 1 }));
        const t1 = Date.now();
        return { status: 'ok', ping: formatPing(t1 - t0), data: noticias };
      }
      const rawNoticias = await scrapeJornada();
      noticias = rawNoticias.map((n, idx) => ({ ...n, id: idx + 1 }));
      const t1 = Date.now();
      return { status: 'ok', ping: formatPing(t1 - t0), data: noticias };
    }
    return { status: 'error', ping: formatPing(0), data: [], message: 'Sitio no soportado' };
  }
}
