import { useState } from 'react';
import { apiRequest, formatRupees } from '../api.js';

const blankForm = { name: '', description: '', pricingUnit: 'kg', price: '' };

function AdminServices({ services, onServicesChanged, onNotify }) {
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [busy, setBusy] = useState(false);

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  function startEditing(service) {
    setEditingId(service._id);
    setForm({
      name: service.name,
      description: service.description,
      pricingUnit: service.pricingUnit,
      price: String(service.price),
    });
    setMessage('');
    setMessageType('error');
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(blankForm);
    setMessage('');
    setMessageType('error');
  }

  async function saveService(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const payload = { ...form, price: Number(form.price) };

    try {
      await apiRequest(editingId ? `/api/admin/services/${editingId}` : '/api/admin/services', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      const successMessage = editingId ? 'Service updated.' : 'Service created.';
      cancelEditing();
      setMessage(successMessage);
      setMessageType('success');
      onNotify(successMessage);
      await onServicesChanged();
    } catch (error) {
      setMessage(error.message);
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  }

  async function deactivateService(service) {
    setBusy(true);
    setMessage('');
    try {
      await apiRequest(`/api/admin/services/${service._id}/deactivate`, { method: 'PATCH' });
      const successMessage = service.name + ' is now inactive.';
      setMessage(successMessage);
      setMessageType('success');
      onNotify(successMessage);
      await onServicesChanged();
    } catch (error) {
      setMessage(error.message);
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  }
  async function activateService(service) {
    setBusy(true); setMessage('');
    try { await apiRequest(`/api/admin/services/${service._id}/activate`, { method: 'PATCH' }); const successMessage = service.name + ' is now active.'; setMessage(successMessage); setMessageType('success'); onNotify(successMessage); await onServicesChanged(); }
    catch (error) { setMessage(error.message); setMessageType('error'); }
    finally { setBusy(false); }
  }

  return (
    <section className="page-section services-management" id="admin-services">
      <div className="section-heading">
        <div><p className="eyebrow">Catalog</p><h2>Manage laundry services</h2><p className="section-description">Keep the customer catalog clear, current, and ready for new orders.</p></div>
      </div>
      <form className="panel-form" onSubmit={saveService}>
        <h3>{editingId ? 'Update service' : 'Add a service'}</h3>
        <label>Service name<input name="name" value={form.name} onChange={updateField} minLength="2" maxLength="100" required /></label>
        <label>Description<textarea name="description" value={form.description} onChange={updateField} minLength="2" maxLength="500" rows="3" required /></label>
        <div className="form-row">
          <label>Pricing unit<select name="pricingUnit" value={form.pricingUnit} onChange={updateField}><option value="kg">Per kg</option><option value="item">Per item</option></select></label>
          <label>Price (₹)<input name="price" type="number" value={form.price} onChange={updateField} min="0.01" max="100000" step="0.01" required /></label>
        </div>
        {message && <p className={`message ${messageType === 'success' ? 'success-message' : ''}`} role="status">{message}</p>}
        <div className="button-row">
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create service'}</button>
          {editingId && <button className="secondary-button" type="button" onClick={cancelEditing}>Cancel</button>}
        </div>
      </form>
      <div className="service-grid">
        {services.map(service => (
          <article className={`service-card ${service.isActive ? '' : 'inactive'}`} key={service._id}>
            <div className="service-card-heading"><h3>{service.name}</h3><span className="status-pill">{service.isActive ? 'Active' : 'Inactive'}</span></div>
            <p>{service.description}</p>
            <strong>{formatRupees(service.price)} / {service.pricingUnit === 'kg' ? 'kg' : 'item'}</strong>
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => startEditing(service)}>Edit</button>
              {service.isActive ? <button className="text-button danger" type="button" disabled={busy} onClick={() => deactivateService(service)}>Deactivate</button> : <button className="secondary-button" type="button" disabled={busy} onClick={() => activateService(service)}>Activate</button>}
            </div>
          </article>
        ))}
        {services.length === 0 && <p className="empty-state">No services yet. Add one above.</p>}
      </div>
    </section>
  );
}

export default AdminServices;

