import CustomerQuotesView from "./CustomerQuotesView";

export default function CustomerQuotesPage() {
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  return <CustomerQuotesView stripePublishableKey={stripePublishableKey} />;
}
