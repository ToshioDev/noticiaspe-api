import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/**
 * Devuelve una instancia de browser lista para producción o desarrollo.
 * Usa @sparticuz/chromium-min en producción (Vercel, serverless), y puppeteer local en desarrollo.
 */
export async function launchBrowser(options: any = {}) {
  let browser
  if (process.env.VERCEL_ENV === 'production') {
    const executablePath = await chromium.executablePath()
    browser = await puppeteerCore.launch({
      executablePath,
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport
    })
  } else {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }
  return browser
}
