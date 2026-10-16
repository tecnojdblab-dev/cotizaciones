const path = require('path');
const PDFDocument = require('pdfkit');
const {
  FRONTEND_IMAGES_DIR,
  FIRMANTE_PRESETS,
  loadImageBuffer,
  formatMoneyInWords,
  formatMoney,
  formatDocDate,
  drawDocumentFooter,
} = require('../../utils/pdfCommon');

function getNotaTotal(nota) {
  const items = nota?.items || [];
  return items.reduce((acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0), 0);
}

function cleanText(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

async function buildNotaPdf(nota) {
  const logoBuffer = await loadImageBuffer(path.join(FRONTEND_IMAGES_DIR, 'logojdblab.jpeg.png'), { maxWidth: 1600 });

  // Resolving signer images (with preset fallbacks)
  const empresa = String(nota.empresaEntregadoPor || '').toLowerCase();
  const preset = FIRMANTE_PRESETS[empresa];

  let entregaFirmaBuffer = null;
  const firmaSrc = nota.entregadoFirmaUrl || nota.entregadoFirma;
  if (firmaSrc && !firmaSrc.startsWith('/assets/') && !firmaSrc.startsWith('/@fs/')) {
    entregaFirmaBuffer = await loadImageBuffer(firmaSrc, { maxWidth: 350 });
  }
  if (!entregaFirmaBuffer && preset?.firmaPath) {
    entregaFirmaBuffer = await loadImageBuffer(preset.firmaPath, { maxWidth: 350 });
  }

  let entregaSelloBuffer = null;
  if (!nota.ocultarSello) {
    const selloSrc = nota.entregadoSelloUrl || nota.entregadoSello;
    if (selloSrc && !selloSrc.startsWith('/assets/') && !selloSrc.startsWith('/@fs/')) {
      entregaSelloBuffer = await loadImageBuffer(selloSrc, { maxWidth: 320 });
    }
    if (!entregaSelloBuffer && preset?.selloPath) {
      entregaSelloBuffer = await loadImageBuffer(preset.selloPath, { maxWidth: 320 });
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const isA4 = String(nota.papel || '').toLowerCase() === 'a4';
      const doc = new PDFDocument({
        size: isA4 ? 'A4' : 'LETTER',
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
        const col1W = Math.round(contentWidth * 0.28);
        const col2W = Math.round(contentWidth * 0.44);
        const col3W = Math.round(contentWidth * 0.13);
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
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111');
        doc.text('SISTEMA DE GESTIÓN DE CALIDAD', left + col1W + 2, top + 4, {
          width: col2W - 4,
          align: 'center',
        });
        doc.text('REGISTRO', left + col1W + 2, top + rowH + 4, {
          width: col2W - 4,
          align: 'center',
        });
        doc.text('NOTA DE ENTREGA', left + col1W + 2, top + rowH * 2 + 4, {
          width: col2W - 4,
          align: 'center',
        });

        // Col 3 text (Labels)
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111111');
        doc.text('Código:', left + col1W + col2W + 3, top + 4, { width: col3W - 6, align: 'left' });
        doc.text('Revisión:', left + col1W + col2W + 3, top + rowH + 4, { width: col3W - 6, align: 'left' });
        doc.text('Página:', left + col1W + col2W + 3, top + rowH * 2 + 4, { width: col3W - 6, align: 'left' });

        // Col 4 text (Values)
        doc.font('Helvetica').fontSize(7.5).fillColor('#111111');
        doc.text(cleanText(nota.codigo), left + col1W + col2W + col3W + 2, top + 4, { width: col4W - 4, align: 'center' });
        doc.text(cleanText(nota.revision), left + col1W + col2W + col3W + 2, top + rowH + 4, { width: col4W - 4, align: 'center' });
        doc.text(`${pageNumber} de ${totalPages}`, left + col1W + col2W + col3W + 2, top + rowH * 2 + 4, { width: col4W - 4, align: 'center' });

        doc.restore();
        return top + headerH;
      }

      // Initial page header
      let currentY = drawHeaderTable(1, 1) + 8;

      // 1. Info Table
      const infoCol1W = Math.round(contentWidth * 0.34);
      const infoCol2W = contentWidth - infoCol1W;
      const infoRows = [
        { label: 'CLIENTE O ENTIDAD CONTRATANTE:', value: (cleanText(nota.clienteEntidad) || '[Nombre del cliente]').toUpperCase() },
        { label: 'OBJETO DE LA CONTRATACIÓN:', value: cleanText(nota.objetoContratacion) || '[Descripción de la contratación]' },
        { label: 'LUGAR DE ENTREGA:', value: cleanText(nota.lugarEntrega) || '[Dirección]' },
        { label: 'FECHA DE ENTREGA:', value: formatDocDate(nota.fechaEntrega) },
      ];

      doc.lineWidth(1).strokeColor('#222222');
      for (const row of infoRows) {
        doc.font('Helvetica').fontSize(8);
        const textH = doc.heightOfString(row.value, { width: infoCol2W - 8 });
        const rowH = Math.max(16, textH + 6);

        doc.rect(left, currentY, infoCol1W, rowH).fillColor('#80DDF4').fill();
        doc.rect(left + infoCol1W, currentY, infoCol2W, rowH).fillColor('#FFFFFF').fill();

        doc.rect(left, currentY, infoCol1W, rowH).strokeColor('#222222').stroke();
        doc.rect(left + infoCol1W, currentY, infoCol2W, rowH).strokeColor('#222222').stroke();

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111111')
          .text(row.label, left + 4, currentY + (rowH - 8) / 2, { width: infoCol1W - 8, align: 'left' });

        doc.font('Helvetica').fontSize(8).fillColor('#111111')
          .text(row.value, left + infoCol1W + 4, currentY + 3, { width: infoCol2W - 8, align: 'left' });

        currentY += rowH;
      }

      currentY += 10;

      // Section 1: Descripción de la entrega
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111')
        .text('1.   DESCRIPCIÓN DE LA ENTREGA.', left, currentY);
      currentY += 13;

      if (nota.introduccion) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#222222')
          .text(cleanText(nota.introduccion), left, currentY, { width: contentWidth, align: 'justify' });
        currentY = doc.y + 10;
      }

      // Items Table configuration
      const colWidths = [
        Math.round(contentWidth * 0.06), // Ítem
        Math.round(contentWidth * 0.41), // Equipo y descripción
        Math.round(contentWidth * 0.09), // Código
        Math.round(contentWidth * 0.13), // N.º de serie
        Math.round(contentWidth * 0.06), // Cant.
        Math.round(contentWidth * 0.14), // P. unitario
        contentWidth - (
          Math.round(contentWidth * 0.06) +
          Math.round(contentWidth * 0.41) +
          Math.round(contentWidth * 0.09) +
          Math.round(contentWidth * 0.13) +
          Math.round(contentWidth * 0.06) +
          Math.round(contentWidth * 0.14)
        ), // Total
      ];

      function drawItemsHeader(y) {
        const headerH = 18;
        doc.rect(left, y, contentWidth, headerH).fillColor('#80DDF4').fill();
        doc.rect(left, y, contentWidth, headerH).strokeColor('#222222').stroke();

        let curX = left;
        const labels = ['Ítem', 'Equipo y descripción', 'Código', 'N.º de serie', 'Cant.', 'P. unitario\nBs', 'Total Bs'];

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111111');
        for (let i = 0; i < colWidths.length; i++) {
          if (i > 0) doc.moveTo(curX, y).lineTo(curX, y + headerH).stroke();
          doc.text(labels[i], curX + 1, y + (labels[i].includes('\n') ? 2 : 5), {
            width: colWidths[i] - 2,
            align: 'center',
          });
          curX += colWidths[i];
        }
        return y + headerH;
      }

      currentY = drawItemsHeader(currentY);

      const items = (nota.items && nota.items.length > 0)
        ? nota.items
        : [{ nombre: 'AGREGUE UN PRODUCTO O COMPONENTE', descripcion: '', codigo: '-', numeroSerie: '', cantidad: 1, precioUnitario: 0 }];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const cant = Number(item.cantidad) || 0;
        const pu = Number(item.precioUnitario) || 0;
        const totalLine = cant * pu;

        doc.font('Helvetica-Bold').fontSize(8);
        const nameH = doc.heightOfString(cleanText(item.nombre), { width: colWidths[1] - 6 });
        doc.font('Helvetica').fontSize(7.5);
        const descH = item.descripcion ? doc.heightOfString(cleanText(item.descripcion), { width: colWidths[1] - 6 }) : 0;
        const rowH = Math.max(16, nameH + descH + 8);

        if (currentY + rowH > bottomLimit - 50) {
          doc.addPage();
          currentY = drawHeaderTable(doc.bufferedPageRange().count, doc.bufferedPageRange().count) + 12;
          currentY = drawItemsHeader(currentY);
        }

        doc.rect(left, currentY, contentWidth, rowH).fillColor('#FFFFFF').fill();
        doc.rect(left, currentY, contentWidth, rowH).strokeColor('#222222').stroke();

        let cellX = left;
        // Col 0: Index
        doc.font('Helvetica').fontSize(8).fillColor('#111111')
          .text(String(i + 1), cellX, currentY + (rowH - 8) / 2, { width: colWidths[0], align: 'center' });
        cellX += colWidths[0];
        doc.moveTo(cellX, currentY).lineTo(cellX, currentY + rowH).stroke();

        // Col 1: Nombre + Descripción
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
          .text(cleanText(item.nombre), cellX + 3, currentY + 3, { width: colWidths[1] - 6, align: 'left' });
        if (item.descripcion) {
          doc.font('Helvetica').fontSize(7.5).fillColor('#333333')
            .text(cleanText(item.descripcion), cellX + 3, currentY + nameH + 4, { width: colWidths[1] - 6, align: 'left' });
        }
        cellX += colWidths[1];
        doc.moveTo(cellX, currentY).lineTo(cellX, currentY + rowH).stroke();

        // Col 2: Código
        doc.font('Helvetica').fontSize(7.5).fillColor('#111111')
          .text(cleanText(item.codigo) || '-', cellX + 1, currentY + (rowH - 8) / 2, { width: colWidths[2] - 2, align: 'center' });
        cellX += colWidths[2];
        doc.moveTo(cellX, currentY).lineTo(cellX, currentY + rowH).stroke();

        // Col 3: Número de serie
        doc.font('Helvetica').fontSize(7.5).fillColor('#111111')
          .text(cleanText(item.numeroSerie) || '-', cellX + 1, currentY + (rowH - 8) / 2, { width: colWidths[3] - 2, align: 'center' });
        cellX += colWidths[3];
        doc.moveTo(cellX, currentY).lineTo(cellX, currentY + rowH).stroke();

        // Col 4: Cantidad
        doc.font('Helvetica').fontSize(8).fillColor('#111111')
          .text(String(cant), cellX + 1, currentY + (rowH - 8) / 2, { width: colWidths[4] - 2, align: 'center' });
        cellX += colWidths[4];
        doc.moveTo(cellX, currentY).lineTo(cellX, currentY + rowH).stroke();

        // Col 5: Precio unitario
        doc.font('Helvetica').fontSize(8).fillColor('#111111')
          .text(formatMoney(pu), cellX + 1, currentY + (rowH - 8) / 2, { width: colWidths[5] - 4, align: 'right' });
        cellX += colWidths[5];
        doc.moveTo(cellX, currentY).lineTo(cellX, currentY + rowH).stroke();

        // Col 6: Total
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
          .text(formatMoney(totalLine), cellX + 1, currentY + (rowH - 8) / 2, { width: colWidths[6] - 4, align: 'right' });

        currentY += rowH;
      }

      // Total Row
      const grandTotal = getNotaTotal(nota);
      const totalColSpanW = contentWidth - colWidths[6];
      const totalRowH = 16;

      if (currentY + totalRowH * 2 > bottomLimit - 50) {
        doc.addPage();
        currentY = drawHeaderTable(doc.bufferedPageRange().count, doc.bufferedPageRange().count) + 12;
      }

      doc.rect(left, currentY, totalColSpanW, totalRowH).fillColor('#80DDF4').fill();
      doc.rect(left, currentY, totalColSpanW, totalRowH).strokeColor('#222222').stroke();
      doc.rect(left + totalColSpanW, currentY, colWidths[6], totalRowH).fillColor('#FFFFFF').fill();
      doc.rect(left + totalColSpanW, currentY, colWidths[6], totalRowH).strokeColor('#222222').stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
        .text('TOTAL Bs:', left + 4, currentY + 4, { width: totalColSpanW - 8, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
        .text(formatMoney(grandTotal), left + totalColSpanW + 1, currentY + 4, { width: colWidths[6] - 4, align: 'right' });

      currentY += totalRowH;

      // Son row (words)
      const wordsText = `SON: ${formatMoneyInWords(grandTotal)}`;
      doc.rect(left, currentY, contentWidth, totalRowH).fillColor('#FFFFFF').fill();
      doc.rect(left, currentY, contentWidth, totalRowH).strokeColor('#222222').stroke();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111111')
        .text(wordsText, left + 4, currentY + 4, { width: contentWidth - 8, align: 'left' });

      currentY += totalRowH + 16;

      // Signatures section
      const sigHeight = 170;
      if (currentY + sigHeight > bottomLimit) {
        doc.addPage();
        currentY = drawHeaderTable(doc.bufferedPageRange().count, doc.bufferedPageRange().count) + 20;
      }

      const sigColW = Math.round(contentWidth * 0.46);
      const sigCol2Left = right - sigColW;

      // Col 1: Entregado Por
      let sigY = currentY;
      if (entregaFirmaBuffer) {
        try {
          doc.image(entregaFirmaBuffer, left + (sigColW - 150) / 2, sigY, { fit: [150, 55], align: 'center' });
        } catch {}
      }
      sigY += 57;

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111')
        .text('ENTREGADO POR', left, sigY, { width: sigColW, align: 'center' });
      sigY += 10;

      const entregadoNombre = cleanText(nota.entregadoNombre) || preset?.firmanteNombre || '[Persona seleccionada]';
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
        .text(entregadoNombre.toUpperCase(), left, sigY, { width: sigColW, align: 'center' });
      sigY += 10;

      const entregadoCargo = cleanText(nota.entregadoCargo) || preset?.firmanteCargo || '[Cargo]';
      doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#333333')
        .text(entregadoCargo, left, sigY, { width: sigColW, align: 'center' });
      sigY += 9;

      const entregadoDoc = cleanText(nota.entregadoDocumento) || preset?.firmanteDocumento;
      if (entregadoDoc) {
        doc.font('Helvetica').fontSize(7.5).fillColor('#333333')
          .text(entregadoDoc, left, sigY, { width: sigColW, align: 'center' });
        sigY += 9;
      }

      const entregadoTel = cleanText(nota.entregadoTelefono) || preset?.firmanteTelefono;
      if (entregadoTel) {
        doc.font('Helvetica').fontSize(7.5).fillColor('#333333')
          .text(entregadoTel, left, sigY, { width: sigColW, align: 'center' });
        sigY += 9;
      }

      if (entregaSelloBuffer) {
        try {
          doc.image(entregaSelloBuffer, left + (sigColW - 135) / 2, sigY + 2, { fit: [135, 48], align: 'center' });
        } catch {}
      }

      // Col 2: Recibido Por
      let recY = currentY + 38;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111')
        .text('RECIBIDO POR', sigCol2Left, recY, { width: sigColW, align: 'center' });
      recY += 10;

      const recibidoNombre = cleanText(nota.recibidoNombre) || '[Persona que recibe]';
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
        .text(recibidoNombre.toUpperCase(), sigCol2Left, recY, { width: sigColW, align: 'center' });
      recY += 10;

      doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#333333')
        .text('Comisión de Recepción', sigCol2Left, recY, { width: sigColW, align: 'center' });

      // Post-processing: footers and exact total page numbers
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = range.start; i < range.start + totalPages; i++) {
        doc.switchToPage(i);
        drawDocumentFooter(doc);

        const top = doc.page.margins.top;
        const headerH = 46;
        const rowH = headerH / 3;
        const col1W = Math.round(contentWidth * 0.28);
        const col2W = Math.round(contentWidth * 0.44);
        const col3W = Math.round(contentWidth * 0.13);
        const col4W = contentWidth - col1W - col2W - col3W;
        const pageCellX = left + col1W + col2W + col3W;
        const pageCellY = top + rowH * 2;

        doc.save();
        doc.rect(pageCellX + 1, pageCellY + 1, col4W - 2, rowH - 2).fillColor('#FFFFFF').fill();
        doc.font('Helvetica').fontSize(7.5).fillColor('#111111')
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

module.exports = { buildNotaPdf };
