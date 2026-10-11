// Иконка приложения. Запуск: node scripts/icon.mjs (нужен sharp)
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

/**
 * Глубокий изумрудный фон с мягким светом, кремовая гантель и тонкое золотое кольцо
 * прогресса (8 делений — 8 недель цикла, 7 закрашены, восьмая — разгрузка).
 * scale — масштаб знака (для maskable знак меньше, чтобы попасть в безопасную зону).
 */
function svg({ scale = 1, rounded = false } = {}) {
  const c = 512 / 2;
  const R = 168 * scale; // радиус кольца
  const ticks = [];
  for (let i = 0; i < 8; i++) {
    const gap = 7; // градусы между сегментами
    const a0 = -90 + i * 45 + gap / 2;
    const a1 = a0 + 45 - gap;
    const rad = (d) => (d * Math.PI) / 180;
    const p = (a) => [c + R * Math.cos(rad(a)), c + R * Math.sin(rad(a))];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    const active = i < 7;
    ticks.push(
      `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${active ? 'url(#gold)' : '#d9c48f'}" stroke-opacity="${active ? 1 : 0.35}" stroke-width="${14 * scale}" stroke-linecap="round" fill="none"/>`,
    );
  }
  const s = scale;
  // Гантель: гриф + по два диска с каждой стороны
  const bar = `<rect x="${c - 92 * s}" y="${c - 9 * s}" width="${184 * s}" height="${18 * s}" rx="${9 * s}" fill="url(#cream)"/>`;
  const plate = (x, w, h) =>
    `<rect x="${x}" y="${c - h / 2}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2.4}" fill="url(#cream)"/>`;
  const plates = [
    plate(c - 112 * s, 30 * s, 128 * s),
    plate(c - 140 * s, 22 * s, 92 * s),
    plate(c + 82 * s, 30 * s, 128 * s),
    plate(c + 118 * s, 22 * s, 92 * s),
  ].join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="35%" cy="25%" r="90%">
      <stop offset="0" stop-color="#2a7a63"/>
      <stop offset="0.55" stop-color="#14473a"/>
      <stop offset="1" stop-color="#0a2620"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3dc9b"/>
      <stop offset="0.5" stop-color="#d4ae58"/>
      <stop offset="1" stop-color="#a9822f"/>
    </linearGradient>
    <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbf7ee"/>
      <stop offset="1" stop-color="#e6dcc6"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${6 * s}" stdDeviation="${8 * s}" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#bg)"/>
  <g>${ticks.join('')}</g>
  <g filter="url(#shadow)">${bar}${plates}</g>
</svg>`;
}

const jobs = [
  ['apple-touch-icon.png', 180, svg()],
  ['pwa-192x192.png', 192, svg()],
  ['pwa-512x512.png', 512, svg()],
  ['maskable-512x512.png', 512, svg({ scale: 0.8 })],
];
for (const [name, size, source] of jobs) {
  await sharp(Buffer.from(source)).resize(size, size).png().toFile(join(out, name));
  console.log('✓', name);
}
writeFileSync(join(out, 'favicon.svg'), svg({ rounded: true }));
await sharp(Buffer.from(svg({ rounded: true }))).resize(512, 512).png().toFile(join(out, '_preview.png'));
