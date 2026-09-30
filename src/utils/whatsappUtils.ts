import type { BillPrintData } from '../components/BillPrintTemplate';
import { getStoredSettings } from '../components/SettingsPage';

/**
 * Cleans and formats phone number for WhatsApp link (e.g., adding country code '91' if 10-digit Indian number)
 */
export const getCleanWhatsAppNumber = (rawPhone?: string): string => {
  if (!rawPhone) return '';
  // Remove all non-digit characters
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';

  // If 10 digits, prepend 91 (India)
  if (digits.length === 10) {
    return `91${digits}`;
  }
  // If 11 digits starting with 0, replace 0 with 91
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  // If already 12 digits starting with 91, return as is
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
};

/**
 * Builds a clean, professional WhatsApp text message for a bill
 */
export const formatBillWhatsAppMessage = (bill: BillPrintData): string => {
  const storeSettings = getStoredSettings();
  const companyName =
    bill.companyName && bill.companyName.trim() !== '' && bill.companyName !== 'General'
      ? bill.companyName
      : storeSettings.companyName || 'Siva Balaji Crackers';

  const dateStr = bill.date || new Date().toLocaleDateString('en-GB');
  const billNum = bill.billNo || 'NEW';
  const customerName = bill.customerName || 'Valued Customer';
  
  // Format items
  const itemsText = (bill.products || [])
    .map((item, idx) => {
      const pName = item.particular || 'Item';
      const qty = item.quantity || 1;
      const unit = item.pktUnit ? ` ${item.pktUnit}` : '';
      const rate = Number(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const amt = Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${idx + 1}. *${pName}*\n    ${qty}${unit} × ₹${rate} = *₹${amt}*`;
    })
    .join('\n');

  const subtotalNum = parseFloat(String(bill.amount || '0').replace(/,/g, '')) || 0;
  const discountNum = parseFloat(String(bill.discount || '0').replace(/,/g, '')) || 0;
  const packingNum = parseFloat(String(bill.packing || '0').replace(/,/g, '')) || 0;
  const taxNum = parseFloat(String(bill.tax || '0').replace(/,/g, '')) || 0;
  const totalNum = parseFloat(String(bill.total || bill.amount || '0').replace(/,/g, '')) || subtotalNum;

  let summaryBreakdown = '';
  if (discountNum > 0) {
    summaryBreakdown += `\n• Subtotal: ₹${subtotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    summaryBreakdown += `\n• Discount: -₹${discountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }
  if (packingNum > 0) {
    summaryBreakdown += `\n• Packing/Charges: +₹${packingNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }
  if (taxNum > 0) {
    summaryBreakdown += `\n• GST / Tax: +₹${taxNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }
  if (bill.transport && bill.transport !== '0' && bill.transport !== '0.00') {
    summaryBreakdown += `\n• Transport / Note: ${bill.transport}`;
  }

  let contactFooter = '';
  const storePhone = storeSettings.phone || storeSettings.whatsapp || '';
  if (storePhone) {
    contactFooter += `\n📞 Contact: ${storePhone}`;
  }
  if (storeSettings.upiId) {
    contactFooter += `\n💳 UPI ID: *${storeSettings.upiId}*`;
  }
  if (storeSettings.bankAccountNo) {
    contactFooter += `\n🏦 Bank A/C: ${storeSettings.bankAccountNo} (${storeSettings.bankIfsc || ''})`;
  }

  const message = `✨ *INVOICE / BILL ESTIMATE* ✨
━━━━━━━━━━━━━━━━━━━━
🏢 *${companyName.toUpperCase()}*
${storeSettings.tagline ? `_${storeSettings.tagline}_\n` : ''}${storeSettings.address ? `📍 ${storeSettings.address}, ${storeSettings.city || 'Sivakasi'}\n` : ''}━━━━━━━━━━━━━━━━━━━━
🧾 *Bill No:* #${billNum}
📅 *Date:* ${dateStr}
👤 *Customer:* ${customerName}
${bill.customerPhone ? `📱 *Phone:* ${bill.customerPhone}\n` : ''}━━━━━━━━━━━━━━━━━━━━
📦 *ORDER PARTICULARS:*

${itemsText || 'No items listed'}
━━━━━━━━━━━━━━━━━━━━${summaryBreakdown ? `${summaryBreakdown}\n━━━━━━━━━━━━━━━━━━━━` : ''}
💰 *GRAND TOTAL: ₹${totalNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*
━━━━━━━━━━━━━━━━━━━━${contactFooter ? `${contactFooter}\n━━━━━━━━━━━━━━━━━━━━` : ''}
🙏 _Thank you for doing business with us!_`;

  return message;
};

/**
 * Opens WhatsApp Web or App with pre-filled number and message
 */
export const sendWhatsAppMessage = (phone: string, message: string) => {
  const cleanPhone = getCleanWhatsAppNumber(phone);
  const encodedText = encodeURIComponent(message);
  
  let url = '';
  if (cleanPhone) {
    url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  } else {
    // If no phone number, open WhatsApp send interface so user can pick contact
    url = `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
};
