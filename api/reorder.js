export default async function handler(req, res) {
    // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://brandmybeverage.com/');
  res.setHeader('Access-Control-Allow-Origin', 'https://brandmybeverage.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
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

    // 1️. Fetch original order
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

    // 2️. Prepare line items
    const line_items = order.line_items
      .filter(item => item.variant_id) // exclude custom/manual items
      .map(item => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        custom: false,
        properties: item.properties || [],
      }));

    // 3️. Include shipping fee
    const shipping_line = order.shipping_lines?.[0];
    const shipping_line_payload = shipping_line
      ? [
          {
            title: shipping_line.title || 'Shipping',
            price: shipping_line.price || '0.00',
          },
        ]
      : [];

    // 4️. Include discounts
    const discount_applications = order.discount_applications?.map(discount => ({
      description: discount.title,
      value_type: discount.value_type,
      value: discount.value,
      target_type: discount.target_type,
    })) || [];

    // 5️. Create draft order payload
    const draftPayload = {
      draft_order: {
        email: order.email,
        customer: { id: order.customer?.id },
        billing_address: order.billing_address,
        shipping_address: order.shipping_address,
        line_items,
        shipping_line: shipping_line_payload[0],
        note: order.note || `Reorder from ${order.name}`,
        note_attributes: order.note_attributes || [],
        tags: order.tags,
        applied_discount:
          discount_applications.length > 0
            ? {
                description: discount_applications[0].description,
                value_type: discount_applications[0].value_type,
                value: discount_applications[0].value,
                amount: discount_applications[0].value,
              }
            : undefined,
        use_customer_default_address: true,
      },
    };

    // 6. Create draft order
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

    // 4️. Return invoice URL
    return res.status(200).json({
      draft_order_id: draft_order.id,
      invoice_url: draft_order.invoice_url,
    });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
