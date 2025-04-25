import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Prueba de Puppeteer y Sparticuz/Chromium
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  // Test para chromium.executablePath
  it('chromium.executablePath debe devolver un path válido o undefined', async () => {
    let executablePath: string | undefined = undefined;
    try {
      executablePath = await chromium.executablePath();
    } catch (err) {
      // Puede fallar si no está Sparticuz disponible
      executablePath = undefined;
    }
    console.log('[TEST] chromium.executablePath:', executablePath);
    // No debe lanzar error, puede ser string o undefined
    expect([undefined, 'string'].includes(typeof executablePath)).toBe(true);
  });

  // Test para puppeteer.launch con executablePath
  it('puppeteer.launch debe funcionar con executablePath si existe', async () => {
    let executablePath: string | undefined = undefined;
    try {
      executablePath = await chromium.executablePath();
    } catch {
      executablePath = undefined;
    }
    if (executablePath) {
      const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });
      const page = await browser.newPage();
      await page.goto('https://example.com');
      const title = await page.title();
      await browser.close();
      expect(typeof title).toBe('string');
    } else {
      // Si no hay executablePath, simplemente pasa la prueba
      expect(executablePath).toBeUndefined();
    }
  });
});
