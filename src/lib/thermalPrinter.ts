import type { Sale, ShopSettings, SaleItem } from '@/types';

export function generateThermalReceipt(sale: Sale, settings: ShopSettings, items: SaleItem[]): string {
  const width = settings.thermal_width || 80;
  const maxWidth = width === 58 ? 32 : 42;
  const dash = '-'.repeat(maxWidth);

  const lines: string[] = [];
  lines.push(center(settings.shop_name, maxWidth));
  if (settings.address) lines.push(center(settings.address, maxWidth));
  if (settings.phone) lines.push(center('Phone: ' + settings.phone, maxWidth));
  if (settings.gstin) lines.push(center('GSTIN: ' + settings.gstin, maxWidth));
  lines.push(dash);
  lines.push(`Invoice: ${sale.invoice_number}`);
  lines.push(`Date: ${new Date(sale.created_at).toLocaleString('en-IN')}`);
  if (sale.cashier) lines.push(`Cashier: ${sale.cashier}`);
  lines.push(`Customer: ${sale.customer_name}`);
  lines.push(dash);
  lines.push(`${pad('Item', maxWidth - 12)}${padRight('Qty', 4)}${padRight('Amt', 8)}`);
  lines.push(dash);

  for (const item of items) {
    const name = truncate(item.product_name, maxWidth - 14);
    lines.push(`${pad(name, maxWidth - 14)}${padRight(item.quantity.toFixed(0), 4)}${padRight(item.total.toFixed(2), 8)}`);
  }

  lines.push(dash);
  lines.push(`${pad('Subtotal', maxWidth - 10)}${padRight(sale.subtotal.toFixed(2), 10)}`);
  if (sale.discount > 0) lines.push(`${pad('Discount', maxWidth - 10)}${padRight('-' + sale.discount.toFixed(2), 10)}`);
  if (sale.tax > 0) lines.push(`${pad('Tax/GST', maxWidth - 10)}${padRight(sale.tax.toFixed(2), 10)}`);
  lines.push(`${pad('TOTAL', maxWidth - 10)}${padRight(settings.currency + sale.total.toFixed(2), 10)}`);
  lines.push(`${pad('Paid (' + sale.payment_method + ')', maxWidth - 10)}${padRight(sale.paid.toFixed(2), 10)}`);
  if (sale.balance > 0) lines.push(`${pad('Balance', maxWidth - 10)}${padRight(sale.balance.toFixed(2), 10)}`);
  lines.push(dash);
  lines.push(center(settings.footer_message || 'Thank you!', maxWidth));
  lines.push(center('Powered by MilkShop POS', maxWidth));

  const pre = `<pre style="font-family: 'Courier New', monospace; font-size: ${width === 58 ? '11px' : '13px'}; line-height: 1.3; margin: 0; padding: 8px; white-space: pre-wrap;">${lines.join('\n')}</pre>`;
  return pre;
}

export function generateA4Invoice(sale: Sale, settings: ShopSettings, items: SaleItem[]): string {
  const rows = items.map(item => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${item.product_name}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${settings.currency}${item.price.toFixed(2)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${settings.currency}${item.total.toFixed(2)}</td>
    </tr>`).join('');

  return `
  <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
      <div>
        <h1 style="margin:0;color:#1e40af;">${settings.shop_name}</h1>
        <p style="margin:4px 0;color:#555;font-size:13px;">${settings.address || ''}</p>
        <p style="margin:2px 0;color:#555;font-size:13px;">${settings.phone ? 'Phone: ' + settings.phone : ''}${settings.gstin ? ' | GSTIN: ' + settings.gstin : ''}</p>
      </div>
      <div style="text-align:right;">
        <h2 style="margin:0;color:#333;font-size:22px;">INVOICE</h2>
        <p style="margin:4px 0;font-size:13px;"><strong>${sale.invoice_number}</strong></p>
        <p style="margin:2px 0;font-size:13px;color:#555;">${new Date(sale.created_at).toLocaleString('en-IN')}</p>
      </div>
    </div>
    <div style="margin-bottom:16px;padding:10px;background:#f8fafc;border-radius:8px;">
      <strong>Bill To:</strong> ${sale.customer_name}
      ${sale.cashier ? `<span style="float:right"><strong>Cashier:</strong> ${sale.cashier}</span>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#1e40af;color:#fff;">
          <th style="padding:8px 10px;text-align:left;">Product</th>
          <th style="padding:8px 10px;text-align:center;">Qty</th>
          <th style="padding:8px 10px;text-align:right;">Price</th>
          <th style="padding:8px 10px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:16px;display:flex;justify-content:flex-end;">
      <table style="font-size:14px;">
        <tr><td style="padding:4px 20px 4px 0;">Subtotal:</td><td style="text-align:right;">${settings.currency}${sale.subtotal.toFixed(2)}</td></tr>
        ${sale.discount > 0 ? `<tr><td style="padding:4px 20px 4px 0;">Discount:</td><td style="text-align:right;">-${settings.currency}${sale.discount.toFixed(2)}</td></tr>` : ''}
        ${sale.tax > 0 ? `<tr><td style="padding:4px 20px 4px 0;">Tax/GST:</td><td style="text-align:right;">${settings.currency}${sale.tax.toFixed(2)}</td></tr>` : ''}
        <tr style="font-size:18px;font-weight:bold;color:#1e40af;"><td style="padding:8px 20px 4px 0;">Grand Total:</td><td style="text-align:right;">${settings.currency}${sale.total.toFixed(2)}</td></tr>
        <tr><td style="padding:4px 20px 4px 0;">Paid (${sale.payment_method}):</td><td style="text-align:right;">${settings.currency}${sale.paid.toFixed(2)}</td></tr>
        ${sale.balance > 0 ? `<tr><td style="padding:4px 20px 4px 0;">Balance:</td><td style="text-align:right;">${settings.currency}${sale.balance.toFixed(2)}</td></tr>` : ''}
      </table>
    </div>
    <div style="text-align:center;margin-top:30px;color:#555;font-size:13px;border-top:1px solid #eee;padding-top:12px;">
      ${settings.footer_message || 'Thank you for your business!'}
    </div>
  </div>`;
}

function center(text: string, width: number): string {
  const len = text.length;
  if (len >= width) return text.slice(0, width);
  const pad = Math.floor((width - len) / 2);
  return ' '.repeat(pad) + text;
}

function pad(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

function padRight(text: string, width: number): string {
  const s = String(text);
  if (s.length >= width) return s.slice(s.length - width);
  return ' '.repeat(width - s.length) + s;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
