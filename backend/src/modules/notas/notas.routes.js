const express = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const { requireRoles } = require('../../middlewares/auth.middleware');
const { uploadSingle } = require('../../middlewares/uploadMiddleware');
const controller = require('./notas.controller');

const router = express.Router();
const canManageNotas = requireRoles('administrador', 'vendedor');

router.get('/', asyncHandler(controller.list));
router.post('/pdf', asyncHandler(controller.downloadDraftPdf));
router.get('/:id/pdf', asyncHandler(controller.getPdf));
router.get('/:id', asyncHandler(controller.getById));
router.post('/firma-recibida', canManageNotas, uploadSingle('file'), asyncHandler(controller.uploadFirmaRecibida));
router.post('/', canManageNotas, asyncHandler(controller.create));
router.put('/:id', canManageNotas, asyncHandler(controller.update));
router.delete('/:id', canManageNotas, asyncHandler(controller.remove));

module.exports = { router };
