const express = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const { requireRoles } = require('../../middlewares/auth.middleware');
const controller = require('./cartas.controller');

const router = express.Router();
const canManageCartas = requireRoles('administrador', 'vendedor');

router.get('/', asyncHandler(controller.list));
router.post('/pdf', asyncHandler(controller.downloadDraftPdf));
router.get('/:id/pdf', asyncHandler(controller.getPdf));
router.get('/:id', asyncHandler(controller.getById));
router.post('/', canManageCartas, asyncHandler(controller.create));
router.put('/:id', canManageCartas, asyncHandler(controller.update));
router.delete('/:id', canManageCartas, asyncHandler(controller.remove));

module.exports = { router };
