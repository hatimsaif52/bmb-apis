export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'GET not supported' });
  }

  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: 'Missing order_id' });
    }

    const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
    const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
    console.log('SHOP URL',SHOPIFY_SHOP);
    console.log('ADMIN TOKEN',ACCESS_TOKEN);
    // 1️⃣ Fetch original order
    const orderResp = await fetch(
      `https://${SHOPIFY_SHOP}/admin/api/2024-10/orders/${order_id}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
        },
      }
    );

    if (!orderResp.ok) {
      const err = await orderResp.text();
      return res.status(500).json({ error: 'Failed to fetch order', details: err });
    }

    const { order } = await orderResp.json();

    // 2️⃣ Build new draft order payload
    const draftPayload = {
      draft_order: {
        email: order.email,
        customer: { id: order.customer?.id },
        shipping_address: order.shipping_address,
        billing_address: order.billing_address,
        note: `Reorder from order #${order.name}`,
        line_items: order.line_items.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
        })),
        use_customer_default_address: true,
      },
    };

    // 3️⃣ Create draft order
    const draftResp = await fetch(
      `https://${SHOPIFY_SHOP}/admin/api/2024-10/draft_orders.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': ACCESS_TOKEN,
        },
        body: JSON.stringify(draftPayload),
      }
    );

    if (!draftResp.ok) {
      const err = await draftResp.text();
      return res.status(500).json({ error: 'Failed to create draft order', details: err });
    }

    const { draft_order } = await draftResp.json();

    // 4️⃣ Return invoice URL
    return res.status(200).json({
      draft_order_id: draft_order.id,
      invoice_url: draft_order.invoice_url,
    });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
