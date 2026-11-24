import { useEffect, useRef, useState } from 'react';
import { apiRequest, bookingStatusLabels, formatRupees } from '../api.js';
import StatusTimeline from './StatusTimeline.jsx';

const initialMessage = {
  id: 1,
  role: 'assistant',
  text: 'Hi! I can explain laundry services, help prepare a pickup booking, check a booking status, or answer basic garment-care questions.',
};

function indiaDateTimeMinimum() {
  const indiaNow = new Date(Date.now() + 330 * 60 * 1000);
  return indiaNow.toISOString().slice(0, 16);
}

function ChatAssistant({ services, onBookingCreated }) {
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState('');
  const [flow, setFlow] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pickupAt, setPickupAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const recognitionRef = useRef(null);
  const messageId = useRef(1);

  const speechSupported = typeof window !== 'undefined' && Boolean(window.speechSynthesis);
  const voiceInputSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => () => { recognitionRef.current?.stop(); if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel(); }, []);

  function addMessage(role, text, extra = {}) {
    const message = { id: ++messageId.current, role, text, ...extra };
    setMessages(current => [...current, message]);
    if (role === 'assistant' && voiceOutput && speechSupported) {
      try { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-IN'; window.speechSynthesis.speak(utterance); } catch { setVoiceMessage('Speech output is unavailable. You can continue reading the response.'); }
    }
    return message;
  }

  function listServices() {
    if (!services.length) return 'There are no active services in the catalog right now. Please check again later.';
    return `Available services (prices are read from the current catalog):\n${services.map(service => `• ${service.name}: ${formatRupees(service.price)} per ${service.pricingUnit === 'kg' ? 'kg' : 'item'} — ${service.description}`).join('\n')}`;
  }

  function startBooking() {
    if (!services.length) {
      addMessage('assistant', 'I cannot prepare a booking because there are no active services available right now.');
      return;
    }
    setDraft(null);
    setPickupAt('');
    setFlow({ step: 'service', items: [] });
    addMessage('assistant', `Let's prepare your pickup. Choose service number(s), separated by commas, or type service name(s):\n${services.map((service, index) => `${index + 1}. ${service.name} (${formatRupees(service.price)} / ${service.pricingUnit === 'kg' ? 'kg' : 'item'})`).join('\n')}`);
  }

  async function checkBooking(reference) {
    try {
      const data = await apiRequest('/api/bookings/me');
      const booking = data.bookings.find(item => item.bookingReference.toLowerCase() === reference.trim().toLowerCase());
      if (!booking) {
        addMessage('assistant', `I could not find booking “${reference}” in your account. Check the reference and try again.`);
        return;
      }
      addMessage('assistant', `Booking ${booking.bookingReference} is currently ${bookingStatusLabels[booking.status] || booking.status}. The status below comes from your saved booking.`, { booking });
    } catch (error) {
      addMessage('assistant', error.message);
    }
  }

  function answerQuestion(text) {
    const question = text.toLowerCase().trim();

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(question)) {
      return 'Hello! I can help with service prices, pickup bookings, order status, or basic garment-care questions.';
    }
    if (/(help me book|book (a )?pickup|book my|book laundry|make (a )?booking|schedule (a )?pickup|start (a )?booking)/.test(question)) {
      startBooking();
      return null;
    }
    if (/\b(help|what can you do|how does this work)\b/.test(question)) {
      return 'I can show current services and prices, prepare a pickup booking for your review, look up a booking in your account, and share basic garment-care guidance.';
    }
    if (/\b(status|track|tracking|where is|progress)\b|\bcheck\b.*\b(booking|order)\b/.test(question)) {
      setFlow({ step: 'reference' });
      return 'Please enter the booking reference shown in your order history. I only look up bookings in your account.';
    }
    if (/\b(service|services|price|prices|cost|catalog|rate|rates)\b/.test(question)) {
      return listServices();
    }
    if (/\b(payment|pay|online payment|cash)\b/.test(question)) {
      return 'Online payment is not available in this version. Your booking shows an estimate from the current service catalog; contact the laundry team for payment arrangements.';
    }
    if (/\b(delivery time|turnaround|how long|ready by)\b/.test(question)) {
      return 'Turnaround time depends on the service and current workload. The laundry team can confirm an expected delivery time after reviewing your order.';
    }
    if (/\b(cancel|cancellation|change my order)\b/.test(question)) {
      return 'I cannot change or cancel a submitted order here. Open your order history and contact the laundry team with your booking reference.';
    }
    if (/\b(profile|change my name|account details)\b/.test(question)) {
      return 'You can update your name in the Profile section. Email address changes are not currently supported.';
    }
    if (/\b(stain|stains|care|wash|washing|fabric|garment|iron|dry)\b/.test(question)) {
      return 'Follow the garment care label. Avoid applying heat to an untreated stain, and mention stains or special handling in your booking instructions so the laundry team can assess the item.';
    }
    if (/\b(pickup|pick up|collect|collection|schedule)\b/.test(question)) {
      return 'I can help prepare a pickup booking. You will review all details and explicitly confirm before anything is submitted.';
    }
    if (/\b(thanks|thank you)\b/.test(question)) {
      return 'You are welcome. Let me know if you need help with a service, booking, or order update.';
    }
    return 'I could not match that question to the available help topics. Try: show prices, help me book, check my order, or garment care.';
  }
  function processBookingAnswer(text) {
    const answer = text.trim();
    if (/^(stop|never mind|nevermind|discard)$/i.test(answer)) {
      setFlow(null);
      setDraft(null);
      addMessage('assistant', 'Booking preparation stopped. Nothing was submitted.');
      return;
    }
    if (flow.step === 'reference') {
      setFlow(null);
      void checkBooking(answer);
      return;
    }
    if (flow.step === 'service') {
      const parts = answer.split(',').map(part => part.trim()).filter(Boolean);
      const selected = parts.map(part => {
        const number = Number(part);
        if (Number.isInteger(number) && number >= 1 && number <= services.length) return services[number - 1];
        const normalized = part.toLowerCase();
        return services.find(service => service.name.toLowerCase() === normalized)
          || services.find(service => service.name.toLowerCase().includes(normalized));
      });
      if (!selected.length || selected.some(service => !service) || new Set(selected.map(service => service._id)).size !== selected.length) {
        addMessage('assistant', 'I could not match that selection. Enter the service number(s) or exact name(s), separated by commas.');
        return;
      }
      setFlow({ step: 'quantity', items: selected.map(service => ({ service, quantity: null })), index: 0 });
      const service = selected[0];
      addMessage('assistant', `How much ${service.name} would you like? Enter a quantity in ${service.pricingUnit === 'kg' ? 'kg (up to two decimal places)' : 'whole items'}.`);
      return;
    }
    if (flow.step === 'quantity') {
      const quantity = Number(answer);
      const currentItem = flow.items[flow.index];
      const isValid = Number.isFinite(quantity) && quantity > 0 && quantity <= 1000
        && (currentItem.service.pricingUnit === 'item' ? Number.isInteger(quantity) : Math.round(quantity * 100) / 100 === quantity);
      if (!isValid) {
        addMessage('assistant', currentItem.service.pricingUnit === 'item'
          ? 'Enter a whole item quantity greater than 0 and no more than 1,000.'
          : 'Enter a quantity greater than 0 and no more than 1,000, with at most two decimal places.');
        return;
      }
      const items = flow.items.map((item, index) => index === flow.index ? { ...item, quantity } : item);
      const nextIndex = flow.index + 1;
      if (nextIndex < items.length) {
        setFlow({ ...flow, items, index: nextIndex });
        const nextService = items[nextIndex].service;
        addMessage('assistant', `How much ${nextService.name} would you like? Enter a quantity in ${nextService.pricingUnit === 'kg' ? 'kg' : 'whole items'}.`);
      } else {
        setFlow({ step: 'pickupAt', items });
        addMessage('assistant', 'Choose a future pickup date and time in Indian Standard Time (IST).');
      }
      return;
    }
    if (flow.step === 'pickupAddress') {
      if (answer.length < 5 || answer.length > 300) {
        addMessage('assistant', 'Please enter a pickup address between 5 and 300 characters.');
        return;
      }
      setDraft(current => ({ ...current, pickupAddress: answer }));
      setFlow({ ...flow, step: 'deliveryAddress' });
      addMessage('assistant', 'What is the delivery address?');
      return;
    }
    if (flow.step === 'deliveryAddress') {
      if (answer.length < 5 || answer.length > 300) {
        addMessage('assistant', 'Please enter a delivery address between 5 and 300 characters.');
        return;
      }
      setDraft(current => ({ ...current, deliveryAddress: answer }));
      setFlow({ ...flow, step: 'instructions' });
      addMessage('assistant', 'Any special instructions? Enter them now, or type “skip”.');
      return;
    }
    if (flow.step === 'instructions') {
      if (answer.length > 500) {
        addMessage('assistant', 'Instructions must be 500 characters or fewer. Please shorten them or type “skip”.');
        return;
      }
      const nextDraft = { ...draft, instructions: /^skip$/i.test(answer) ? '' : answer };
      setDraft(nextDraft);
      setFlow({ ...flow, step: 'review' });
      const total = Math.round((nextDraft.items.reduce((sum, item) => sum + item.service.price * item.quantity, 0) + Number.EPSILON) * 100) / 100;
      addMessage('assistant', 'Please review the complete booking below. A booking is created only if you press “Confirm booking”.', { review: true, total });
    }
  }

  function sendMessage(rawText = input) {
    const text = rawText.trim();
    if (!text || busy) return;
    setInput('');
    addMessage('customer', text);
    if (flow) {
      processBookingAnswer(text);
      return;
    }
    const response = answerQuestion(text);
    if (response) addMessage('assistant', response);
  }

  function submitPickupTime(event) {
    event.preventDefault();
    const selectedTime = event.currentTarget.elements.namedItem('pickupAt')?.value || pickupAt;
    if (!selectedTime) return;
    addMessage('customer', `${selectedTime.replace('T', ' ')} IST`);
    setDraft({ items: flow.items, pickupAt: selectedTime, pickupAddress: '', deliveryAddress: '', instructions: '' });
    setPickupAt('');
    setFlow({ ...flow, step: 'pickupAddress' });
    addMessage('assistant', 'What is the pickup address?');
  }

  async function confirmBooking() {
    if (!draft || busy) return;
    setBusy(true);
    try {
      const data = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          services: draft.items.map(item => ({ serviceId: item.service._id, quantity: item.quantity })),
          pickupAt: draft.pickupAt,
          pickupAddress: draft.pickupAddress,
          deliveryAddress: draft.deliveryAddress,
          instructions: draft.instructions,
        }),
      });
      onBookingCreated(data.booking);
      addMessage('assistant', `Your booking ${data.booking.bookingReference} was submitted successfully. Its current status is ${bookingStatusLabels[data.booking.status] || data.booking.status}.`);
      setFlow(null);
      setDraft(null);
    } catch (error) {
      addMessage('assistant', `The booking could not be submitted: ${error.message} Please review your details and try again.`);
    } finally {
      setBusy(false);
    }
  }

  function startVoiceInput() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setVoiceMessage('Voice input is not supported by this browser. You can type your message instead.'); return; }
    try {
      const recognition = new Recognition(); recognition.lang = 'en-IN'; recognition.interimResults = false;
      recognition.onstart = () => setVoiceMessage('Listening...');
      recognition.onresult = event => { const transcript = event.results?.[0]?.[0]?.transcript?.trim(); setVoiceMessage(''); if (transcript) sendMessage(transcript); else setVoiceMessage('No speech was detected. Try again or type your message.'); };
      recognition.onerror = event => { const message = event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'Microphone access was denied. Allow microphone access or type your message.' : event.error === 'no-speech' ? 'No speech was detected. Try again or type your message.' : 'Voice input was unavailable. You can type your message instead.'; setVoiceMessage(message); };
      recognition.onend = () => { recognitionRef.current = null; setVoiceMessage(current => current === 'Listening...' ? '' : current); };
      recognitionRef.current = recognition; recognition.start();
    } catch { recognitionRef.current = null; setVoiceMessage('Voice input could not start. You can type your message instead.'); }
  }
  function speakLatest() {
    const latest = [...messages].reverse().find(message => message.role === 'assistant'); if (!latest || !speechSupported) return;
    try { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(latest.text); utterance.lang = 'en-IN'; window.speechSynthesis.speak(utterance); }
    catch { setVoiceMessage('Speech output is unavailable. You can continue reading the response.'); }
  }

  const needsPickupTime = flow?.step === 'pickupAt';

  return (
    <section className="page-section chat-assistant" id="customer-assistant" aria-labelledby="chat-title">
      <div className="section-heading"><div><p className="eyebrow">Customer assistant</p><h2 id="chat-title">Laundry chat</h2></div></div>
      <p className="chat-intro">Ask about catalog prices, prepare a pickup booking, check an order, or get basic care guidance.</p>
      <div className="chat-window" aria-live="polite" aria-relevant="additions">
        {messages.map(message => (
          <article className={`chat-message ${message.role}`} key={message.id}>
            <strong>{message.role === 'assistant' ? 'LaundryAI' : 'You'}</strong>
            <p>{message.text}</p>
            {message.booking && <StatusTimeline booking={message.booking} />}
            {message.review && draft && (
              <div className="chat-booking-review">
                <ul className="review-items">{draft.items.map(item => <li key={item.service._id}><span>{item.service.name} · {item.quantity} {item.service.pricingUnit === 'kg' ? 'kg' : 'item(s)'} × {formatRupees(item.service.price)}</span><strong>{formatRupees(item.service.price * item.quantity)}</strong></li>)}</ul>
                <p><strong>Pickup:</strong> {draft.pickupAt.replace('T', ' ')} IST</p>
                <p><strong>Pickup address:</strong> {draft.pickupAddress}</p>
                <p><strong>Delivery address:</strong> {draft.deliveryAddress}</p>
                <p><strong>Instructions:</strong> {draft.instructions || 'None'}</p>
                <div className="review-total"><span>Estimated total</span><strong>{formatRupees(message.total)}</strong></div>
                <small>The backend will look up the service prices and recalculate the total when you confirm.</small>
                <button className="primary-button" type="button" disabled={busy || flow?.step !== 'review'} onClick={confirmBooking}>{busy ? 'Submitting…' : 'Confirm booking'}</button>
                <button className="text-button" type="button" disabled={busy} onClick={() => { setFlow(null); setDraft(null); addMessage('assistant', 'Review discarded. Nothing was booked. You can start again whenever you are ready.'); }}>Discard review</button>
              </div>
            )}
          </article>
        ))}
      </div>
      {needsPickupTime && <form className="chat-date-form" onSubmit={submitPickupTime}><label>Pickup date and time (IST)<input name="pickupAt" type="datetime-local" value={pickupAt} min={indiaDateTimeMinimum()} onChange={event => setPickupAt(event.target.value)} required /></label><button className="primary-button" type="submit">Use this time</button></form>}
      {!flow && <div className="chat-suggestions" aria-label="Suggested questions">
        <button type="button" onClick={() => sendMessage('Show services and prices')}>Services and prices</button>
        <button type="button" onClick={() => sendMessage('Help me book a pickup')}>Book a pickup</button>
        <button type="button" onClick={() => sendMessage('Check a booking status')}>Check status</button>
      </div>}
      <form className="chat-input-row" onSubmit={event => { event.preventDefault(); sendMessage(); }}>
        <label className="chat-input-label"><span className="sr-only">Message LaundryAI</span><input value={input} onChange={event => setInput(event.target.value)} maxLength="500" placeholder={flow?.step === 'review' ? 'Confirm or discard the review above' : 'Type a message…'} disabled={busy || needsPickupTime || flow?.step === 'review'} /></label>
        <button className="primary-button" type="submit" disabled={busy || needsPickupTime || flow?.step === 'review' || !input.trim()}>Send</button>
        {voiceInputSupported && <button className="secondary-button" type="button" onClick={startVoiceInput} disabled={busy || needsPickupTime || flow?.step === 'review'} aria-label="Speak your message">Voice input</button>}
        {speechSupported && <button className="secondary-button" type="button" onClick={speakLatest} aria-label="Read the latest response aloud">Read aloud</button>}
      </form>
      {speechSupported && <label className="chat-speech-toggle"><input type="checkbox" checked={voiceOutput} onChange={event => setVoiceOutput(event.target.checked)} /> Speak new responses</label>}
      {voiceMessage && <p className="hint" role="status">{voiceMessage}</p>}
    </section>
  );
}

export default ChatAssistant;
