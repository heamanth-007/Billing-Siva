import React from 'react';
import { getStoredSettings } from './SettingsPage';

export type BillPrintFormat = 'a4-portrait' | 'a4-landscape' | 'a4-dual' | 'thermal';

export interface BillPrintProduct {
  particular: string;
  quantity: string | number;
  rate: string | number;
  pktUnit: string | number;
  amount: string | number;
}

export interface BillPrintData {
  billNo: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGst?: string;
  companyName: string;
  preparedBy?: string;
  phone?: string;
  email?: string;
  website?: string;
  transport?: string;
  caseCount?: string | number;
  products: BillPrintProduct[];
  amount?: string | number;
  discount?: string | number;
  packing?: string | number;
  tax?: string | number;
  total?: string | number;
  paymentStatus?: string;
  paymentMode?: string;
  paidAmount?: string | number;
  notes?: string;
  pdfData?: string;
  pdfUrl?: string;
  pdfName?: string;
}

interface BillPrintTemplateProps {
  bill: BillPrintData;
  format?: BillPrintFormat;
}

export const BillPrintTemplate: React.FC<BillPrintTemplateProps> = ({
  bill,
  format = 'a4-portrait',
}) => {
  const [storeSettings, setStoreSettings] = React.useState(() => getStoredSettings());

  React.useEffect(() => {
    const handleSettingsUpdate = () => {
      setStoreSettings(getStoredSettings());
    };
    window.addEventListener('dheeksha_settings_updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('dheeksha_settings_updated', handleSettingsUpdate);
    };
  }, []);

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
  const formattedTotal = '₹' + finalTotalNum.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Calculate sum of quantities across products for Total No. of Cases
  const computedCases = bill.caseCount !== undefined && bill.caseCount !== ''
    ? bill.caseCount
    : (bill.products || []).reduce((acc, p) => acc + (parseFloat(String(p.quantity)) || 0), 0);

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

  // =========================================================================
  // 1. THERMAL 80mm FORMAT PREVIEW
  // =========================================================================
  if (format === 'thermal') {
    return (
      <div
        style={{
          width: '320px',
          margin: '0 auto',
          backgroundColor: '#FFFFFF',
          color: '#000000',
          fontFamily: "'Courier New', Courier, monospace",
          padding: '16px 12px',
          border: '1.5px dashed #CBD5E1',
          borderRadius: '4px',
          fontSize: '12px',
          lineHeight: 1.3,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase' }}>
            {displayCompanyName}
          </div>
          {storeSettings.tagline && <div style={{ fontSize: '10px', fontStyle: 'italic' }}>{storeSettings.tagline}</div>}
          <div style={{ fontSize: '10.5px' }}>{fullAddressLine}</div>
          {contactLine && <div style={{ fontSize: '10px' }}>{contactLine}</div>}
          {taxLine && <div style={{ fontSize: '10px', fontWeight: 700 }}>{taxLine}</div>}
        </div>

        <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span>Bill No: <b>#{bill.billNo || '-'}</b></span>
          <span>Date: <b>{bill.date || '-'}</b></span>
        </div>
        <div style={{ fontSize: '11px', marginTop: '2px' }}>
          Customer: <b>{bill.customerName || 'Cash Customer'}</b>
        </div>
        {bill.customerPhone && <div style={{ fontSize: '10.5px' }}>Phone: {bill.customerPhone}</div>}
        {transportDisplayName !== '-' && (
          <div style={{ fontSize: '10.5px' }}>
            Transport: {transportDisplayName} | Pieces: {computedCases}
          </div>
        )}

        <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '11px' }}>
          <span>ITEM DESCRIPTION</span>
          <span>AMOUNT</span>
        </div>

        <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

        <div>
          {rawProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '6px' }}>No items</div>
          ) : (
            rawProducts.map((item, idx) => {
              const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
              const numRate = parseFloat(String(item.rate).replace(/,/g, '')) || 0;
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ flex: 1, paddingRight: '6px' }}>
                    {idx + 1}. <b>{item.particular || '-'}</b>
                    <div style={{ fontSize: '10px', color: '#444' }}>
                      {item.quantity || '1'} {item.pktUnit || ''} x ₹{numRate.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, textAlign: 'right', minWidth: '60px' }}>
                    ₹{numAmt.toFixed(2)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
          <span>Particular Amount:</span>
          <b>₹{subtotal.toFixed(2)}</b>
        </div>
        {discountAmt > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#DC2626' }}>
            <span>{discountLabel}:</span>
            <span>-₹{discountAmt.toFixed(2)}</span>
          </div>
        )}
        {transportAmt > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span>Transport:</span>
            <span>+₹{transportAmt.toFixed(2)}</span>
          </div>
        )}
        {packingAmt > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span>{packingLabel}:</span>
            <span>+₹{packingAmt.toFixed(2)}</span>
          </div>
        )}
        {taxAmt > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span>{taxLabel}:</span>
            <span>+₹{taxAmt.toFixed(2)}</span>
          </div>
        )}

        <div style={{ borderBottom: '2px solid #000', margin: '8px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 900 }}>
          <span>GRAND TOTAL:</span>
          <span>{formattedTotal}</span>
        </div>

        <div style={{ borderBottom: '2px solid #000', margin: '8px 0' }} />

        {hasBankDetails && (
          <div style={{ fontSize: '10px', marginTop: '6px' }}>
            <b>Bank Details:</b> {storeSettings.bankName || ''} A/C: {storeSettings.bankAccountNo || ''}<br />
            IFSC: {storeSettings.bankIfsc || ''} {storeSettings.upiId ? `| UPI: ${storeSettings.upiId}` : ''}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', fontWeight: 700 }}>
          *** THANK YOU VISIT AGAIN ***
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. A4 2-IN-1 DUAL COPY PREVIEW
  // =========================================================================
  if (format === 'a4-dual') {
    const renderMiniBill = (copyTitle: string) => (
      <div
        style={{
          flex: '1 1 50%',
          border: '1.5px solid #000000',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: '1.5px solid #000', padding: '6px 8px', textAlign: 'center', backgroundColor: '#FAFAFA' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 800, background: '#000', color: '#FFF', padding: '1px 5px', borderRadius: '2px' }}>
              {copyTitle}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase' }}>
              {displayCompanyName}
            </span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#475569' }}>
              #{bill.billNo || '-'}
            </span>
          </div>
          <div style={{ fontSize: '9px', color: '#334155', marginTop: '2px' }}>
            {fullAddressLine}
          </div>
        </div>

        {/* Metadata */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1.5px solid #000', fontSize: '10px' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', padding: '3px 6px', width: '50%' }}>
                <div><span style={{ color: '#64748B' }}>To:</span> <b>{bill.customerName || '-'}</b></div>
                {bill.customerPhone && <div><span style={{ color: '#64748B' }}>Mob:</span> {bill.customerPhone}</div>}
              </td>
              <td style={{ border: '1px solid #000', padding: '3px 6px', width: '50%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Date: <b>{bill.date || '-'}</b></span>
                  <span>Pieces: <b>{computedCases}</b></span>
                </div>
                <div>Transport: <b>{transportDisplayName}</b></div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Products */}
        <div style={{ flex: '1 1 auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1.5px solid #000', fontSize: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F1F5F9' }}>
                <th style={{ border: '1px solid #000', padding: '3px 4px', width: '24px', textAlign: 'center' }}>#</th>
                <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>Particular</th>
                <th style={{ border: '1px solid #000', padding: '3px 4px', width: '35px', textAlign: 'center' }}>Qty</th>
                <th style={{ border: '1px solid #000', padding: '3px 4px', width: '48px', textAlign: 'right' }}>Rate</th>
                <th style={{ border: '1px solid #000', padding: '3px 6px', width: '65px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rawProducts.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '8px' }}>No items</td></tr>
              ) : (
                rawProducts.map((p, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '2px 6px', fontWeight: 600 }}>{p.particular}</td>
                    <td style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'center' }}>{p.quantity}</td>
                    <td style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'right' }}>{p.rate}</td>
                    <td style={{ border: '1px solid #000', padding: '2px 6px', textAlign: 'right', fontWeight: 700 }}>{p.amount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000' }}>
          <div style={{ flex: '1 1 45%', padding: '4px 6px', fontSize: '9px', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {hasBankDetails ? (
              <div>Bank: <b>{storeSettings.bankName || '-'}</b><br />A/C: {storeSettings.bankAccountNo || '-'}</div>
            ) : (
              <div style={{ fontStyle: 'italic' }}>Thank you!</div>
            )}
            <div style={{ borderTop: '1px dashed #000', paddingTop: '2px', textAlign: 'center', fontWeight: 700, marginTop: '4px' }}>
              Authorized Signatory
            </div>
          </div>
          <div style={{ flex: '1 1 55%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '2px 4px', borderBottom: '1px solid #CCC' }}>Subtotal:</td>
                  <td style={{ padding: '2px 4px', borderBottom: '1px solid #CCC', textAlign: 'right', fontWeight: 600 }}>₹{subtotal.toFixed(2)}</td>
                </tr>
                {discountAmt > 0 && (
                  <tr>
                    <td style={{ padding: '1px 4px', color: '#DC2626' }}>Disc:</td>
                    <td style={{ padding: '1px 4px', textAlign: 'right', color: '#DC2626' }}>-₹{discountAmt.toFixed(2)}</td>
                  </tr>
                )}
                {taxAmt > 0 && (
                  <tr>
                    <td style={{ padding: '1px 4px' }}>Tax:</td>
                    <td style={{ padding: '1px 4px', textAlign: 'right' }}>+₹{taxAmt.toFixed(2)}</td>
                  </tr>
                )}
                <tr style={{ backgroundColor: '#F8FAFC', borderTop: '1.5px solid #000' }}>
                  <td style={{ padding: '3px 4px', fontWeight: 900 }}>TOTAL:</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 900, fontSize: '12px' }}>{formattedTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    return (
      <div
        style={{
          width: '100%',
          maxWidth: '820px',
          display: 'flex',
          gap: '12px',
          margin: '0 auto',
          boxSizing: 'border-box',
          minHeight: '480px',
        }}
      >
        {renderMiniBill('ORIGINAL (CUSTOMER COPY)')}
        <div style={{ display: 'flex', alignItems: 'center', color: '#94A3B8', fontSize: '12px', fontWeight: 700 }}>
          ✂
        </div>
        {renderMiniBill('DUPLICATE (OFFICE / TRANSPORT COPY)')}
      </div>
    );
  }

  // =========================================================================
  // 3. A4 LANDSCAPE PREVIEW
  // =========================================================================
  if (format === 'a4-landscape') {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: '820px',
          minHeight: '480px',
          margin: '0 auto',
          backgroundColor: '#FFFFFF',
          color: '#000000',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          border: '1.5px solid #000000',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Landscape Top Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 14px',
            borderBottom: '1.5px solid #000000',
            backgroundColor: '#FAFAFA',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {storeSettings.logoUrl && (
              <img src={storeSettings.logoUrl} alt="Logo" style={{ maxHeight: '36px', maxWidth: '110px', objectFit: 'contain' }} />
            )}
            <div>
              <div style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase' }}>
                {displayCompanyName}
              </div>
              <div style={{ fontSize: '10.5px', color: '#334155', fontWeight: 600 }}>
                {fullAddressLine} {contactLine ? `| ${contactLine}` : ''}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', fontWeight: 900, border: '1.5px solid #000', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
              TAX INVOICE / BILL
            </div>
            {taxLine && <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', marginTop: '2px' }}>{taxLine}</div>}
          </div>
        </div>

        {/* 3-Column Metadata */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1.5px solid #000', fontSize: '11px' }}>
          <tbody>
            <tr>
              <td style={{ width: '38%', border: '1px solid #000', padding: '4px 8px', verticalAlign: 'top' }}>
                <div style={{ color: '#475569', fontWeight: 600, fontSize: '10px' }}>BILL TO:</div>
                <div style={{ fontSize: '13px', fontWeight: 800 }}>{bill.customerName || '-'}</div>
                {bill.customerPhone && <div style={{ fontSize: '10.5px' }}>Mobile: <strong>{bill.customerPhone}</strong></div>}
                {bill.customerAddress && <div style={{ fontSize: '10px', color: '#475569' }}>{bill.customerAddress}</div>}
                {bill.customerGst && <div style={{ fontSize: '10px', fontWeight: 700 }}>GSTIN: {bill.customerGst}</div>}
              </td>
              <td style={{ width: '32%', border: '1px solid #000', padding: '4px 8px', verticalAlign: 'top' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: '#475569' }}>Invoice No:</span>
                  <strong style={{ fontSize: '12px' }}>#{bill.billNo || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: '#475569' }}>Date:</span>
                  <strong>{bill.date || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>Billed By:</span>
                  <strong>{displayCompanyName}</strong>
                </div>
              </td>
              <td style={{ width: '30%', border: '1px solid #000', padding: '4px 8px', verticalAlign: 'top' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: '#475569' }}>Transport:</span>
                  <strong>{transportDisplayName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: '#475569' }}>Total Pieces:</span>
                  <strong style={{ fontSize: '12px', color: '#0B4DB7' }}>{computedCases}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>Items:</span>
                  <strong>{rawProducts.length} Items</strong>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Product Table */}
        <div style={{ flex: '1 1 auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1.5px solid #000', fontSize: '11px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ backgroundColor: '#F1F5F9' }}>
                <th style={{ width: '38px', border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>Si.No</th>
                <th style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'left' }}>Particular / Product Description</th>
                <th style={{ width: '70px', border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>Qty</th>
                <th style={{ width: '80px', border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ width: '75px', border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>Unit</th>
                <th style={{ width: '100px', border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rawProducts.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '12px' }}>No items</td></tr>
              ) : (
                rawProducts.map((p, idx) => {
                  const numAmt = parseFloat(String(p.amount).replace(/,/g, '')) || 0;
                  const numRate = parseFloat(String(p.rate).replace(/,/g, '')) || 0;
                  return (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 8px', fontWeight: 600 }}>{p.particular}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'center' }}>{p.quantity}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{numRate > 0 ? numRate.toFixed(2) : p.rate}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'center' }}>{p.pktUnit || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'right', fontWeight: 700 }}>{numAmt.toFixed(2)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 55%', borderRight: '1.5px solid #000', padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {receiptSrc ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <img src={receiptSrc} style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} alt="Receipt" />
              </div>
            ) : hasBankDetails ? (
              <div style={{ fontSize: '10px', color: '#1E293B' }}>
                <strong style={{ textTransform: 'uppercase' }}>Bank & Payment Details:</strong>
                {storeSettings.bankName && <div>Bank: <b>{storeSettings.bankName}</b> | A/C: <b>{storeSettings.bankAccountNo || '-'}</b></div>}
                {storeSettings.bankIfsc && <div>IFSC: <b>{storeSettings.bankIfsc}</b> {storeSettings.upiId ? `| UPI: <b>${storeSettings.upiId}</b>` : ''}</div>}
              </div>
            ) : (
              <div style={{ fontSize: '10.5px', color: '#64748B', fontStyle: 'italic' }}>Thank you for your business!</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4px' }}>
              <div style={{ fontSize: '9px', color: '#64748B' }}>Terms: Goods once sold will not be taken back.</div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, borderTop: '1px dashed #000', paddingTop: '2px', width: '140px', textAlign: 'center' }}>
                Authorized Signatory
              </div>
            </div>
          </div>

          <div style={{ flex: '1 1 45%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', color: '#475569' }}>Particular Amount</td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>₹ {subtotal.toFixed(2)}</td>
                </tr>
                {discountAmt > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', color: '#475569' }}>{discountLabel}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 600, color: '#DC2626' }}>-₹ {discountAmt.toFixed(2)}</td>
                  </tr>
                )}
                {transportAmt > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', color: '#475569' }}>Transport Charges</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>+₹ {transportAmt.toFixed(2)}</td>
                  </tr>
                )}
                {packingAmt > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', color: '#475569' }}>{packingLabel}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>+₹ {packingAmt.toFixed(2)}</td>
                  </tr>
                )}
                {taxAmt > 0 && (
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', color: '#475569' }}>{taxLabel}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>+₹ {taxAmt.toFixed(2)}</td>
                  </tr>
                )}
                <tr style={{ backgroundColor: '#F8FAFC', borderTop: '1.5px solid #000' }}>
                  <td style={{ border: '1px solid #000', fontWeight: 800, fontSize: '11.5px', padding: '5px 6px' }}>TOTAL AMOUNT</td>
                  <td style={{ border: '1px solid #000', textAlign: 'right', fontSize: '13.5px', fontWeight: 900, color: '#000000', padding: '5px 6px' }}>{formattedTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 4. A4 PORTRAIT DEFAULT PREVIEW
  // =========================================================================
  return (
    <div
      className="dheeksha-bill-container"
      style={{
        width: '100%',
        maxWidth: '820px',
        minHeight: '750px',
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        border: '1.5px solid #000000',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Top Header: Company Branding & Details */}
      <div
        style={{
          textAlign: 'center',
          padding: '10px 16px 8px 16px',
          borderBottom: '1.5px solid #000000',
        }}
      >
        {storeSettings.logoUrl && (
          <div style={{ marginBottom: '4px' }}>
            <img
              src={storeSettings.logoUrl}
              alt="Logo"
              style={{ maxHeight: '44px', maxWidth: '140px', objectFit: 'contain' }}
            />
          </div>
        )}
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 900,
            color: '#000000',
            margin: '0 0 2px 0',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            lineHeight: 1.15,
          }}
        >
          {displayCompanyName}
        </h1>
        {storeSettings.tagline && (
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155', fontStyle: 'italic', marginBottom: '2px' }}>
            {storeSettings.tagline}
          </div>
        )}
        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#1E293B', lineHeight: 1.3 }}>
          {fullAddressLine}
        </div>
        {contactLine && (
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
            {contactLine}
          </div>
        )}
        {taxLine && (
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
            {taxLine}
          </div>
        )}
      </div>

      {/* Bill Metadata Block */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          borderBottom: '1.5px solid #000000',
          fontSize: '12px',
          tableLayout: 'fixed',
        }}
      >
        <tbody>
          <tr>
            <td style={{ width: '50%', border: '1px solid #000000', padding: '5px 8px', verticalAlign: 'top' }}>
              <div>
                <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Customer Name:</span>
                <strong style={{ color: '#000000', fontSize: '13px' }}>{bill.customerName || '-'}</strong>
              </div>
              {bill.customerPhone && bill.customerPhone.trim() !== '' && bill.customerPhone !== '-' && (
                <div style={{ fontSize: '11px', color: '#1E293B', marginTop: '2px' }}>
                  <span style={{ color: '#475569', fontWeight: 500 }}>Mobile: </span>
                  <strong>{bill.customerPhone}</strong>
                </div>
              )}
              {bill.customerAddress && bill.customerAddress.trim() !== '' && bill.customerAddress !== '-' && (
                <div style={{ fontSize: '11px', color: '#334155', marginTop: '2px' }}>
                  <span style={{ color: '#475569', fontWeight: 500 }}>Address: </span>
                  <span>{bill.customerAddress}</span>
                </div>
              )}
              {bill.customerGst && bill.customerGst.trim() !== '' && bill.customerGst !== '-' && bill.customerGst !== 'N/A' && (
                <div style={{ fontSize: '11px', color: '#334155', marginTop: '2px' }}>
                  <span style={{ color: '#475569', fontWeight: 500 }}>GSTIN: </span>
                  <strong>{bill.customerGst}</strong>
                </div>
              )}
            </td>
            <td style={{ width: '50%', border: '1px solid #000000', padding: '5px 8px', verticalAlign: 'top' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <div>
                  <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Bill No:</span>
                  <strong style={{ color: '#000000', fontSize: '13px' }}>#{bill.billNo || '-'}</strong>
                </div>
                <div>
                  <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Date:</span>
                  <strong style={{ color: '#000000' }}>{bill.date || '-'}</strong>
                </div>
              </div>
              <div style={{ marginTop: '2px' }}>
                <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Billed By:</span>
                <strong style={{ color: '#000000' }}>{displayCompanyName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                <div>
                  <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Transport:</span>
                  <strong style={{ color: '#000000' }}>{transportDisplayName}</strong>
                </div>
                <div>
                  <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Total Pieces:</span>
                  <strong style={{ color: '#000000' }}>{computedCases}</strong>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Products Table Area */}
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            borderBottom: '1.5px solid #000000',
            fontSize: '11.5px',
            tableLayout: 'fixed',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC' }}>
              <th style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'center', width: '38px', fontWeight: 700 }}>
                Si.No
              </th>
              <th style={{ border: '1px solid #000000', padding: '5px 8px', textAlign: 'left', fontWeight: 700 }}>
                Particular / Product Description
              </th>
              <th style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'center', width: '65px', fontWeight: 700 }}>
                Qty
              </th>
              <th style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'right', width: '75px', fontWeight: 700 }}>
                Rate (₹)
              </th>
              <th style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'center', width: '75px', fontWeight: 700 }}>
                Unit
              </th>
              <th style={{ border: '1px solid #000000', padding: '5px 8px', textAlign: 'right', width: '95px', fontWeight: 700 }}>
                Amount (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            {(bill.products || []).length === 0 ? (
              <tr>
                <td colSpan={6} style={{ border: '1px solid #000000', textAlign: 'center', padding: '16px', color: '#64748B' }}>
                  No product items in bill
                </td>
              </tr>
            ) : (
              (bill.products || []).map((item, idx) => {
                const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
                const numRate = parseFloat(String(item.rate).replace(/,/g, '')) || 0;
                return (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000000', padding: '4px 8px', fontWeight: 600 }}>{item.particular || '-'}</td>
                    <td style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'center' }}>{item.quantity || '-'}</td>
                    <td style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'right' }}>
                      {numRate > 0 ? numRate.toFixed(2) : (item.rate || '-')}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'center' }}>
                      {item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : ''}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>
                      {numAmt.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Fixed Section */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'stretch',
          marginTop: 'auto',
          flexShrink: 0,
          backgroundColor: '#FFFFFF',
        }}
      >
        {/* Left Column: Bank Details, Receipt Image, or Signatory */}
        <div
          style={{
            flex: '1 1 50%',
            borderRight: '1.5px solid #000000',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            minHeight: '125px',
          }}
        >
          {receiptSrc ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <img
                src={receiptSrc}
                alt="Transport Receipt"
                style={{
                  maxWidth: '100%',
                  maxHeight: '125px',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          ) : hasBankDetails ? (
            <div style={{ fontSize: '10.5px', color: '#1E293B', marginBottom: '8px' }}>
              <div style={{ fontWeight: 800, textTransform: 'uppercase', color: '#0F172A', marginBottom: '2px', borderBottom: '1px solid #CBD5E1', paddingBottom: '1px' }}>
                Bank & Payment Details:
              </div>
              {storeSettings.bankName && <div>Bank: <strong>{storeSettings.bankName}</strong></div>}
              {storeSettings.bankAccountNo && <div>A/C No: <strong>{storeSettings.bankAccountNo}</strong></div>}
              {storeSettings.bankIfsc && <div>IFSC: <strong>{storeSettings.bankIfsc}</strong> {storeSettings.bankBranch ? `| Branch: ${storeSettings.bankBranch}` : ''}</div>}
              {storeSettings.upiId && <div>UPI ID: <strong>{storeSettings.upiId}</strong></div>}
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
              Thank you for your business!
            </div>
          )}

          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#000000',
              borderTop: '1px dashed #000000',
              display: 'inline-block',
              paddingTop: '3px',
              width: '160px',
              marginTop: '8px',
            }}
          >
            Authorized Signatory
          </div>
        </div>

        {/* Right Column: Amount Calculation Summary Table */}
        <div style={{ flex: '1 1 50%', padding: 0, boxSizing: 'border-box' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '11.5px',
            }}
          >
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '4px 8px', fontWeight: 500, color: '#334155' }}>
                  Particular Amount
                </td>
                <td style={{ border: '1px solid #000000', padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: '#000000' }}>
                  {subtotal.toFixed(2)}
                </td>
              </tr>
              {discountAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '4px 8px', fontWeight: 500, color: '#334155' }}>
                    {discountLabel}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: '#000000' }}>
                    -{discountAmt.toFixed(2)}
                  </td>
                </tr>
              )}
              {transportAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '4px 8px', fontWeight: 500, color: '#334155' }}>
                    Transport Charges
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: '#000000' }}>
                    +{transportAmt.toFixed(2)}
                  </td>
                </tr>
              )}
              {packingAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '4px 8px', fontWeight: 500, color: '#334155' }}>
                    {packingLabel}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: '#000000' }}>
                    +{packingAmt.toFixed(2)}
                  </td>
                </tr>
              )}
              {taxAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '4px 8px', fontWeight: 500, color: '#334155' }}>
                    {taxLabel}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: '#000000' }}>
                    +{taxAmt.toFixed(2)}
                  </td>
                </tr>
              )}
              <tr style={{ backgroundColor: '#F8FAFC' }}>
                <td style={{ border: '1px solid #000000', borderTop: '1.5px solid #000000', padding: '6px 8px', fontWeight: 800, fontSize: '12px' }}>
                  Total Amount
                </td>
                <td style={{ border: '1px solid #000000', borderTop: '1.5px solid #000000', padding: '6px 8px', textAlign: 'right', fontSize: '13.5px', fontWeight: 900, color: '#000000' }}>
                  {formattedTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
