/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default () => render(<InvoiceAction />, document.body);

export function InvoiceAction({inline = false}) {
  const base = String(shopify.settings?.value?.backend_url || 'https://appseconnect-demo.onrender.com').trim().replace(/\/$/, '');
  const Wrapper = inline ? 's-stack' : 's-customer-account-action';
  return (
    <Wrapper {...(inline ? {} : {heading: 'Download invoice'})}>
      {inline ? <s-heading>Invoice</s-heading> : null}
      <s-button href={`${base}/customer-account/invoices/demo.pdf`} target="_self">Download invoice</s-button>
    </Wrapper>
  );
}
