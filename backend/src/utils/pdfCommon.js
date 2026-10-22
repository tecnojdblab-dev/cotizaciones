const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function findFrontendImagesDir() {
  const candidates = [
    path.resolve(__dirname, '../../../frontend/images'),
    path.resolve(__dirname, '../../../../frontend/images'),
    path.resolve(process.cwd(), '../frontend/images'),
    path.resolve(process.cwd(), 'frontend/images'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const FRONTEND_IMAGES_DIR = findFrontendImagesDir();

const DOCUMENT_FOOTER_LINE = 'TEL: 4-4292937 - CEL: 70769521 - AV. CIRCUNVALACIÓN, ENTRE C. VATICANO Y C.F. PÉREZ SAAVEDRA - CBBA - BOLIVIA';

const FIRMANTE_PRESETS = {
  tecnoequip: {
    firmanteNombre: 'ING. JORGE DAVALOS CRESPO',
    firmanteCargo: 'TECNOequip',
    firmanteDocumento: 'NIT: 4513773014',
    firmanteTelefono: '',
    firmaPath: path.join(FRONTEND_IMAGES_DIR, 'TECNOEQUIP', 'FIRMATECNO.webp'),
    selloPath: path.join(FRONTEND_IMAGES_DIR, 'TECNOEQUIP', 'SELLOTECNO.webp'),
  },
  jdblab: {
    firmanteNombre: 'LIC. DELIA A. CRESPO DAVID',
    firmanteCargo: 'JDBlab',
    firmanteDocumento: 'NIT: 800082018',
    firmanteTelefono: '',
    firmaPath: path.join(FRONTEND_IMAGES_DIR, 'JDBLAB', 'firmaJDBLAB.webp'),
    selloPath: path.join(FRONTEND_IMAGES_DIR, 'JDBLAB', 'CELLOJDBLAB.webp'),
  },
};

function resolveImagePath(filename) {
  if (!filename) return null;
  const p = String(filename).trim();
  if (path.isAbsolute(p) && fs.existsSync(p)) return p;
  const relative = path.join(FRONTEND_IMAGES_DIR, p);
  if (fs.existsSync(relative)) return relative;
  return null;
}

const imageCache = new Map();

async function loadImageBuffer(source, { maxWidth = 600, maxHeight } = {}) {
  if (!source) return null;
  const src = String(source).trim();
  if (!src) return null;

  // If this is a Vite client-side bundle asset path like /assets/FIRMATECNO-DVxVPX8F.webp,
  // it cannot be read as a filesystem path directly.
  if (src.startsWith('/assets/') || src.startsWith('/@fs/')) {
    return null;
  }

  const cacheKey = `${src}_w${maxWidth}_h${maxHeight || ''}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  const promise = (async () => {
    try {
      let buffer = null;

      // 1. Data URL (base64)
      if (/^data:image\//i.test(src)) {
        const [, base64] = src.split(',');
        if (!base64) return null;
        buffer = Buffer.from(base64, 'base64');
      }
      // 2. HTTP/HTTPS URL
      else if (/^https?:\/\//i.test(src)) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
          const res = await fetch(src, { signal: controller.signal });
          if (!res.ok) return null;
          const arrayBuffer = await res.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } finally {
          clearTimeout(timeout);
        }
      }
      // 3. Local filesystem path
      else {
        const resolved = resolveImagePath(src);
        if (resolved) {
          buffer = await fs.promises.readFile(resolved);
        }
      }

      if (!buffer) return null;

      const pipeline = sharp(buffer);
      if (maxWidth || maxHeight) {
        pipeline.resize({
          width: maxWidth || undefined,
          height: maxHeight || undefined,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      return await pipeline.png().toBuffer();
    } catch (err) {
      console.warn('[pdfCommon] Error cargando imagen:', src.slice(0, 60), err.message);
      return null;
    }
  })();

  imageCache.set(cacheKey, promise);
  return promise;
}

const UNITS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const TEENS = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const TENS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const HUNDREDS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function belowOneHundred(value) {
  if (value < 10) return UNITS[value];
  if (value < 20) return TEENS[value - 10];
  if (value < 30) return value === 20 ? 'VEINTE' : `VEINTI${UNITS[value - 20]}`;
  const tens = TENS[Math.floor(value / 10)];
  return value % 10 ? `${tens} Y ${UNITS[value % 10]}` : tens;
}

function belowOneThousand(value) {
  if (!value) return '';
  if (value === 100) return 'CIEN';
  return `${HUNDREDS[Math.floor(value / 100)]} ${belowOneHundred(value % 100)}`.trim();
}

function masculine(value) {
  return value.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');
}

function numberInWords(value) {
  if (!value) return 'CERO';
  const groups = [];
  const billions = Math.floor(value / 1_000_000_000);
  const millions = Math.floor((value % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1_000);
  const rest = value % 1_000;

  if (billions) groups.push(billions === 1 ? 'MIL MILLONES' : `${masculine(belowOneThousand(billions))} MIL MILLONES`);
  if (millions) groups.push(millions === 1 ? 'UN MILLÓN' : `${masculine(belowOneThousand(millions))} MILLONES`);
  if (thousands) groups.push(thousands === 1 ? 'MIL' : `${masculine(belowOneThousand(thousands))} MIL`);
  if (rest) groups.push(belowOneThousand(rest));
  return groups.join(' ');
}

function formatMoneyInWords(value) {
  const cents = Math.round(Math.max(0, Number(value) || 0) * 100);
  const whole = Math.floor(cents / 100);
  const decimal = String(cents % 100).padStart(2, '0');
  return `${numberInWords(whole)} ${decimal}/100 BOLIVIANOS`;
}

function formatMoney(value) {
  const num = Number(value || 0);
  return num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDocDate(value) {
  if (!value) return '-';
  const str = normalizeDateInput(value);
  if (!str) return '-';
  const date = new Date(`${str}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function formatLongDate(value) {
  if (!value) return '-';
  const str = normalizeDateInput(value);
  if (!str) return '-';
  const date = new Date(`${str}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  const day = date.getDate();
  const month = MONTHS_ES[date.getMonth()];
  const year = date.getFullYear();
  return `${day} de ${month} de ${year}`;
}

function normalizeDateInput(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const isoDate = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function htmlToPlainText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function drawDocumentFooter(doc) {
  const { width, height } = doc.page;
  const left = 34;
  const right = width - 34;
  const lineY = height - 38;
  const textY = lineY + 6;

  doc.save();
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  // Blue rule
  doc.strokeColor('#4F9BD3')
    .lineWidth(0.8)
    .moveTo(left, lineY)
    .lineTo(right, lineY)
    .stroke();

  // Footer text
  doc.font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#757575')
    .text(DOCUMENT_FOOTER_LINE, left, textY, {
      width: right - left,
      align: 'center',
      lineBreak: false,
    });

  doc.page.margins.bottom = originalBottomMargin;
  doc.restore();
}

module.exports = {
  FRONTEND_IMAGES_DIR,
  FIRMANTE_PRESETS,
  resolveImagePath,
  loadImageBuffer,
  formatMoneyInWords,
  formatMoney,
  formatDocDate,
  formatLongDate,
  htmlToPlainText,
  drawDocumentFooter,
};
