import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createHmac} from 'node:crypto';
import {createInvoiceRouter} from './invoices.js';
import {PriceChangeDB} from '../../price-change-db.js';

test('invoice demo, authentication, ticket integrity, expiry, and provider ownership', async () => {
  process.env.SHOPIFY_API_SECRET = 'test-secret';
  delete process.env.INVOICE_API_URL;
  const app = express();
  app.use(express.json());
  app.use('/customer-account/invoices', createInvoiceRouter({api:{session:{decodeSessionToken: async token => {
    if (token !== 'valid') throw new Error('Invalid');
    return {dest:'example.myshopify.com',sub:'gid://shopify/Customer/123'};
  }}}}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = globalThis.fetch;
  const originalByShop = PriceChangeDB.byShop;
  const request = (token = 'valid', orderId = 'gid://shopify/Order/456') => originalFetch(`${base}/customer-account/invoices`, {
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({orderId}),
  });
  try {
    assert.equal((await request('invalid')).status, 401);
    assert.equal((await request('valid', 'bad')).status, 400);
    const prepared = await request();
    assert.equal(prepared.status, 200);
    const data = await prepared.json();
    assert.equal(data.demo, true);
    const receipt = await originalFetch(base + data.path);
    assert.equal(receipt.status, 200);
    assert.match(receipt.headers.get('content-disposition'), /attachment.*demo-receipt.pdf/);
    assert.match(await receipt.text(), /^%PDF/);
    const publicDemo = await originalFetch(base + '/customer-account/invoices/demo.pdf');
    assert.equal(publicDemo.status, 200);
    const demoData = await originalFetch(base + '/customer-account/invoices/demo-data');
    assert.equal(demoData.status, 200);
    const sample = await demoData.json();
    assert.equal(sample.total, 77);
    assert.ok(sample.items.length > 0);
    const page = await originalFetch(base + '/customer-account/invoices/demo');
    assert.match(await page.text(), /demo-client.js/);
    const client = await originalFetch(base + '/customer-account/invoices/demo-client.js');
    assert.match(await client.text(), /fetch\('\.\/demo-data'/);
    assert.match(publicDemo.headers.get('content-type'), /application\/pdf/);
    assert.equal((await originalFetch(base + data.path + 'tampered')).status, 401);
    const payload = Buffer.from(JSON.stringify({exp:Date.now()-1000})).toString('base64url');
    const sig = createHmac('sha256','test-secret').update(payload).digest('base64url');
    assert.equal((await originalFetch(`${base}/customer-account/invoices/download?ticket=${payload}.${sig}`)).status, 410);
    process.env.INVOICE_API_URL = 'https://invoice.example/invoice';
    PriceChangeDB.byShop = async () => [{accessToken:'test-admin'}];
    globalThis.fetch = async () => new Response(JSON.stringify({order:{customer:{id:999}}}), {headers:{'Content-Type':'application/json'}});
    assert.equal((await request()).status, 403);
    globalThis.fetch = async () => new Response(JSON.stringify({order:{customer:{id:123}}}), {headers:{'Content-Type':'application/json'}});
    const live = await (await request()).json();
    assert.equal(live.demo,false);
    globalThis.fetch = async url => {
      assert.equal(new URL(url).searchParams.get('orderId'),'gid://shopify/Order/456');
      return new Response('%PDF-1.4 demo',{headers:{'Content-Type':'application/pdf'}});
    };
    const invoice = await originalFetch(base + live.path);
    assert.equal(invoice.status,200);
    assert.match(invoice.headers.get('content-disposition'),/invoice-456.pdf/);
    assert.match(await invoice.text(),/^%PDF/);
  } finally {
    globalThis.fetch = originalFetch;
    PriceChangeDB.byShop = originalByShop;
    delete process.env.INVOICE_API_URL;
    await new Promise(resolve => server.close(resolve));
  }
});
