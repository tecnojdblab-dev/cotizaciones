const express = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const { requireRoles } = require('../../middlewares/auth.middleware');
const controller = require('./certificados.controller');

const router = express.Router();
const canManageCertificados = requireRoles('administrador', 'vendedor');

router.get('/', asyncHandler(controller.list));
router.post('/pdf', asyncHandler(controller.downloadDraftPdf));
router.get('/:id/pdf', asyncHandler(controller.getPdf));
router.get('/:id', asyncHandler(controller.getById));
router.post('/', canManageCertificados, asyncHandler(controller.create));
router.put('/:id', canManageCertificados, asyncHandler(controller.update));
router.delete('/:id', canManageCertificados, asyncHandler(controller.remove));

module.exports = { router };
