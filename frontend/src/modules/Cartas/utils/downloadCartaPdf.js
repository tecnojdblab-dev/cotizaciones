import { downloadCartaPdf as fetchCartaPdf, downloadCartaDraftPdf } from '../api/cartasApi.js'
import { safeFileName } from './cartaFormatters.js'
import { downloadBlob } from '../../../shared/utils/downloadBlob.js'

export async function downloadCartaPdf(carta) {
  if (!carta) throw new Error('No se especificó la carta a descargar')

  const filename = `${safeFileName(carta.numero || carta.referencia || 'carta')}.pdf`

  let blob
  if (carta.id) {
    blob = await fetchCartaPdf(carta.id)
  } else {
    blob = await downloadCartaDraftPdf(carta)
  }

  downloadBlob(blob, filename)
  return { filename }
}
