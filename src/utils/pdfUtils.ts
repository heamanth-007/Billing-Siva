import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { BillPrintData } from '../components/BillPrintTemplate';
import { getStoredSettings } from '../components/SettingsPage';
import { getCleanWhatsAppNumber } from './whatsappUtils';

/**
 * Calculates bill particulars and financial totals for clean rendering
 */
export const calculateBillPdfDetails = (bill: BillPrintData) => {
  const prodSubtotal = (bill.products || []).reduce((acc, p) => {
    const amt = parseFloat(String(p.amount).replace(/,/g, '')) || 0;
    return acc + amt;
  }, 0);
  const subtotal =
    prodSubtotal > 0
      ? prodSubtotal
      : parseFloat(String(bill.amount || bill.total || '0').replace(/,/g, '')) || 0;

  // Discount
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

  // Transport
  const rawTransportStr = String(bill.transport ?? '').trim();
  const cleanTrans = rawTransportStr.replace(/[^0-9.]/g, '');
  const transNum = parseFloat(cleanTrans) || 0;
  const transportAmt = !isNaN(Number(rawTransportStr)) && transNum > 0 ? transNum : 0;
  const transportDisplayName =
    !rawTransportStr || rawTransportStr === '0' || rawTransportStr === '-' ? '-' : rawTransportStr;

  // Packing
  const rawPackStr = String(bill.packing ?? '').trim();
  const cleanPack = rawPackStr.replace(/[^0-9.]/g, '');
  const packNum = parseFloat(cleanPack) || 0;
  let packingAmt = 0;
  let packingLabel = 'Packing Charges';
  if (packNum > 0) {
    if (rawPackStr.startsWith('₹')) {
      packingAmt = packNum;
    } else {
      packingAmt = (subtotal * packNum) / 100;
      packingLabel = `Packing Charges (${packNum}%)`;
    }
  }

  // Tax
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

  const computedCases =
    bill.caseCount !== undefined && bill.caseCount !== ''
      ? bill.caseCount
      : (bill.products || []).reduce((acc, p) => acc + (parseFloat(String(p.quantity)) || 0), 0);

  const storeSettings = getStoredSettings();
  const displayCompanyName =
    bill.companyName && bill.companyName.trim() !== '' && bill.companyName !== 'General'
      ? bill.companyName
      : storeSettings.companyName || 'Siva Balaji Crackers';

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

  const isTaxActive = Boolean(storeSettings.enableTax) || parseFloat(String(bill.tax || '0').replace(/[^0-9.]/g, '')) > 0;
  const taxItems = [
    isTaxActive && storeSettings.gstin ? `GSTIN: ${storeSettings.gstin}` : '',
    storeSettings.pan ? `PAN: ${storeSettings.pan}` : '',
    storeSettings.ownerName ? `Prop: ${storeSettings.ownerName}` : '',
  ].filter(Boolean);
  const taxLine = taxItems.join(' | ');

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
    storeSettings,
  };
};

/**
 * Builds HTML for offscreen canvas PDF rendering
 */
export const buildBillPdfHtml = (bill: BillPrintData): string => {
  const calc = calculateBillPdfDetails(bill);
  const products = bill.products || [];

  const rowsHtml = products
    .map((item, idx) => {
      const numRate = parseFloat(String(item.rate).replace(/,/g, '')) || 0;
      const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
      const bg = idx % 2 === 0 ? '#ffffff' : '#fafafa';
      return `
      <tr style="background-color: ${bg};">
        <td style="border: 1px solid #d1d5db; padding: 6px 8px; text-align: center; font-weight: 700; font-size: 11px; color: #4b5563;">${idx + 1}</td>
        <td style="border: 1px solid #d1d5db; padding: 6px 10px; font-weight: 700; font-size: 12px; color: #111827;">${item.particular || '-'}</td>
        <td style="border: 1px solid #d1d5db; padding: 6px 8px; text-align: center; font-size: 11px; color: #374151;">${item.quantity || '0'}</td>
        <td style="border: 1px solid #d1d5db; padding: 6px 8px; text-align: center; font-size: 11px; color: #6b7280;">${item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : 'Box'}</td>
        <td style="border: 1px solid #d1d5db; padding: 6px 8px; text-align: right; font-size: 11.5px; font-weight: 600; color: #374151;">₹${numRate > 0 ? numRate.toFixed(2) : (item.rate || '0.00')}</td>
        <td style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right; font-size: 12px; font-weight: 800; color: #b91c1c;">₹${numAmt.toFixed(2)}</td>
      </tr>
    `;
    })
    .join('');

  return `
    <div style="width: 794px; background: #ffffff; padding: 24px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; line-height: 1.35;">
      
      <!-- Top Company Banner Header -->
      <div style="border: 2px solid #b91c1c; border-radius: 8px; padding: 14px 18px; margin-bottom: 14px; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1;">
            <div style="font-size: 22px; font-weight: 900; color: #b91c1c; text-transform: uppercase; letter-spacing: -0.02em; line-height: 1.1;">
              ${calc.displayCompanyName}
            </div>
            ${calc.storeSettings.tagline ? `<div style="font-size: 11px; font-weight: 700; color: #d97706; margin-top: 2px;">${calc.storeSettings.tagline}</div>` : ''}
            <div style="font-size: 11px; color: #4b5563; margin-top: 3px; font-weight: 500;">
              ${calc.fullAddressLine}
            </div>
            ${calc.contactLine ? `<div style="font-size: 10.5px; color: #1f2937; margin-top: 2px; font-weight: 600;">${calc.contactLine}</div>` : ''}
            ${calc.taxLine ? `<div style="font-size: 10.5px; color: #b91c1c; margin-top: 2px; font-weight: 700;">${calc.taxLine}</div>` : ''}
          </div>
          
          <div style="text-align: right; border-left: 2px solid #fef3c7; padding-left: 16px; min-width: 170px;">
            <div style="display: inline-block; background: #b91c1c; color: #ffffff; font-size: 12px; font-weight: 900; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em;">
              TAX INVOICE
            </div>
            <div style="font-size: 14px; font-weight: 800; color: #111827; margin-top: 6px;">
              Bill No: <span style="color: #b91c1c;">#${bill.billNo || 'NEW'}</span>
            </div>
            <div style="font-size: 12px; font-weight: 600; color: #4b5563; margin-top: 2px;">
              Date: <span style="color: #111827; font-weight: 700;">${bill.date || new Date().toLocaleDateString('en-GB')}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Customer / Party Box -->
      <div style="display: flex; gap: 12px; margin-bottom: 14px;">
        <div style="flex: 1; border: 1.5px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; background: #f9fafb;">
          <div style="font-size: 10px; font-weight: 800; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
            BILLED TO / CUSTOMER DETAILS
          </div>
          <div style="font-size: 13.5px; font-weight: 800; color: #111827;">
            ${bill.customerName || 'Cash Customer'}
          </div>
          ${bill.customerPhone ? `<div style="font-size: 11.5px; font-weight: 600; color: #374151; margin-top: 2px;">📱 Contact: ${bill.customerPhone}</div>` : ''}
          ${bill.customerAddress ? `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">📍 Address: ${bill.customerAddress}</div>` : ''}
          ${bill.customerGst ? `<div style="font-size: 11px; font-weight: 700; color: #d97706; margin-top: 2px;">GSTIN: ${bill.customerGst}</div>` : ''}
        </div>

        <div style="width: 220px; border: 1.5px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; background: #f9fafb;">
          <div style="font-size: 10px; font-weight: 800; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
            DISPATCH DETAILS
          </div>
          <div style="font-size: 11.5px; color: #374151; margin-top: 2px;">
            Transport: <b>${calc.transportDisplayName}</b>
          </div>
          <div style="font-size: 11.5px; color: #374151; margin-top: 2px;">
            Total Cases / Qty: <b>${calc.computedCases}</b>
          </div>
          <div style="font-size: 11.5px; color: #374151; margin-top: 2px;">
            Total Items: <b>${products.length}</b>
          </div>
        </div>
      </div>

      <!-- Particulars Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1.5px solid #d1d5db;">
        <thead>
          <tr style="background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); color: #ffffff;">
            <th style="border: 1px solid #991b1b; padding: 7px 8px; font-size: 11px; font-weight: 800; width: 40px; text-align: center; color: #ffffff;">#</th>
            <th style="border: 1px solid #991b1b; padding: 7px 10px; font-size: 11px; font-weight: 800; text-align: left; color: #ffffff;">PRODUCT / PARTICULAR</th>
            <th style="border: 1px solid #991b1b; padding: 7px 8px; font-size: 11px; font-weight: 800; width: 60px; text-align: center; color: #ffffff;">QTY</th>
            <th style="border: 1px solid #991b1b; padding: 7px 8px; font-size: 11px; font-weight: 800; width: 65px; text-align: center; color: #ffffff;">UNIT</th>
            <th style="border: 1px solid #991b1b; padding: 7px 8px; font-size: 11px; font-weight: 800; width: 85px; text-align: right; color: #ffffff;">RATE (₹)</th>
            <th style="border: 1px solid #991b1b; padding: 7px 10px; font-size: 11px; font-weight: 800; width: 105px; text-align: right; color: #ffffff;">AMOUNT (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #9ca3af;">No items listed in bill</td></tr>'}
        </tbody>
      </table>

      <!-- Bottom Calculation & Bank / Terms Grid -->
      <div style="display: flex; justify-content: space-between; gap: 16px; align-items: flex-start;">
        <!-- Left Column: Bank Details & Terms -->
        <div style="flex: 1; border: 1.5px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; background: #fdfdfd;">
          ${
            calc.storeSettings.bankAccountNo || calc.storeSettings.upiId
              ? `
            <div style="font-size: 10.5px; font-weight: 800; color: #065f46; text-transform: uppercase; margin-bottom: 4px;">
              💳 PAYMENT & BANK DETAILS
            </div>
            ${calc.storeSettings.bankName ? `<div style="font-size: 11px; color: #374151;">Bank: <b>${calc.storeSettings.bankName}</b></div>` : ''}
            ${calc.storeSettings.bankAccountNo ? `<div style="font-size: 11px; color: #374151;">A/C No: <b>${calc.storeSettings.bankAccountNo}</b></div>` : ''}
            ${calc.storeSettings.bankIfsc ? `<div style="font-size: 11px; color: #374151;">IFSC: <b>${calc.storeSettings.bankIfsc}</b></div>` : ''}
            ${calc.storeSettings.upiId ? `<div style="font-size: 11px; color: #065f46; font-weight: 700; margin-top: 2px;">UPI ID: ${calc.storeSettings.upiId}</div>` : ''}
            <div style="margin-top: 8px; border-top: 1px dashed #e5e7eb; padding-top: 6px;"></div>
          `
              : ''
          }
          <div style="font-size: 9.5px; color: #6b7280; line-height: 1.35;">
            • Goods once sold cannot be returned or exchanged.<br/>
            • Subject to Sivakasi jurisdiction only.<br/>
            • This is a computer generated invoice estimate.
          </div>
        </div>

        <!-- Right Column: Subtotal, Discount, Charges, Grand Total -->
        <div style="width: 280px; border: 2px solid #b91c1c; border-radius: 6px; overflow: hidden; background: #ffffff;">
          <div style="padding: 10px 14px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #4b5563; font-weight: 600;">Subtotal:</span>
              <span style="font-weight: 700; color: #111827;">₹${calc.subtotal.toFixed(2)}</span>
            </div>

            ${
              calc.discountAmt > 0
                ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #059669;">
                <span style="font-weight: 600;">${calc.discountLabel}:</span>
                <span style="font-weight: 700;">-₹${calc.discountAmt.toFixed(2)}</span>
              </div>
            `
                : ''
            }

            ${
              calc.packingAmt > 0
                ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #d97706;">
                <span style="font-weight: 600;">${calc.packingLabel}:</span>
                <span style="font-weight: 700;">+₹${calc.packingAmt.toFixed(2)}</span>
              </div>
            `
                : ''
            }

            ${
              calc.taxAmt > 0
                ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #4338ca;">
                <span style="font-weight: 600;">${calc.taxLabel}:</span>
                <span style="font-weight: 700;">+₹${calc.taxAmt.toFixed(2)}</span>
              </div>
            `
                : ''
            }

            ${
              calc.transportAmt > 0
                ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #4b5563;">
                <span style="font-weight: 600;">Transport:</span>
                <span style="font-weight: 700;">+₹${calc.transportAmt.toFixed(2)}</span>
              </div>
            `
                : ''
            }
          </div>

          <!-- Grand Total Bar -->
          <div style="background: #b91c1c; color: #ffffff; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; font-weight: 800; letter-spacing: 0.02em;">GRAND TOTAL:</span>
            <span style="font-size: 16px; font-weight: 900; color: #fef08a;">${calc.formattedTotal}</span>
          </div>
        </div>
      </div>

      <!-- Signature Section -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding: 0 10px;">
        <div style="text-align: center; width: 160px;">
          <div style="border-top: 1px solid #9ca3af; padding-top: 4px; font-size: 11px; font-weight: 700; color: #4b5563;">
            Customer Signature
          </div>
        </div>

        <div style="text-align: center; width: 200px;">
          <div style="font-size: 11px; font-weight: 700; color: #111827; margin-bottom: 25px;">
            For ${calc.displayCompanyName}
          </div>
          <div style="border-top: 1px solid #9ca3af; padding-top: 4px; font-size: 11px; font-weight: 700; color: #4b5563;">
            Authorised Signatory
          </div>
        </div>
      </div>

    </div>
  `;
};

/**
 * Generates an actual PDF Blob and File object in the browser
 */
export const generateBillPdfFile = async (
  bill: BillPrintData
): Promise<{ blob: Blob; file: File; fileName: string; dataUrl: string }> => {
  const fileName = `Invoice-${bill.billNo ? bill.billNo.replace(/[^a-zA-Z0-9-_]/g, '_') : 'Bill'}.pdf`;

  // Create an offscreen render container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '794px'; // Standard A4 width in pixels at 96 DPI
  container.style.background = '#ffffff';
  container.innerHTML = buildBillPdfHtml(bill);

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2, // 2x scale for ultra crisp high DPI
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    // Add image to PDF
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(pdfHeight, imgHeight));

    const blob = pdf.output('blob');
    const dataUrl = pdf.output('dataurlstring');
    const file = new File([blob], fileName, { type: 'application/pdf' });

    return { blob, file, fileName, dataUrl };
  } finally {
    document.body.removeChild(container);
  }
};

/**
 * Downloads the PDF directly to the user's computer
 */
export const downloadBillPdf = async (bill: BillPrintData): Promise<string> => {
  const { blob, fileName } = await generateBillPdfFile(bill);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return fileName;
};

/**
 * Shares PDF file directly via Web Share API (native WhatsApp document attachment) or downloads PDF + opens WhatsApp
 */
export const shareBillPdfToWhatsApp = async (
  bill: BillPrintData,
  phoneNumber: string,
  _optionalText?: string
): Promise<{ method: 'native-share' | 'download-whatsapp'; fileName: string }> => {
  const { file, fileName } = await generateBillPdfFile(bill);
  const cleanPhone = getCleanWhatsAppNumber(phoneNumber);

  // 1. Mobile & Web Share API supported browsers: Directly attach the PDF document
  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: fileName,
      });
      return { method: 'native-share', fileName };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User closed share dialog
        return { method: 'native-share', fileName };
      }
      console.warn('Native share failed, falling back to download + WhatsApp:', err);
    }
  }

  // 2. Desktop WhatsApp Web fallback:
  // Automatically download the PDF to user's device
  await downloadBillPdf(bill);

  // Open WhatsApp chat directly with customer so user can drop/attach the PDF
  let whatsappUrl = '';
  if (cleanPhone) {
    whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}`;
  } else {
    whatsappUrl = `https://api.whatsapp.com/send`;
  }
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

  return { method: 'download-whatsapp', fileName };
};
