/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default () => {
  const base = String(shopify.settings?.value?.backend_url || 'https://appseconnect-demo.onrender.com').trim().replace(/\/$/, '');
  render(<s-button href={`${base}/customer-account/invoices/demo.pdf`} target="_self">Download invoice</s-button>, document.body);
};
