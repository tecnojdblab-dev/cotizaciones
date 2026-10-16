const path = require('path');
const PDFDocument = require('pdfkit');
const {
  FRONTEND_IMAGES_DIR,
  FIRMANTE_PRESETS,
  loadImageBuffer,
  formatLongDate,
  htmlToPlainText,
  drawDocumentFooter,
} = require('../../utils/pdfCommon');

function cleanText(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function formatLetterDate(value, city = '') {
  // Prisma devuelve los campos Date como objetos Date; normalizarlos antes de
  // pasarlos al formateador evita que String(Date).slice() produzca una fecha inválida.
  const dateValue = value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().slice(0, 10)
    : typeof value === 'string'
      ? value.slice(0, 10)
      : value;
  const formatted = formatLongDate(dateValue);
  if (formatted === '-') return city || '';
  return city ? `${city}, ${formatted}` : formatted;
}

async function buildCartaPdf(carta) {
  const headerLogoBuffer = await loadImageBuffer(path.join(FRONTEND_IMAGES_DIR, 'cabezeralogo.webp'), { maxWidth: 500 });

  // Resolving signer images — skip Vite asset hashes (/assets/, /@fs/)
  const empresa = String(carta.empresaFirmante || '').toLowerCase();
  const preset = FIRMANTE_PRESETS[empresa] || null;

  let firmaBuffer = null;
  const firmaSrc = carta.firmaUrl || carta.firmaImagen;
  if (firmaSrc && !firmaSrc.startsWith('/assets/') && !firmaSrc.startsWith('/@fs/')) {
    firmaBuffer = await loadImageBuffer(firmaSrc, { maxWidth: 350 });
  }
  if (!firmaBuffer && preset?.firmaPath) {
    firmaBuffer = await loadImageBuffer(preset.firmaPath, { maxWidth: 350 });
  }

  let selloBuffer = null;
  const selloSrc = carta.selloUrl || carta.selloImagen;
  if (selloSrc && !selloSrc.startsWith('/assets/') && !selloSrc.startsWith('/@fs/')) {
    selloBuffer = await loadImageBuffer(selloSrc, { maxWidth: 320 });
  }
  if (!selloBuffer && preset?.selloPath) {
    selloBuffer = await loadImageBuffer(preset.selloPath, { maxWidth: 320 });
  }

  return new Promise((resolve, reject) => {
    try {
      const isA4 = String(carta.papel || '').toLowerCase() === 'a4';
      const doc = new PDFDocument({
        size: isA4 ? 'A4' : 'LETTER',
        margins: { top: 32, bottom: 42, left: 45, right: 45 },
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentWidth = right - left;
      const bottomLimit = doc.page.height - 48;

      function drawPageHeader() {
        if (headerLogoBuffer) {
          try {
            doc.image(headerLogoBuffer, left, doc.page.margins.top - 10, {
              fit: [140, 50],
              align: 'left',
            });
          } catch {}
        }
      }

      // Draw first page header
      drawPageHeader();
      let currentY = doc.page.margins.top + 45;

      // 1. Date and City (Right aligned)
      const dateText = formatLetterDate(carta.fecha, cleanText(carta.ciudadFecha));
      if (dateText) {
        doc.font('Helvetica').fontSize(9.5).fillColor('#111111')
          .text(dateText, left, currentY, { width: contentWidth, align: 'right' });
        currentY = doc.y + 14;
      }

      // 2. Recipient Section (Left aligned)
      const recipientLines = [
        cleanText(carta.tratamiento),
        cleanText(carta.destinatario),
        cleanText(carta.cargoDestinatario),
        cleanText(carta.institucion),
        cleanText(carta.presente),
      ].filter(Boolean);

      if (recipientLines.length > 0) {
        for (let i = 0; i < recipientLines.length; i++) {
          const line = recipientLines[i];
          const isDestinatario = line === cleanText(carta.destinatario);
          const isPresente = line === cleanText(carta.presente);

          if (isDestinatario) {
            doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111');
          } else if (isPresente) {
            doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111');
          } else {
            doc.font('Helvetica').fontSize(9.5).fillColor('#222222');
          }

          doc.text(line, left, currentY, { width: contentWidth, align: 'left' });
          currentY = doc.y + 2;
        }
        currentY += 12;
      }

      // 3. Reference and Number
      const refText = cleanText(carta.referencia);
      const numText = cleanText(carta.numero);

      if (refText || numText) {
        if (refText) {
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111')
            .text(`REF.: ${refText}`, left, currentY, { width: contentWidth, align: 'left' });
          currentY = doc.y + 2;
        }
        if (numText) {
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111')
            .text(`N.º ${numText}`, left, currentY, { width: contentWidth, align: 'left' });
          currentY = doc.y + 2;
        }
        currentY += 12;
      }

      // 4. Body Content (Rich HTML converted to clean paragraphs)
      const bodyPlainText = htmlToPlainText(carta.cuerpoHtml);
      const paragraphs = bodyPlainText ? bodyPlainText.split('\n\n') : [];

      for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
        const paragraph = paragraphs[pIndex].trim();
        if (!paragraph) continue;

        doc.font('Helvetica').fontSize(9.5).fillColor('#222222');
        const textH = doc.heightOfString(paragraph, { width: contentWidth, align: 'justify' });

        if (currentY + textH > bottomLimit - 50) {
          doc.addPage();
          drawPageHeader();
          currentY = doc.page.margins.top + 45;
        }

        doc.text(paragraph, left, currentY, {
          width: contentWidth,
          align: 'justify',
          lineGap: 3,
        });
        currentY = doc.y + 8;
      }

      // 5. Farewell
      const despedida = cleanText(carta.despedida);
      if (despedida) {
        doc.font('Helvetica').fontSize(9.5).fillColor('#222222');
        const despH = doc.heightOfString(despedida, { width: contentWidth });

        if (currentY + despH > bottomLimit - 50) {
          doc.addPage();
          drawPageHeader();
          currentY = doc.page.margins.top + 45;
        }

        doc.text(despedida, left, currentY, { width: contentWidth, align: 'left' });
        currentY = doc.y + 16;
      }

      // 6. Signature Section
      const sigHeight = 170;
      if (currentY + sigHeight > bottomLimit) {
        doc.addPage();
        drawPageHeader();
        currentY = doc.page.margins.top + 45;
      }

      const sigBlockW = Math.min(contentWidth * 0.55, 240);
      const sigBlockX = left + (contentWidth - sigBlockW) / 2;
      let sY = currentY;

      if (firmaBuffer) {
        try {
          doc.image(firmaBuffer, sigBlockX + (sigBlockW - 150) / 2, sY, { fit: [150, 55], align: 'center' });
        } catch {}
      }
      sY += 57;

      const firmanteNombre = cleanText(carta.firmanteNombre) || preset?.firmanteNombre;
      if (firmanteNombre) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111')
          .text(firmanteNombre, sigBlockX, sY, { width: sigBlockW, align: 'center' });
        sY += 11;
      }

      const firmanteCargo = cleanText(carta.firmanteCargo) || preset?.firmanteCargo;
      if (firmanteCargo) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#333333')
          .text(firmanteCargo, sigBlockX, sY, { width: sigBlockW, align: 'center' });
        sY += 10;
      }

      const firmanteDoc = cleanText(carta.firmanteDocumento) || preset?.firmanteDocumento;
      if (firmanteDoc) {
        doc.font('Helvetica').fontSize(8).fillColor('#333333')
          .text(firmanteDoc, sigBlockX, sY, { width: sigBlockW, align: 'center' });
        sY += 9;
      }

      const firmanteTel = cleanText(carta.firmanteTelefono) || preset?.firmanteTelefono;
      if (firmanteTel) {
        doc.font('Helvetica').fontSize(8).fillColor('#333333')
          .text(firmanteTel, sigBlockX, sY, { width: sigBlockW, align: 'center' });
        sY += 9;
      }

      if (selloBuffer) {
        try {
          doc.image(selloBuffer, sigBlockX + (sigBlockW - 135) / 2, sY + 2, { fit: [135, 48], align: 'center' });
        } catch {}
      }

      // Post-processing: footers on all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        drawDocumentFooter(doc);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildCartaPdf };
