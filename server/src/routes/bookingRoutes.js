import { randomBytes } from 'node:crypto';
import express from 'express';
import Booking from '../models/Booking.js';
import Service from '../models/Service.js';
import { authenticate, requireCustomer } from '../middleware/auth.js';

const router = express.Router();
const localOffsetMinutes = 5 * 60 + 30;
const roundMoney = amount => Math.round((amount + Number.EPSILON) * 100) / 100;

function parsePickupAt(value) {
  if (typeof value !== 'string') return null;
  const match = /^(20\d{2})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
    return null;
  }

  const pickupAt = new Date(Date.UTC(year, month - 1, day, hour, minute) - localOffsetMinutes * 60 * 1000);
  return pickupAt.getTime() > Date.now() ? pickupAt : null;
}

function validAddress(value) {
  return typeof value === 'string' && value.trim().length >= 5 && value.trim().length <= 300;
}

function validQuantity(quantity, pricingUnit) {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) return false;
  if (pricingUnit === 'item') return Number.isInteger(quantity);
  return Math.round(quantity * 100) / 100 === quantity;
}

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomBytes(8).toString('hex').toUpperCase();
  return `LAI-${date}-${suffix}`;
}

router.use(authenticate, requireCustomer);

router.post('/', async (request, response, next) => {
  try {
    const body = request.body ?? {};
    const pickupAt = parsePickupAt(body.pickupAt);
    const pickupAddress = typeof body.pickupAddress === 'string' ? body.pickupAddress.trim() : '';
    const deliveryAddress = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : '';
    const instructions = body.instructions === undefined ? '' : body.instructions;

    if (!pickupAt) {
      return response.status(400).json({ message: 'Choose a valid future pickup date and time in IST.' });
    }
    if (!validAddress(pickupAddress) || !validAddress(deliveryAddress)) {
      return response.status(400).json({ message: 'Pickup and delivery addresses must be between 5 and 300 characters.' });
    }
    if (typeof instructions !== 'string' || instructions.trim().length > 500) {
      return response.status(400).json({ message: 'Instructions must be 500 characters or fewer.' });
    }
    if (!Array.isArray(body.services) || body.services.length < 1 || body.services.length > 20) {
      return response.status(400).json({ message: 'Select between 1 and 20 services.' });
    }

    const requestedItems = body.services;
    const serviceIds = [];
    for (const item of requestedItems) {
      if (!item || typeof item.serviceId !== 'string' || !/^[a-f\d]{24}$/i.test(item.serviceId)) {
        return response.status(400).json({ message: 'One or more service IDs are invalid.' });
      }
      if (!validQuantity(item.quantity, 'kg') && !validQuantity(item.quantity, 'item')) {
        return response.status(400).json({ message: 'Each quantity must be a positive number no greater than 1,000.' });
      }
      serviceIds.push(item.serviceId.toLowerCase());
    }

    if (new Set(serviceIds).size !== serviceIds.length) {
      return response.status(400).json({ message: 'Select each service only once.' });
    }

    const services = await Service.find({ _id: { $in: serviceIds }, isActive: true });
    if (services.length !== serviceIds.length) {
      return response.status(400).json({ message: 'One or more selected services are invalid or unavailable.' });
    }

    const serviceById = new Map(services.map(service => [service.id, service]));
    const items = [];
    for (const requested of requestedItems) {
      const service = serviceById.get(requested.serviceId.toLowerCase());
      if (!validQuantity(requested.quantity, service.pricingUnit)) {
        return response.status(400).json({
          message: service.pricingUnit === 'item'
            ? `${service.name} quantity must be a whole number.`
            : `${service.name} quantity must use at most two decimal places.`,
        });
      }

      const subtotal = roundMoney(service.price * requested.quantity);
      items.push({
        service: service._id,
        serviceName: service.name,
        pricingUnit: service.pricingUnit,
        quantity: requested.quantity,
        unitPrice: service.price,
        subtotal,
      });
    }

    const estimatedTotal = roundMoney(items.reduce((total, item) => total + item.subtotal, 0));
    const booking = await Booking.create({
      bookingReference: createReference(),
      customer: request.user._id,
      items,
      pickupAt,
      pickupAddress,
      deliveryAddress,
      instructions: instructions.trim(),
      estimatedTotal,
      status: 'pending',
      statusHistory: [{ status: 'pending', changedAt: new Date(), adminId: null }],
    });

    return response.status(201).json({ message: 'Booking created.', booking });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', async (request, response, next) => {
  try {
    const bookings = await Booking.find({ customer: request.user._id })
      .populate('statusHistory.adminId', 'name')
      .sort({ createdAt: -1 });
    return response.json({ bookings });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (request, response, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(request.params.id)) {
      return response.status(404).json({ message: 'Booking not found.' });
    }

    const booking = await Booking.findOne({ _id: request.params.id, customer: request.user._id })
      .populate('statusHistory.adminId', 'name');
    if (!booking) return response.status(404).json({ message: 'Booking not found.' });
    return response.json({ booking });
  } catch (error) {
    return next(error);
  }
});

export default router;



