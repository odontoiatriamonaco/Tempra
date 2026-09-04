// Tempra v1.0.0 — 2026-09-04 14:30
//
// Criterio 8.1: «le icone 192/512 non hanno canale alpha (test che legge
// l'header PNG)». iOS scarta le icone RGBA quando le si aggiunge alla Home e
// al loro posto mette uno screenshot della pagina — un difetto che si vede
// solo su un iPhone vero, quindi va colto qui.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** I tipi di colore PNG che portano trasparenza (bit 2 acceso, o palette). */
const COLOR_TYPES = {
  0: 'scala di grigi',
  2: 'RGB',
  3: 'palette',
  4: 'grigi + alpha',
  6: 'RGBA',
};

/**
 * Legge l'header IHDR, che in una PNG valida sta sempre agli stessi offset.
 * @param {string} name
 */
function readPng(name) {
  const path = fileURLToPath(new URL(`../../public/icons/${name}`, import.meta.url));
  const buffer = readFileSync(path);
  return {
    buffer,
    signature: buffer.subarray(0, 8),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
  };
}

const ICONS = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
];

describe('icone della PWA', () => {
  it.each(ICONS)('%s è una PNG valida di %i px', (name, size) => {
    const png = readPng(name);
    expect(png.signature.equals(PNG_SIGNATURE)).toBe(true);
    expect(png.width).toBe(size);
    expect(png.height).toBe(size);
  });

  it.each(ICONS)('%s non ha canale alpha (criterio 8.1)', (name) => {
    const png = readPng(name);
    expect(
      png.colorType,
      `${name} è ${COLOR_TYPES[png.colorType] ?? png.colorType}, non RGB opaco`
    ).toBe(2);
  });

  it.each(ICONS)('%s resta piccola', (name) => {
    expect(readPng(name).buffer.length).toBeLessThan(64 * 1024);
  });
});

describe('manifest', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../public/manifest.webmanifest', import.meta.url), 'utf8')
  );

  it('dichiara nome, scope e display standalone (spec 8)', () => {
    expect(manifest.name).toBe('Tempra');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.lang).toBe('it');
  });

  it('usa i colori dei token', () => {
    expect(manifest.background_color).toBe('#f7f7f5');
    expect(manifest.theme_color).toBe('#f7f7f5');
  });

  it('elenca le icone 192 e 512, che esistono davvero', () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    for (const icon of manifest.icons) {
      expect(() => readPng(icon.src.replace('/icons/', ''))).not.toThrow();
    }
  });

  it('ha un’icona maskable per Android', () => {
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });
});

describe('index.html', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

  it('collega manifest e apple-touch-icon', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('/icons/apple-touch-icon.png');
  });

  it('ha i meta tag iOS richiesti dalla spec 8', () => {
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('apple-mobile-web-app-status-bar-style');
    expect(html).toContain('viewport-fit=cover');
  });
});

describe('vercel.json', () => {
  const config = JSON.parse(
    readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')
  );
  const csp = config.headers
    .flatMap((entry) => entry.headers)
    .find((header) => header.key === 'Content-Security-Policy');

  it('vieta ogni connessione in uscita (requisito 1.3)', () => {
    expect(csp.value).toContain("connect-src 'none'");
    expect(csp.value).toContain("default-src 'self'");
    expect(csp.value).toContain("script-src 'self'");
  });
});
