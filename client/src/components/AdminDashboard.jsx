import { useEffect, useRef, useState } from 'react';
import { apiRequest, bookingStatusLabels, formatBookingStatus, formatPickupTime, formatRupees } from '../api.js';
import StatusTimeline from './StatusTimeline.jsx';

const statuses = Object.keys(bookingStatusLabels);
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

function BookingRow({ booking, onOpen }) {
  return (
    <article className="admin-booking-row">
      <div><strong>{booking.bookingReference}</strong><span>{booking.customer?.name || 'Customer'}</span></div>
      <div><span className="status-pill">{formatBookingStatus(booking.status)}</span><strong>{formatRupees(booking.estimatedTotal)}</strong></div>
      <button className="text-button" type="button" onClick={() => onOpen(booking._id)}>View order</button>
    </article>
  );
}

function AdminDashboard({ onNotify }) {
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, processing: 0, completed: 0 });
  const [recentBookings, setRecentBookings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [nextStatus, setNextStatus] = useState('');
  const [message, setMessage] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [busy, setBusy] = useState(false);
  const knownBookingIds = useRef(new Set());
  const initializedBookings = useRef(false);

  useEffect(() => {
    let current = true;
    apiRequest('/api/admin/dashboard')
      .then(data => {
        if (current) {
          setStats(data.stats);
          setRecentBookings(data.recentBookings);
          knownBookingIds.current = new Set(data.recentBookings.map(booking => booking._id));
          initializedBookings.current = true;
        }
      })
      .catch(error => { if (current) setMessage(error.message); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    async function checkForNewBookings() {
      try {
        const data = await apiRequest('/api/admin/dashboard');
        if (!current) return;
        const ids = new Set(data.recentBookings.map(booking => booking._id));
        if (initializedBookings.current) { const newest = data.recentBookings.find(booking => !knownBookingIds.current.has(booking._id)); if (newest) onNotify('New booking ' + newest.bookingReference + ' received.'); }
        else initializedBookings.current = true;
        knownBookingIds.current = ids; setStats(data.stats); setRecentBookings(data.recentBookings);
      } catch (error) { if (current) setMessage(error.message); }
    }
    const timer = window.setInterval(checkForNewBookings, 60_000);
    return () => { current = false; window.clearInterval(timer); };
  }, [onNotify]);

  useEffect(() => {
    let current = true;
    async function loadBookings() {
      setLoadingList(true);
      setMessage('');
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (statusFilter) query.set('status', statusFilter);
      try {
        const data = await apiRequest(`/api/admin/bookings?${query.toString()}`);
        if (current) setBookings(data.bookings);
      } catch (error) {
        if (current) setMessage(error.message);
      } finally {
        if (current) setLoadingList(false);
      }
    }
    loadBookings();
    return () => { current = false; };
  }, [search, statusFilter]);

  async function openBooking(bookingId) {
    setMessage('');
    try {
      const data = await apiRequest(`/api/admin/bookings/${bookingId}`);
      setSelected(data.booking);
      setNextStatus(permittedNextStatuses[data.booking.status]?.[0] || '');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshSummary() {
    try {
      const data = await apiRequest('/api/admin/dashboard');
      setStats(data.stats);
      setRecentBookings(data.recentBookings);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateStatus(event) {
    event.preventDefault();
    if (!selected || !nextStatus) return;

    setBusy(true);
    setMessage('');
    try {
      const data = await apiRequest(`/api/admin/bookings/${selected._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setSelected(data.booking);
      setNextStatus(permittedNextStatuses[data.booking.status]?.[0] || '');
      const statusMessage = `Booking ${data.booking.bookingReference} updated to ${formatBookingStatus(data.booking.status)}.`;
      setMessage(statusMessage);
      onNotify(statusMessage);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (statusFilter) query.set('status', statusFilter);
      const [listData, summaryData] = await Promise.all([
        apiRequest(`/api/admin/bookings?${query.toString()}`),
        apiRequest('/api/admin/dashboard'),
      ]);
      setBookings(listData.bookings);
      setStats(summaryData.stats);
      setRecentBookings(summaryData.recentBookings);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section admin-dashboard" id="admin-overview">
      <div className="section-heading"><div><p className="eyebrow">Overview</p><h2>Booking dashboard</h2></div></div>
      {message && <p className="message dashboard-message" role="status">{message}</p>}
      <div className="stats-grid">
        <article className="stat-card"><span>Total bookings</span><strong>{stats.total}</strong></article>
        <article className="stat-card"><span>Pending</span><strong>{stats.pending}</strong></article>
        <article className="stat-card"><span>Confirmed</span><strong>{stats.confirmed}</strong></article>
        <article className="stat-card"><span>Processing</span><strong>{stats.processing}</strong></article>
        <article className="stat-card"><span>Completed</span><strong>{stats.completed}</strong></article>
      </div>

      <div className="admin-subsection">
        <div className="section-heading"><div><p className="eyebrow">Latest activity</p><h3>Recent bookings</h3></div></div>
        {recentBookings.length === 0 ? <p className="empty-state">New bookings will appear here.</p> : <div className="admin-booking-list">{recentBookings.map(booking => <BookingRow key={booking._id} booking={booking} onOpen={openBooking} />)}</div>}
      </div>

      <div className="admin-subsection order-management" id="admin-orders">
        <div className="section-heading"><div><p className="eyebrow">Order management</p><h3>All bookings</h3><p className="section-description">Search by customer or reference, then open an order to update its status.</p></div></div>
        <form className="booking-filters" onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); }}>
          <label>Search reference or customer<input value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength="100" placeholder="Booking reference, name or email" /></label>
          <label>Filter by status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">All statuses</option>{statuses.map(status => <option key={status} value={status}>{bookingStatusLabels[status]}</option>)}</select></label>
          <button className="secondary-button" type="submit">Search</button>
        </form>
        {loadingList ? <p className="empty-state">Loading bookings…</p> : bookings.length === 0 ? <p className="empty-state">No bookings match these filters.</p> : <div className="admin-booking-list">{bookings.map(booking => <BookingRow key={booking._id} booking={booking} onOpen={openBooking} />)}</div>}
      </div>

      {selected && (
        <div className="admin-order-detail" aria-label="Booking details">
          <div className="section-heading"><div><p className="eyebrow">Booking details</p><h3>{selected.bookingReference}</h3></div><button className="text-button" type="button" onClick={() => setSelected(null)}>Close</button></div>
          <div className="order-detail-grid">
            <div><strong>Customer</strong><span>{selected.customer?.name || 'Unknown customer'}</span><a href={`mailto:${selected.customer?.email || ''}`}>{selected.customer?.email || 'No email saved'}</a></div>
            <div><strong>Pickup</strong><span>{formatPickupTime(selected.pickupAt)}</span><span>{selected.pickupAddress}</span></div>
            <div><strong>Delivery address</strong><span>{selected.deliveryAddress}</span></div>
            <div><strong>Created</strong><span>{formatPickupTime(selected.createdAt)}</span></div>
          </div>
          {selected.instructions && <p><strong>Customer instructions:</strong> {selected.instructions}</p>}
          <ul className="review-items">
            {selected.items.map(item => <li key={`${selected._id}-${item.service}`}><span>{item.serviceName} · {item.quantity} {item.pricingUnit === 'kg' ? 'kg' : 'item(s)'} @ {formatRupees(item.unitPrice)}</span><strong>{formatRupees(item.subtotal)}</strong></li>)}
          </ul>
          <div className="review-total"><span>Estimated total</span><strong>{formatRupees(selected.estimatedTotal)}</strong></div>
          <StatusTimeline booking={selected} />
          {permittedNextStatuses[selected.status]?.length > 0 ? (
            <form className="status-update-form" onSubmit={updateStatus}>
              <label>Move order to<select value={nextStatus} onChange={event => setNextStatus(event.target.value)} required>{permittedNextStatuses[selected.status].map(status => <option key={status} value={status}>{bookingStatusLabels[status]}</option>)}</select></label>
              <button className="primary-button" type="submit" disabled={busy || !nextStatus}>{busy ? 'Updating…' : 'Update status'}</button>
            </form>
          ) : <p className="empty-state">This order is in a final status and cannot move further.</p>}
        </div>
      )}
    </section>
  );
}

export default AdminDashboard;
