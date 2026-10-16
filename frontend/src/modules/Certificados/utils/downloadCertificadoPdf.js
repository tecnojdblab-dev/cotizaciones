import { downloadCertificadoPdf as fetchCertificadoPdf, downloadCertificadoDraftPdf } from '../api/certificadosApi.js'
import { safeCertificateFileName } from './certificadoFormatters.js'
import { downloadBlob } from '../../../shared/utils/downloadBlob.js'

export async function downloadCertificadoPdf(certificado) {
  if (!certificado) throw new Error('No se especificó el certificado a descargar')

  const filename = `${safeCertificateFileName(certificado.codigo || 'garantia')}.pdf`

  let blob
  if (certificado.id) {
    blob = await fetchCertificadoPdf(certificado.id)
  } else {
    blob = await downloadCertificadoDraftPdf(certificado)
  }

  downloadBlob(blob, filename)
  return { filename }
}
