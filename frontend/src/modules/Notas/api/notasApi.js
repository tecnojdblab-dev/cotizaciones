import { apiDelete, apiGet, apiPost, apiPut, unwrapData } from '../../../services/api/http'
import { FIRMANTE_PRESETS } from '../../../shared/utils/firmantePresets.js'

const BASE_URL = '/notas'

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

function toFrontendNota(nota) {
  const preset = nota.empresaEntregadoPor ? FIRMANTE_PRESETS[nota.empresaEntregadoPor] : null
  return {
    id: String(nota.idNota),
    clienteId: nota.idCliente ? String(nota.idCliente) : undefined,
    codigo: nota.codigo || '',
    revision: nota.revision || '',
    numero: nota.numero || '',
    clienteEntidad: nota.clienteEntidad,
    institucion: nota.institucion || '',
    objetoContratacion: nota.objetoContratacion || '',
    lugarEntrega: nota.lugarEntrega || '',
    fechaEntrega: toDateInputValue(nota.fechaEntrega),
    introduccion: nota.introduccion || '',
    empresaEntregadoPor: nota.empresaEntregadoPor || undefined,
    entregadoNombre: preset?.firmanteNombre || nota.entregadoNombre || '',
    entregadoCargo: preset?.firmanteCargo || nota.entregadoCargo || '',
    entregadoDocumento: preset?.firmanteDocumento || nota.entregadoDocumento || '',
    entregadoTelefono: nota.entregadoTelefono || preset?.firmanteTelefono || '',
    entregadoFirma: nota.entregadoFirmaUrl || preset?.firmaImagen || '',
    entregadoSello: nota.entregadoSelloUrl || preset?.selloImagen || '',
    ocultarSello: Boolean(nota.ocultarSello),
    recibidoNombre: nota.recibidoNombre || '',
    recibidoCargo: nota.recibidoCargo || '',
    recibidoFirma: nota.recibidoFirmaUrl || '',
    papel: nota.papel || 'letter',
    estado: nota.estado || 'borrador',
    createdAt: nota.fechaCreacion,
    updatedAt: nota.fechaActualizacion,
    items: (nota.items || []).map((item) => ({
      catalogoTipo: item.tipoCatalogo,
      catalogoId: item.idProducto || item.idComponente ? String(item.idProducto || item.idComponente) : undefined,
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      codigo: item.codigo || '',
      numeroSerie: item.numeroSerie || '',
      cantidad: item.cantidad,
      precioUnitario: Number(item.precioUnitario),
    })),
  }
}

async function uploadSignature(value) {
  if (!value?.startsWith('data:')) return /^https?:\/\//.test(value || '') ? value : null
  const blob = await (await fetch(value)).blob()
  const form = new FormData()
  form.append('file', new File([blob], 'firma.png', { type: blob.type || 'image/png' }))
  const response = await apiPost(`${BASE_URL}/firma-recibida`, form)
  return unwrapData(response).urlImagen
}

async function toApiPayload(nota) {
  const [entregadoFirmaUrl, entregadoSelloUrl, recibidoFirmaUrl] = await Promise.all([
    uploadSignature(nota.entregadoFirma),
    uploadSignature(nota.entregadoSello),
    uploadSignature(nota.recibidoFirma),
  ])
  return {
    idCliente: nota.clienteId || null,
    codigo: nota.codigo || null,
    revision: nota.revision || null,
    numero: nota.numero || null,
    clienteEntidad: nota.clienteEntidad,
    institucion: nota.institucion || null,
    objetoContratacion: nota.objetoContratacion || null,
    lugarEntrega: nota.lugarEntrega || null,
    fechaEntrega: nota.fechaEntrega || null,
    introduccion: nota.introduccion || null,
    empresaEntregadoPor: nota.empresaEntregadoPor || null,
    entregadoNombre: nota.entregadoNombre || null,
    entregadoCargo: nota.entregadoCargo || null,
    entregadoDocumento: nota.entregadoDocumento || null,
    entregadoTelefono: nota.entregadoTelefono || null,
    entregadoFirmaUrl,
    entregadoSelloUrl,
    ocultarSello: Boolean(nota.ocultarSello),
    recibidoNombre: nota.recibidoNombre || null,
    recibidoCargo: nota.recibidoCargo || null,
    recibidoFirmaUrl,
    papel: nota.papel || 'letter',
    estado: nota.estado || 'borrador',
    items: (nota.items || []).map((item, index) => ({
      tipoCatalogo: item.catalogoTipo || 'producto',
      idProducto: item.catalogoTipo === 'producto' ? item.catalogoId || null : null,
      idComponente: item.catalogoTipo === 'componente' ? item.catalogoId || null : null,
      nombre: item.nombre,
      descripcion: item.descripcion || null,
      codigo: item.codigo || null,
      numeroSerie: item.numeroSerie || null,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      ordenVisual: index,
    })),
  }
}

export async function getNotas({ take = 8, skip = 0, search = '', signal } = {}) {
  const params = new URLSearchParams({ take: String(take), skip: String(skip) })
  if (search.trim()) params.set('search', search.trim())
  const response = await apiGet(`${BASE_URL}?${params}`, { signal })
  const data = unwrapData(response)
  return {
    items: Array.isArray(data) ? data.map(toFrontendNota) : [],
    total: Number(response?.meta?.total ?? (Array.isArray(data) ? data.length : 0)),
  }
}

export async function createNota(nota) {
  const response = await apiPost(BASE_URL, await toApiPayload(nota))
  return toFrontendNota(unwrapData(response))
}

export async function updateNota(id, nota) {
  const response = await apiPut(`${BASE_URL}/${id}`, await toApiPayload(nota))
  return toFrontendNota(unwrapData(response))
}

export async function deleteNota(id) {
  await apiDelete(`${BASE_URL}/${id}`)
}

export async function downloadNotaPdf(id) {
  return apiGet(`${BASE_URL}/${id}/pdf`, { responseType: 'blob' })
}

export async function downloadNotaDraftPdf(nota) {
  const payload = await toApiPayload(nota)
  return apiPost(`${BASE_URL}/pdf`, payload, { responseType: 'blob' })
}
