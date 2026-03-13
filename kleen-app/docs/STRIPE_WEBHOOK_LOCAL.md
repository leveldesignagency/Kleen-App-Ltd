# Running the Stripe webhook locally

Stripe can’t send webhooks to `localhost`. To get `payment_intent.succeeded` (and other events) in local dev, use the **Stripe CLI** to forward events to your app.

## 1. Install Stripe CLI

- **macOS (Homebrew):** `brew install stripe/stripe-cli/stripe`
- Or: https://stripe.com/docs/stripe-cli#install

## 2. Log in and forward webhooks

```bash
# Log in (one-time)
stripe login

# From the kleen-app directory, with the app running on port 3000:
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI will print a **webhook signing secret** like `whsec_...`.

## 3. Use that secret in `.env.local`

Set:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxx   # the value from `stripe listen`
```

Restart the Next.js dev server so it picks up the new env.

## 4. Pay for a quote

When you complete a test payment, Stripe will send the event to the CLI, which forwards it to `localhost:3000/api/stripe/webhook`. Your handler will run and update the job to `customer_accepted` so the UI shows “Your chosen quote” and “Declined” for the rest.

Keep the `stripe listen` terminal running while you test payments.
