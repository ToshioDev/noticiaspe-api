import puppeteer, { Browser as Browser} from 'puppeteer';
import puppeteerCore, { Browser as BrowserCore } from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

/**
 * Devuelve una instancia de browser lista para producción o desarrollo.
 * Usa @sparticuz/chromium-min en producción (Vercel, serverless), y puppeteer local en desarrollo.
 */
export async function launchBrowser(options: any = {}): Promise<Browser | BrowserCore> {
  let browser: Browser | BrowserCore;
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...options,
  });
  return browser;
}
