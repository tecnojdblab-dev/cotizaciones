const { HttpError } = require('../../utils/httpError');
const { uploadNotaSignature } = require('../../services/storage/imageService');
const { listNotas, getNotaById, createNota, updateNota, deleteNota } = require('./notas.service');
const { createNotaSchema, updateNotaSchema, formatZodError } = require('./notas.validation');
const { buildNotaPdf } = require('./notas.pdf');

function parseId(value, label = 'id_nota') {
  try {
    const id = BigInt(value);
    if (id <= 0n) throw new Error();
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

function mapError(error) {
  if (error?.code === 'P2025') throw new HttpError(404, 'Nota no encontrada');
  if (error?.code === 'P2003') throw new HttpError(400, 'El cliente o ítem de catálogo seleccionado no existe');
  throw error;
}

async function list(req, res) {
  const take = Number(req.query.take ?? 50);
  const skip = Number(req.query.skip ?? 0);
  const safeTake = Number.isFinite(take) ? Math.min(Math.max(take, 1), 200) : 50;
  const safeSkip = Number.isFinite(skip) ? Math.max(skip, 0) : 0;
  const { items, total } = await listNotas({
    take: safeTake,
    skip: safeSkip,
    search: req.query.search ? String(req.query.search) : undefined,
  });
  res.json({ ok: true, data: items, meta: { total, take: safeTake, skip: safeSkip } });
}

async function getById(req, res) {
  const data = await getNotaById(parseId(req.params.id));
  if (!data) throw new HttpError(404, 'Nota no encontrada');
  res.json({ ok: true, data });
}

async function create(req, res) {
  const payload = parseBody(createNotaSchema, req.body);
  try {
    const data = await createNota(payload, parseId(req.userId, 'usuario'));
    res.status(201).json({ ok: true, data });
  } catch (error) {
    mapError(error);
  }
}

async function update(req, res) {
  const payload = parseBody(updateNotaSchema, req.body);
  try {
    const data = await updateNota(parseId(req.params.id), payload);
    res.json({ ok: true, data });
  } catch (error) {
    mapError(error);
  }
}

async function remove(req, res) {
  try {
    await deleteNota(parseId(req.params.id));
    res.status(204).send();
  } catch (error) {
    mapError(error);
  }
}

async function uploadFirmaRecibida(req, res) {
  if (!req.file) throw new HttpError(400, 'Debe adjuntar una imagen de firma');
  const data = await uploadNotaSignature(req.file, parseId(req.userId, 'usuario'));
  res.status(201).json({ ok: true, data });
}

async function getPdf(req, res) {
  const nota = await getNotaById(parseId(req.params.id));
  if (!nota) throw new HttpError(404, 'Nota no encontrada');
  const buffer = await buildNotaPdf(nota);
  const filename = `nota-${nota.numero || nota.idNota || 'entrega'}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.status(200).send(buffer);
}

async function downloadDraftPdf(req, res) {
  const payload = req.body || {};
  const buffer = await buildNotaPdf(payload);
  const filename = `nota-${payload.numero || 'entrega'}.pdf`;
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
  uploadFirmaRecibida,
  getPdf,
  downloadDraftPdf,
};
