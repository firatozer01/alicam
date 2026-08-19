import { PaymentResult } from "../payment-result";

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order = "" } = await searchParams;
  return <PaymentResult order={order} />;
}
