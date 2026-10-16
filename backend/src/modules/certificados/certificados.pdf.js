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

async function buildCertificadoPdf(certificado) {
  const logoBuffer = await loadImageBuffer(path.join(FRONTEND_IMAGES_DIR, 'logojdblab.jpeg.png'), { maxWidth: 1600 });

  // Resolving signer images — skip Vite asset hashes (/assets/, /@fs/)
  const empresa = String(certificado.empresaFirmante || '').toLowerCase();
  const preset = FIRMANTE_PRESETS[empresa] || null;

  let firmaBuffer = null;
  const firmaSrc = certificado.firmaUrl || certificado.firmaImagen;
  if (firmaSrc && !firmaSrc.startsWith('/assets/') && !firmaSrc.startsWith('/@fs/')) {
    firmaBuffer = await loadImageBuffer(firmaSrc, { maxWidth: 350 });
  }
  if (!firmaBuffer && preset?.firmaPath) {
    firmaBuffer = await loadImageBuffer(preset.firmaPath, { maxWidth: 350 });
  }

  let selloBuffer = null;
  const selloSrc = certificado.selloUrl || certificado.selloImagen;
  if (selloSrc && !selloSrc.startsWith('/assets/') && !selloSrc.startsWith('/@fs/')) {
    selloBuffer = await loadImageBuffer(selloSrc, { maxWidth: 320 });
  }
  if (!selloBuffer && preset?.selloPath) {
    selloBuffer = await loadImageBuffer(preset.selloPath, { maxWidth: 320 });
  }

  return new Promise((resolve, reject) => {
    try {
      const isLetter = String(certificado.papel || '').toLowerCase() === 'letter';
      const doc = new PDFDocument({
        size: isLetter ? 'LETTER' : 'A4',
        margins: { top: 32, bottom: 42, left: 34, right: 34 },
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

      // Draw Header Table function
      function drawHeaderTable(pageNumber = 1, totalPages = 1) {
        const top = doc.page.margins.top;
        const headerH = 46;
        const col1W = Math.round(contentWidth * 0.22);
        const col2W = Math.round(contentWidth * 0.48);
        const col3W = Math.round(contentWidth * 0.14);
        const col4W = contentWidth - col1W - col2W - col3W;

        doc.save();
        doc.lineWidth(1).strokeColor('#222222');

        // Outer box
        doc.rect(left, top, contentWidth, headerH).stroke();

        // Vertical lines
        doc.moveTo(left + col1W, top).lineTo(left + col1W, top + headerH).stroke();
        doc.moveTo(left + col1W + col2W, top).lineTo(left + col1W + col2W, top + headerH).stroke();
        doc.moveTo(left + col1W + col2W + col3W, top).lineTo(left + col1W + col2W + col3W, top + headerH).stroke();

        // Horizontal lines inside cols 2, 3, 4
        const rowH = headerH / 3;
        doc.moveTo(left + col1W, top + rowH).lineTo(right, top + rowH).stroke();
        doc.moveTo(left + col1W, top + rowH * 2).lineTo(right, top + rowH * 2).stroke();

        // Logo in col 1
        if (logoBuffer) {
          try {
            doc.image(logoBuffer, left + 4, top + 4, {
              fit: [col1W - 8, headerH - 8],
              align: 'center',
              valign: 'center',
            });
          } catch {}
        }

        // Col 2 text
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111');
        doc.text('SISTEMA DE GESTIÓN DE LA CALIDAD', left + col1W + 2, top + 4, {
          width: col2W - 4,
          align: 'center',
        });
        doc.text('REGISTRO', left + col1W + 2, top + rowH + 4, {
          width: col2W - 4,
          align: 'center',
        });
        doc.text('CERTIFICADO DE GARANTÍA', left + col1W + 2, top + rowH * 2 + 4, {
          width: col2W - 4,
          align: 'center',
        });

        // Col 3 text (Labels)
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111');
        doc.text('Código', left + col1W + col2W + 4, top + 4, { width: col3W - 8, align: 'left' });
        doc.text('Revisión', left + col1W + col2W + 4, top + rowH + 4, { width: col3W - 8, align: 'left' });
        doc.text('Página', left + col1W + col2W + 4, top + rowH * 2 + 4, { width: col3W - 8, align: 'left' });

        // Col 4 text (Values)
        doc.font('Helvetica').fontSize(8).fillColor('#111111');
        doc.text(cleanText(certificado.codigo), left + col1W + col2W + col3W + 2, top + 4, { width: col4W - 4, align: 'center' });
        doc.text(cleanText(certificado.revision), left + col1W + col2W + col3W + 2, top + rowH + 4, { width: col4W - 4, align: 'center' });
        doc.text(`${pageNumber} de ${totalPages}`, left + col1W + col2W + col3W + 2, top + rowH * 2 + 4, { width: col4W - 4, align: 'center' });

        doc.restore();
        return top + headerH;
      }

      // Initial page header
      let currentY = drawHeaderTable(1, 1) + 8;

      // 1. Client Table
      const clientCol1W = Math.round(contentWidth * 0.39);
      const clientCol2W = contentWidth - clientCol1W;

      const clientRows = [
        { label: 'CLIENTE O ENTIDAD CONTRATANTE:', value: (cleanText(certificado.clienteEntidad) || 'CLIENTE O ENTIDAD').toUpperCase() },
        { label: 'OBJETO DE LA CONTRATACIÓN:', value: cleanText(certificado.objetoContratacion) || 'OBJETO DE LA CONTRATACIÓN' },
      ];

      doc.lineWidth(1).strokeColor('#222222');
      for (const row of clientRows) {
        doc.font('Helvetica').fontSize(8);
        const textH = doc.heightOfString(row.value, { width: clientCol2W - 8 });
        const rowH = Math.max(16, textH + 6);

        doc.rect(left, currentY, clientCol1W, rowH).fillColor('#82DDF5').fill();
        doc.rect(left + clientCol1W, currentY, clientCol2W, rowH).fillColor('#FFFFFF').fill();

        doc.rect(left, currentY, clientCol1W, rowH).strokeColor('#222222').stroke();
        doc.rect(left + clientCol1W, currentY, clientCol2W, rowH).strokeColor('#222222').stroke();

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111111')
          .text(row.label, left + 4, currentY + (rowH - 8) / 2, { width: clientCol1W - 8, align: 'left' });

        doc.font('Helvetica').fontSize(8).fillColor('#111111')
          .text(row.value, left + clientCol1W + 4, currentY + 3, { width: clientCol2W - 8, align: 'left' });

        currentY += rowH;
      }

      // Row 3: Warranty years header
      const yearsText = `TIEMPO DE GARANTÍA ${certificado.garantiaAnos || 1} AÑO${Number(certificado.garantiaAnos) === 1 ? '' : 'S'}`;
      doc.rect(left, currentY, contentWidth, 16).fillColor('#82DDF5').fill();
      doc.rect(left, currentY, contentWidth, 16).strokeColor('#222222').stroke();
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111')
        .text(yearsText, left + 4, currentY + 4, { width: contentWidth - 8, align: 'center' });
      currentY += 16;

      // Row 4: Dates row (DESDE ... HASTA ...)
      const dateW1 = 55;
      const dateW2 = Math.round((contentWidth - dateW1 * 2) / 2);
      const dateW4 = contentWidth - dateW1 * 2 - dateW2;
      const dateH = 16;

      doc.rect(left, currentY, dateW1, dateH).fillColor('#82DDF5').fill();
      doc.rect(left + dateW1, currentY, dateW2, dateH).fillColor('#FFFFFF').fill();
      doc.rect(left + dateW1 + dateW2, currentY, dateW1, dateH).fillColor('#82DDF5').fill();
      doc.rect(left + dateW1 * 2 + dateW2, currentY, dateW4, dateH).fillColor('#FFFFFF').fill();

      doc.rect(left, currentY, contentWidth, dateH).strokeColor('#222222').stroke();
      doc.moveTo(left + dateW1, currentY).lineTo(left + dateW1, currentY + dateH).stroke();
      doc.moveTo(left + dateW1 + dateW2, currentY).lineTo(left + dateW1 + dateW2, currentY + dateH).stroke();
      doc.moveTo(left + dateW1 * 2 + dateW2, currentY).lineTo(left + dateW1 * 2 + dateW2, currentY + dateH).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
        .text('DESDE:', left + 4, currentY + 4, { width: dateW1 - 8, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor('#111111')
        .text(formatLongDate(certificado.fechaDesde).toUpperCase(), left + dateW1 + 4, currentY + 4, { width: dateW2 - 8, align: 'left' });
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
        .text('HASTA:', left + dateW1 + dateW2 + 4, currentY + 4, { width: dateW1 - 8, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor('#111111')
        .text(formatLongDate(certificado.fechaHasta).toUpperCase(), left + dateW1 * 2 + dateW2 + 4, currentY + 4, { width: dateW4 - 8, align: 'left' });

      currentY += dateH + 10;

      // Section 1: Descripción de la entrega
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111')
        .text('1.   DESCRIPCIÓN DE LA ENTREGA.', left, currentY);
      currentY += 13;

      // Items Table configuration
      const certColWidths = [
        Math.round(contentWidth * 0.09), // Ítem
        Math.round(contentWidth * 0.53), // Descripción + Marca/Modelo
        Math.round(contentWidth * 0.14), // Cantidad
        contentWidth - (Math.round(contentWidth * 0.09) + Math.round(contentWidth * 0.53) + Math.round(contentWidth * 0.14)), // Aclaraciones
      ];

      function drawCertItemsHeader(y) {
        const headerH = 16;
        doc.rect(left, y, contentWidth, headerH).fillColor('#82DDF5').fill();
        doc.rect(left, y, contentWidth, headerH).strokeColor('#222222').stroke();

        let curX = left;
        const labels = ['ÍTEM', 'DESCRIPCIÓN', 'CANTIDAD', 'ACLARACIONES'];

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111');
        for (let i = 0; i < certColWidths.length; i++) {
          if (i > 0) doc.moveTo(curX, y).lineTo(curX, y + headerH).stroke();
          doc.text(labels[i], curX + 1, y + 4, { width: certColWidths[i] - 2, align: 'center' });
          curX += certColWidths[i];
        }
        return y + headerH;
      }

      currentY = drawCertItemsHeader(currentY);

      const items = (certificado.items && certificado.items.length > 0)
        ? certificado.items
        : [{ descripcion: 'DESCRIPCIÓN DEL EQUIPO', marca: '', modelo: '', cantidad: 1, aclaraciones: 'NUEVO' }];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const cant = Number(item.cantidad) || 0;

        doc.font('Helvetica-Bold').fontSize(8);
        const descH = doc.heightOfString(cleanText(item.descripcion) || 'DESCRIPCIÓN DEL EQUIPO', { width: certColWidths[1] - 8 });
        const hasExtra = Boolean(item.marca || item.modelo);
        const extraText = hasExtra ? `MARCA: ${cleanText(item.marca) || '-'}   MODELO: ${cleanText(item.modelo) || '-'}` : '';
        const extraH = hasExtra ? doc.heightOfString(extraText, { width: certColWidths[1] - 8 }) : 0;
        const rowH = Math.max(16, descH + extraH + 8);

        if (currentY + rowH > bottomLimit - 60) {
          doc.addPage();
          currentY = drawHeaderTable(doc.bufferedPageRange().count, doc.bufferedPageRange().count) + 12;
          currentY = drawCertItemsHeader(currentY);
        }

        doc.rect(left, currentY, contentWidth, rowH).fillColor('#FFFFFF').fill();
        doc.rect(left, currentY, contentWidth, rowH).strokeColor('#222222').stroke();

        let cellX = left;
        // Col 0: Index
        doc.font('Helvetica').fontSize(8).fillColor('#111111')
          .text(String(i + 1), cellX, currentY + (rowH - 8) / 2, { width: certColWidths[0], align: 'center' });
        cellX += certColWidths[0];
        doc.moveTo(cellX, currentY).lineTo(cellX, currentY + rowH).stroke();

        // Col 1: Descripción + Marca/Modelo
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
          .text(cleanText(item.descripcion) || 'DESCRIPCIÓN DEL EQUIPO', cellX + 4, currentY + 3, { width: certColWidths[1] - 8, align: 'left' });
        if (hasExtra) {
          doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#333333')
            .text(extraText, cellX + 4, currentY + descH + 4, { width: certColWidths[1] - 8, align: 'left' });
        }
        cellX += certColWidths[1];
        doc.moveTo(cellX, currentY).lineTo(cellX, currentY + rowH).stroke();

        // Col 2: Cantidad
        doc.font('Helvetica').fontSize(8).fillColor('#111111')
          .text(String(cant), cellX, currentY + (rowH - 8) / 2, { width: certColWidths[2], align: 'center' });
        cellX += certColWidths[2];
        doc.moveTo(cellX, currentY).lineTo(cellX, currentY + rowH).stroke();

        // Col 3: Aclaraciones
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
          .text(cleanText(item.aclaraciones) || 'NUEVO', cellX + 4, currentY + (rowH - 8) / 2, { width: certColWidths[3] - 8, align: 'center' });

        currentY += rowH;
      }

      currentY += 12;

      // Warranty Conditions Section
      const conditionsRaw = cleanText(certificado.condicionesHtml);
      const conditionsText = htmlToPlainText(conditionsRaw);

      if (conditionsText) {
        doc.font('Helvetica-Oblique').fontSize(8);
        const condTextH = doc.heightOfString(conditionsText, { width: contentWidth - 16 });
        const boxH = condTextH + 30;

        if (currentY + boxH > bottomLimit - 60) {
          doc.addPage();
          currentY = drawHeaderTable(doc.bufferedPageRange().count, doc.bufferedPageRange().count) + 12;
        }

        // Section header
        doc.rect(left, currentY, contentWidth, 16).fillColor('#82DDF5').fill();
        doc.rect(left, currentY, contentWidth, 16).strokeColor('#222222').stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111')
          .text('CERTIFICADO DE GARANTÍA', left + 4, currentY + 4, { width: contentWidth - 8, align: 'center' });
        currentY += 16;

        // Content box
        doc.rect(left, currentY, contentWidth, condTextH + 12).fillColor('#FFFFFF').fill();
        doc.rect(left, currentY, contentWidth, condTextH + 12).strokeColor('#222222').stroke();

        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#222222')
          .text(conditionsText, left + 8, currentY + 6, { width: contentWidth - 16, align: 'justify' });
        currentY += condTextH + 20;
      }

      // Signature Section (Centered)
      const sigHeight = 170;
      if (currentY + sigHeight > bottomLimit) {
        doc.addPage();
        currentY = drawHeaderTable(doc.bufferedPageRange().count, doc.bufferedPageRange().count) + 20;
      }

      const sigBlockW = Math.round(contentWidth * 0.55);
      const sigLeft = left + (contentWidth - sigBlockW) / 2;
      let sY = currentY;

      if (firmaBuffer) {
        try {
          doc.image(firmaBuffer, sigLeft + (sigBlockW - 150) / 2, sY, { fit: [150, 55], align: 'center' });
        } catch {}
      }
      sY += 57;

      const firmanteNombre = cleanText(certificado.firmanteNombre) || preset?.firmanteNombre;
      if (firmanteNombre) {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111')
          .text(firmanteNombre.toUpperCase(), sigLeft, sY, { width: sigBlockW, align: 'center' });
        sY += 10;
      }

      const firmanteCargo = cleanText(certificado.firmanteCargo) || preset?.firmanteCargo;
      if (firmanteCargo) {
        doc.font('Helvetica').fontSize(8).fillColor('#333333')
          .text(firmanteCargo, sigLeft, sY, { width: sigBlockW, align: 'center' });
        sY += 9;
      }

      const firmanteDoc = cleanText(certificado.firmanteDocumento) || preset?.firmanteDocumento;
      if (firmanteDoc) {
        doc.font('Helvetica').fontSize(7.5).fillColor('#333333')
          .text(firmanteDoc, sigLeft, sY, { width: sigBlockW, align: 'center' });
        sY += 9;
      }

      const firmanteTel = cleanText(certificado.firmanteTelefono) || preset?.firmanteTelefono;
      if (firmanteTel) {
        doc.font('Helvetica').fontSize(7.5).fillColor('#333333')
          .text(firmanteTel, sigLeft, sY, { width: sigBlockW, align: 'center' });
        sY += 9;
      }

      if (selloBuffer) {
        try {
          doc.image(selloBuffer, sigLeft + (sigBlockW - 135) / 2, sY + 2, { fit: [135, 48], align: 'center' });
        } catch {}
      }

      // Post-processing: footers and exact total page numbers
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = range.start; i < range.start + totalPages; i++) {
        doc.switchToPage(i);
        drawDocumentFooter(doc);

        const top = doc.page.margins.top;
        const headerH = 46;
        const rowH = headerH / 3;
        const col1W = Math.round(contentWidth * 0.22);
        const col2W = Math.round(contentWidth * 0.48);
        const col3W = Math.round(contentWidth * 0.14);
        const col4W = contentWidth - col1W - col2W - col3W;
        const pageCellX = left + col1W + col2W + col3W;
        const pageCellY = top + rowH * 2;

        doc.save();
        doc.rect(pageCellX + 1, pageCellY + 1, col4W - 2, rowH - 2).fillColor('#FFFFFF').fill();
        doc.font('Helvetica').fontSize(8).fillColor('#111111')
          .text(`${i - range.start + 1} de ${totalPages}`, pageCellX + 2, pageCellY + 4, {
            width: col4W - 4,
            align: 'center',
          });
        doc.restore();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildCertificadoPdf };
