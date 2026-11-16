import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

export default () => render(<InvoiceAction />, document.body);

function InvoiceAction() {
  const [download, setDownload] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const orderId = shopify.order.value?.id;

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    async function prepare() {
      setError('');
      setDownload(null);
      try {
        const base = String(shopify.settings.value.backend_url || 'https://appseconnect-demo.onrender.com').replace(/\/$/, '');
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
  }, [orderId, attempt]);

  return (
    <s-customer-account-action heading="Download invoice">
      {error ? <s-banner tone="critical">{error}</s-banner> : null}
      {!error && !download ? <s-text>Preparing your receipt…</s-text> : null}
      {download ? <s-text>{download.demo ? 'Demo receipt — sample data, not a tax invoice.' : 'Your invoice is ready.'}</s-text> : null}
      {download ? <s-button href={download.url} target="_blank">Download invoice</s-button> : null}
      {error ? <s-button onClick={() => setAttempt(value => value + 1)}>Try again</s-button> : null}
    </s-customer-account-action>
  );
}

