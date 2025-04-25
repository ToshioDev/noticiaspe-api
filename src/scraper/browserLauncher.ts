import puppeteer, { LaunchOptions as PuppeteerLaunchOptions } from 'puppeteer';
import puppeteerCore, { LaunchOptions as PuppeteerCoreLaunchOptions } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const PROD_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--window-size=1920,1080',
  '--hide-scrollbars',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--single-process'
];

// Variable global para debug
let lastExecutablePath: string | undefined = undefined;

/**
 * Devuelve una instancia de browser lista para producción o desarrollo.
 * Usa @sparticuz/chromium en producción (Vercel, serverless), y puppeteer local en desarrollo.
 */
export async function launchBrowser(options: any = {}): Promise<any> {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const sanitizedOptions: PuppeteerCoreLaunchOptions = { ...options };
    if (
      'headless' in sanitizedOptions &&
      typeof sanitizedOptions.headless !== 'boolean'
    ) {
      delete sanitizedOptions.headless;
    }
    let executablePath: string | undefined = undefined;
    try {
      if (typeof chromium?.executablePath === 'function') {
        executablePath = await chromium.executablePath();
      } else if (process.env.CHROME_PATH) {
        executablePath = process.env.CHROME_PATH;
      } else if (typeof puppeteer.executablePath === 'function') {
        executablePath = puppeteer.executablePath();
      }
      lastExecutablePath = executablePath;
      console.log('[DEBUG] executablePath usado:', executablePath);
    } catch (err) {
      console.error('[DEBUG] Error obteniendo executablePath:', err);
      executablePath = undefined;
      lastExecutablePath = undefined;
    }
    const launchOptions: PuppeteerCoreLaunchOptions = {
      args: PROD_ARGS,
      headless: (chromium && typeof chromium.headless === 'boolean') ? chromium.headless : true,
      ...sanitizedOptions,
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }
    return puppeteerCore.launch(launchOptions);
  } else {
    const devOptions: PuppeteerLaunchOptions = { headless: true, ...options };
    return puppeteer.launch(devOptions);
  }
}

// Exporta la variable para debug externo
export function getLastExecutablePath() {
  return lastExecutablePath;
}
