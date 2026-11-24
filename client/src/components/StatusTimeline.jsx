import { formatBookingStatus, formatPickupTime } from '../api.js';

function StatusTimeline({ booking }) {
  const history = Array.isArray(booking.statusHistory) && booking.statusHistory.length > 0
    ? booking.statusHistory
    : [{ status: booking.status, changedAt: booking.createdAt, adminId: null }];

  return (
    <section className="status-timeline-card" aria-label="Order progress">
      <div className="timeline-heading">
        <div><p className="eyebrow">Order progress</p><h3>Latest status: {formatBookingStatus(booking.status)}</h3></div>
        <span className="status-pill">{formatBookingStatus(booking.status)}</span>
      </div>
      <ol className="status-timeline">
        {history.map((entry, index) => (
          <li className={index === history.length - 1 ? 'current' : 'complete'} key={`${entry.status}-${entry.changedAt}`}>
            <div className="timeline-event">
              <strong>{formatBookingStatus(entry.status)}</strong>
              <time dateTime={new Date(entry.changedAt).toISOString()}>{formatPickupTime(entry.changedAt)}</time>
              <small>{entry.adminId?.name ? `Updated by ${entry.adminId.name}` : entry.status === 'pending' ? 'Booking created' : 'Status update recorded'}</small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default StatusTimeline;
