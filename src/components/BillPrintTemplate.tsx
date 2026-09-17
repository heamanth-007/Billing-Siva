import React from 'react';
import { getStoredSettings } from './SettingsPage';

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
}

export const BillPrintTemplate: React.FC<BillPrintTemplateProps> = ({ bill }) => {
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

  // Packing calculation - amount by default, only percentage if explicitly formatted with %
  const rawPackStr = String(bill.packing ?? '').trim();
  const cleanPack = rawPackStr.replace(/[^0-9.]/g, '');
  const packNum = parseFloat(cleanPack) || 0;
  let packingAmt = 0;
  let packingLabel = 'Packing Charges';
  if (packNum > 0) {
    if (rawPackStr.includes('%')) {
      packingAmt = (subtotal * packNum) / 100;
      packingLabel = `Packing Charges (${packNum}%)`;
    } else {
      packingAmt = packNum;
      packingLabel = `Packing Charges`;
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

  // Final Net Total
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

  const isTaxActive = Boolean(storeSettings.enableTax) || (parseFloat(String(bill.tax || '0').replace(/[^0-9.]/g, '')) > 0);
  const cityLine = `${storeSettings.city || 'Sivakasi'}${storeSettings.state ? `, ${storeSettings.state}` : ''}`;
  const gstinLine = (isTaxActive && storeSettings.gstin) ? `GSTIN: ${storeSettings.gstin}` : '';
  const phoneLine = storeSettings.phone ? `Mobile: ${storeSettings.phone}` : '';
  const metaContact = [gstinLine, phoneLine].filter(Boolean).join(' | ');

  // Check for uploaded Lorry / Godown receipt (pdfData or pdfUrl)
  const receiptSrc = bill.pdfData || bill.pdfUrl || '';

  return (
    <div
      className="dheeksha-bill-container"
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        border: '1.5px solid #000000',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header: Centered Company Name & Logo without floating extra text */}
      <div
        style={{
          textAlign: 'center',
          padding: '12px 16px 10px 16px',
          borderBottom: '1.5px solid #000000',
        }}
      >
        {storeSettings.logoUrl && (
          <div style={{ marginBottom: '4px' }}>
            <img
              src={storeSettings.logoUrl}
              alt="Logo"
              style={{ maxHeight: '48px', maxWidth: '150px', objectFit: 'contain' }}
            />
          </div>
        )}
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 800,
            color: '#000000',
            margin: '0 0 2px 0',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
          }}
        >
          {displayCompanyName}
        </h1>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
          {cityLine}
        </div>
        {metaContact && (
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
            {metaContact}
          </div>
        )}
      </div>

      {/* Bill Metadata Block with Boxed Lines */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          borderBottom: '1.5px solid #000000',
          fontSize: '12.5px',
        }}
      >
        <tbody>
          <tr>
            <td style={{ width: '50%', border: '1px solid #000000', padding: '5px 10px' }}>
              <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Bill No:</span>
              <strong style={{ color: '#000000' }}>{bill.billNo || '-'}</strong>
            </td>
            <td style={{ width: '50%', border: '1px solid #000000', padding: '5px 10px' }}>
              <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Date:</span>
              <strong style={{ color: '#000000' }}>{bill.date || '-'}</strong>
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000000', padding: '5px 10px', verticalAlign: 'top' }}>
              <div>
                <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Customer Name:</span>
                <strong style={{ color: '#000000' }}>{bill.customerName || '-'}</strong>
              </div>
              {bill.customerPhone && bill.customerPhone.trim() !== '' && bill.customerPhone !== '-' && (
                <div style={{ fontSize: '11.5px', color: '#1E293B', marginTop: '2px' }}>
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
            </td>
            <td style={{ border: '1px solid #000000', padding: '5px 10px', verticalAlign: 'top' }}>
              <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Company Name:</span>
              <strong style={{ color: '#000000' }}>{displayCompanyName}</strong>
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000000', padding: '5px 10px' }}>
              <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Transport:</span>
              <strong style={{ color: '#000000' }}>{transportDisplayName}</strong>
            </td>
            <td style={{ border: '1px solid #000000', padding: '5px 10px' }}>
              <span style={{ color: '#475569', fontWeight: 500, marginRight: '4px' }}>Total No. of Cases:</span>
              <strong style={{ color: '#000000' }}>{computedCases}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Products Table with Boxed Rows */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          borderBottom: '1.5px solid #000000',
          fontSize: '12px',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#F8FAFC' }}>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', width: '45px', fontWeight: 700 }}>
              Si.No
            </th>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>
              Particular
            </th>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', width: '75px', fontWeight: 700 }}>
              Quantity
            </th>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'right', width: '85px', fontWeight: 700 }}>
              Rate (₹)
            </th>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', width: '85px', fontWeight: 700 }}>
              Pkt / Unit
            </th>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'right', width: '105px', fontWeight: 700 }}>
              Amount (₹)
            </th>
          </tr>
        </thead>
        <tbody>
          {(bill.products || []).length === 0 ? (
            <tr>
              <td colSpan={6} style={{ border: '1px solid #000000', textAlign: 'center', padding: '14px', color: '#64748B' }}>
                No product items in bill
              </td>
            </tr>
          ) : (
            (bill.products || []).map((item, idx) => {
              const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
              const numRate = parseFloat(String(item.rate).replace(/,/g, '')) || 0;
              return (
                <tr key={idx}>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px', fontWeight: 600 }}>{item.particular || '-'}</td>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>{item.quantity || '-'}</td>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'right' }}>
                    {numRate > 0 ? numRate.toFixed(2) : (item.rate || '-')}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>
                    {item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : ''}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                    {numAmt.toFixed(2)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Bottom Split Section: Left (Receipt Image or Signatory Box) & Right (Calculation Summary Table) */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'stretch',
        }}
      >
        {/* Left Column: Uploaded Receipt Image or Authorized Signatory */}
        {receiptSrc ? (
          <div
            style={{
              flex: '1 1 50%',
              borderRight: '1.5px solid #000000',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              minHeight: '140px',
            }}
          >
            {receiptSrc.startsWith('data:image') || receiptSrc.match(/\.(jpeg|jpg|png|webp|gif)$/i) || !receiptSrc.includes('application/pdf') ? (
              <img
                src={receiptSrc}
                alt="Transport Receipt"
                style={{
                  maxWidth: '100%',
                  maxHeight: '180px',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <iframe
                src={receiptSrc}
                title="Transport Receipt PDF"
                style={{
                  width: '100%',
                  height: '180px',
                  border: 'none',
                }}
              />
            )}
          </div>
        ) : (
          <div
            style={{
              flex: '1 1 50%',
              borderRight: '1.5px solid #000000',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              boxSizing: 'border-box',
              minHeight: '140px',
            }}
          >
            <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '24px' }}>
              Thank you for your business!
            </div>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#000000',
                borderTop: '1px dashed #000000',
                display: 'inline-block',
                paddingTop: '4px',
                width: '170px',
              }}
            >
              Authorized Signatory
            </div>
          </div>
        )}

        {/* Right Column: Calculation Summary Table */}
        <div style={{ flex: '1 1 50%', padding: 0, boxSizing: 'border-box' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12.5px',
            }}
          >
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '5px 10px', fontWeight: 500, color: '#334155' }}>
                  Particular Amount
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 10px', textAlign: 'right', fontWeight: 600, color: '#000000' }}>
                  {subtotal.toFixed(2)}
                </td>
              </tr>
              {discountAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '5px 10px', fontWeight: 500, color: '#334155' }}>
                    {discountLabel}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '5px 10px', textAlign: 'right', fontWeight: 600, color: '#000000' }}>
                    -{discountAmt.toFixed(2)}
                  </td>
                </tr>
              )}
              {transportAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '5px 10px', fontWeight: 500, color: '#334155' }}>
                    Transport Charges
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '5px 10px', textAlign: 'right', fontWeight: 600, color: '#000000' }}>
                    +{transportAmt.toFixed(2)}
                  </td>
                </tr>
              )}
              {packingAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '5px 10px', fontWeight: 500, color: '#334155' }}>
                    {packingLabel}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '5px 10px', textAlign: 'right', fontWeight: 600, color: '#000000' }}>
                    +{packingAmt.toFixed(2)}
                  </td>
                </tr>
              )}
              {taxAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '5px 10px', fontWeight: 500, color: '#334155' }}>
                    {taxLabel}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '5px 10px', textAlign: 'right', fontWeight: 600, color: '#000000' }}>
                    +{taxAmt.toFixed(2)}
                  </td>
                </tr>
              )}
              <tr style={{ backgroundColor: '#F8FAFC' }}>
                <td style={{ border: '1px solid #000000', borderTop: '1.5px solid #000000', padding: '7px 10px', fontWeight: 800 }}>
                  Total Amount
                </td>
                <td style={{ border: '1px solid #000000', borderTop: '1.5px solid #000000', padding: '7px 10px', textAlign: 'right', fontSize: '13.5px', fontWeight: 800 }}>
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
