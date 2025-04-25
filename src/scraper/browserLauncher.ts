import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

/**
 * Devuelve una instancia de browser lista para producción o desarrollo.
 * Usa @sparticuz/chromium-min en producción (Vercel, serverless), y puppeteer local en desarrollo.
 */
export async function launchBrowser(options: any = {}) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    const executablePath = await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar');
    return puppeteerCore.launch({
      executablePath,
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
      ...options,
    });
  } else {
    return puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...options,
    });
  }
}
