import { useMemo, useState } from 'react';
import { apiRequest, formatRupees } from '../api.js';

function localDateTimeMinimum() {
  const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000);
  return localNow.toISOString().slice(0, 16);
}

function BookingPanel({ services, onBookingCreated }) {
  const [quantities, setQuantities] = useState({});
  const [pickupAt, setPickupAt] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [instructions, setInstructions] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [busy, setBusy] = useState(false);

  const selectedServices = services.filter(service => Object.hasOwn(quantities, service._id));
  const estimatedTotal = useMemo(() => selectedServices.reduce((total, service) => {
    const quantity = Number(quantities[service._id]);
    return total + (Number.isFinite(quantity) ? service.price * quantity : 0);
  }, 0), [selectedServices, quantities]);

  function toggleService(service, checked) {
    setQuantities(current => {
      const next = { ...current };
      if (checked) next[service._id] = '1';
      else delete next[service._id];
      return next;
    });
  }

  function updateQuantity(serviceId, value) {
    setQuantities(current => ({ ...current, [serviceId]: value }));
  }

  function reviewBooking(event) {
    event.preventDefault();
    if (selectedServices.length === 0) {
      setMessage('Select at least one service to continue.');
      setMessageType('error');
      return;
    }
    const formData = new FormData(event.currentTarget);
    setPickupAt(String(formData.get('pickupAt') || pickupAt));
    setPickupAddress(String(formData.get('pickupAddress') || pickupAddress));
    setDeliveryAddress(String(formData.get('deliveryAddress') || deliveryAddress));
    setInstructions(String(formData.get('instructions') || instructions));
    setMessage('');
    setReviewing(true);
  }

  async function submitBooking() {
    setBusy(true);
    setMessage('');
    const payload = {
      services: selectedServices.map(service => ({
        serviceId: service._id,
        quantity: Number(quantities[service._id]),
      })),
      pickupAt,
      pickupAddress,
      deliveryAddress,
      instructions,
    };

    try {
      const data = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onBookingCreated(data.booking);
      setMessage(`Booking ${data.booking.bookingReference} was submitted.`);
      setMessageType('success');
      setQuantities({});
      setPickupAt('');
      setPickupAddress('');
      setDeliveryAddress('');
      setInstructions('');
      setReviewing(false);
    } catch (error) {
      setMessage(error.message);
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section booking-section" id="customer-booking">
      <div className="section-heading"><div><p className="eyebrow">Services</p><h2>Book a laundry pickup</h2><p className="section-description">Choose the care you need and we’ll help arrange a convenient collection.</p></div></div>
      {services.length === 0 ? <p className="empty-state">There are no active laundry services right now.</p> : reviewing ? (
        <div className="booking-review">
          <h3>Review your booking</h3>
          <ul className="review-items">
            {selectedServices.map(service => {
              const quantity = Number(quantities[service._id]);
              return <li key={service._id}><span>{service.name} · {quantity} {service.pricingUnit === 'kg' ? 'kg' : 'item(s)'}</span><strong>{formatRupees(service.price * quantity)}</strong></li>;
            })}
          </ul>
          <div className="review-total"><span>Estimated total</span><strong>{formatRupees(estimatedTotal)}</strong></div>
          <dl className="review-details">
            <div><dt>Pickup</dt><dd>{pickupAt.replace('T', ' ')} IST</dd></div>
            <div><dt>Pickup address</dt><dd>{pickupAddress}</dd></div>
            <div><dt>Delivery address</dt><dd>{deliveryAddress}</dd></div>
            {instructions && <div><dt>Instructions</dt><dd>{instructions}</dd></div>}
          </dl>
          <p className="hint">The server checks current prices and calculates the final estimate when you confirm.</p>
          {message && <p className="message" role="status">{message}</p>}
          <div className="button-row">
            <button className="primary-button" type="button" disabled={busy} onClick={submitBooking}>{busy ? 'Submitting…' : 'Confirm booking'}</button>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => setReviewing(false)}>Edit details</button>
          </div>
        </div>
      ) : (
        <form className="booking-form" onSubmit={reviewBooking}>
          <h3>Choose your services</h3>
          <div className="service-grid">
            {services.map(service => (
              <article className={`service-card ${Object.hasOwn(quantities, service._id) ? 'selected' : ''}`} key={service._id}>
                <label className="service-select">
                  <input type="checkbox" checked={Object.hasOwn(quantities, service._id)} onChange={event => toggleService(service, event.target.checked)} />
                  <span><strong>{service.name}</strong><small>{formatRupees(service.price)} / {service.pricingUnit === 'kg' ? 'kg' : 'item'}</small></span>
                </label>
                <p>{service.description}</p>
                {Object.hasOwn(quantities, service._id) && <label>Quantity ({service.pricingUnit === 'kg' ? 'kg' : 'items'})<input type="number" min="0.01" max="1000" step={service.pricingUnit === 'kg' ? '0.01' : '1'} value={quantities[service._id]} onChange={event => updateQuantity(service._id, event.target.value)} required /></label>}
              </article>
            ))}
          </div>
          <div className="form-row">
            <label>Pickup date and time (IST)<input name="pickupAt" type="datetime-local" value={pickupAt} min={localDateTimeMinimum()} onChange={event => setPickupAt(event.target.value)} required /></label>
          </div>
          <div className="form-row">
            <label>Pickup address<textarea name="pickupAddress" value={pickupAddress} onChange={event => setPickupAddress(event.target.value)} minLength="5" maxLength="300" rows="2" required /></label>
            <label>Delivery address<textarea name="deliveryAddress" value={deliveryAddress} onChange={event => setDeliveryAddress(event.target.value)} minLength="5" maxLength="300" rows="2" required /></label>
          </div>
          <label>Optional instructions<textarea name="instructions" value={instructions} onChange={event => setInstructions(event.target.value)} maxLength="500" rows="2" placeholder="Any details for the pickup?" /></label>
          <div className="estimate-row"><span>Current estimate</span><strong>{formatRupees(estimatedTotal)}</strong></div>
          <button className="primary-button" type="submit">Review booking</button>
        </form>
      )}
      {message && !reviewing && services.length > 0 && <p className={`message booking-message ${messageType === 'success' ? 'success-message' : ''}`} role="status">{message}</p>}
    </section>
  );
}

export default BookingPanel;

