// Data is fetched from the app server; this browser page only formats the PDF.
export function buildReceiptPdf(receipt) {
  const amount = value => `${receipt.currency} ${Number(value).toFixed(2)}`;
  const rows = [receipt.storeName, 'DEMO RECEIPT', `Receipt: ${receipt.receiptNumber}`,
    `Customer: ${receipt.customerName}`, '', receipt.notice, '',
    ...receipt.items.map(item => `${item.description} | Qty: ${item.quantity} | ${amount(item.unitPrice * item.quantity)}`),
    '', `Subtotal: ${amount(receipt.subtotal)}`, `Tax: ${amount(receipt.tax)}`, `Total: ${amount(receipt.total)}`];
  const escape = value => String(value).replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&');
  const stream = `BT /F1 12 Tf 48 790 Td 22 TL\n${rows.map((row,index) => `${index ? 'T* ' : ''}(${escape(row)}) Tj`).join('\n')}\nET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object,index) => {offsets.push(pdf.length); pdf += `${index+1} 0 obj\n${object}\nendobj\n`;});
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}`;
  return `${pdf}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

if (typeof document !== 'undefined') {
  const status = document.getElementById('status');
  const download = document.getElementById('download');
  const retry = document.getElementById('retry');
  let objectUrl;
  async function prepare() {
    retry.hidden = true;
    download.hidden = true;
    status.textContent = 'Fetching receipt data from the server...';
    try {
      const response = await fetch('./demo-data', {cache: 'no-store', signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('Receipt data could not be fetched. Please try again.');
      const receipt = await response.json();
      if (!receipt.demo || !Array.isArray(receipt.items)) throw new Error('Invalid receipt data received.');
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(new Blob([buildReceiptPdf(receipt)], {type: 'application/pdf'}));
      download.href = objectUrl;
      download.download = `receipt-${String(receipt.receiptNumber).replace(/[^a-zA-Z0-9_-]/g,'')}.pdf`;
      download.hidden = false;
      status.textContent = 'Demo receipt ready. If the download does not start, click Download PDF.';
      download.click();
    } catch (error) {
      status.textContent = error.message || 'Unable to download receipt.';
      retry.hidden = false;
    }
  }
  retry.addEventListener('click', prepare);
  prepare();
}
