/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
export default () => render(<InvoiceAction />, document.body);
export function InvoiceAction({inline = false}) {
  const [download, setDownload] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const base = String(shopify.settings?.value?.backend_url || 'https://appseconnect-demo.onrender.com').trim().replace(/\/$/, '');
  const liveInvoices = shopify.settings?.value?.live_invoices === true;
  const demoDownload = {demo: true, url: `${base}/customer-account/invoices/demo`};
  const readyDownload = liveInvoices ? download : demoDownload;
  const orderId = shopify.order?.value?.id;
  useEffect(() => {
    if (!liveInvoices) return;
    if (!orderId) { setError('Order details are unavailable. Please reopen this invoice from an order.'); return; }
    let cancelled = false;
    async function prepare() {
      setError('');
      setDownload(null);
      try {
        const base = String(shopify.settings?.value?.backend_url || 'https://appseconnect-demo.onrender.com').replace(/\/$/, '');
        if (new URL(base).protocol !== 'https:') throw new Error('Configure an HTTPS app backend URL.');
        const token = await shopify.sessionToken.get();
        const response = await fetch(`${base}/customer-account/invoices`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
          body: JSON.stringify({orderId}),
        });
        if (!response.ok) throw new Error('Unable to prepare your invoice. Please try again.');
        const result = await response.json();
        if (!cancelled) setDownload({...result, url: `${base}${result.path}`});
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to prepare your invoice.');
      }
    }
    prepare();
    return () => { cancelled = true; };
  }, [orderId, attempt, liveInvoices, base]);
  const Wrapper = inline ? "s-stack" : "s-customer-account-action";
  return (
    <Wrapper {...(inline ? {} : {heading: "Download invoice"})}>
      {inline ? <s-heading>Invoice</s-heading> : null}
      {error ? <s-banner tone="critical">{error}</s-banner> : null}
      {!error && !readyDownload ? <s-text>Preparing your receipt…</s-text> : null}
      {readyDownload ? <s-text>{readyDownload.demo ? 'Demo receipt — sample data, not a tax invoice.' : 'Your invoice is ready.'}</s-text> : null}
      {readyDownload ? <s-button href={readyDownload.url} target="_blank">Download invoice</s-button> : null}
      {error ? <s-button onClick={() => setAttempt(value => value + 1)}>Try again</s-button> : null}
    </Wrapper>
  );
}
