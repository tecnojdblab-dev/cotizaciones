export const DOCUMENT_FOOTER_TEXT = 'TEL: 4-4292937 - CEL: 70769521 - AV. CIRCUNVALACIÓN, ENTRE C. VATICANO Y C.F. PÉREZ SAAVEDRA - CBBA - BOLIVIA'

export function createDocumentWordFooter(docx, fontSize = 20) {
  return new docx.Footer({
    children: [new docx.Paragraph({
      children: [new docx.TextRun({
        font: 'Arial', size: fontSize, bold: true, color: '757575',
        text: DOCUMENT_FOOTER_TEXT,
      })],
      alignment: docx.AlignmentType.CENTER,
      spacing: { before: 100, line: 220 },
      border: {
        top: {
          style: docx.BorderStyle.SINGLE,
          size: 12,
          color: '4F9BD3',
          space: 8,
        },
      },
    })],
  })
}
