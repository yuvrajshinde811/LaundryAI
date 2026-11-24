import express from 'express';
import Service from '../models/Service.js';

const router = express.Router();

router.get('/', async (_request, response, next) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ name: 1 });
    return response.json({ services });
  } catch (error) {
    return next(error);
  }
});

export default router;
