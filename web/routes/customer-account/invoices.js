import {Router} from 'express';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PriceChangeDB} from '../../price-change-db.js';

export function createInvoiceRouter(shopify) {
  const router = Router();
  const secret = process.env.SHOPIFY_API_SECRET;
  const signature = value => createHmac('sha256', secret).update(value).digest('base64url');

  router.post('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!secret) return res.status(503).json({error: 'Invoice service is not configured'});
    let claims;
    try {
      const bearer = req.get('Authorization') || '';
      if (!bearer.startsWith('Bearer ')) throw new Error('Missing token');
      claims = await shopify.api.session.decodeSessionToken(bearer.slice(7));
      if (!claims.sub) throw new Error('Customer login required');
    } catch {
      return res.status(401).json({error: 'Customer login required'});
    }
    const orderId = req.body?.orderId;
    if (typeof orderId !== 'string' || !/^gid:\/\/shopify\/Order\/\d+$/.test(orderId)) {
      return res.status(400).json({error: 'Invalid order ID'});
    }
    try {
      const shop = new URL(String(claims.dest).includes('://') ? claims.dest : `https://${claims.dest}`).hostname;
      if (!/^[a-z0-9-]+\.myshopify\.com$/.test(shop)) return res.status(401).json({error: 'Invalid shop'});
      const demo = !process.env.INVOICE_API_URL?.trim();
      if (!demo) {
        // Never issue a real invoice link for an order owned by another customer.
        const sessions = await PriceChangeDB.byShop(shop);
        const session = sessions?.[0];
        if (!session) return res.status(503).json({error: 'Shop session unavailable'});
        const id = orderId.split('/').pop();
        const response = await fetch(`https://${shop}/admin/api/2026-01/orders/${id}.json?fields=id,customer`, {
          headers: {'X-Shopify-Access-Token': session.accessToken},
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) return res.status(403).json({error: 'Order unavailable'});
        const {order} = await response.json();
        if (!order?.customer?.id || String(order.customer.id) !== String(claims.sub).split('/').pop()) {
          return res.status(403).json({error: 'Order unavailable'});
        }
      }
      const payload = Buffer.from(JSON.stringify({shop, orderId, customerId: claims.sub, demo, exp: Date.now() + 5 * 60 * 1000})).toString('base64url');
      // Relative download path keeps the configured public app origin authoritative.
      return res.json({demo, path: `/customer-account/invoices/download?ticket=${payload}.${signature(payload)}`});
    } catch (error) {
      console.error('[Invoice] Preparation failed:', error.message);
      return res.status(502).json({error: 'Unable to prepare invoice'});
    }
  });

  router.get('/download', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!secret) return res.sendStatus(503);
    try {
      const [payload, supplied, extra] = String(req.query.ticket || '').split('.');
      if (!payload || !supplied || extra) return res.sendStatus(401);
      const expected = Buffer.from(signature(payload));
      const actual = Buffer.from(supplied);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return res.sendStatus(401);
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (!Number.isFinite(data.exp) || data.exp < Date.now()) return res.status(410).send('Download expired. Request your invoice again.');
      if (data.demo) {
        return res.download(fileURLToPath(new URL('../../assets/demo-receipt.html', import.meta.url)), 'demo-receipt.html');
      }
      const endpoint = new URL(process.env.INVOICE_API_URL);
      if (endpoint.protocol !== 'https:') throw new Error('Invoice API must use HTTPS');
      endpoint.searchParams.set('orderId', data.orderId);
      endpoint.searchParams.set('customerId', data.customerId);
      endpoint.searchParams.set('shop', data.shop);
      const headers = process.env.INVOICE_API_TOKEN ? {Authorization: `Bearer ${process.env.INVOICE_API_TOKEN}`} : {};
      const response = await fetch(endpoint, {headers, signal: AbortSignal.timeout(20000), redirect: 'error'});
      if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error('Invoice API must return a PDF');
      const file = Buffer.from(await response.arrayBuffer());
      if (!file.length) throw new Error('Empty invoice');
      return res.type('application/pdf').attachment(`invoice-${data.orderId.split('/').pop()}.pdf`).send(file);
    } catch (error) {
      console.error('[Invoice] Download failed:', error.message);
      return res.status(502).send('Unable to download invoice. Please try again.');
    }
  });
  return router;
}

