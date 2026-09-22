import type { BillPrintData, BillPrintFormat } from '../components/BillPrintTemplate';
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

interface BillCalculations {
  subtotal: number;
  discountAmt: number;
  discountLabel: string;
  transportAmt: number;
  transportDisplayName: string;
  packingAmt: number;
  packingLabel: string;
  taxAmt: number;
  taxLabel: string;
  finalTotalNum: number;
  formattedTotal: string;
  computedCases: string | number;
  displayCompanyName: string;
  fullAddressLine: string;
  contactLine: string;
  taxLine: string;
  hasBankDetails: boolean;
  receiptSrc: string;
  rawProducts: any[];
}

const computeBillDetails = (bill: BillPrintData): BillCalculations => {
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

  // Packing calculation
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

  // Grand Total
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

  const addressParts = [
    storeSettings.address,
    storeSettings.city,
    storeSettings.state,
    storeSettings.pincode ? `PIN: ${storeSettings.pincode}` : '',
  ].filter(Boolean);
  const fullAddressLine = addressParts.length > 0 ? addressParts.join(', ') : 'Sivakasi, Tamil Nadu';

  const contactItems = [
    storeSettings.phone ? `Mobile: ${storeSettings.phone}` : '',
    storeSettings.whatsapp ? `WhatsApp: ${storeSettings.whatsapp}` : '',
    storeSettings.email ? `Email: ${storeSettings.email}` : '',
  ].filter(Boolean);
  const contactLine = contactItems.join(' | ');

  const isTaxActive = Boolean(storeSettings.enableTax) || (parseFloat(String(bill.tax || '0').replace(/[^0-9.]/g, '')) > 0);
  const taxItems = [
    (isTaxActive && storeSettings.gstin) ? `GSTIN: ${storeSettings.gstin}` : '',
    storeSettings.pan ? `PAN: ${storeSettings.pan}` : '',
    storeSettings.ownerName ? `Prop: ${storeSettings.ownerName}` : '',
  ].filter(Boolean);
  const taxLine = taxItems.join(' | ');

  const hasBankDetails = Boolean(
    storeSettings.bankName || storeSettings.bankAccountNo || storeSettings.bankIfsc || storeSettings.upiId
  );

  const receiptSrc = bill.pdfData || bill.pdfUrl || '';
  const rawProducts = bill.products || [];

  return {
    subtotal,
    discountAmt,
    discountLabel,
    transportAmt,
    transportDisplayName,
    packingAmt,
    packingLabel,
    taxAmt,
    taxLabel,
    finalTotalNum,
    formattedTotal,
    computedCases,
    displayCompanyName,
    fullAddressLine,
    contactLine,
    taxLine,
    hasBankDetails,
    receiptSrc,
    rawProducts,
  };
};

/**
 * Generates A4 Portrait HTML
 */
const generateA4PortraitHtml = (bill: BillPrintData): string => {
  const calc = computeBillDetails(bill);
  const storeSettings = getStoredSettings();

  const productRowsHtml = calc.rawProducts.map((item, idx) => {
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
  <title>Bill #${bill.billNo || 'Invoice'} - ${calc.displayCompanyName}</title>
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .bill-box-container {
      width: 100%;
      max-width: 800px;
      min-height: 270mm;
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
      min-height: 125px;
    }
    .receipt-img {
      max-width: 100%;
      max-height: 125px;
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
      <div class="comp-name">${calc.displayCompanyName}</div>
      ${storeSettings.tagline ? `<div class="comp-tagline">${storeSettings.tagline}</div>` : ''}
      <div class="comp-address">${calc.fullAddressLine}</div>
      ${calc.contactLine ? `<div class="comp-contact">${calc.contactLine}</div>` : ''}
      ${calc.taxLine ? `<div class="comp-tax">${calc.taxLine}</div>` : ''}
    </div>

    <!-- Metadata Grid Table -->
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
            <span class="meta-val">${calc.displayCompanyName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 3px;">
            <div>
              <span class="meta-label">Transport:</span>
              <span class="meta-val">${calc.transportDisplayName}</span>
            </div>
            <div>
              <span class="meta-label">Total Pieces:</span>
              <span class="meta-val">${calc.computedCases}</span>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Products Table -->
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

    <!-- Bottom Section -->
    <div class="bottom-section">
      <div class="left-side-area">
        ${
          calc.receiptSrc
            ? `
            <div style="display: flex; align-items: center; justify-content: center; flex: 1;">
              <img src="${calc.receiptSrc}" class="receipt-img" alt="Transport Receipt" />
            </div>
            `
            : calc.hasBankDetails
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

      <!-- Right Column: Summary Table -->
      <div class="summary-area">
        <table class="summary-table">
          <tbody>
            <tr>
              <td class="summary-label-cell">Particular Amount</td>
              <td class="summary-val-cell">${calc.subtotal.toFixed(2)}</td>
            </tr>
            ${
              calc.discountAmt > 0
                ? `<tr>
                    <td class="summary-label-cell">${calc.discountLabel}</td>
                    <td class="summary-val-cell">-${calc.discountAmt.toFixed(2)}</td>
                  </tr>`
                : ''
            }
            ${
              calc.transportAmt > 0
                ? `<tr>
                    <td class="summary-label-cell">Transport Charges</td>
                    <td class="summary-val-cell">+${calc.transportAmt.toFixed(2)}</td>
                  </tr>`
                : ''
            }
            ${
              calc.packingAmt > 0
                ? `<tr>
                    <td class="summary-label-cell">${calc.packingLabel}</td>
                    <td class="summary-val-cell">+${calc.packingAmt.toFixed(2)}</td>
                  </tr>`
                : ''
            }
            ${
              calc.taxAmt > 0
                ? `<tr>
                    <td class="summary-label-cell">${calc.taxLabel}</td>
                    <td class="summary-val-cell">+${calc.taxAmt.toFixed(2)}</td>
                  </tr>`
                : ''
            }
            <tr class="summary-total-row">
              <td style="font-weight: 800; font-size: 12px;">Total Amount</td>
              <td class="summary-val-cell" style="font-size: 13.5px; font-weight: 900; color: #000000;">${calc.formattedTotal}</td>
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
 * Generates A4 Landscape Single Wide Bill HTML
 */
const generateA4LandscapeHtml = (bill: BillPrintData): string => {
  const calc = computeBillDetails(bill);
  const storeSettings = getStoredSettings();

  const productRowsHtml = calc.rawProducts.map((item, idx) => {
    const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
    const numRate = parseFloat(String(item.rate).replace(/,/g, '')) || 0;
    return `
      <tr>
        <td style="border: 1px solid #000000; padding: 3px 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #000000; padding: 3px 8px; text-align: left; font-weight: 600;">${item.particular || '-'}</td>
        <td style="border: 1px solid #000000; padding: 3px 6px; text-align: center;">${item.quantity || '-'}</td>
        <td style="border: 1px solid #000000; padding: 3px 6px; text-align: right;">${numRate > 0 ? numRate.toFixed(2) : (item.rate || '-')}</td>
        <td style="border: 1px solid #000000; padding: 3px 6px; text-align: center;">${item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : ''}</td>
        <td style="border: 1px solid #000000; padding: 3px 8px; text-align: right; font-weight: 700;">${numAmt.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill #${bill.billNo || 'Invoice'} (Landscape) - ${calc.displayCompanyName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 5mm 8mm;
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
    .landscape-bill-container {
      width: 100%;
      max-width: 100%;
      min-height: 190mm;
      margin: 0 auto;
      border: 1.5px solid #000000;
      background: #ffffff;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .land-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 14px;
      border-bottom: 1.5px solid #000000;
      background: #fafafa;
    }
    .land-comp-title {
      font-size: 20px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.01em;
      color: #000000;
      line-height: 1.1;
    }
    .land-comp-sub {
      font-size: 10.5px;
      font-weight: 600;
      color: #334155;
      margin-top: 1px;
    }
    .land-meta-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 1.5px solid #000000;
      font-size: 11px;
    }
    .land-meta-table td {
      border: 1px solid #000000;
      padding: 4px 8px;
      vertical-align: top;
    }
    .land-prod-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 1.5px solid #000000;
      font-size: 11px;
      table-layout: fixed;
    }
    .land-prod-table th {
      background-color: #f1f5f9;
      border: 1px solid #000000;
      padding: 4px 6px;
      font-weight: 700;
    }
    .land-prod-table td {
      border: 1px solid #000000;
      padding: 3px 6px;
    }
    .land-bottom {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      margin-top: auto;
      background: #ffffff;
    }
    .land-left {
      flex: 1 1 55%;
      border-right: 1.5px solid #000000;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 95px;
    }
    .land-right {
      flex: 1 1 45%;
      padding: 0;
    }
    .land-sum-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .land-sum-table td {
      border: 1px solid #000000;
      padding: 3px 6px;
    }
  </style>
</head>
<body>
  <div class="landscape-bill-container">
    <!-- Header -->
    <div class="land-header">
      <div style="display: flex; align-items: center; gap: 10px;">
        ${storeSettings.logoUrl ? `<img src="${storeSettings.logoUrl}" alt="Logo" style="max-height:36px; max-width:110px; object-fit:contain;" />` : ''}
        <div>
          <div class="land-comp-title">${calc.displayCompanyName}</div>
          <div class="land-comp-sub">${calc.fullAddressLine} ${calc.contactLine ? `| ${calc.contactLine}` : ''}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 13px; font-weight: 900; color: #000000; border: 1.5px solid #000000; padding: 2px 8px; border-radius: 4px; display: inline-block;">
          TAX INVOICE / BILL
        </div>
        ${calc.taxLine ? `<div style="font-size: 10px; font-weight: 700; color: #334155; margin-top: 2px;">${calc.taxLine}</div>` : ''}
      </div>
    </div>

    <!-- 3-Column Metadata Table -->
    <table class="land-meta-table">
      <tr>
        <td style="width: 38%;">
          <div style="color: #475569; font-weight: 600; font-size: 10px;">BILL TO:</div>
          <div style="font-size: 13px; font-weight: 800; color: #000000;">${bill.customerName || '-'}</div>
          ${bill.customerPhone ? `<div style="font-size: 10.5px; color: #1e293b;">Mobile: <strong>${bill.customerPhone}</strong></div>` : ''}
          ${bill.customerAddress ? `<div style="font-size: 10px; color: #475569;">${bill.customerAddress}</div>` : ''}
          ${bill.customerGst ? `<div style="font-size: 10px; font-weight: 700;">GSTIN: ${bill.customerGst}</div>` : ''}
        </td>
        <td style="width: 32%;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: #475569;">Invoice No:</span>
            <strong style="font-size: 12px;">#${bill.billNo || '-'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: #475569;">Invoice Date:</span>
            <strong>${bill.date || '-'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #475569;">Billed By:</span>
            <strong>${calc.displayCompanyName}</strong>
          </div>
        </td>
        <td style="width: 30%;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: #475569;">Transport / Lorry:</span>
            <strong>${calc.transportDisplayName}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: #475569;">Total Pieces:</span>
            <strong style="font-size: 12px; color: #0b4db7;">${calc.computedCases}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #475569;">Total Line Items:</span>
            <strong>${calc.rawProducts.length} Items</strong>
          </div>
        </td>
      </tr>
    </table>

    <!-- Product Items Table -->
    <div style="flex: 1 1 auto;">
      <table class="land-prod-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">Si.No</th>
            <th style="text-align: left; padding: 4px 8px;">Particular / Product Description</th>
            <th style="width: 80px; text-align: center;">Qty</th>
            <th style="width: 90px; text-align: right;">Rate (₹)</th>
            <th style="width: 80px; text-align: center;">Unit</th>
            <th style="width: 120px; text-align: right; padding: 4px 8px;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${productRowsHtml || '<tr><td colspan="6" style="text-align:center; padding:12px; border:1px solid #000;">No product items in bill</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Bottom Section -->
    <div class="land-bottom">
      <div class="land-left">
        ${
          calc.receiptSrc
            ? `<div style="display:flex; justify-content:center; align-items:center;"><img src="${calc.receiptSrc}" style="max-height:85px; max-width:100%; object-fit:contain;" alt="Receipt" /></div>`
            : calc.hasBankDetails
            ? `
            <div style="font-size: 10px; color: #1e293b;">
              <strong style="text-transform: uppercase;">Bank & Payment Details:</strong>
              ${storeSettings.bankName ? `<div>Bank: <b>${storeSettings.bankName}</b> | A/C: <b>${storeSettings.bankAccountNo || '-'}</b></div>` : ''}
              ${storeSettings.bankIfsc ? `<div>IFSC: <b>${storeSettings.bankIfsc}</b> ${storeSettings.upiId ? `| UPI: <b>${storeSettings.upiId}</b>` : ''}</div>` : ''}
            </div>
            `
            : `<div style="font-size: 10.5px; color: #64748b; font-style: italic;">Thank you for your business!</div>`
        }
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 6px;">
          <div style="font-size: 9.5px; color: #64748b;">Terms: Goods once sold will not be taken back.</div>
          <div style="font-size: 10.5px; font-weight: 700; border-top: 1px dashed #000000; padding-top: 2px; width: 140px; text-align: center;">
            Authorized Signatory
          </div>
        </div>
      </div>

      <!-- Right Summary -->
      <div class="land-right">
        <table class="land-sum-table">
          <tbody>
            <tr>
              <td style="color: #475569;">Particular Amount</td>
              <td style="text-align: right; font-weight: 600;">₹ ${calc.subtotal.toFixed(2)}</td>
            </tr>
            ${calc.discountAmt > 0 ? `<tr><td style="color: #475569;">${calc.discountLabel}</td><td style="text-align: right; font-weight: 600; color: #dc2626;">-₹ ${calc.discountAmt.toFixed(2)}</td></tr>` : ''}
            ${calc.transportAmt > 0 ? `<tr><td style="color: #475569;">Transport Charges</td><td style="text-align: right; font-weight: 600;">+₹ ${calc.transportAmt.toFixed(2)}</td></tr>` : ''}
            ${calc.packingAmt > 0 ? `<tr><td style="color: #475569;">${calc.packingLabel}</td><td style="text-align: right; font-weight: 600;">+₹ ${calc.packingAmt.toFixed(2)}</td></tr>` : ''}
            ${calc.taxAmt > 0 ? `<tr><td style="color: #475569;">${calc.taxLabel}</td><td style="text-align: right; font-weight: 600;">+₹ ${calc.taxAmt.toFixed(2)}</td></tr>` : ''}
            <tr style="background-color: #f8fafc; border-top: 1.5px solid #000000;">
              <td style="font-weight: 800; font-size: 11.5px; padding: 5px 6px;">TOTAL AMOUNT</td>
              <td style="text-align: right; font-size: 13.5px; font-weight: 900; color: #000000; padding: 5px 6px;">${calc.formattedTotal}</td>
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
 * Generates A4 2-in-1 Dual Copy Bill (Side-by-Side on Landscape Sheet)
 */
const generateA4DualCopyHtml = (bill: BillPrintData): string => {
  const calc = computeBillDetails(bill);
  const storeSettings = getStoredSettings();

  const renderSingleMiniBill = (copyTitle: string) => {
    const productRows = calc.rawProducts.map((item, idx) => {
      const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
      const numRate = parseFloat(String(item.rate).replace(/,/g, '')) || 0;
      return `
        <tr>
          <td style="border: 1px solid #000000; padding: 2px 4px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #000000; padding: 2px 5px; text-align: left; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">${item.particular || '-'}</td>
          <td style="border: 1px solid #000000; padding: 2px 4px; text-align: center;">${item.quantity || '-'}</td>
          <td style="border: 1px solid #000000; padding: 2px 4px; text-align: right;">${numRate > 0 ? numRate.toFixed(2) : (item.rate || '-')}</td>
          <td style="border: 1px solid #000000; padding: 2px 5px; text-align: right; font-weight: 700;">${numAmt.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="mini-bill-card">
        <!-- Top Banner -->
        <div style="border-bottom: 1.5px solid #000000; padding: 4px 6px; text-align: center; background-color: #fafafa;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 8.5px; font-weight: 800; background: #000; color: #fff; padding: 1px 4px; border-radius: 2px;">
              ${copyTitle}
            </div>
            <div style="font-size: 14px; font-weight: 900; text-transform: uppercase;">
              ${calc.displayCompanyName}
            </div>
            <div style="font-size: 8.5px; font-weight: 700; color: #475569;">
              BILL #${bill.billNo || '-'}
            </div>
          </div>
          <div style="font-size: 9px; color: #334155; margin-top: 1px;">
            ${calc.fullAddressLine} ${calc.contactLine ? `| ${calc.contactLine}` : ''}
          </div>
        </div>

        <!-- Meta -->
        <table style="width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000000; font-size: 9.5px;">
          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px; width: 50%;">
              <div><span style="color: #64748b;">Customer:</span> <b>${bill.customerName || '-'}</b></div>
              ${bill.customerPhone ? `<div><span style="color: #64748b;">Mob:</span> ${bill.customerPhone}</div>` : ''}
              ${bill.customerAddress ? `<div style="color: #475569;">${bill.customerAddress}</div>` : ''}
            </td>
            <td style="border: 1px solid #000; padding: 3px 5px; width: 50%;">
              <div style="display: flex; justify-content: space-between;">
                <span>Date: <b>${bill.date || '-'}</b></span>
                <span>Pieces: <b>${calc.computedCases}</b></span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 1px;">
                <span>Transport: <b>${calc.transportDisplayName}</b></span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Product Table -->
        <div style="flex: 1 1 auto;">
          <table style="width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000000; font-size: 9.5px;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="border: 1px solid #000; padding: 3px 2px; width: 22px; text-align: center;">#</th>
                <th style="border: 1px solid #000; padding: 3px 4px; text-align: left;">Particular</th>
                <th style="border: 1px solid #000; padding: 3px 2px; width: 35px; text-align: center;">Qty</th>
                <th style="border: 1px solid #000; padding: 3px 2px; width: 45px; text-align: right;">Rate</th>
                <th style="border: 1px solid #000; padding: 3px 4px; width: 60px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${productRows || '<tr><td colspan="5" style="text-align:center; padding:10px;">No items</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Mini Bottom -->
        <div style="display: flex; justify-content: space-between; align-items: stretch; margin-top: auto; border-top: 1px solid #000;">
          <div style="flex: 1 1 45%; padding: 4px; font-size: 8.5px; border-right: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between;">
            ${
              calc.hasBankDetails
                ? `<div>Bank: <b>${storeSettings.bankName || '-'}</b><br/>A/C: ${storeSettings.bankAccountNo || '-'}</div>`
                : `<div style="font-style:italic;">Thank you!</div>`
            }
            <div style="border-top: 1px dashed #000; padding-top: 2px; text-align: center; font-weight: 700; margin-top: 4px;">
              Authorized Signatory
            </div>
          </div>
          <div style="flex: 1 1 55%; padding: 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
              <tr>
                <td style="padding: 2px 4px; border-bottom: 1px solid #ccc; color: #475569;">Subtotal:</td>
                <td style="padding: 2px 4px; border-bottom: 1px solid #ccc; text-align: right; font-weight: 600;">₹${calc.subtotal.toFixed(2)}</td>
              </tr>
              ${calc.discountAmt > 0 ? `<tr><td style="padding: 1px 4px; color: #dc2626;">Disc:</td><td style="padding: 1px 4px; text-align: right; color: #dc2626;">-₹${calc.discountAmt.toFixed(2)}</td></tr>` : ''}
              ${calc.transportAmt > 0 ? `<tr><td style="padding: 1px 4px;">Transport:</td><td style="padding: 1px 4px; text-align: right;">+₹${calc.transportAmt.toFixed(2)}</td></tr>` : ''}
              ${calc.taxAmt > 0 ? `<tr><td style="padding: 1px 4px;">Tax:</td><td style="padding: 1px 4px; text-align: right;">+₹${calc.taxAmt.toFixed(2)}</td></tr>` : ''}
              <tr style="background-color: #f8fafc; border-top: 1.5px solid #000;">
                <td style="padding: 3px 4px; font-weight: 900; font-size: 10.5px;">TOTAL:</td>
                <td style="padding: 3px 4px; text-align: right; font-weight: 900; font-size: 11.5px;">${calc.formattedTotal}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Dual Bill #${bill.billNo || 'Invoice'} - ${calc.displayCompanyName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 4mm 5mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .dual-wrapper {
      display: flex;
      width: 100%;
      height: 195mm;
      box-sizing: border-box;
      page-break-inside: avoid;
    }
    .mini-bill-card {
      flex: 1 1 50%;
      border: 1.5px solid #000000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      background: #ffffff;
    }
    .dual-cut-line {
      width: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .dual-cut-line::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      border-left: 1.5px dashed #000000;
    }
    .cut-icon {
      background: #ffffff;
      padding: 4px 0;
      z-index: 1;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="dual-wrapper">
    ${renderSingleMiniBill('ORIGINAL (CUSTOMER COPY)')}
    <div class="dual-cut-line">
      <span class="cut-icon">✂</span>
    </div>
    ${renderSingleMiniBill('DUPLICATE (TRANSPORT / OFFICE COPY)')}
  </div>
</body>
</html>
  `;
};

/**
 * Generates Thermal POS Slip HTML (80mm / 3 inch)
 */
const generateThermalHtml = (bill: BillPrintData): string => {
  const calc = computeBillDetails(bill);
  const storeSettings = getStoredSettings();

  const productRows = calc.rawProducts.map((item, idx) => {
    const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
    const numRate = parseFloat(String(item.rate).replace(/,/g, '')) || 0;
    return `
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 11px;">
        <div style="flex: 1; padding-right: 4px;">
          ${idx + 1}. <b>${item.particular || '-'}</b><br/>
          <span style="color: #444; font-size: 10px;">${item.quantity || '1'} ${item.pktUnit || ''} x ₹${numRate.toFixed(2)}</span>
        </div>
        <div style="font-weight: 700; text-align: right; min-width: 60px;">
          ₹${numAmt.toFixed(2)}
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt #${bill.billNo || 'POS'} - ${calc.displayCompanyName}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 2mm 3mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .thermal-container {
      width: 74mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 4px;
      font-size: 11px;
      line-height: 1.25;
    }
    .center { text-align: center; }
    .bold { font-weight: 800; }
    .dashed-line { border-bottom: 1px dashed #000; margin: 4px 0; }
    .double-line { border-bottom: 2px solid #000; margin: 4px 0; }
    .flex-sb { display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="thermal-container">
    <div class="center">
      <div class="bold" style="font-size: 16px; text-transform: uppercase;">${calc.displayCompanyName}</div>
      ${storeSettings.tagline ? `<div style="font-size: 9.5px; font-style: italic;">${storeSettings.tagline}</div>` : ''}
      <div style="font-size: 10px;">${calc.fullAddressLine}</div>
      ${calc.contactLine ? `<div style="font-size: 9.5px;">${calc.contactLine}</div>` : ''}
      ${calc.taxLine ? `<div style="font-size: 9.5px; font-weight: 700;">${calc.taxLine}</div>` : ''}
    </div>

    <div class="dashed-line"></div>

    <div class="flex-sb" style="font-size: 10.5px;">
      <span>Bill No: <b>#${bill.billNo || '-'}</b></span>
      <span>Date: <b>${bill.date || '-'}</b></span>
    </div>
    <div style="font-size: 11px; margin-top: 2px;">
      Customer: <b>${bill.customerName || 'Cash Customer'}</b>
    </div>
    ${bill.customerPhone ? `<div style="font-size: 10px;">Phone: ${bill.customerPhone}</div>` : ''}
    ${calc.transportDisplayName !== '-' ? `<div style="font-size: 10px;">Transport: ${calc.transportDisplayName} | Pieces: ${calc.computedCases}</div>` : ''}

    <div class="dashed-line"></div>

    <div style="font-weight: 800; font-size: 10.5px; margin-bottom: 4px;" class="flex-sb">
      <span>ITEM DESCRIPTION</span>
      <span>AMOUNT</span>
    </div>

    <div class="dashed-line"></div>

    <div>
      ${productRows || '<div class="center">No items</div>'}
    </div>

    <div class="dashed-line"></div>

    <div class="flex-sb">
      <span>Particular Amount:</span>
      <b>₹${calc.subtotal.toFixed(2)}</b>
    </div>
    ${calc.discountAmt > 0 ? `<div class="flex-sb" style="color: #dc2626;"><span>${calc.discountLabel}:</span><span>-₹${calc.discountAmt.toFixed(2)}</span></div>` : ''}
    ${calc.transportAmt > 0 ? `<div class="flex-sb"><span>Transport:</span><span>+₹${calc.transportAmt.toFixed(2)}</span></div>` : ''}
    ${calc.packingAmt > 0 ? `<div class="flex-sb"><span>Packing:</span><span>+₹${calc.packingAmt.toFixed(2)}</span></div>` : ''}
    ${calc.taxAmt > 0 ? `<div class="flex-sb"><span>${calc.taxLabel}:</span><span>+₹${calc.taxAmt.toFixed(2)}</span></div>` : ''}

    <div class="double-line"></div>

    <div class="flex-sb" style="font-size: 14px; font-weight: 900;">
      <span>GRAND TOTAL:</span>
      <span>${calc.formattedTotal}</span>
    </div>

    <div class="double-line"></div>

    ${
      calc.hasBankDetails
        ? `
        <div style="font-size: 9.5px; margin-top: 4px;">
          <b>Bank Details:</b> ${storeSettings.bankName || ''} A/C: ${storeSettings.bankAccountNo || ''}<br/>
          IFSC: ${storeSettings.bankIfsc || ''} ${storeSettings.upiId ? `| UPI: ${storeSettings.upiId}` : ''}
        </div>
        `
        : ''
    }

    <div class="center" style="margin-top: 8px; font-size: 10px;">
      <div>*** THANK YOU VISIT AGAIN ***</div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Universal Bill HTML Generator supporting all print formats
 */
export const generateBillHtml = (bill: BillPrintData, format: BillPrintFormat = 'a4-portrait'): string => {
  switch (format) {
    case 'a4-landscape':
      return generateA4LandscapeHtml(bill);
    case 'a4-dual':
      return generateA4DualCopyHtml(bill);
    case 'thermal':
      return generateThermalHtml(bill);
    case 'a4-portrait':
    default:
      return generateA4PortraitHtml(bill);
  }
};

/**
 * Direct print function that opens an isolated, clean print window
 * Guaranteed to print cleanly in the chosen format (A4 Portrait, A4 Landscape, A4 Dual Copy, Thermal 80mm)!
 */
export const printBillDirectly = (bill: BillPrintData, format: BillPrintFormat = 'a4-portrait') => {
  const htmlContent = generateBillHtml(bill, format);
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .report-container {
      width: 100%;
      padding: 4px;
    }
    .company-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000000;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .comp-name {
      font-size: 22px;
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
      font-size: 14px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
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
      margin-bottom: 8px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 5px;
      padding: 5px 7px;
      background-color: #F8FAFC;
    }
    .kpi-title {
      font-size: 9px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }
    .kpi-val {
      font-size: 13px;
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
      padding: 5px 5px;
      border: 1px solid #94A3B8;
      text-align: left;
    }
    .data-table td {
      padding: 4px 5px;
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
      margin-top: 18px;
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
      font-size: 10px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="report-container">
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

    <div class="kpi-summary-grid">
      <div class="kpi-card">
        <div class="kpi-title">Total Customers</div>
        <div class="kpi-val">${customers.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Total Purchases (Dr)</div>
        <div class="kpi-val">₹ ${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Total Paid (Cr)</div>
        <div class="kpi-val" style="color:#16A34A;">₹ ${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card" style="background-color:#FEF2F2; border-color:#FECACA;">
        <div class="kpi-title" style="color:#991B1B;">Total Pending Due</div>
        <div class="kpi-val" style="color:#DC2626;">₹ ${totalPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card" style="background-color:#F0F9FF; border-color:#BAE6FD;">
        <div class="kpi-title" style="color:#0369A1;">Total Advance Held</div>
        <div class="kpi-val" style="color:#0284C7;">₹ ${totalAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
    </div>

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
    @page { size: A4 portrait; margin: 6mm 8mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #000; margin:0; padding:8px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
    .title { font-size: 22px; font-weight: 900; color: #0B4DB7; }
    .sub { font-size: 11px; color: #64748B; font-weight: 700; text-transform: uppercase; }
    .date-badge { display: inline-block; background: #EFF6FF; color: #0B4DB7; border: 1px solid #BFDBFE; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-top: 3px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #000; margin-top: 6px; }
    .table th { background: #F1F5F9; border: 1px solid #94A3B8; padding: 5px; font-weight: 800; font-size: 11px; }
    .table td { border: 1px solid #CBD5E1; padding: 4px 6px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals td { background: #F8FAFC; border-top: 2px solid #000; font-weight: 800; font-size: 11.5px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${compName}</div>
      <div class="sub">${compSub}</div>
      <h2 style="font-size:14.5px; margin-top:3px;">ACCOUNT STATEMENT: ${customerName}</h2>
      ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
    </div>
    <div style="text-align:right; font-size:11px;">
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
      ${rowsHtml || '<tr><td colspan="7" class="text-center" style="padding:16px;">No transaction entries found for the selected period.</td></tr>'}
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
    @page { size: A4 landscape; margin: 6mm 8mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #000; margin:0; padding:8px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
    .title { font-size: 22px; font-weight: 900; color: #0B4DB7; }
    .date-badge { display: inline-block; background: #EFF6FF; color: #0B4DB7; border: 1px solid #BFDBFE; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-top: 3px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #000; margin-top: 6px; }
    .table th { background: #F1F5F9; border: 1px solid #94A3B8; padding: 5px; font-weight: 800; }
    .table td { border: 1px solid #CBD5E1; padding: 4px 6px; }
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
      <h2 style="font-size:14.5px; margin-top:3px;">PARTICULARS BILLS MASTER REPORT</h2>
      ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
    </div>
    <div style="text-align:right; font-size:11px;">
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
      ${rowsHtml || '<tr><td colspan="8" class="text-center" style="padding:16px;">No bill records found for the selected period.</td></tr>'}
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
    @page { size: A4 portrait; margin: 6mm 8mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin:0; padding:8px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #000; }
    .table th { background: #F1F5F9; border: 1px solid #94A3B8; padding: 6px; font-weight: 800; }
    .table td { border: 1px solid #CBD5E1; padding: 5px; }
    .text-center { text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:22px; font-weight:900; color:#0B4DB7;">${compName}</div>
      <h2 style="font-size:14.5px;">COMPANIES DIRECTORY</h2>
    </div>
    <div style="text-align:right; font-size:11px;">
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
    @page { size: A4 portrait; margin: 6mm 8mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin:0; padding:8px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #000; }
    .table th { background: #F1F5F9; border: 1px solid #94A3B8; padding: 6px; font-weight: 800; }
    .table td { border: 1px solid #CBD5E1; padding: 5px; }
    .text-center { text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:22px; font-weight:900; color:#0B4DB7;">${compName}</div>
      <h2 style="font-size:14.5px;">PRODUCTS PRICE CATALOG</h2>
    </div>
    <div style="text-align:right; font-size:11px;">
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
 * Print Price List Direct (A4 Standard)
 */
export const generatePriceListPrintHtml = (items: any[], categoryTitle?: string): string => {
  const storeSettings = getStoredSettings();
  const compName = (storeSettings.companyName || 'BILLING & MANAGEMENT').toUpperCase();
  const compTagline = storeSettings.tagline || `Official Wholesale & Retail Price List • ${storeSettings.city || 'Sivakasi'}`;
  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

  const rowsHtml = items.map((item, idx) => `
    <tr>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 5px 6px;">${item.slNo || idx + 1}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: 700; color: #0f172a;">${item.itemName || '-'}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 6px; color: #475569;">${item.category || 'General'}</td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 5px 6px;">${item.unit || 'Box'}</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 5px 6px; color: #64748b;">₹${Number(item.mrp || 0).toFixed(2)}</td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 5px 6px; font-weight: 600;">${item.discountPercent ? `${item.discountPercent}%` : '—'}</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: 800; color: #b91c1c;">₹${Number(item.rate || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${compName} - Price List - ${currentDate}</title>
  <style>
    @page { size: A4 portrait; margin: 6mm 8mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin:0; padding:8px; color:#0f172a; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .header { text-align: center; border-bottom: 2px solid #b91c1c; padding-bottom: 8px; margin-bottom: 10px; }
    .title { font-size: 22px; font-weight: 900; color: #b91c1c; text-transform: uppercase; }
    .subtitle { font-size: 11px; color: #d97706; font-weight: 700; text-transform: uppercase; margin-top: 2px; }
    .meta { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #000; }
    th { background-color: #fef3c7; color: #78350f; font-weight: 800; border: 1px solid #94a3b8; padding: 6px; text-align: left; }
    th.center { text-align: center; }
    th.right { text-align: right; }
    tr:nth-child(even) { background-color: #f8fafc; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${compName}</div>
    <div class="subtitle">${compTagline}</div>
  </div>
  <div class="meta">
    <span><strong>Category:</strong> ${categoryTitle || 'All Products'}</span>
    <span><strong>Date:</strong> ${currentDate}</span>
    <span><strong>Total Items:</strong> ${items.length}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width: 45px;">SL.NO</th>
        <th>ITEM NAME</th>
        <th>CATEGORY</th>
        <th class="center" style="width: 65px;">UNIT</th>
        <th class="right" style="width: 80px;">M.R.P</th>
        <th class="center" style="width: 70px;">DISC %</th>
        <th class="right" style="width: 95px;">NET RATE</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding:16px;">No items in price list</td></tr>'}
    </tbody>
  </table>
</body>
</html>
  `;
};

export const printPriceListDirectly = (items: any[], categoryTitle?: string) => {
  const htmlContent = generatePriceListPrintHtml(items, categoryTitle);
  triggerBrowserPrint(htmlContent);
};

/**
 * Reusable hidden-iframe print helper with robust image loading support
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
