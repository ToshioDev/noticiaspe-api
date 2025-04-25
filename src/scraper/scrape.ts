import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import type { Page, Browser } from 'puppeteer-core';

const isVercelProd = process.env.VERCEL_ENV === 'production' || !!process.env.AWS_LAMBDA_FUNCTION_VERSION;

async function launchBrowser() {
  if (isVercelProd) {
    return await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
      ignoreHTTPSErrors: true,
    });
  } else {
    return await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
}

export interface NewsItem {
  id: string; // Identificador de la página: 'bbc', 'elpais', 'lemonde'
  title: string;
  subtitle?: string;
  url: string;
  source: string;
  section?: string;
  author?: string;
  summary?: string;
  img?: string;
  date?: string;
  titulo_detalle?: string;
  subtitulo?: string;
  contenido?: string;
  content?: string;
}

export async function scrapeBBC(): Promise<NewsItem[]> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto('https://www.bbc.com/news', { waitUntil: 'domcontentloaded' });
  const news = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a.gs-c-promo-heading')).slice(0, 5).map(el => ({
      id: 'bbc',
      title: el.textContent?.trim() || '',
      url: el instanceof HTMLAnchorElement ? el.href : '',
      source: 'BBC News',
    }));
  });
  await browser.close();
  return news;
}

export async function scrapeElPais(): Promise<NewsItem[]> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto('https://elpais.com/', { waitUntil: 'domcontentloaded' });
  const news = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h2.c_t')).slice(0, 5).map(el => {
      const anchor = el.querySelector('a');
      return {
        id: 'elpais',
        title: anchor?.textContent?.trim() || '',
        url: anchor instanceof HTMLAnchorElement ? anchor.href : '',
        source: 'El País',
      };
    });
  });
  await browser.close();
  return news;
}

export async function scrapeLeMonde(): Promise<NewsItem[]> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto('https://www.lemonde.fr/', { waitUntil: 'domcontentloaded' });
  const news = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('section.article__wrapper h3.article__title a')).slice(0, 5).map(el => ({
      id: 'lemonde',
      title: el.textContent?.trim() || '',
      url: el instanceof HTMLAnchorElement ? el.href : '',
      source: 'Le Monde',
    }));
  });
  await browser.close();
  return news;
}

export async function scrapeElPeruano(): Promise<NewsItem[]> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto('https://elperuano.pe/', { waitUntil: 'domcontentloaded' });
  // Intentar obtener titulares principales de "Actualidad" o portada
  const news = await page.evaluate(() => {
    // Buscar titulares principales en portada
    // NOTA: Si la estructura cambia, ajustar el selector
    const anchors = Array.from(document.querySelectorAll('a'));
    // Filtrar titulares con texto visible y que apunten a noticias internas
    const items = anchors.filter(a => {
      const href = a.getAttribute('href') || '';
      return (
        a.textContent && a.textContent.trim().length > 30 && // titulares largos
        href.startsWith('/noticia/')
      );
    }).slice(0, 5).map(a => ({
      id: 'elperuano',
      title: a.textContent?.trim() || '',
      url: a instanceof HTMLAnchorElement ? ('https://elperuano.pe' + a.getAttribute('href')) : '',
      source: 'El Peruano',
    }));
    return items;
  });
  await browser.close();
  return news;
}

// Extrae las categorías principales y subcategorías del menú principal de El Peruano
export async function scrapeElPeruanoCategorias(): Promise<{ name: string, url: string, subcategories?: { name: string, url: string }[] }[]> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto('https://elperuano.pe/', { waitUntil: 'domcontentloaded' });
  const categorias = await page.evaluate(() => {
    const base = 'https://elperuano.pe';
    const ul = document.querySelector('ul.hide-on-med-and-down.inlineblock');
    if (!ul) return [];
    const categorias: { name: string, url: string, subcategories?: { name: string, url: string }[] }[] = [];
    ul.querySelectorAll(':scope > li').forEach(li => {
      const a = li.querySelector(':scope > a');
      if (!a) return;
      const name = a.textContent?.trim() || '';
      let url = a.getAttribute('href') || '';
      // Ignorar logo y enlaces externos
      if (url.startsWith('http') && !url.includes('elperuano.pe')) return;
      if (url.startsWith('http') && url.includes('elperuano.pe')) url = url; // absoluto
      else if (url.startsWith('/')) url = base + url;
      else url = base + '/' + url;
      // Subcategorías
      const subUl = li.querySelector('ul.dropdown-content');
      let subcategories;
      if (subUl) {
        subcategories = Array.from(subUl.querySelectorAll('li > a')).map(subA => {
          let subUrl = subA.getAttribute('href') || '';
          if (subUrl.startsWith('http') && !subUrl.includes('elperuano.pe')) return null;
          if (subUrl.startsWith('http') && subUrl.includes('elperuano.pe')) subUrl = subUrl;
          else if (subUrl.startsWith('/')) subUrl = base + subUrl;
          else subUrl = base + '/' + subUrl;
          return {
            name: subA.textContent?.trim() || '',
            url: subUrl
          };
        }).filter(Boolean);
      }
      categorias.push({ name, url, subcategories });
    });
    // Filtrar logo y enlaces vacíos
    return categorias.filter(cat => cat.name && cat.url);
  });
  await browser.close();
  return categorias;
}

// Extrae las noticias principales de una url de sección de El Peruano (desfragmentando cada card)
export async function scrapeElPeruanoNoticiasDeSeccion(url: string): Promise<NewsItem[]> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Esperar a que carguen los artículos reales (no skeletons)
  await page.waitForFunction(() => {
    const section = document.querySelector('#notasseccion');
    if (!section) return false;
    const articles = Array.from(section.querySelectorAll('article'));
    // Al menos un article que NO tenga .skeleton-nota
    return articles.some(article => !article.querySelector('.skeleton-nota'));
  }, { timeout: 10000 });

  // Scroll para cargar más noticias (infinite scroll)
  let prevCount = 0;
  for (let i = 0; i < 2; i++) { // Haz scroll 2 veces para asegurar 20 noticias
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(res => setTimeout(res, 500)); // Espera poco tiempo para cargar
    const count = await page.evaluate(() => {
      const section = document.querySelector('#notasseccion');
      if (!section) return 0;
      return Array.from(section.querySelectorAll('article')).filter(article => !article.querySelector('.skeleton-nota')).length;
    });
    if (count === prevCount) break; // No se cargaron más noticias
    prevCount = count;
  }

  // Limita el número de noticias a 20
  const news = (await page.evaluate((url) => {
    const base = 'https://elperuano.pe';
    const section = document.querySelector('#notasseccion');
    if (!section) {
      return [{
        id: 'elperuano',
        title: '',
        url,
        source: 'El Peruano',
        summary: 'No se encontró el contenedor #notasseccion en esta URL',
        img: '',
        date: ''
      }];
    }
    // Solo artículos que NO sean skeletons
    const articles = Array.from(section.querySelectorAll('article')).filter(article => !article.querySelector('.skeleton-nota'));
    if (articles.length === 0) {
      return [{
        id: 'elperuano',
        title: '',
        url,
        source: 'El Peruano',
        summary: 'No se encontraron artículos válidos en #notasseccion',
        img: '',
        date: ''
      }];
    }
    return articles.map(article => {
      const img = article.querySelector('.card-images img')?.getAttribute('src') || '';
      const titleAnchor = article.querySelector('.card-title2 .titular');
      const urlRel = titleAnchor?.getAttribute('href') || '';
      const newsUrl = urlRel.startsWith('http') ? urlRel : (base + (urlRel.startsWith('/') ? urlRel : '/' + urlRel));
      const title = titleAnchor?.textContent?.trim() || '';
      const bajadaAnchor = article.querySelector('.bajada');
      const summary = bajadaAnchor?.textContent?.trim() || '';
      const date = article.querySelector('.card-title3')?.textContent?.trim() || '';
      return {
        id: 'elperuano',
        title,
        url: newsUrl,
        source: 'El Peruano',
        summary,
        img,
        date
      };
    });
  }, url)).slice(0, 20);
  await page.close();

  // Obtener detalles de cada noticia (título, subtítulo, contenido) usando el mismo browser y páginas independientes
  const concurrency = 10; // Concurrencia alta para máxima velocidad
  const results: NewsItem[] = [];
  let idx = 0;
  async function processBatch(batch: any[]) {
    await Promise.all(batch.map(async (item) => {
      if (!item.url) {
        results.push(item);
        return;
      }
      let detalle = { titulo: '', subtitulo: '', contenido: '' };
      try {
        const pageDetalle = await browser.newPage();
        await pageDetalle.goto(item.url, { waitUntil: 'domcontentloaded' });
        await pageDetalle.waitForFunction(() => !document.querySelector('.skeleton-nota'), { timeout: 8000 }).catch(() => {});
        detalle = await pageDetalle.evaluate(() => {
          const titulo = document.querySelector('main#portada h1')?.textContent?.trim() || '';
          const h5s = document.querySelectorAll('main#portada h5');
          const subtitulo = h5s.length > 1 ? h5s[1].textContent?.trim() || '' : '';
          const contenido = (document.querySelector('#contenido') as HTMLElement)?.innerText?.trim() || '';
          return { titulo, subtitulo, contenido };
        });
        await pageDetalle.close();
      } catch (e) {
        // Si falla, deja los campos de detalle vacíos
      }
      results.push({
        ...item,
        titulo_detalle: detalle.titulo,
        subtitulo: detalle.subtitulo,
        contenido: detalle.contenido,
        date: formatDateToIsoPeru(item.date) // Formatea la fecha a ISO con zona horaria -05:00
      });
    }));
  }
  while (idx < news.length) {
    const batch = news.slice(idx, idx + concurrency);
    await processBatch(batch);
    idx += concurrency;
  }
  await browser.close();
  return results;
}

// Scrapea el detalle de una noticia de El Peruano: título, subtítulo y contenido
export async function scrapeElPeruanoNoticiaDetalle(url: string): Promise<{ titulo: string, subtitulo: string, contenido: string }> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Esperar a que desaparezcan skeletons si existen (hasta 8s)
  await page.waitForFunction(() => {
    // Si no hay skeletons, o no hay .skeleton-nota en el DOM
    return !document.querySelector('.skeleton-nota');
  }, { timeout: 8000 }).catch(() => {});

  const data = await page.evaluate(() => {
    // Título
    const titulo = document.querySelector('main#portada h1')?.textContent?.trim() || '';
    // Subtítulo (segundo h5)
    const h5s = document.querySelectorAll('main#portada h5');
    const subtitulo = h5s.length > 1 ? h5s[1].textContent?.trim() || '' : '';
    // Contenido principal (cast a HTMLElement para innerText)
    const contenido = (document.querySelector('#contenido') as HTMLElement)?.innerText?.trim() || '';
    return { titulo, subtitulo, contenido };
  });
  await browser.close();
  return data;
}

// Extrae las noticias de todas las categorías y subcategorías de El Peruano
export async function scrapeElPeruanoNoticiasPorCategoria(): Promise<{ categorias: any[], noticias_por_categoria: { [categoria: string]: NewsItem[] } }> {
  const categorias = await scrapeElPeruanoCategorias();
  const noticias_por_categoria: { [categoria: string]: NewsItem[] } = {};
  for (const cat of categorias) {
    // Scrape noticias de la categoría principal
    noticias_por_categoria[cat.name] = await scrapeElPeruanoNoticiasDeSeccion(cat.url);
    // Scrape noticias de subcategorías si existen
    if (cat.subcategories) {
      for (const sub of cat.subcategories) {
        noticias_por_categoria[sub.name] = await scrapeElPeruanoNoticiasDeSeccion(sub.url);
      }
    }
  }
  return { categorias, noticias_por_categoria };
}

// Scrapea noticias de una categoría de El Depor (estructura HTML precisa)
export async function scrapeDeporCategoria(url: string): Promise<NewsItem[]> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Espera a que cargue la lista principal de noticias
  await page.waitForSelector('.stories-news__list .story-item', { timeout: 10000 });

  const news = await page.evaluate((url) => {
    const base = 'https://depor.com';
    const source = 'Depor';
    const items = Array.from(document.querySelectorAll('.stories-news__list .story-item'));
    return items.slice(0, 20).map(item => {
      // Título y URL
      let title = '';
      let url = '';
      const titleA = item.querySelector('a.story-item__title');
      if (titleA) {
        title = titleA.textContent?.trim() || '';
        url = titleA.getAttribute('href') || '';
        if (url && !url.startsWith('http')) url = base + url;
      }
      // Subtítulo
      let subtitle = '';
      const subtitleP = item.querySelector('p.story-item__subtitle');
      if (subtitleP) subtitle = subtitleP.textContent?.trim() || '';
      // Imagen
      let img = '';
      const imgEl = item.querySelector('img.story-item__img');
      if (imgEl) img = imgEl.getAttribute('src') || '';
      // Sección
      let section = '';
      const sectionA = item.querySelector('a.story-item__section');
      if (sectionA) section = sectionA.textContent?.trim() || '';
      // Fecha
      let date = '';
      const dateP = item.querySelector('p.story-item__date');
      if (dateP) date = dateP.textContent?.trim() || '';
      return {
        id: 'depor',
        title,
        subtitle,
        url,
        source,
        section,
        img,
        date
      };
    });
  }, url);
  await browser.close();
  return news.filter(n => n.title && n.url);
}

// Scrapea solo título e imagen de la lista de noticias de una categoría de El Depor, con límite configurable
export async function scrapeDeporCategoriaResumen(url: string, limit: number = 20): Promise<{ title: string, img: string, url: string }[]> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.stories-news__list .story-item', { timeout: 10000 });
  const news = await page.evaluate((base, limit) => {
    const items = Array.from(document.querySelectorAll('.stories-news__list .story-item'));
    return items.slice(0, limit).map(item => {
      let title = '';
      let url = '';
      let img = '';
      const titleA = item.querySelector('a.story-item__title');
      if (titleA) {
        title = titleA.textContent?.trim() || '';
        url = titleA.getAttribute('href') || '';
        if (url && !url.startsWith('http')) url = base + url;
      }
      const imgEl = item.querySelector('img.story-item__img');
      if (imgEl) img = imgEl.getAttribute('src') || '';
      return { title, img, url };
    });
  }, 'https://depor.com', limit);
  await browser.close();
  return news.filter(n => n.title && n.img);
}

// Scrapea las dos categorías principales de fútbol de Depor
export async function scrapeDeporFutbolCategorias(): Promise<{ peruano: NewsItem[], internacional: NewsItem[] }> {
  const peruanoUrl = 'https://depor.com/futbol-peruano/';
  const internacionalUrl = 'https://depor.com/futbol-internacional/';
  const [peruano, internacional] = await Promise.all([
    scrapeDeporCategoria(peruanoUrl),
    scrapeDeporCategoria(internacionalUrl)
  ]);
  return { peruano, internacional };
}

export async function scrapeDeporCategoriaCompleto(url: string, limit: number = 20): Promise<NewsItem[]> {
  const cacheFile = 'cache/depor.json';
  let cache: NewsItem[] = await readCache(cacheFile);

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.stories-news__list .story-item', { timeout: 10000 });
  const items = await page.evaluate((base, limit) => {
    const nodes = Array.from(document.querySelectorAll('.stories-news__list .story-item'));
    return nodes.slice(0, limit).map(item => {
      let title = '';
      let url = '';
      let img = '';
      let subtitle = '';
      let section = '';
      let date = '';
      const titleA = item.querySelector('a.story-item__title');
      if (titleA) {
        title = titleA.textContent?.trim() || '';
        url = titleA.getAttribute('href') || '';
        if (url && !url.startsWith('http')) url = base + url;
      }
      const imgEl = item.querySelector('img.story-item__img');
      if (imgEl) img = imgEl.getAttribute('src') || '';
      const subtitleP = item.querySelector('p.story-item__subtitle');
      if (subtitleP) subtitle = subtitleP.textContent?.trim() || '';
      const sectionA = item.querySelector('a.story-item__section');
      if (sectionA) section = sectionA.textContent?.trim() || '';
      const dateP = item.querySelector('p.story-item__date');
      if (dateP) date = dateP.textContent?.trim() || '';
      return { title, url, img, subtitle, section, date };
    });
  }, 'https://depor.com', limit);

  // Asignar índice original para mantener el orden
  const itemsWithIndex = items.map((item, idx) => ({ ...item, _idx: idx }));
  const concurrency = 8;
  const results: (NewsItem & { _idx: number })[] = [];
  let idx = 0;
  while (idx < itemsWithIndex.length) {
    const batch = itemsWithIndex.slice(idx, idx + concurrency);
    const batchResults = await Promise.allSettled(batch.map(async (item) => {
      if (!item.url) return null;
      // Buscar en cache por url y date, pero si content está vacío, forzar scraping
      const cached = cache.find(n => n.url === item.url && n.date === item.date);
      if (cached && cached.content && cached.content.trim() !== '') {
        return { ...cached, _idx: item._idx };
      }
      // Si no está en la cache o cambió la fecha, scrapear detalle
      const detailPage = await browser.newPage();
      try {
        await detailPage.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await detailPage.waitForSelector('.sht__title', { timeout: 5000 });
        const data = await detailPage.evaluate(() => {
          const section = document.querySelector('.sht__category a')?.textContent?.trim() || '';
          const title = document.querySelector('.sht__title')?.textContent?.trim() || '';
          const subtitle = document.querySelector('.sht__summary')?.textContent?.trim() || '';
          const date = document.querySelector('.story-contents__author-date time')?.getAttribute('datetime') ||
            document.querySelector('.story-contents__author-date time')?.textContent?.trim() || '';
          const img = document.querySelector('.s-multimedia picture img')?.getAttribute('src') || '';
          const contentDiv = document.querySelector('#contenedor');
          let content = '';
          if (contentDiv) {
            const paragraphs = Array.from(contentDiv.querySelectorAll('p.story-contents__font-paragraph'));
            content = paragraphs.map(p => p.textContent?.trim() || '').filter(Boolean).join('\n\n');
          }
          // Si no hay contenido normal, intenta extraer de live-event
          if (!content || content.trim() === '') {
            const liveBlocks = Array.from(document.querySelectorAll('.live-event2-comment.score'));
            const liveTexts = liveBlocks.map(block => {
              // Busca todos los <p> dentro del bloque
              return Array.from(block.querySelectorAll('p')).map(p => p.textContent?.trim() || '').filter(Boolean).join(' ');
            }).filter(Boolean);
            content = liveTexts.join('\n\n');
          }
          return { section, title, subtitle, date, img, content };
        });
        await detailPage.close();
        const news: NewsItem = {
          id: 'depor',
          title: data.title || item.title || '',
          subtitle: data.subtitle || item.subtitle || '',
          url: item.url,
          source: 'Depor',
          section: data.section || item.section || '',
          img: data.img || item.img || '',
          date: data.date || item.date || '',
          content: data.content || ''
        };
        // Actualiza la cache (quita la anterior si existe, agrega la nueva)
        cache = cache.filter(n => n.url !== news.url);
        cache.push(news);
        return { ...news, _idx: item._idx };
      } catch (e) {
        await detailPage.close();
        return null;
      }
    }));
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
    idx += concurrency;
  }
  await browser.close();
  // Ordenar resultados por el índice original
  results.sort((a, b) => a._idx - b._idx);
  // Actualiza la cache en disco
  await writeCache(cacheFile, cache);
  // Elimina _idx antes de devolver
  return results.map(({ _idx, ...rest }) => rest);
}

export async function scrapeJornadaCategorias(page: Page): Promise<{ name: string, url: string }[]> {
  await page.goto('https://jornada.com.pe/', { waitUntil: 'domcontentloaded' });
  const categorias = await page.evaluate(() => {
    const result: { name: string, url: string }[] = [];
    const menu = document.querySelector('ul#menu-menu-principal-3');
    if (!menu) return result;
    const links = menu.querySelectorAll('li > a');
    links.forEach(a => {
      const name = a.textContent?.trim() || '';
      let url = a.getAttribute('href') || '';
      if (name && url) {
        result.push({ name, url });
      }
    });
    return result;
  });
  return categorias;
}

export async function scrapeJornadaCategoria(page: Page, url: string): Promise<NewsItem[]> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const articles = await page.evaluate(() => {
    const result: { title: string, url: string, img?: string, date?: string, summary?: string }[] = [];
    document.querySelectorAll('.tdb_module_loop.td_module_wrap').forEach(block => {
      const a = block.querySelector('.td-module-title a');
      const imgEl = block.querySelector('.td-module-thumb .entry-thumb');
      const dateEl = block.querySelector('.td-post-date time');
      const summaryEl = block.querySelector('.td-excerpt');
      const title = a?.textContent?.trim() || '';
      const url = a?.getAttribute('href') || '';
      const img = imgEl?.getAttribute('data-img-url') || '';
      const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';
      const summary = summaryEl?.textContent?.trim() || '';
      if (title && url) {
        result.push({ title, url, img, date, summary });
      }
    });
    return result;
  });

  // Extraer detalles de cada noticia (contenido) en paralelo
  const news: NewsItem[] = [];
  const detailPromises = articles.map(async (art) => {
    const detailPage = await page.browser().newPage();
    try {
      const detail = await scrapeJornadaDetalle(detailPage, art.url);
      // Genera el summary como extracto reducido del contenido
      const resumen = detail.content ? (detail.content.length > 180 ? detail.content.slice(0, 180) + '...' : detail.content) : '';
      news.push({
        id: '', // será asignado en el controlador
        title: detail.titulo || art.title,
        url: art.url,
        source: 'Jornada',
        summary: resumen,
        img: art.img,
        date: detail.date || art.date || '',
        titulo_detalle: detail.titulo || art.title || '',
        subtitulo: detail.subtitulo || art.summary || '',
        contenido: detail.content
      });
    } catch (e) {
      news.push({
        id: '', // será asignado en el controlador
        title: art.title,
        url: art.url,
        source: 'Jornada',
        summary: '',
        img: art.img,
        date: art.date || '',
        titulo_detalle: '',
        subtitulo: art.summary || '',
        contenido: ''
      });
    } finally {
      await detailPage.close();
    }
  });
  await Promise.all(detailPromises);
  return news;
}

export async function scrapeJornadaDetalle(page: Page, url: string): Promise<{ content: string, date?: string, titulo?: string, subtitulo?: string }> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Extraer título
  const titulo = await page.evaluate(() => {
    const tituloEl = document.querySelector('h1.tdb-title-text');
    return tituloEl?.textContent?.trim() || '';
  });
  // Extraer subtítulo
  const subtitulo = await page.evaluate(() => {
    const sub = document.querySelector('.tdb_single_subtitle .tdb-block-inner');
    return sub?.textContent?.trim() || '';
  });
  // Extraer contenido principal
  const content = await page.evaluate(() => {
    const contentBlock = document.querySelector('.tdb_single_content .tdb-block-inner');
    if (!contentBlock) return '';
    // Elimina el <p> de redes sociales si existe
    const ps = contentBlock.querySelectorAll('p');
    ps.forEach(p => {
      if (p.textContent && p.textContent.includes('Búscanos en')) {
        p.remove();
      }
    });
    let text = '';
    contentBlock.querySelectorAll('p, ul, ol, li').forEach(el => {
      text += el.textContent?.trim() + '\n';
    });
    return text.trim();
  });
  // Extraer fecha si existe
  const date = await page.evaluate(() => {
    const dateEl = document.querySelector('.td-single-date, .tdb_single_date time, time.td-module-date');
    return dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';
  });
  return { content, date, titulo, subtitulo };
}

// === Funciones auxiliares para compatibilidad con el controlador ===

export async function scrapeJornadaCategoriasSimple(): Promise<{ name: string, url: string }[]> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const result = await scrapeJornadaCategorias(page);
    await browser.close();
    return result;
  } catch (e) {
    await browser.close();
    throw e;
  }
}

export async function scrapeJornadaCategoriaSimple(url: string): Promise<NewsItem[]> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const result = await scrapeJornadaCategoria(page, url);
    await browser.close();
    return result;
  } catch (e) {
    await browser.close();
    throw e;
  }
}

export async function scrapeJornadaDetalleSimple(url: string): Promise<{ content: string, date?: string, titulo?: string, subtitulo?: string }> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const result = await scrapeJornadaDetalle(page, url);
    await browser.close();
    return result;
  } catch (e) {
    await browser.close();
    throw e;
  }
}

// Agrega Jornada al flujo principal de scraping optimizado: concurrencia máxima en categorías y detalles, máximo 10 noticias
export async function scrapeJornada() {
  const browser = await launchBrowser();
  const mainPage = await browser.newPage();
  // Opcional: prioriza categorías más relevantes si lo sabes
  let categorias = await scrapeJornadaCategorias(mainPage);
  // Ejemplo: prioriza "Actualidad" y "Política" si existen
  const prioridad = ["Actualidad", "Política", "Economía", "Mundo"];
  categorias = categorias.sort((a, b) => {
    const ia = prioridad.indexOf(a.name);
    const ib = prioridad.indexOf(b.name);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  // Filtra categorías válidas
  const categoriasValidas = categorias.filter(cat => !["PORTADA", "EDICIONES"].includes(cat.name.toUpperCase()));

  // 1. Obtén artículos de todas las categorías (concurrencia)
  const catConcurrency = 8; // Número de tabs en paralelo para categorías
  const catPages: Page[] = [];
  for (let i = 0; i < catConcurrency; i++) {
    catPages.push(await browser.newPage());
  }
  let allArticles: { title: string, url: string, img?: string, date?: string, summary?: string, section: string }[] = [];
  await Promise.all(categoriasValidas.map((cat, idx) => (async () => {
    if (allArticles.length >= 10) return; // Early exit si ya tenemos suficientes
    const myPage = catPages[idx % catConcurrency];
    await myPage.goto(cat.url, { waitUntil: 'domcontentloaded' });
    const articles = await myPage.evaluate(() => {
      const result: { title: string, url: string, img?: string, date?: string, summary?: string }[] = [];
      document.querySelectorAll('.tdb_module_loop.td_module_wrap').forEach(block => {
        const a = block.querySelector('.td-module-title a');
        const imgEl = block.querySelector('.td-module-thumb .entry-thumb');
        const dateEl = block.querySelector('.td-post-date time');
        const summaryEl = block.querySelector('.td-excerpt');
        const title = a?.textContent?.trim() || '';
        const url = a?.getAttribute('href') || '';
        const img = imgEl?.getAttribute('data-img-url') || '';
        const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';
        const summary = summaryEl?.textContent?.trim() || '';
        if (title && url) {
          result.push({ title, url, img, date, summary });
        }
      });
      return result;
    });
    // Usa lock para evitar condición de carrera
    if (allArticles.length < 10) {
      for (const a of articles) {
        if (allArticles.length < 10) {
          allArticles.push({ ...a, section: cat.name });
        } else {
          break;
        }
      }
    }
  })()));

  // Cierra páginas de categorías
  for (const p of catPages) await p.close();

  // Limita a solo 10 noticias
  const topArticles = allArticles.slice(0, 10);

  // 2. Scraping paralelo real de detalles usando varias páginas (pool de 16 tabs)
  const concurrency = 16; // Número de tabs en paralelo para detalles
  const pages: Page[] = [];
  for (let i = 0; i < concurrency; i++) {
    pages.push(await browser.newPage());
  }

  const news: NewsItem[] = [];
  await Promise.all(topArticles.map((art, idx) => (async () => {
    const myPage = pages[idx % concurrency];
    try {
      await myPage.goto(art.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      // Extraer detalles
      const [titulo, subtitulo, content, date] = await Promise.all([
        myPage.evaluate(() => document.querySelector('h1.tdb-title-text')?.textContent?.trim() || ''),
        myPage.evaluate(() => document.querySelector('.tdb_single_subtitle .tdb-block-inner')?.textContent?.trim() || ''),
        myPage.evaluate(() => {
          const contentBlock = document.querySelector('.tdb_single_content .tdb-block-inner');
          if (!contentBlock) return '';
          // Elimina el <p> de redes sociales si existe
          const ps = contentBlock.querySelectorAll('p');
          ps.forEach(p => {
            if (p.textContent && p.textContent.includes('Búscanos en')) {
              p.remove();
            }
          });
          let text = '';
          contentBlock.querySelectorAll('p, ul, ol, li').forEach(el => {
            text += el.textContent?.trim() + '\n';
          });
          return text.trim();
        }),
        myPage.evaluate(() => {
          const dateEl = document.querySelector('.td-single-date, .tdb_single_date time, time.td-module-date');
          return dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';
        })
      ]);
      // Genera el summary como extracto reducido del contenido
      const resumen = content ? (content.length > 180 ? content.slice(0, 180) + '...' : content) : '';
      news.push({
        id: '', // será reemplazado por el id numérico en el controlador
        title: titulo || art.title,
        url: art.url,
        source: 'Jornada',
        summary: resumen,
        img: art.img,
        date: formatDateToIsoPeru(date || art.date || ''),
        titulo_detalle: titulo || art.title || '',
        subtitulo: subtitulo || art.summary || '',
        contenido: content
      });
    } catch (e) {
      news.push({
        id: '', // será reemplazado por el id numérico en el controlador
        title: art.title,
        url: art.url,
        source: 'Jornada',
        summary: '',
        img: art.img,
        date: formatDateToIsoPeru(art.date || ''),
        titulo_detalle: '',
        subtitulo: art.summary || '',
        contenido: ''
      });
    }
  })()));

  // Cierra las páginas extra
  for (const p of pages) await p.close();
  await browser.close();
  // Refuerza el límite: solo devuelve 10 noticias máximo
  return news.slice(0, 10);
}

// Si se ejecuta como script, imprime las noticias
if (require.main === module) {
  (async () => {
    console.log('Scraping news from BBC News, El País, Le Monde, El Peruano y Jornada...');
    const [bbc, elpais, lemonde, elperuano, jornada] = await Promise.all([
      scrapeBBC(),
      scrapeElPais(),
      scrapeLeMonde(),
      scrapeElPeruano(),
      scrapeJornada(),
    ]);
    const allNews = [...bbc, ...elpais, ...lemonde, ...elperuano, ...jornada];
    allNews.forEach(item => {
      console.log(`[${item.source}] ${item.title}\n${item.url}\n`);
    });
  })().catch(err => {
    console.error('Error scraping news:', err);
    process.exit(1);
  });
}

import { readFileSync, writeFileSync } from 'fs';

async function readCache(file: string): Promise<NewsItem[]> {
  try {
    const data = readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

async function writeCache(file: string, data: NewsItem[]): Promise<void> {
  writeFileSync(file, JSON.stringify(data));
}

// Función auxiliar para formatear fecha a ISO con zona horaria -05:00 (hora de Perú)
export function formatDateToIsoPeru(dateStr: string): string {
  // Intenta parsear fechas tipo "24/04/2025 22:07" o "24/04/2025"
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (match) {
    const [, dd, mm, yyyy, hh, min] = match;
    // Siempre crea la fecha en zona horaria -05:00
    // Evita usar Date() porque asume UTC/local, mejor construye string manual
    const fecha = `${yyyy}-${mm}-${dd}T${hh || '00'}:${min || '00'}:00-05:00`;
    return fecha;
  }
  // Si ya es ISO y tiene zona horaria, fuerza a -05:00
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateStr)) {
    // Reemplaza cualquier zona horaria por -05:00
    return dateStr.replace(/([+-]\d{2}:\d{2}|Z)$/, '-05:00');
  }
  return dateStr;
}
