import { downloadNotaPdf as fetchNotaPdf, downloadNotaDraftPdf } from '../api/notasApi.js'
import { safeNotaFileName } from './notaFormatters.js'
import { downloadBlob } from '../../../shared/utils/downloadBlob.js'

export async function downloadNotaPdf(nota) {
  if (!nota) throw new Error('No se especificó la nota a descargar')

  const filename = `${safeNotaFileName(nota.numero ? `nota-${nota.numero}` : 'nota-entrega')}.pdf`

  let blob
  if (nota.id) {
    blob = await fetchNotaPdf(nota.id)
  } else {
    blob = await downloadNotaDraftPdf(nota)
  }

  downloadBlob(blob, filename)
  return { filename }
}
