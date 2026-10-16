import { apiDelete, apiGet, apiPost, apiPut, unwrapData } from '../../../services/api/http'
import { FIRMANTE_PRESETS } from '../../../shared/utils/firmantePresets.js'

const BASE_URL = '/certificados'

function toDateInputValue(value) {
  if (!value) return ''
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10)
  }
  const text = String(value).trim()
  const isoDate = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (isoDate) return isoDate
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

function toFrontendItem(item) {
  const id = item.idProducto ?? item.idComponente
  return {
    catalogoTipo: item.tipoCatalogo,
    catalogoId: id ? String(id) : undefined,
    descripcion: item.descripcion,
    marca: item.marca || '',
    modelo: item.modelo || '',
    cantidad: item.cantidad,
    aclaraciones: item.aclaraciones || '',
  }
}

function toFrontendCertificado(certificado) {
  const preset = certificado.empresaFirmante ? FIRMANTE_PRESETS[certificado.empresaFirmante] : null
  return {
    id: String(certificado.idCertificado),
    clienteId: certificado.idCliente ? String(certificado.idCliente) : undefined,
    idNotaOrigen: certificado.idNotaOrigen ? String(certificado.idNotaOrigen) : undefined,
    clienteEntidad: certificado.clienteEntidad,
    objetoContratacion: certificado.objetoContratacion,
    codigo: certificado.codigo,
    revision: certificado.revision || '',
    garantiaAnos: certificado.garantiaAnos || 1,
    fechaDesde: toDateInputValue(certificado.fechaDesde),
    fechaHasta: toDateInputValue(certificado.fechaHasta),
    condicionesHtml: certificado.condicionesHtml || '',
    empresaFirmante: certificado.empresaFirmante || undefined,
    firmanteNombre: preset?.firmanteNombre || certificado.firmanteNombre || '',
    firmanteCargo: preset?.firmanteCargo || certificado.firmanteCargo || '',
    firmanteDocumento: preset?.firmanteDocumento || certificado.firmanteDocumento || '',
    firmanteTelefono: certificado.firmanteTelefono || preset?.firmanteTelefono || '',
    firmaImagen: preset?.firmaImagen || '',
    selloImagen: preset?.selloImagen || '',
    papel: certificado.papel || 'a4',
    estado: certificado.estado || 'borrador',
    items: Array.isArray(certificado.items) ? certificado.items.map(toFrontendItem) : [],
    createdAt: certificado.fechaCreacion,
    updatedAt: certificado.fechaActualizacion,
  }
}

function toApiPayload(certificado) {
  return {
    idCliente: certificado.clienteId || null,
    idNotaOrigen: certificado.idNotaOrigen || null,
    clienteEntidad: certificado.clienteEntidad,
    objetoContratacion: certificado.objetoContratacion,
    codigo: certificado.codigo,
    revision: certificado.revision || null,
    garantiaAnos: certificado.garantiaAnos || null,
    fechaDesde: certificado.fechaDesde || null,
    fechaHasta: certificado.fechaHasta || null,
    condicionesHtml: certificado.condicionesHtml,
    empresaFirmante: certificado.empresaFirmante || null,
    firmanteNombre: certificado.firmanteNombre || null,
    firmanteCargo: certificado.firmanteCargo || null,
    firmanteDocumento: certificado.firmanteDocumento || null,
    firmanteTelefono: certificado.firmanteTelefono || null,
    papel: certificado.papel || 'a4',
    estado: certificado.estado || 'borrador',
    items: (certificado.items || []).map((item, index) => ({
      tipoCatalogo: item.catalogoTipo || 'producto',
      idProducto: item.catalogoTipo === 'producto' ? item.catalogoId || null : null,
      idComponente: item.catalogoTipo === 'componente' ? item.catalogoId || null : null,
      descripcion: item.descripcion,
      marca: item.marca || null,
      modelo: item.modelo || null,
      cantidad: item.cantidad,
      aclaraciones: item.aclaraciones || null,
      ordenVisual: index,
    })),
  }
}

export async function getCertificados(options = {}) {
  const { take = 8, skip = 0, search = '', signal } = options
  const params = new URLSearchParams({ take: String(take), skip: String(skip) })
  if (search.trim()) params.set('search', search.trim())
  const response = await apiGet(`${BASE_URL}?${params.toString()}`, { signal })
  const data = unwrapData(response)
  return {
    items: Array.isArray(data) ? data.map(toFrontendCertificado) : [],
    total: Number(response?.meta?.total ?? (Array.isArray(data) ? data.length : 0)),
  }
}

export async function createCertificado(certificado, fetchOptions = {}) {
  const response = await apiPost(BASE_URL, toApiPayload(certificado), fetchOptions)
  return toFrontendCertificado(unwrapData(response))
}

export async function updateCertificado(id, certificado, fetchOptions = {}) {
  const response = await apiPut(`${BASE_URL}/${id}`, toApiPayload(certificado), fetchOptions)
  return toFrontendCertificado(unwrapData(response))
}

export async function deleteCertificado(id, fetchOptions = {}) {
  await apiDelete(`${BASE_URL}/${id}`, fetchOptions)
}

export async function downloadCertificadoPdf(id) {
  return apiGet(`${BASE_URL}/${id}/pdf`, { responseType: 'blob' })
}

export async function downloadCertificadoDraftPdf(certificado) {
  const payload = toApiPayload(certificado)
  return apiPost(`${BASE_URL}/pdf`, payload, { responseType: 'blob' })
}
