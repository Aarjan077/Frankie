'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  const heading = document.getElementById('result-heading');
  const message = document.getElementById('result-message');
  const details = document.getElementById('result-details');
  const query = new URLSearchParams(window.location.search);
  const sessionId = query.get('session_id');
  if (query.has('cancelled')) {
    heading.textContent = 'Test checkout cancelled.';
    message.textContent = 'No test payment was completed. You can return to the gallery or studio section and try again.';
    return;
  }
  if (!sessionId || !/^cs_test_[A-Za-z0-9_]{6,160}$/.test(sessionId)) {
    heading.textContent = 'Checkout not found.';
    message.textContent = 'Open a gallery photograph or use the studio form to start a new test checkout.';
    return;
  }
  try {
    const response = await fetch(`/api/payments/status?session_id=${encodeURIComponent(sessionId)}`, {cache:'no-store'});
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || 'We could not verify the test payment.');
    if (status.paid) {
      heading.textContent = 'Test payment complete.';
      const purpose = status.purpose === 'studio_support' ? 'studio support' : 'photograph purchase';
      message.textContent = `Stripe confirms your sandbox ${purpose} payment succeeded. This is a simulation; no real money was charged.`;
      details.textContent = new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(status.amountPence/100);
    } else {
      heading.textContent = 'Test payment pending.';
      message.textContent = 'Stripe has not confirmed payment. Check your test Stripe Dashboard for the latest status.';
    }
  } catch(error) {
    heading.textContent = 'Unable to check status.';
    message.textContent = error.message;
  }
});
