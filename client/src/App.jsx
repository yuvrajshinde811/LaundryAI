import { useEffect, useRef, useState } from 'react';
import AdminDashboard from './components/AdminDashboard.jsx';
import AdminServices from './components/AdminServices.jsx';
import BookingPanel from './components/BookingPanel.jsx';
import ChatAssistant from './components/ChatAssistant.jsx';
import CustomerBookings from './components/CustomerBookings.jsx';
import { apiRequest, formatBookingStatus, formatPickupTime } from './api.js';
import './App.css';

const emptyForm = { name: '', email: '', password: '' };

function CustomerOverview({ user, bookings }) {
  const activeBookings = bookings.filter(booking => !['delivered', 'rejected', 'cancelled'].includes(booking.status)).length;
  const pendingBookings = bookings.filter(booking => booking.status === 'pending').length;
  const completedBookings = bookings.filter(booking => booking.status === 'delivered').length;
  const latestUpdate = bookings.flatMap(booking => (booking.statusHistory || []).slice(1).map(entry => ({ ...entry, bookingReference: booking.bookingReference }))).sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))[0];
  return (
    <section className="customer-overview" id="customer-home">
      {latestUpdate && <div className="notification-banner" role="status"><div><p className="eyebrow">Latest order update</p><strong>{latestUpdate.bookingReference} - {formatBookingStatus(latestUpdate.status)}</strong></div><span>{formatPickupTime(latestUpdate.changedAt)}</span><a href="#customer-orders">View order history</a></div>}
      <div className="overview-copy">
        <p className="eyebrow">Your laundry, in good hands</p><h2>Welcome back, {user.name.split(' ')[0]}.</h2>
        <p>Book a pickup, keep an eye on your orders, and let us take care of laundry day.</p>
        <a className="primary-button overview-action" href="#customer-booking">Book a pickup</a>
      </div>
      <div className="customer-metrics" aria-label="Your booking summary">
        <article><span>Active orders</span><strong>{activeBookings}</strong></article><article><span>Awaiting confirmation</span><strong>{pendingBookings}</strong></article><article><span>Delivered</span><strong>{completedBookings}</strong></article>
      </div>
    </section>
  );
}
function CustomerProfile({ user, onProfileUpdated, onNotify }) {
  const [name, setName] = useState(user.name);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => setName(user.name), [user.name]);
  const createdDate = user.createdAt ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(user.createdAt)) : '-';

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const data = await apiRequest('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ name }) });
      onProfileUpdated(data.user);
      setEditing(false);
      setMessage('Profile updated.');
      onNotify('Profile updated.');
    } catch (error) {
      setMessage(error.message);
      onNotify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section profile-section" id="customer-profile">
      <div className="section-heading"><div><p className="eyebrow">Account</p><h2>Your profile</h2></div></div>
      <div className="profile-card"><div className="profile-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div><div className="profile-content">
        {!editing ? <><div className="profile-grid"><div><span>Name</span><strong>{user.name}</strong></div><div><span>Email address</span><strong>{user.email}</strong></div><div><span>Account type</span><strong>Customer</strong></div><div><span>Member since</span><strong>{createdDate}</strong></div></div><button className="secondary-button profile-edit-button" type="button" onClick={() => setEditing(true)}>Edit profile</button></> :
          <form className="profile-edit-form" onSubmit={saveProfile}><label>Full name<input value={name} onChange={event => setName(event.target.value)} minLength="2" maxLength="80" autoComplete="name" required /></label><p className="hint">Email address changes are unavailable until email verification is supported.</p>{message && <p className="message" role="status">{message}</p>}<div className="button-row"><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save profile'}</button><button className="secondary-button" type="button" onClick={() => { setName(user.name); setEditing(false); setMessage(''); }} disabled={busy}>Cancel</button></div></form>}
      </div></div>
    </section>
  );
}
function App() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(emptyForm);
  const [user, setUser] = useState(null);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState('');
  const [dashboardMessage, setDashboardMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notification, setNotification] = useState(null);
  const notificationTimer = useRef(null);
  const customerStatusRef = useRef(new Map());
  const customerStatusReady = useRef(false);
  useEffect(() => () => window.clearTimeout(notificationTimer.current), []);
  function showNotification(text, type = 'success') {
    window.clearTimeout(notificationTimer.current);
    setNotification({ text, type });
    notificationTimer.current = window.setTimeout(() => setNotification(null), 5000);
  }



  useEffect(() => {
    fetch('/api/auth/me')
      .then(async response => {
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      })
      .catch(() => setMessage('Could not reach the LaundryAI API.'));
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let current = true;

    async function loadDashboard() {
      setLoading(true);
      setDashboardMessage('');
      try {
        if (user.role === 'admin') {
          const data = await apiRequest('/api/admin/services');
          if (current) setServices(data.services);
        } else {
          const [serviceData, bookingData] = await Promise.all([
            apiRequest('/api/services'),
            apiRequest('/api/bookings/me'),
          ]);
          if (current) {
            setServices(serviceData.services);
            customerStatusRef.current = new Map(bookingData.bookings.map(booking => [booking._id, booking.status]));
            customerStatusReady.current = true;
            setBookings(bookingData.bookings);
          }
        }
      } catch (error) {
        if (current) setDashboardMessage(error.message);
      } finally {
        if (current) setLoading(false);
      }
    }

    loadDashboard();
    return () => { current = false; };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'customer') return undefined;
    let current = true;
    async function checkForStatusUpdates() {
      try {
        const data = await apiRequest('/api/bookings/me');
        if (!current) return;
        if (customerStatusReady.current) {
          for (const booking of data.bookings) {
            const previousStatus = customerStatusRef.current.get(booking._id);
            if (previousStatus && previousStatus !== booking.status) {
              showNotification(booking.bookingReference + ' is now ' + formatBookingStatus(booking.status) + '.');
            }
          }
        } else customerStatusReady.current = true;
        customerStatusRef.current = new Map(data.bookings.map(booking => [booking._id, booking.status]));
        setBookings(data.bookings);
      } catch (error) {
        if (current) setDashboardMessage(error.message);
      }
    }
    const timer = window.setInterval(checkForStatusUpdates, 60_000);
    return () => { current = false; window.clearInterval(timer); };
  }, [user]);

  function selectMode(nextMode) {
    setMode(nextMode);
    setForm(emptyForm);
    setMessage('');
  }

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const endpoint = mode === 'register'
      ? '/api/auth/register'
      : mode === 'admin'
        ? '/api/auth/admin/login'
        : '/api/auth/login';

    try {
      const data = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(form) });
      setUser(data.user);
      setForm(emptyForm);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setServices([]);
      setBookings([]);
      customerStatusRef.current = new Map();
      customerStatusReady.current = false;
      setMode('login');
      setMessage('You have signed out.');
    } catch (error) {
      setDashboardMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshServices() {
    try {
      const path = user.role === 'admin' ? '/api/admin/services' : '/api/services';
      const data = await apiRequest(path);
      setServices(data.services);
    } catch (error) {
      setDashboardMessage(error.message);
    }
  }

  function addBooking(booking) {
    setBookings(current => [booking, ...current]);
    showNotification('Booking ' + booking.bookingReference + ' was submitted.');
  }

  return user ? (
    <main className={`app-shell ${user.role === 'admin' ? 'admin-shell' : 'customer-shell'}`}>
      {notification && <div className={`app-notification ${notification.type}`} role={notification.type === 'error' ? 'alert' : 'status'}><span>{notification.text}</span><button type="button" onClick={() => setNotification(null)} aria-label="Dismiss notification">Dismiss</button></div>}
      <header className="app-header">
        <a className="brand-lockup" href={user.role === 'admin' ? '#admin-overview' : '#customer-home'} aria-label="LaundryAI home">
          <span className="brand-mark" aria-hidden="true">LA</span>
          <span><strong>LaundryAI</strong><small>Care made simple</small></span>
        </a>
        <div className="header-account">
          <div className="header-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="header-user-copy"><strong>{user.name}</strong><span>{user.role === 'admin' ? 'Administrator' : user.email}</span></div>
          <button className="secondary-button sign-out-button" type="button" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </header>

      <div className="workspace-heading">
        <p className="eyebrow">{user.role === 'admin' ? 'Operations' : 'Customer space'}</p>
        <h1>{user.role === 'admin' ? 'Admin workspace' : 'Your laundry dashboard'}</h1>
        <p>{user.role === 'admin' ? 'Manage orders and keep your service catalog up to date.' : 'Everything you need to plan and track laundry pickups.'}</p>
      </div>

      <nav className="workspace-nav" aria-label={user.role === 'admin' ? 'Admin navigation' : 'Customer navigation'}>
        {user.role === 'admin' ? (
          <><a href="#admin-overview">Overview</a><a href="#admin-orders">Orders</a><a href="#admin-services">Services</a></>
        ) : (
          <><a href="#customer-home">Home</a><a href="#customer-booking">Book a pickup</a><a href="#customer-assistant">Laundry chat</a><a href="#customer-orders">My orders</a><a href="#customer-profile">Profile</a></>
        )}
      </nav>

      {dashboardMessage && <p className="message" role="status">{dashboardMessage}</p>}
      {loading ? <div className="loading-panel" role="status"><span className="loading-spinner" />Loading your LaundryAI workspace…</div> : user.role === 'admin' ? (
        <>
          <AdminDashboard onNotify={showNotification} />
          <AdminServices services={services} onServicesChanged={refreshServices} onNotify={showNotification} />
        </>
      ) : (
        <>
          <CustomerOverview user={user} bookings={bookings} />
          <BookingPanel services={services} onBookingCreated={addBooking} />
          <ChatAssistant services={services} onBookingCreated={addBooking} />
          <CustomerBookings bookings={bookings} />
          <CustomerProfile user={user} onProfileUpdated={setUser} onNotify={showNotification} />
        </>
      )}
      <footer className="app-footer"><span>LaundryAI</span><span>Fresh care, thoughtfully managed.</span></footer>
    </main>
  ) : (
    <main className="auth-layout">
      <section className="auth-story">
        <a className="brand-lockup auth-brand" href="#sign-in" aria-label="LaundryAI home">
          <span className="brand-mark" aria-hidden="true">LA</span>
          <span><strong>LaundryAI</strong><small>Care made simple</small></span>
        </a>
        <div className="auth-story-copy">
          <p className="eyebrow">Laundry day, simplified</p>
          <h1>More time for the things you love.</h1>
          <p>Schedule a pickup, choose the care your clothes need, and follow every order from one calm, simple space.</p>
          <div className="story-points"><span><b>01</b> Choose trusted laundry services</span><span><b>02</b> Pick a time that works for you</span><span><b>03</b> Follow your order as it moves</span></div>
        </div>
        <span className="auth-decoration" aria-hidden="true">Laundry, off your list.</span>
      </section>
      <section className="auth-card" id="sign-in">
        <p className="eyebrow">Welcome to LaundryAI</p>
        <h2>{mode === 'register' ? 'Create your account' : mode === 'admin' ? 'Administrator sign in' : 'Sign in to continue'}</h2>
        <p className="intro">{mode === 'admin' ? 'Use your administrator account to manage your branch.' : mode === 'register' ? 'Create an account to book and track your laundry.' : 'Your next pickup is just a few steps away.'}</p>
        <div className="mode-switch" aria-label="Account actions">
          <button type="button" className={mode === 'login' ? 'selected' : ''} onClick={() => selectMode('login')}>Customer sign in</button>
          <button type="button" className={mode === 'register' ? 'selected' : ''} onClick={() => selectMode('register')}>Create account</button>
          <button type="button" className={mode === 'admin' ? 'selected' : ''} onClick={() => selectMode('admin')}>Admin</button>
        </div>
        <form onSubmit={submitAuth}>
          {mode === 'register' && <label>Name<input name="name" autoComplete="name" value={form.name} onChange={updateField} required minLength="2" maxLength="80" /></label>}
          <label>Email<input name="email" type="email" autoComplete="username" value={form.email} onChange={updateField} required maxLength="254" /></label>
          <label>Password<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={form.password} onChange={updateField} required minLength={mode === 'register' ? 8 : 1} maxLength="72" /></label>
          {message && <p className="message" role="status">{message}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="auth-footnote">Secure access for customers and laundry administrators.</p>
      </section>
    </main>
  );
}

export default App;

