# Customer order invoices

Adds **Download invoice** to the action menu of each order in Shopify's new customer accounts (orders index and order details). Shopify does not expose a target for an arbitrary inline button inside the native order card. This extension does not change legacy Liquid customer accounts.

## Demo setup

1. Run `npm install`, then `shopify app dev` to preview, or `shopify app deploy` to release the extension.
2. Deploy the backend with this change. It must have its normal `SHOPIFY_API_SECRET` and app credentials configured.
3. In Shopify's checkout and accounts editor, enable the **Order invoice download** order action. Set **App backend URL** to the public HTTPS URL of this app if different from the default.
4. Leave `INVOICE_API_URL` empty. Open a signed-in customer's order menu, select **Download invoice**, then download the prepared receipt.

The demo downloads `demo-receipt.html`, a standalone receipt that opens in a browser and can be printed. It contains fixed sample data and is explicitly marked as a demo, not an actual invoice. The selected order ID is sent to the API; no real order data is used for the sample receipt.

## Invoice provider

See `web/invoice.env.example`. Add the values to the environment used to start the backend (not the extension bundle).

- `INVOICE_API_URL`: HTTPS endpoint returning invoice bytes with `Content-Type: application/pdf`. Leave blank for demo mode.
- `INVOICE_API_TOKEN`: optional server-only bearer credential for the provider.

The provider receives a GET with `orderId` (Shopify Order GID), `customerId` (Shopify Customer GID), and `shop`. The app verifies the Shopify session token, checks order ownership through the Admin API before issuing a live link, and issues a signed download URL valid for five minutes. An upstream failure displays an error rather than substituting a demo for a real invoice.

API paths: `POST /customer-account/invoices` prepares the link; `GET /customer-account/invoices/download?ticket=...` downloads the file. The API requires the app's existing customer/order scopes and protected customer data access for the signed-in customer claim. Access to orders older than 60 days additionally needs Shopify's approved `read_all_orders` scope.

Run backend checks with `node --test web/routes/customer-account/invoices.test.js`.


A visible invoice block is also available on the order details page: in the accounts editor select Order status, add Order invoice download to Main, and save. The order menu action remains available on the orders list.
