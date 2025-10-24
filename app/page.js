'use client';

export default function Page() {
  const reorder = async () => {
    const orderId = prompt('Enter Shopify Order ID');
    if (!orderId) return;

    const res = await fetch('/api/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    });

    const data = await res.json();
    if (data.invoice_url) {
      window.location.href = data.invoice_url;
    } else {
      alert('Error: ' + (data.error || 'Something went wrong'));
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Shopify Reorder Test</h1>
      <button
        onClick={reorder}
        className="px-6 py-3 rounded-xl bg-black text-white hover:bg-gray-800"
      >
        Reorder (Create Draft Order)
      </button>
    </main>
  );
}
