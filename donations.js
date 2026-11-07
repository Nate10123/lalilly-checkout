const form = document.querySelector('#donation-form');
const amount = document.querySelector('#amount');
const feedback = document.querySelector('#feedback');
const submit = document.querySelector('#donate');
const choices = [...document.querySelectorAll('[data-amount]')];
let requestId = crypto.randomUUID();
function updateSelection() { choices.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.amount) === Number(amount.value)))); requestId = crypto.randomUUID(); }
choices.forEach(button => button.addEventListener('click', () => { amount.value = button.dataset.amount; updateSelection(); }));
amount.addEventListener('input', updateSelection);
const params = new URLSearchParams(location.search);
if (params.has('thanks')) feedback.textContent = 'Thank you for supporting Lilly! Check your email for your payment confirmation from Stripe.';
if (params.has('canceled')) feedback.textContent = 'Checkout canceled. You can try again whenever you like.';
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  submit.disabled = true; feedback.textContent = 'Opening secure checkout…';
  try {
    const response = await fetch('/api/donation-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amount.value, requestId }) });
    const data = await response.json();
    if (!response.ok || !data.url) throw new Error(data.error || 'Checkout is unavailable.');
    const destination = new URL(data.url);
    if (destination.protocol !== 'https:' || destination.hostname !== 'checkout.stripe.com') throw new Error('Checkout is unavailable.');
    location.assign(destination.href);
  } catch (error) { feedback.textContent = error.message; submit.disabled = false; }
});
