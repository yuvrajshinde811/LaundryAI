import express from 'express';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const statuses = ['pending', 'confirmed', 'picked_up', 'processing', 'ready', 'out_for_delivery', 'delivered', 'rejected', 'cancelled'];
const permittedNextStatuses = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['picked_up', 'cancelled'],
  picked_up: ['processing'],
  processing: ['ready'],
  ready: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  rejected: [],
  cancelled: [],
};

router.use(authenticate, requireAdmin);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validBookingId(id) {
  return /^[a-f\d]{24}$/i.test(id);
}

function populateBooking(query) {
  return query
    .populate('customer', 'name email')
    .populate('statusHistory.adminId', 'name');
}

router.get('/me', (request, response) => {
  response.json({
    user: {
      id: request.user.id,
      name: request.user.name,
      email: request.user.email,
      role: request.user.role,
      createdAt: request.user.createdAt,
    },
  });
});

router.get('/dashboard', async (_request, response, next) => {
  try {
    const [summary] = await Booking.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
          processing: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        },
      },
    ]);
    const recentBookings = await populateBooking(Booking.find()).sort({ createdAt: -1 }).limit(8);

    return response.json({
      stats: summary
        ? { total: summary.total, pending: summary.pending, confirmed: summary.confirmed, processing: summary.processing, completed: summary.completed }
        : { total: 0, pending: 0, confirmed: 0, processing: 0, completed: 0 },
      recentBookings,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/bookings', async (request, response, next) => {
  try {
    const status = typeof request.query.status === 'string' ? request.query.status : '';
    const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';

    if (status && !statuses.includes(status)) {
      return response.status(400).json({ message: 'Choose a valid booking status filter.' });
    }
    if (search.length > 100) {
      return response.status(400).json({ message: 'Search text must be 100 characters or fewer.' });
    }

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const searchPattern = new RegExp(escapeRegex(search), 'i');
      const matchingCustomers = await User.find({ $or: [{ name: searchPattern }, { email: searchPattern }] })
        .select('_id')
        .limit(100);
      filter.$or = [
        { bookingReference: searchPattern },
        { customer: { $in: matchingCustomers.map(customer => customer._id) } },
      ];
    }

    const bookings = await populateBooking(Booking.find(filter)).sort({ createdAt: -1 });
    return response.json({ bookings });
  } catch (error) {
    return next(error);
  }
});

router.get('/bookings/:id', async (request, response, next) => {
  try {
    if (!validBookingId(request.params.id)) return response.status(404).json({ message: 'Booking not found.' });

    const booking = await populateBooking(Booking.findById(request.params.id));
    if (!booking) return response.status(404).json({ message: 'Booking not found.' });
    return response.json({ booking });
  } catch (error) {
    return next(error);
  }
});

router.patch('/bookings/:id/status', async (request, response, next) => {
  try {
    if (!validBookingId(request.params.id)) return response.status(404).json({ message: 'Booking not found.' });

    const body = request.body ?? {};
    if (Object.keys(body).some(key => key !== 'status') || typeof body.status !== 'string' || !statuses.includes(body.status)) {
      return response.status(400).json({ message: 'Provide one valid booking status.' });
    }

    const booking = await Booking.findById(request.params.id);
    if (!booking) return response.status(404).json({ message: 'Booking not found.' });

    if (!permittedNextStatuses[booking.status]?.includes(body.status)) {
      return response.status(409).json({ message: `A booking cannot move from ${booking.status} to ${body.status}.` });
    }

    const historyEntries = [];
    if (booking.statusHistory.length === 0) {
      historyEntries.push({ status: booking.status, changedAt: booking.createdAt, adminId: null });
    }
    historyEntries.push({ status: body.status, changedAt: new Date(), adminId: request.user._id });

    const updatedBooking = await populateBooking(Booking.findOneAndUpdate(
      { _id: booking._id, status: booking.status },
      {
        $set: { status: body.status },
        $push: { statusHistory: { $each: historyEntries } },
      },
      { new: true, runValidators: true },
    ));

    if (!updatedBooking) {
      return response.status(409).json({ message: 'The booking changed while you were updating it. Reload and try again.' });
    }

    return response.json({ message: 'Booking status updated.', booking: updatedBooking });
  } catch (error) {
    return next(error);
  }
});

export default router;

