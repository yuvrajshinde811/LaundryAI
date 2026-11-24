import express from 'express';
import mongoose from 'mongoose';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import Service from '../models/Service.js';

const router = express.Router();
const validUnits = ['kg', 'item'];
const allowedFields = ['name', 'description', 'pricingUnit', 'price'];

router.use(authenticate, requireAdmin);

function validateServiceInput(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Provide service details as a JSON object.' };
  }

  const keys = Object.keys(body);
  if (keys.some(key => !allowedFields.includes(key))) {
    return { error: 'Only name, description, pricingUnit, and price can be changed.' };
  }
  if (partial && keys.length === 0) {
    return { error: 'Provide at least one service field to update.' };
  }

  const values = {};
  if (!partial || Object.hasOwn(body, 'name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2 || name.length > 100) return { error: 'Name must be between 2 and 100 characters.' };
    values.name = name;
  }
  if (!partial || Object.hasOwn(body, 'description')) {
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (description.length < 2 || description.length > 500) return { error: 'Description must be between 2 and 500 characters.' };
    values.description = description;
  }
  if (!partial || Object.hasOwn(body, 'pricingUnit')) {
    if (!validUnits.includes(body.pricingUnit)) return { error: 'pricingUnit must be kg or item.' };
    values.pricingUnit = body.pricingUnit;
  }
  if (!partial || Object.hasOwn(body, 'price')) {
    const price = body.price;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0.01 || price > 100000 || Math.round(price * 100) / 100 !== price) {
      return { error: 'Price must be a positive INR amount with at most two decimal places.' };
    }
    values.price = price;
  }

  return { values };
}

function validId(id) {
  return /^[a-f\d]{24}$/i.test(id);
}

router.get('/', async (_request, response, next) => {
  try {
    const services = await Service.find().sort({ name: 1 });
    return response.json({ services });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (request, response, next) => {
  try {
    const { values, error } = validateServiceInput(request.body);
    if (error) return response.status(400).json({ message: error });

    const service = await Service.create(values);
    return response.status(201).json({ message: 'Service created.', service });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ message: 'A service with that name already exists.' });
    return next(error);
  }
});

router.patch('/:id/activate', async (request, response, next) => {
  try {
    if (!validId(request.params.id)) return response.status(404).json({ message: 'Service not found.' });

    const service = await Service.findByIdAndUpdate(
      request.params.id,
      { isActive: true },
      { new: true },
    );
    if (!service) return response.status(404).json({ message: 'Service not found.' });
    return response.json({ message: 'Service activated.', service });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/deactivate', async (request, response, next) => {
  try {
    if (!validId(request.params.id)) return response.status(404).json({ message: 'Service not found.' });

    const service = await Service.findByIdAndUpdate(
      request.params.id,
      { isActive: false },
      { new: true },
    );
    if (!service) return response.status(404).json({ message: 'Service not found.' });
    return response.json({ message: 'Service deactivated.', service });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', async (request, response, next) => {
  try {
    if (!validId(request.params.id)) return response.status(404).json({ message: 'Service not found.' });

    const { values, error } = validateServiceInput(request.body, true);
    if (error) return response.status(400).json({ message: error });

    const service = await Service.findByIdAndUpdate(
      request.params.id,
      { $set: values },
      { new: true, runValidators: true },
    );
    if (!service) return response.status(404).json({ message: 'Service not found.' });
    return response.json({ message: 'Service updated.', service });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ message: 'A service with that name already exists.' });
    return next(error);
  }
});

export default router;


