import { useEffect, useState } from 'react';
import { apiRequest, formatBookingStatus, formatPickupTime, formatRupees } from '../api.js';
import StatusTimeline from './StatusTimeline.jsx';

function CustomerBookings({ bookings }) {
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!selected) return;
    const latest = bookings.find(booking => booking._id === selected._id);
    if (latest && latest.status !== selected.status) setSelected(latest);
  }, [bookings, selected]);

  async function showDetails(bookingId) {
    setMessage('');
    try {
      const data = await apiRequest(`/api/bookings/${bookingId}`);
      setSelected(data.booking);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="page-section" id="customer-orders">
      <div className="section-heading"><div><p className="eyebrow">Order history</p><h2>Your bookings</h2><p className="section-description">Check the latest update or open an order for its full progress timeline.</p></div><span className="section-count">{bookings.length} total</span></div>
      {message && <p className="message" role="status">{message}</p>}
      {bookings.length === 0 ? <p className="empty-state">Your bookings will appear here.</p> : (
        <div className="booking-list">
          {bookings.map(booking => {
            const latestUpdate = booking.statusHistory?.at(-1)?.changedAt || booking.createdAt;
            return (
              <article className="booking-row" key={booking._id}>
                <div><strong>{booking.bookingReference}</strong><span>{formatPickupTime(booking.pickupAt)}</span></div>
                <div><span className="status-pill">{formatBookingStatus(booking.status)}</span><strong>{formatRupees(booking.estimatedTotal)}</strong><small>Updated {formatPickupTime(latestUpdate)}</small></div>
                <button className="text-button" type="button" onClick={() => showDetails(booking._id)}>View details</button>
              </article>
            );
          })}
        </div>
      )}
      {selected && (
        <div className="detail-card">
          <div className="section-heading"><h3>{selected.bookingReference}</h3><button className="text-button" type="button" onClick={() => setSelected(null)}>Close</button></div>
          <StatusTimeline booking={selected} />
          <p><strong>Pickup:</strong> {formatPickupTime(selected.pickupAt)}</p>
          <p><strong>Pickup address:</strong> {selected.pickupAddress}</p>
          <p><strong>Delivery address:</strong> {selected.deliveryAddress}</p>
          {selected.instructions && <p><strong>Instructions:</strong> {selected.instructions}</p>}
          <ul className="review-items">
            {selected.items.map(item => <li key={`${selected._id}-${item.service}`}><span>{item.serviceName} · {item.quantity} {item.pricingUnit === 'kg' ? 'kg' : 'item(s)'} @ {formatRupees(item.unitPrice)}</span><strong>{formatRupees(item.subtotal)}</strong></li>)}
          </ul>
          <div className="review-total"><span>Estimated total</span><strong>{formatRupees(selected.estimatedTotal)}</strong></div>
          <small>Created {formatPickupTime(selected.createdAt)}</small>
        </div>
      )}
    </section>
  );
}

export default CustomerBookings;
