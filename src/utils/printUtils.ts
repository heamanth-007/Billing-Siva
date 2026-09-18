import type { BillPrintData } from '../components/BillPrintTemplate';
import { getStoredSettings } from '../components/SettingsPage';

/**
 * Robust date parser supporting DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, ISO, etc.
 */
export const parseDateToTimestamp = (dateStr: string): number => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const clean = dateStr.trim();

  // Format: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  // Format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  const parsed = Date.parse(clean);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Checks whether an item's date falls within [fromDate, toDate]
 */
export const isDateInRange = (dateStr: string, fromDateStr: string, toDateStr: string): boolean => {
  if (!fromDateStr && !toDateStr) return true;
  const itemTime = parseDateToTimestamp(dateStr);
  if (!itemTime) return true;

  if (fromDateStr) {
    const fromTime = parseDateToTimestamp(fromDateStr);
    if (fromTime && itemTime < fromTime) return false;
  }

  if (toDateStr) {
    const toTime = parseDateToTimestamp(toDateStr);
    // Include the full day until 23:59:59
    if (toTime && itemTime > toTime + (24 * 60 * 60 * 1000 - 1)) return false;
  }

  return true;
};

export const generateBillHtml = (bill: BillPrintData): string => {
  // Calculate Subtotal from Products or bill.amount
  const prodSubtotal = (bill.products || []).reduce((acc, p) => {
    const amt = parseFloat(String(p.amount).replace(/,/g, '')) || 0;
    return acc + amt;
  }, 0);
  const subtotal = prodSubtotal > 0 ? prodSubtotal : (parseFloat(String(bill.amount || bill.total || '0').replace(/,/g, '')) || 0);

  // Discount calculation
  const rawDiscStr = String(bill.discount ?? '').trim();
  const cleanDisc = rawDiscStr.replace(/[^0-9.]/g, '');
  const discNum = parseFloat(cleanDisc) || 0;
  let discountAmt = 0;
  let discountLabel = 'Discount';
  if (discNum > 0) {
    if (rawDiscStr.includes('%') || (discNum <= 100 && !rawDiscStr.startsWith('₹'))) {
      discountAmt = (subtotal * discNum) / 100;
      discountLabel = `Discount (${discNum}%)`;
    } else {
      discountAmt = discNum;
      discountLabel = `Discount (₹${discNum.toFixed(2)})`;
    }
  }

  // Transport calculation
  const rawTransportStr = String(bill.transport ?? '').trim();
  const cleanTrans = rawTransportStr.replace(/[^0-9.]/g, '');
  const transNum = parseFloat(cleanTrans) || 0;
  const transportAmt = (!isNaN(Number(rawTransportStr)) && transNum > 0) ? transNum : 0;
  const transportDisplayName = (!rawTransportStr || rawTransportStr === '0' || rawTransportStr === '-') ? '-' : rawTransportStr;

  // Packing calculation - percentage by default
  const rawPackStr = String(bill.packing ?? '').trim();
  const cleanPack = rawPackStr.replace(/[^0-9.]/g, '');
  const packNum = parseFloat(cleanPack) || 0;
  let packingAmt = 0;
  let packingLabel = 'Packing Charges';
  if (packNum > 0) {
    if (rawPackStr.startsWith('₹')) {
      packingAmt = packNum;
      packingLabel = `Packing Charges`;
    } else {
      packingAmt = (subtotal * packNum) / 100;
      packingLabel = `Packing Charges (${packNum}%)`;
    }
  }

  // Tax calculation
  const rawTaxStr = String(bill.tax ?? '').trim();
  const cleanTax = rawTaxStr.replace(/[^0-9.]/g, '');
  const taxNum = parseFloat(cleanTax) || 0;
  let taxAmt = 0;
  let taxLabel = 'GST / Tax';
  if (taxNum > 0) {
    const baseForTax = Math.max(0, subtotal - discountAmt + transportAmt + packingAmt);
    taxAmt = (baseForTax * taxNum) / 100;
    taxLabel = `GST / Tax (${taxNum}%)`;
  }

  // Grand Total calculation
  const calculatedTotal = Math.max(0, subtotal - discountAmt + transportAmt + packingAmt + taxAmt);
  const rawTotalNum = parseFloat(String(bill.total ?? bill.amount ?? '0').replace(/,/g, '')) || 0;
  const finalTotalNum = rawTotalNum > 0 ? rawTotalNum : calculatedTotal;
  const formattedTotal = '₹' + finalTotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const computedCases = bill.caseCount !== undefined && bill.caseCount !== ''
    ? bill.caseCount
    : (bill.products || []).reduce((acc, p) => acc + (parseFloat(String(p.quantity)) || 0), 0);

  const storeSettings = getStoredSettings();
  const displayCompanyName =
    bill.companyName &&
    bill.companyName.trim() !== '' &&
    bill.companyName !== 'General'
      ? bill.companyName
      : storeSettings.companyName || 'General';

  // Build full company address line
  const addressParts = [
    storeSettings.address,
    storeSettings.city,
    storeSettings.state,
    storeSettings.pincode ? `PIN: ${storeSettings.pincode}` : '',
  ].filter(Boolean);
  const fullAddressLine = addressParts.length > 0 ? addressParts.join(', ') : 'Sivakasi, Tamil Nadu';

  // Build contact lines
  const contactItems = [
    storeSettings.phone ? `Mobile: ${storeSettings.phone}` : '',
    storeSettings.whatsapp ? `WhatsApp: ${storeSettings.whatsapp}` : '',
    storeSettings.email ? `Email: ${storeSettings.email}` : '',
  ].filter(Boolean);
  const contactLine = contactItems.join(' | ');

  // Build tax/reg line
  const isTaxActive = Boolean(storeSettings.enableTax) || (parseFloat(String(bill.tax || '0').replace(/[^0-9.]/g, '')) > 0);
  const taxItems = [
    (isTaxActive && storeSettings.gstin) ? `GSTIN: ${storeSettings.gstin}` : '',
    storeSettings.pan ? `PAN: ${storeSettings.pan}` : '',
    storeSettings.ownerName ? `Prop: ${storeSettings.ownerName}` : '',
  ].filter(Boolean);
  const taxLine = taxItems.join(' | ');

  // Check for bank details
  const hasBankDetails = Boolean(
    storeSettings.bankName || storeSettings.bankAccountNo || storeSettings.bankIfsc || storeSettings.upiId
  );

  const receiptSrc = bill.pdfData || bill.pdfUrl || '';

  const rawProducts = bill.products || [];

  const productRowsHtml = rawProducts.map((item, idx) => {
    const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
    const numRate = parseFloat(String(item.rate).replace(/,/g, '')) || 0;
    return `
      <tr>
        <td style="border: 1px solid #000000; padding: 4px 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #000000; padding: 4px 8px; text-align: left; font-weight: 600;">${item.particular || '-'}</td>
        <td style="border: 1px solid #000000; padding: 4px 6px; text-align: center;">${item.quantity || '-'}</td>
        <td style="border: 1px solid #000000; padding: 4px 6px; text-align: right;">${numRate > 0 ? numRate.toFixed(2) : (item.rate || '-')}</td>
        <td style="border: 1px solid #000000; padding: 4px 6px; text-align: center;">${item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : ''}</td>
        <td style="border: 1px solid #000000; padding: 4px 8px; text-align: right; font-weight: 700;">${numAmt.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill #${bill.billNo || 'Invoice'} - ${displayCompanyName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #000000;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .bill-box-container {
      width: 100%;
      max-width: 800px;
      min-height: 272mm;
      margin: 0 auto;
      border: 1.5px solid #000000;
      background: #ffffff;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .top-header {
      text-align: center;
      padding: 10px 16px 8px 16px;
      border-bottom: 1.5px solid #000000;
      flex-shrink: 0;
    }
    .comp-name {
      font-size: 24px;
      font-weight: 900;
      color: #000000;
      margin-bottom: 2px;
      letter-spacing: -0.01em;
      text-transform: uppercase;
      line-height: 1.15;
    }
    .comp-tagline {
      font-size: 11.5px;
      font-weight: 600;
      color: #334155;
      font-style: italic;
      margin-bottom: 2px;
    }
    .comp-address {
      font-size: 11.5px;
      font-weight: 600;
      color: #1e293b;
      line-height: 1.3;
    }
    .comp-contact {
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      margin-top: 2px;
    }
    .comp-tax {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 1.5px solid #000000;
      font-size: 12px;
      table-layout: fixed;
      flex-shrink: 0;
    }
    .meta-table td {
      border: 1px solid #000000;
      padding: 5px 8px;
      vertical-align: top;
    }
    .meta-label {
      color: #475569;
      font-weight: 500;
      margin-right: 4px;
    }
    .meta-val {
      font-weight: 700;
      color: #000000;
    }
    .prod-container {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
    }
    .prod-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 1.5px solid #000000;
      font-size: 11.5px;
      table-layout: fixed;
    }
    .prod-table th {
      border: 1px solid #000000;
      padding: 5px 6px;
      font-weight: 700;
      background-color: #f8fafc;
      color: #000000;
    }
    .prod-table td {
      border: 1px solid #000000;
      padding: 4px 6px;
    }
    .bottom-section {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      margin-top: auto;
      flex-shrink: 0;
      page-break-inside: avoid;
      background: #ffffff;
    }
    .left-side-area {
      flex: 1 1 50%;
      border-right: 1.5px solid #000000;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      min-height: 130px;
    }
    .receipt-img {
      max-width: 100%;
      max-height: 130px;
      object-fit: contain;
      display: block;
    }
    .bank-box {
      font-size: 10.5px;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .bank-header {
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      margin-bottom: 2px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 1px;
    }
    .sig-line-box {
      font-size: 11px;
      font-weight: 700;
      color: #000000;
      border-top: 1px dashed #000000;
      display: inline-block;
      padding-top: 3px;
      width: 160px;
      margin-top: 8px;
    }
    .summary-area {
      flex: 1 1 50%;
      padding: 0;
      box-sizing: border-box;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }
    .summary-table td {
      border: 1px solid #000000;
      padding: 4px 8px;
    }
    .summary-label-cell {
      font-weight: 500;
      color: #334155;
    }
    .summary-val-cell {
      text-align: right;
      font-weight: 600;
      color: #000000;
    }
    .summary-total-row td {
      font-weight: 900;
      font-size: 13.5px;
      padding: 6px 8px;
      background-color: #f8fafc;
      border-top: 1.5px solid #000000;
      color: #000000;
    }
  </style>
</head>
<body>
  <div class="bill-box-container">
    <!-- Header -->
    <div class="top-header">
      ${
        storeSettings.logoUrl
          ? `<div style="margin-bottom:4px;"><img src="${storeSettings.logoUrl}" alt="Logo" style="max-height:44px; max-width:140px; object-fit:contain;" /></div>`
          : ''
      }
      <div class="comp-name">${displayCompanyName}</div>
      ${storeSettings.tagline ? `<div class="comp-tagline">${storeSettings.tagline}</div>` : ''}
      <div class="comp-address">${fullAddressLine}</div>
      ${contactLine ? `<div class="comp-contact">${contactLine}</div>` : ''}
      ${taxLine ? `<div class="comp-tax">${taxLine}</div>` : ''}
    </div>

    <!-- Metadata Grid Table with Boxed Lines -->
    <table class="meta-table">
      <tr>
        <td style="width: 50%;">
          <div>
            <span class="meta-label">Customer Name:</span>
            <span class="meta-val" style="font-size: 13px;">${bill.customerName || '-'}</span>
          </div>
          ${
            bill.customerPhone && bill.customerPhone.trim() !== '' && bill.customerPhone !== '-'
              ? `<div style="font-size:11px; margin-top:2px; color:#1e293b;"><span style="color:#64748b;">Mobile:</span> <strong>${bill.customerPhone}</strong></div>`
              : ''
          }
          ${
            bill.customerAddress && bill.customerAddress.trim() !== '' && bill.customerAddress !== '-'
              ? `<div style="font-size:11px; margin-top:2px; color:#334155;"><span style="color:#64748b;">Address:</span> <span>${bill.customerAddress}</span></div>`
              : ''
          }
          ${
            bill.customerGst && bill.customerGst.trim() !== '' && bill.customerGst !== '-' && bill.customerGst !== 'N/A'
              ? `<div style="font-size:11px; margin-top:2px; color:#334155;"><span style="color:#64748b;">GSTIN:</span> <strong>${bill.customerGst}</strong></div>`
              : ''
          }
        </td>
        <td style="width: 50%;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <div>
              <span class="meta-label">Bill No:</span>
              <span class="meta-val" style="font-size: 13px;">#${bill.billNo || '-'}</span>
            </div>
            <div>
              <span class="meta-label">Date:</span>
              <span class="meta-val">${bill.date || '-'}</span>
            </div>
          </div>
          <div style="margin-top: 2px;">
            <span class="meta-label">Billed By:</span>
            <span class="meta-val">${displayCompanyName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 3px;">
            <div>
              <span class="meta-label">Transport:</span>
              <span class="meta-val">${transportDisplayName}</span>
            </div>
            <div>
              <span class="meta-label">Total Cases:</span>
              <span class="meta-val">${computedCases}</span>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Products Table Area (Expands naturally) -->
    <div class="prod-container">
      <table class="prod-table">
        <thead>
          <tr>
            <th style="width: 38px; text-align: center;">Si.No</th>
            <th style="text-align: left; padding: 5px 8px;">Particular / Product Description</th>
            <th style="width: 65px; text-align: center;">Qty</th>
            <th style="width: 75px; text-align: right;">Rate (₹)</th>
            <th style="width: 75px; text-align: center;">Unit</th>
            <th style="width: 95px; text-align: right; padding: 5px 8px;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${productRowsHtml || '<tr><td colspan="6" style="text-align:center; padding:16px; border:1px solid #000;">No product items in bill</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Bottom Fixed Section: Receipt or Bank/Signatory Box on Left & Summary Calculation Box on Right -->
    <div class="bottom-section">
      <div class="left-side-area">
        ${
          receiptSrc
            ? `
            <div style="display: flex; align-items: center; justify-content: center; flex: 1;">
              <img src="${receiptSrc}" class="receipt-img" alt="Transport Receipt" />
            </div>
            `
            : hasBankDetails
            ? `
            <div class="bank-box">
              <div class="bank-header">Bank & Payment Details:</div>
              ${storeSettings.bankName ? `<div>Bank: <strong>${storeSettings.bankName}</strong></div>` : ''}
              ${storeSettings.bankAccountNo ? `<div>A/C No: <strong>${storeSettings.bankAccountNo}</strong></div>` : ''}
              ${storeSettings.bankIfsc ? `<div>IFSC: <strong>${storeSettings.bankIfsc}</strong> ${storeSettings.bankBranch ? `| Branch: ${storeSettings.bankBranch}` : ''}</div>` : ''}
              ${storeSettings.upiId ? `<div>UPI ID: <strong>${storeSettings.upiId}</strong></div>` : ''}
            </div>
            `
            : `
            <div style="font-size: 11px; color: #64748B; font-style: italic;">Thank you for your business!</div>
            `
        }

        <div class="sig-line-box">
          Authorized Signatory
        </div>
      </div>

      <!-- Right Column: Amount Calculation Summary Table -->
      <div class="summary-area">
        <table class="summary-table">
          <tbody>
            <tr>
              <td class="summary-label-cell">Particular Amount</td>
              <td class="summary-val-cell">${subtotal.toFixed(2)}</td>
            </tr>
            ${
              discountAmt > 0
                ? `<tr>
                    <td class="summary-label-cell">${discountLabel}</td>
                    <td class="summary-val-cell">-${discountAmt.toFixed(2)}</td>
                  </tr>`
                : ''
            }
            ${
              transportAmt > 0
                ? `<tr>
                    <td class="summary-label-cell">Transport Charges</td>
                    <td class="summary-val-cell">+${transportAmt.toFixed(2)}</td>
                  </tr>`
                : ''
            }
            ${
              packingAmt > 0
                ? `<tr>
                    <td class="summary-label-cell">${packingLabel}</td>
                    <td class="summary-val-cell">+${packingAmt.toFixed(2)}</td>
                  </tr>`
                : ''
            }
            ${
              taxAmt > 0
                ? `<tr>
                    <td class="summary-label-cell">${taxLabel}</td>
                    <td class="summary-val-cell">+${taxAmt.toFixed(2)}</td>
                  </tr>`
                : ''
            }
            <tr class="summary-total-row">
              <td style="font-weight: 800; font-size: 12px;">Total Amount</td>
              <td class="summary-val-cell" style="font-size: 13.5px; font-weight: 900; color: #000000;">${formattedTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Direct print function that opens an isolated, clean print window
 * Guaranteed to print ONLY the full-page A4 bill document!
 */
export const printBillDirectly = (bill: BillPrintData) => {
  const htmlContent = generateBillHtml(bill);
  triggerBrowserPrint(htmlContent);
};

/**
 * =======================================================================
 * MASTER / BULK LIST PRINT GENERATORS (Standard A4 Format)
 * =======================================================================
 */

export const generateCustomerListPrintHtml = (
  customers: any[],
  reportTitle = 'CUSTOMERS MASTER LEDGER & BALANCES REPORT',
  dateRangeText?: string
): string => {
  const storeSettings = getStoredSettings();
  const compName = (storeSettings.companyName || 'SIVA BALAJI CRACKERS').toUpperCase();
  const compSub = storeSettings.tagline || `Wholesale & Retail Trading • ${storeSettings.city || 'Sivakasi'}`;
  const phoneVal = storeSettings.phone || '+91 98765 43210';

  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  let totalDebit = 0;
  let totalCredit = 0;
  let totalPendingDue = 0;
  let totalAdvanceHeld = 0;

  customers.forEach((c) => {
    const deb = c.totalDebit || 0;
    const cred = c.totalCredit || 0;
    const due = c.pendingDue || 0;
    const net = c.netBalance || 0;

    totalDebit += deb;
    totalCredit += cred;
    totalPendingDue += due;
    if (net > 0) totalAdvanceHeld += net;
  });

  const rowsHtml = customers.map((c, idx) => {
    const idDisplay = c.idCode || `#${(idx + 1).toString().padStart(4, '0')}`;
    const deb = (c.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const cred = (c.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    
    let balanceHtml = '';
    if ((c.pendingDue || 0) > 0) {
      balanceHtml = `<span style="color:#DC2626; font-weight:800;">₹ ${(c.pendingDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Due)</span>`;
    } else if ((c.netBalance || 0) > 0) {
      balanceHtml = `<span style="color:#0284C7; font-weight:800;">+₹ ${(c.netBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)</span>`;
    } else {
      balanceHtml = `<span style="color:#16A34A; font-weight:700;">₹ 0.00 (Settled)</span>`;
    }

    return `
      <tr class="list-row">
        <td class="text-center" style="width: 35px;">${idx + 1}</td>
        <td class="text-center" style="width: 60px; font-weight:700; color:#475569;">${idDisplay}</td>
        <td style="font-weight:800; color:#0F172A;">
          ${c.name}
          ${c.gst && c.gst !== 'N/A' ? `<div style="font-size:9.5px; color:#64748B; font-weight:600;">GSTIN: ${c.gst}</div>` : ''}
        </td>
        <td style="font-size:11px; color:#334155; width:95px;">${c.mobile || '-'}</td>
        <td style="font-size:10.5px; color:#475569; max-width:180px;">${c.address || '-'}</td>
        <td class="text-right" style="font-weight:700; color:#1E293B; width:105px;">₹ ${deb}</td>
        <td class="text-right" style="font-weight:700; color:#16A34A; width:105px;">₹ ${cred}</td>
        <td class="text-right" style="width:130px;">${balanceHtml}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${reportTitle} - ${compName} - ${currentDate}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 10mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .report-container {
      width: 100%;
      padding: 6px;
    }
    .company-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .comp-name {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: #0B4DB7;
    }
    .comp-sub {
      font-size: 10.5px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .report-heading {
      font-size: 14.5px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 3px;
    }
    .date-badge {
      display: inline-block;
      background-color: #EFF6FF;
      color: #0B4DB7;
      border: 1px solid #BFDBFE;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      margin-top: 4px;
    }
    .meta-box {
      text-align: right;
      font-size: 11px;
      color: #334155;
      line-height: 1.35;
    }
    .meta-bold {
      font-weight: 700;
      color: #000000;
    }
    .kpi-summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 5px;
      padding: 6px 8px;
      background-color: #F8FAFC;
    }
    .kpi-title {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }
    .kpi-val {
      font-size: 13.5px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 2px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      border: 1px solid #000000;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background-color: #F1F5F9;
      color: #0F172A;
      font-weight: 800;
      font-size: 10.5px;
      padding: 6px 5px;
      border: 1px solid #94A3B8;
      text-align: left;
      letter-spacing: 0.02em;
    }
    .data-table td {
      padding: 5px 5px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .totals-row td {
      background-color: #F8FAFC;
      border-top: 2px solid #000000 !important;
      border-bottom: 2px solid #000000 !important;
      font-size: 11.5px;
      font-weight: 900;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 22px;
      padding: 0 15px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 160px;
    }
    .sig-line {
      border-top: 1px solid #000000;
      margin-bottom: 4px;
    }
    .sig-label {
      font-size: 10.5px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header Banner -->
    <div class="company-banner">
      <div>
        <div class="comp-name">${compName}</div>
        <div class="comp-sub">${compSub}</div>
        <div class="report-heading">${reportTitle}</div>
        ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
      </div>
      <div class="meta-box">
        <div>Generated: <span class="meta-bold">${currentDate} ${currentTime}</span></div>
        <div>Total Records: <span class="meta-bold">${customers.length} Customers</span></div>
        <div>Phone: ${phoneVal}</div>
      </div>
    </div>

    <!-- Summary Metrics -->
    <div class="kpi-summary-grid">
      <div class="kpi-card">
        <div class="kpi-title">Total Customers</div>
        <div class="kpi-val">${customers.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Total Debit (Purchases)</div>
        <div class="kpi-val">₹ ${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Total Credit (Paid)</div>
        <div class="kpi-val" style="color:#16A34A;">₹ ${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card" style="background-color:#FEF2F2; border-color:#FECACA;">
        <div class="kpi-title" style="color:#991B1B;">Total Pending Due</div>
        <div class="kpi-val" style="color:#DC2626;">₹ ${totalPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card" style="background-color:#F0F9FF; border-color:#BAE6FD;">
        <div class="kpi-title" style="color:#0369A1;">Total Advance Balances</div>
        <div class="kpi-val" style="color:#0284C7;">₹ ${totalAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
    </div>

    <!-- Master Customer Table -->
    <table class="data-table">
      <thead>
        <tr>
          <th class="text-center" style="width: 35px;">#</th>
          <th class="text-center" style="width: 60px;">ID</th>
          <th>Customer Name</th>
          <th style="width: 95px;">Mobile</th>
          <th>Address</th>
          <th class="text-right" style="width: 105px;">Debit (Dr)</th>
          <th class="text-right" style="width: 105px;">Credit (Cr)</th>
          <th class="text-right" style="width: 130px;">Net Balance / Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="8" class="text-center" style="padding: 20px;">No customer records found for the selected range.</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="totals-row">
          <td colspan="5" class="text-right" style="padding-right: 10px;">GRAND TOTALS (${customers.length} Customers):</td>
          <td class="text-right">₹ ${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="text-right" style="color:#16A34A;">₹ ${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="text-right">
            ${
              totalPendingDue > 0
                ? `<span style="color:#DC2626;">Due: ₹ ${totalPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>`
                : `<span style="color:#16A34A;">Settled</span>`
            }
          </td>
        </tr>
      </tfoot>
    </table>

    <!-- Signature Section -->
    <div class="signature-section">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Prepared By</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Checked & Verified By</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

export const printCustomerListDirectly = (customers: any[], reportTitle?: string, dateRangeText?: string) => {
  const htmlContent = generateCustomerListPrintHtml(customers, reportTitle, dateRangeText);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Customer Account Statement / Ledger History (A4 Standard)
 */
export const generateLedgerStatementHtml = (
  customerName: string,
  ledgerEntries: any[],
  dateRangeText?: string
): string => {
  const storeSettings = getStoredSettings();
  const compName = (storeSettings.companyName || 'SIVA BALAJI CRACKERS').toUpperCase();
  const compSub = storeSettings.tagline || `Wholesale & Retail Trading • ${storeSettings.city || 'Sivakasi'}`;

  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  let totalDeb = 0;
  let totalCred = 0;

  const rowsHtml = ledgerEntries.map((entry, idx) => {
    const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
    const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
    totalDeb += deb;
    totalCred += cred;

    return `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="text-center">${entry.date || '-'}</td>
        <td style="font-weight:700;">${entry.billNo ? `Bill #${entry.billNo}` : entry.type || 'PAYMENT'}</td>
        <td>${entry.companyName || '-'}</td>
        <td class="text-right" style="color:#1E293B; font-weight:700;">${deb > 0 ? `₹ ${deb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
        <td class="text-right" style="color:#16A34A; font-weight:700;">${cred > 0 ? `₹ ${cred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
        <td class="text-right" style="font-weight:800;">₹ ${entry.balance || '0.00'}</td>
      </tr>
    `;
  }).join('');

  const netBalance = totalCred - totalDeb;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Account Statement - ${customerName} - ${compName}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #000; margin:0; padding:10px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .title { font-size: 24px; font-weight: 900; color: #0B4DB7; }
    .sub { font-size: 11px; color: #64748B; font-weight: 700; text-transform: uppercase; }
    .date-badge { display: inline-block; background: #EFF6FF; color: #0B4DB7; border: 1px solid #BFDBFE; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-top: 4px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #000; margin-top: 8px; }
    .table th { background: #F1F5F9; border: 1px solid #94A3B8; padding: 6px; font-weight: 800; font-size: 11px; }
    .table td { border: 1px solid #CBD5E1; padding: 5px 6px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals td { background: #F8FAFC; border-top: 2px solid #000; font-weight: 800; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${compName}</div>
      <div class="sub">${compSub}</div>
      <h2 style="font-size:15px; margin-top:4px;">ACCOUNT STATEMENT: ${customerName}</h2>
      ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
    </div>
    <div style="text-align:right; font-size:11.5px;">
      <div>Generated: <b>${currentDate}</b></div>
      <div>Total Entries: <b>${ledgerEntries.length}</b></div>
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th class="text-center" style="width:35px;">#</th>
        <th class="text-center" style="width:85px;">Date</th>
        <th>Particulars / Bill No</th>
        <th>Company</th>
        <th class="text-right" style="width:110px;">Debit (Dr)</th>
        <th class="text-right" style="width:110px;">Credit (Cr)</th>
        <th class="text-right" style="width:120px;">Balance (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="7" class="text-center" style="padding:18px;">No transaction entries found for the selected period.</td></tr>'}
    </tbody>
    <tfoot>
      <tr class="totals">
        <td colspan="4" class="text-right">TOTALS:</td>
        <td class="text-right">₹ ${totalDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right" style="color:#16A34A;">₹ ${totalCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right" style="color:${netBalance < 0 ? '#DC2626' : '#16A34A'};">
          ₹ ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${netBalance < 0 ? 'Dr' : 'Cr'}
        </td>
      </tr>
    </tfoot>
  </table>
</body>
</html>
  `;
};

export const printLedgerStatementDirectly = (customerName: string, ledgerEntries: any[], dateRangeText?: string) => {
  const htmlContent = generateLedgerStatementHtml(customerName, ledgerEntries, dateRangeText);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Particulars Bills Master List (A4 Standard)
 */
export const generateParticularsListPrintHtml = (particulars: any[], dateRangeText?: string): string => {
  const storeSettings = getStoredSettings();
  const compName = (storeSettings.companyName || 'SIVA BALAJI CRACKERS').toUpperCase();
  const compSub = storeSettings.tagline || `Wholesale & Retail Trading • ${storeSettings.city || 'Sivakasi'}`;

  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  let totalSum = 0;

  const rowsHtml = particulars.map((p, idx) => {
    const amt = parseFloat(String(p.total || p.amount || '0').replace(/,/g, '')) || 0;
    totalSum += amt;
    const countItems = (p.products || []).length;
    const billCompName = (p.companyName && p.companyName.trim() !== '' && p.companyName !== 'General')
      ? p.companyName
      : storeSettings.companyName || '-';

    return `
      <tr>
        <td class="text-center" style="width:35px;">${idx + 1}</td>
        <td class="text-center" style="font-weight:800; color:#0B4DB7; width:75px;">#${p.billNo || '-'}</td>
        <td class="text-center" style="width:85px;">${p.date || '-'}</td>
        <td style="font-weight:700;">${p.customerName || '-'}</td>
        <td>${billCompName}</td>
        <td class="text-center" style="width:60px;">${p.caseCount || '-'}</td>
        <td class="text-center" style="width:75px;">${countItems} items</td>
        <td class="text-right" style="font-weight:800; width:120px;">₹ ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Particulars Bills Master Report - ${compName} - ${currentDate}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #000; margin:0; padding:10px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .title { font-size: 24px; font-weight: 900; color: #0B4DB7; }
    .date-badge { display: inline-block; background: #EFF6FF; color: #0B4DB7; border: 1px solid #BFDBFE; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-top: 4px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #000; margin-top: 8px; }
    .table th { background: #F1F5F9; border: 1px solid #94A3B8; padding: 6px; font-weight: 800; }
    .table td { border: 1px solid #CBD5E1; padding: 5px 6px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals td { background: #F8FAFC; border-top: 2px solid #000; font-weight: 900; font-size: 11.5px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${compName}</div>
      <div style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">${compSub}</div>
      <h2 style="font-size:15px; margin-top:4px;">PARTICULARS BILLS MASTER REPORT</h2>
      ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
    </div>
    <div style="text-align:right; font-size:11.5px;">
      <div>Generated: <b>${currentDate}</b></div>
      <div>Total Bills: <b>${particulars.length}</b></div>
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th class="text-center" style="width:35px;">#</th>
        <th class="text-center" style="width:75px;">Bill No</th>
        <th class="text-center" style="width:85px;">Date</th>
        <th>Customer Name</th>
        <th>Company</th>
        <th class="text-center" style="width:60px;">Cases</th>
        <th class="text-center" style="width:75px;">Products</th>
        <th class="text-right" style="width:120px;">Total Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="8" class="text-center" style="padding:18px;">No bill records found for the selected period.</td></tr>'}
    </tbody>
    <tfoot>
      <tr class="totals">
        <td colspan="7" class="text-right">GRAND TOTAL (${particulars.length} Bills):</td>
        <td class="text-right">₹ ${totalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>
  `;
};

export const printParticularsListDirectly = (particulars: any[], dateRangeText?: string) => {
  const htmlContent = generateParticularsListPrintHtml(particulars, dateRangeText);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Companies List (A4 Standard)
 */
export const generateCompaniesListPrintHtml = (companies: any[]): string => {
  const storeSettings = getStoredSettings();
  const compName = (storeSettings.companyName || 'SIVA BALAJI CRACKERS').toUpperCase();
  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const rowsHtml = companies.map((c, idx) => `
    <tr>
      <td class="text-center" style="width:40px;">${idx + 1}</td>
      <td style="font-weight:700; color:#0F172A;">${c.name}</td>
      <td style="color:#334155;">${c.gstin || '-'}</td>
      <td style="color:#475569;">${c.address || '-'}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Companies List - ${compName} - ${currentDate}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin:0; padding:10px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #000; }
    .table th { background: #F1F5F9; border: 1px solid #94A3B8; padding: 7px; font-weight: 800; }
    .table td { border: 1px solid #CBD5E1; padding: 6px; }
    .text-center { text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:24px; font-weight:900; color:#0B4DB7;">${compName}</div>
      <h2 style="font-size:15px;">COMPANIES DIRECTORY</h2>
    </div>
    <div style="text-align:right; font-size:11.5px;">
      <div>Date: <b>${currentDate}</b></div>
      <div>Total Companies: <b>${companies.length}</b></div>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th class="text-center">#</th>
        <th>Company Name</th>
        <th>GSTIN</th>
        <th>Address</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="4" class="text-center">No companies found.</td></tr>'}
    </tbody>
  </table>
</body>
</html>
  `;
};

export const printCompaniesListDirectly = (companies: any[]) => {
  const htmlContent = generateCompaniesListPrintHtml(companies);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Products List (A4 Standard)
 */
export const generateProductsListPrintHtml = (products: any[]): string => {
  const storeSettings = getStoredSettings();
  const compName = (storeSettings.companyName || 'SIVA BALAJI CRACKERS').toUpperCase();
  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const rowsHtml = products.map((p, idx) => `
    <tr>
      <td class="text-center" style="width:40px;">${idx + 1}</td>
      <td style="font-weight:700; color:#0F172A;">${p.name}</td>
      <td class="text-center" style="color:#64748B;">${p.hsnCode || '-'}</td>
      <td style="text-align:right; font-weight:700; color:#0B4DB7;">₹ ${(parseFloat(p.rate) || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Products Catalog - ${compName} - ${currentDate}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin:0; padding:10px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #000; }
    .table th { background: #F1F5F9; border: 1px solid #94A3B8; padding: 7px; font-weight: 800; }
    .table td { border: 1px solid #CBD5E1; padding: 6px; }
    .text-center { text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:24px; font-weight:900; color:#0B4DB7;">${compName}</div>
      <h2 style="font-size:15px;">PRODUCTS PRICE CATALOG</h2>
    </div>
    <div style="text-align:right; font-size:11.5px;">
      <div>Date: <b>${currentDate}</b></div>
      <div>Total Products: <b>${products.length}</b></div>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th class="text-center">#</th>
        <th>Product Name</th>
        <th class="text-center">HSN Code</th>
        <th style="text-align:right;">Default Rate</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="4" class="text-center">No products found.</td></tr>'}
    </tbody>
  </table>
</body>
</html>
  `;
};

export const printProductsListDirectly = (products: any[]) => {
  const htmlContent = generateProductsListPrintHtml(products);
  triggerBrowserPrint(htmlContent);
};

/**
 * Reusable hidden-iframe print helper with image loading support
 */
const triggerBrowserPrint = (htmlContent: string) => {
  let iframe = document.getElementById('dheeksha-print-iframe') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'dheeksha-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();

    const doPrint = () => {
      setTimeout(() => {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      }, 150);
    };

    // Wait for all images in the print document to load
    const images = Array.from(doc.images);
    if (images.length === 0) {
      doPrint();
    } else {
      let loaded = 0;
      const total = images.length;
      const checkAllLoaded = () => {
        loaded++;
        if (loaded >= total) {
          doPrint();
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          checkAllLoaded();
        } else {
          img.onload = checkAllLoaded;
          img.onerror = checkAllLoaded;
        }
      });

      // Safety timeout
      setTimeout(doPrint, 1200);
    }
  }
};
