const { HttpError } = require('../../utils/httpError');
const {
  listCertificados,
  getCertificadoById,
  createCertificado,
  updateCertificado,
  deleteCertificado,
} = require('./certificados.service');
const { createCertificadoSchema, updateCertificadoSchema, formatZodError } = require('./certificados.validation');
const { buildCertificadoPdf } = require('./certificados.pdf');

function parseId(value, label = 'id_certificado') {
  try {
    const id = BigInt(value);
    if (id <= 0n) throw new Error('invalid');
    return id;
  } catch {
    throw new HttpError(400, `${label} inválido`);
  }
}

function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, formatZodError(result.error));
  return result.data;
}

function mapPrismaError(error) {
  if (error?.code === 'P2025') throw new HttpError(404, 'Certificado no encontrado');
  if (error?.code === 'P2003') throw new HttpError(400, 'El cliente o ítem de catálogo seleccionado no existe');
  throw error;
}

async function list(req, res) {
  const take = Number(req.query.take ?? 50);
  const skip = Number(req.query.skip ?? 0);
  const safeTake = Number.isFinite(take) ? Math.min(Math.max(take, 1), 200) : 50;
  const safeSkip = Number.isFinite(skip) ? Math.max(skip, 0) : 0;
  const search = req.query.search ? String(req.query.search) : undefined;
  const { items, total } = await listCertificados({ take: safeTake, skip: safeSkip, search });
  res.json({ ok: true, data: items, meta: { total, take: safeTake, skip: safeSkip } });
}

async function getById(req, res) {
  const data = await getCertificadoById(parseId(req.params.id));
  if (!data) throw new HttpError(404, 'Certificado no encontrado');
  res.json({ ok: true, data });
}

async function create(req, res) {
  const payload = parseBody(createCertificadoSchema, req.body);
  const idUsuarioCreador = parseId(req.userId, 'usuario');
  try {
    const data = await createCertificado(payload, idUsuarioCreador);
    res.status(201).json({ ok: true, data });
  } catch (error) {
    mapPrismaError(error);
  }
}

async function update(req, res) {
  const idCertificado = parseId(req.params.id);
  const payload = parseBody(updateCertificadoSchema, req.body);
  try {
    const data = await updateCertificado(idCertificado, payload);
    res.json({ ok: true, data });
  } catch (error) {
    mapPrismaError(error);
  }
}

async function remove(req, res) {
  try {
    await deleteCertificado(parseId(req.params.id));
    res.status(204).send();
  } catch (error) {
    mapPrismaError(error);
  }
}

async function getPdf(req, res) {
  const certificado = await getCertificadoById(parseId(req.params.id));
  if (!certificado) throw new HttpError(404, 'Certificado no encontrado');
  const buffer = await buildCertificadoPdf(certificado);
  const filename = `certificado-${certificado.codigo || certificado.idCertificado || 'garantia'}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.status(200).send(buffer);
}

async function downloadDraftPdf(req, res) {
  const payload = req.body || {};
  const buffer = await buildCertificadoPdf(payload);
  const filename = `certificado-${payload.codigo || 'garantia'}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.status(200).send(buffer);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  getPdf,
  downloadDraftPdf,
};
