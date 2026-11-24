export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, { ...options, headers });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'The request could not be completed.');
  }

  return data;
}

export const bookingStatusLabels = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  picked_up: 'Picked Up',
  processing: 'Processing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export function formatBookingStatus(status) {
  return bookingStatusLabels[status] || status;
}

export const formatRupees = amount => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(amount);

export function formatPickupTime(value) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}
