import { useState, useEffect, useMemo, type FC } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Grid,
  Divider,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import {
  CustomersApi,
  CompaniesApi,
  ProductsApi,
  PriceListsApi,
  ParticularsApi,
} from '../services/api';
import { getStoredSettings } from './SettingsPage';
import { BillPrintModal } from './BillPrintModal';
import type { BillPrintData } from './BillPrintTemplate';

interface ProductRowItem {
  id: string;
  particular: string;
  quantity: string;
  rate: string;
  pktUnit: string;
  amount: string;
}

interface ProductCatalogOption {
  id: string;
  name: string;
  category?: string;
  rate?: number;
  mrp?: number;
  unit?: string;
}

interface ParticularsPageProps {
  initialCustomerName?: string;
}

const DRAFT_BILL_STORAGE_KEY = 'dheeksha_draft_bill';

interface CustomerOption {
  id: string;
  name: string;
  mobile?: string;
  address?: string;
  gst?: string;
}

interface DraftBillState {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  billNo?: string;
  billDate?: string;
  discount?: string;
  transport?: string;
  packing?: string;
  tax?: string;
  productRows?: ProductRowItem[];
}

const getSavedDraft = (): DraftBillState => {
  try {
    const raw = localStorage.getItem(DRAFT_BILL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load draft bill from localStorage', e);
  }
  return {};
};

export const ParticularsPage: FC<ParticularsPageProps> = ({ initialCustomerName }) => {
  const [storeSettings, setStoreSettings] = useState(() => getStoredSettings());
  const draft = useMemo(() => getSavedDraft(), []);

  // Dropdown options
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [, setCompanyOptions] = useState<{ id: string; name: string }[]>([]);
  const [productOptions, setProductOptions] = useState<ProductCatalogOption[]>([]);

  // Bill Form State (Restores from Draft if page was refreshed)
  const [customerName, setCustomerName] = useState<string>(() => {
    return initialCustomerName || draft.customerName || '';
  });
  const [customerPhone, setCustomerPhone] = useState<string>(() => draft.customerPhone || '');
  const [customerAddress, setCustomerAddress] = useState<string>(() => draft.customerAddress || '');
  const [company, setCompany] = useState<string>(() => {
    return storeSettings.companyName || 'General';
  });
  const [billNo, setBillNo] = useState<string>(() => draft.billNo || '');
  const [billDate, setBillDate] = useState<string>(() => {
    if (draft.billDate) return draft.billDate;
    const today = new Date();
    return today.toLocaleDateString('en-GB').replace(/\//g, '-');
  });
  const [discount, setDiscount] = useState<string>(() => draft.discount ?? '0');
  const [transport, setTransport] = useState<string>(() => draft.transport ?? '0');
  const [packing, setPacking] = useState<string>(() => draft.packing ?? '0');
  const [tax, setTax] = useState<string>(() => draft.tax ?? '0');

  // Product Entry Form State
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [rate, setRate] = useState<string>('0');
  const [unit, setUnit] = useState<string>('Box');
  const [productRows, setProductRows] = useState<ProductRowItem[]>(() => draft.productRows || []);
  const [savingBill, setSavingBill] = useState<boolean>(false);

  // Print Preview Modal State
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [selectedBillForPrint, setSelectedBillForPrint] = useState<BillPrintData | null>(null);

  // Auto-persist draft bill to localStorage
  useEffect(() => {
    const draftPayload: DraftBillState = {
      customerName,
      customerPhone,
      customerAddress,
      billNo,
      billDate,
      discount,
      transport,
      packing,
      tax,
      productRows,
    };
    try {
      localStorage.setItem(DRAFT_BILL_STORAGE_KEY, JSON.stringify(draftPayload));
    } catch (e) {
      console.warn('Failed to auto-save draft bill to localStorage', e);
    }
  }, [customerName, customerPhone, customerAddress, billNo, billDate, discount, transport, packing, tax, productRows]);

  // Listen for settings update (when user updates company name/logo/tax settings in Settings)
  useEffect(() => {
    const handleSettingsUpdate = () => {
      const updated = getStoredSettings();
      setStoreSettings(updated);
      setCompany(updated.companyName || 'General');
      if (updated.enableTax && (!tax || tax === '0')) {
        setTax(updated.defaultTaxRate || '0');
      } else if (!updated.enableTax) {
        setTax('0');
      }
    };
    window.addEventListener('dheeksha_settings_updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('dheeksha_settings_updated', handleSettingsUpdate);
    };
  }, [tax]);

  // Load Dropdown Options (Customers, Companies, Unified Products & Price List)
  const loadOptions = async () => {
    try {
      const [custRes, compRes, prodRes, priceRes] = await Promise.all([
        CustomersApi.getAll().catch(() => []),
        CompaniesApi.getAll().catch(() => []),
        ProductsApi.getAll().catch(() => []),
        PriceListsApi.getAll().catch(() => []),
      ]);

      if (Array.isArray(custRes) && custRes.length > 0) {
        const mapped: CustomerOption[] = custRes.map((c: any) => ({
          id: c._id || c.id,
          name: c.name || '',
          mobile: c.mobile && c.mobile !== '-' ? c.mobile : '',
          address: c.address && c.address !== '-' ? c.address : '',
          gst: c.gst && c.gst !== 'N/A' ? c.gst : '',
        }));
        setCustomerOptions(mapped);

        // Auto-fill phone/address if customer is already selected
        const currentName = initialCustomerName || customerName;
        if (currentName) {
          const match = mapped.find((c) => c.name.toLowerCase() === currentName.trim().toLowerCase());
          if (match) {
            setCustomerPhone((prev) => prev || match.mobile || '');
            setCustomerAddress((prev) => prev || match.address || '');
          }
        }
      }

      if (Array.isArray(compRes) && compRes.length > 0) {
        const mapped = compRes.map((c: any) => ({ id: c._id || c.id, name: c.name }));
        setCompanyOptions(mapped);
        if (mapped.length > 0 && (!company || company === 'General')) {
          setCompany(storeSettings.companyName || mapped[0].name);
        }
      }

      // Merge Products & Price List
      const prodMap = new Map<string, ProductCatalogOption>();

      if (Array.isArray(prodRes)) {
        prodRes.forEach((p: any) => {
          const key = (p.name || '').trim();
          if (key) {
            prodMap.set(key.toLowerCase(), {
              id: p._id || p.id,
              name: key,
              category: p.category || 'General',
              rate: p.rate || 0,
              mrp: p.mrp || 0,
              unit: p.unit || 'Box',
            });
          }
        });
      }

      if (Array.isArray(priceRes)) {
        priceRes.forEach((item: any) => {
          const key = (item.itemName || '').trim();
          if (key) {
            const existing = prodMap.get(key.toLowerCase());
            prodMap.set(key.toLowerCase(), {
              id: item._id || item.id || existing?.id || key,
              name: key,
              category: item.category || existing?.category || 'General',
              rate: item.rate !== undefined && item.rate > 0 ? item.rate : (existing?.rate || 0),
              mrp: item.mrp !== undefined && item.mrp > 0 ? item.mrp : (existing?.mrp || 0),
              unit: item.unit || existing?.unit || 'Box',
            });
          }
        });
      }

      const mergedList = Array.from(prodMap.values());
      setProductOptions(mergedList);
      if (mergedList.length > 0 && !selectedProduct) {
        setSelectedProduct(mergedList[0].name);
        setRate(String(mergedList[0].rate || 0));
        setUnit(mergedList[0].unit || 'Box');
      }
    } catch (err) {
      console.error('Failed to load billing options:', err);
    }
  };

  // Fetch Next Bill Number
  const fetchNextBillNo = async () => {
    try {
      const res = await ParticularsApi.getNextBillNo();
      if (res?.nextBillNo) {
        setBillNo(res.nextBillNo);
      } else {
        setBillNo(`INV-${Date.now().toString().slice(-4)}`);
      }
    } catch {
      setBillNo(`INV-${Date.now().toString().slice(-4)}`);
    }
  };

  // Always keep date current today
  const refreshDate = () => {
    const today = new Date();
    setBillDate(today.toLocaleDateString('en-GB').replace(/\//g, '-'));
  };

  useEffect(() => {
    loadOptions();
    fetchNextBillNo();
    refreshDate();
  }, []);

  // Update customer name if prop changes
  useEffect(() => {
    if (initialCustomerName) {
      setCustomerName(initialCustomerName);
      const match = customerOptions.find(
        (c) => c.name.toLowerCase() === initialCustomerName.trim().toLowerCase()
      );
      if (match) {
        if (match.mobile) setCustomerPhone(match.mobile);
        if (match.address) setCustomerAddress(match.address);
      }
    }
  }, [initialCustomerName, customerOptions]);

  const handleCustomerSelect = (val: string | null) => {
    const nameVal = val || '';
    setCustomerName(nameVal);
    if (nameVal.trim()) {
      const match = customerOptions.find(
        (c) => c.name.toLowerCase() === nameVal.trim().toLowerCase()
      );
      if (match) {
        if (match.mobile) setCustomerPhone(match.mobile);
        if (match.address) setCustomerAddress(match.address);
      }
    }
  };

  // Add Product Item to Bill Row
  const handleAddProductItem = () => {
    if (!selectedProduct.trim()) {
      alert('Please select or enter a product name');
      return;
    }
    const qNum = parseFloat(quantity) || 1;
    const rNum = parseFloat(rate) || 0;
    const amt = (qNum * rNum).toFixed(2);

    const newRow: ProductRowItem = {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      particular: selectedProduct.trim(),
      quantity: String(qNum),
      rate: String(rNum),
      pktUnit: unit || 'Box',
      amount: amt,
    };

    setProductRows((prev) => [...prev, newRow]);
    setQuantity('1');
  };

  // Delete product row from current bill
  const handleDeleteRow = (id: string) => {
    setProductRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Bill Financial Totals Calculation
  const subtotal = useMemo(() => {
    return productRows.reduce((acc, row) => acc + (parseFloat(row.amount) || 0), 0);
  }, [productRows]);

  const discountAmount = useMemo(() => {
    const rawDisc = parseFloat(discount) || 0;
    if (rawDisc <= 0) return 0;
    if (rawDisc <= 100) {
      return (subtotal * rawDisc) / 100;
    }
    return rawDisc;
  }, [subtotal, discount]);

  const totalCases = useMemo(() => {
    return productRows.reduce((acc, row) => acc + (parseFloat(row.quantity) || 0), 0);
  }, [productRows]);

  const packingAmount = useMemo(() => {
    const rawPack = String(packing).trim();
    const packNum = parseFloat(rawPack.replace(/[^0-9.]/g, '')) || 0;
    if (packNum <= 0) return 0;
    if (rawPack.startsWith('₹')) {
      return packNum;
    }
    return (subtotal * packNum) / 100;
  }, [packing, subtotal]);

  const taxAmount = useMemo(() => {
    const rawTax = String(tax).trim();
    const taxNum = parseFloat(rawTax.replace(/[^0-9.]/g, '')) || 0;
    if (taxNum <= 0) return 0;
    const baseForTax = Math.max(0, subtotal - discountAmount + packingAmount);
    return (baseForTax * taxNum) / 100;
  }, [tax, subtotal, discountAmount, packingAmount]);

  const grandTotal = useMemo(() => {
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    return afterDiscount + packingAmount + taxAmount;
  }, [subtotal, discountAmount, packingAmount, taxAmount]);

  // Save Bill to DB
  const handleSaveBill = async (andPrint: boolean = false) => {
    if (!customerName.trim()) {
      alert('Please select or enter Customer Name');
      return;
    }
    if (productRows.length === 0) {
      alert('Please add at least one product item to the bill');
      return;
    }

    try {
      setSavingBill(true);
      const isTaxEnabled = Boolean(storeSettings.enableTax);
      const payload = {
        billNo: billNo.trim() || `INV-${Date.now().toString().slice(-4)}`,
        date: billDate,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        companyName: company || storeSettings.companyName || 'General',
        transport: transport || '0',
        caseCount: String(totalCases),
        discount: discount || '0',
        packing: packing || '0',
        tax: isTaxEnabled ? (tax || '0') : '0',
        amount: String(subtotal.toFixed(2)),
        total: String(grandTotal.toFixed(2)),
        products: productRows.map((r) => ({
          particular: r.particular,
          quantity: r.quantity,
          rate: r.rate,
          pktUnit: r.pktUnit,
          amount: r.amount,
        })),
      };

      await ParticularsApi.create(payload);

      if (andPrint) {
        const printData: BillPrintData = {
          billNo: payload.billNo,
          date: payload.date,
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          customerAddress: payload.customerAddress,
          companyName: payload.companyName,
          transport: payload.transport,
          caseCount: payload.caseCount,
          discount: payload.discount,
          packing: payload.packing,
          tax: payload.tax,
          amount: payload.amount,
          total: payload.total,
          products: payload.products,
        };
        setSelectedBillForPrint(printData);
        setPrintModalOpen(true);
      }

      // Reset Bill Form & Reload Recent Bills
      setProductRows([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setDiscount('0');
      setTransport('0');
      setPacking('0');
      setTax(storeSettings.enableTax ? (storeSettings.defaultTaxRate || '0') : '0');
      localStorage.removeItem(DRAFT_BILL_STORAGE_KEY);
      localStorage.removeItem('dheeksha_active_customer');
      fetchNextBillNo();
      refreshDate();
      loadOptions();

      if (!andPrint) {
        alert(`Bill #${payload.billNo} saved successfully!`);
      }
    } catch (err: any) {
      console.error('Failed to save bill:', err);
      alert(err.message || 'Error saving bill');
    } finally {
      setSavingBill(false);
    }
  };

  // Clear Draft Bill Form
  const handleClearDraft = () => {
    if (productRows.length > 0 || customerName.trim() !== '' || customerPhone.trim() !== '' || customerAddress.trim() !== '') {
      if (!window.confirm('Are you sure you want to clear this draft bill?')) return;
    }
    setProductRows([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setDiscount('0');
    setTransport('0');
    setPacking('0');
    setTax(storeSettings.enableTax ? (storeSettings.defaultTaxRate || '0') : '0');
    localStorage.removeItem(DRAFT_BILL_STORAGE_KEY);
    localStorage.removeItem('dheeksha_active_customer');
    fetchNextBillNo();
    refreshDate();
  };

  return (
    <Box
      sx={{
        width: '100%',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 2, md: 3 },
        boxSizing: 'border-box',
      }}
    >
      {/* Top Banner Header */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: '24px', fontWeight: 800, color: '#B91C1C', letterSpacing: '-0.02em' }}>
            New Invoice & Billing
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#786C58', fontWeight: 500 }}>
            Create and print customer bills instantly with auto-populated price list rates.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {productRows.length > 0 && (
            <Chip
              label={`Draft Auto-Saved (${productRows.length} items)`}
              size="small"
              sx={{ backgroundColor: '#FEF3C7', color: '#B45309', fontWeight: 800, border: '1px solid #FCD34D' }}
            />
          )}
        </Box>
      </Box>

      {/* Main Two-Column Grid: Create Bill Form + Items Table */}
      <Grid container spacing={2.5}>
        {/* Left Column: Customer & Invoice Details */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: '14px',
              border: '1.5px solid #FDE68A',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 4px 20px -2px rgba(217, 119, 6, 0.08)',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#B91C1C', mb: 2 }}>
              1. Invoice Information
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Customer Selector */}
              <Box>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#786C58', mb: 0.6 }}>
                  Customer Name *
                </Typography>
                <Autocomplete
                  freeSolo
                  size="small"
                  options={customerOptions.map((c) => c.name)}
                  value={customerName || ''}
                  onChange={(_, val) => handleCustomerSelect(val)}
                  onInputChange={(_, val) => {
                    setCustomerName(val || '');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select or enter customer name..."
                      sx={{
                        '& .MuiInputBase-input': { fontSize: '13.5px', fontWeight: 600 },
                      }}
                    />
                  )}
                />
              </Box>

              {/* Customer Phone & Address (Optional) */}
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#786C58', mb: 0.4 }}>
                    Customer Mobile (Optional)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="e.g. 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    sx={{
                      '& .MuiInputBase-input': { fontSize: '13px', fontWeight: 500 },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#786C58', mb: 0.4 }}>
                    Customer Address (Optional)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="e.g. Sivakasi, Tamil Nadu"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    sx={{
                      '& .MuiInputBase-input': { fontSize: '13px', fontWeight: 500 },
                    }}
                  />
                </Grid>
              </Grid>

              {/* Bill No & Date (Auto-generated & Non-editable / Read-only) */}
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 6 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.6 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#786C58' }}>
                      Bill / Inv No
                    </Typography>
                    <Tooltip title="Auto Generated (Protected)" arrow>
                      <LockOutlinedIcon sx={{ fontSize: 13, color: '#9CA3AF' }} />
                    </Tooltip>
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    value={billNo}
                    disabled
                    sx={{
                      backgroundColor: '#FEF2F2',
                      borderRadius: '6px',
                      '& .MuiInputBase-input': {
                        fontSize: '13.5px',
                        fontWeight: 800,
                        color: '#B91C1C !important',
                        WebkitTextFillColor: '#B91C1C !important',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#FECACA !important',
                      },
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.6 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#786C58' }}>
                      Bill Date
                    </Typography>
                    <Tooltip title="Auto Set to Today" arrow>
                      <LockOutlinedIcon sx={{ fontSize: 13, color: '#9CA3AF' }} />
                    </Tooltip>
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    value={billDate}
                    disabled
                    sx={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: '6px',
                      '& .MuiInputBase-input': {
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#475569 !important',
                        WebkitTextFillColor: '#475569 !important',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#E2E8F0 !important',
                      },
                    }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 0.5, borderColor: '#FEF3C7' }} />

              {/* Additional Adjustments: Discount, Packing (%), Tax (%) */}
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#78350F' }}>
                Adjustments & Charges
              </Typography>

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#786C58', mb: 0.4 }}>
                    Discount (% or ₹)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="e.g. 5% or 50"
                    sx={{
                      '& .MuiInputBase-input': { fontSize: '13px', fontWeight: 600 },
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#786C58', mb: 0.4 }}>
                    Packing (%)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={packing}
                    onChange={(e) => setPacking(e.target.value)}
                    placeholder="e.g. 2 or 2%"
                    sx={{
                      '& .MuiInputBase-input': { fontSize: '13px', fontWeight: 600 },
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#786C58', mb: 0.4 }}>
                    Tax / GST (%)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    placeholder="e.g. 18 or 18%"
                    sx={{
                      '& .MuiInputBase-input': { fontSize: '13px', fontWeight: 600 },
                    }}
                  />
                </Grid>
              </Grid>

              {/* Summary Total Card with Complete Breakdown */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: '10px',
                  backgroundColor: '#FFFBEB',
                  border: '1.5px solid #FDE68A',
                  mt: 1,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
                  <Typography sx={{ fontSize: '13px', color: '#786C58', fontWeight: 600 }}>Subtotal (Items):</Typography>
                  <Typography sx={{ fontSize: '13px', color: '#1F1714', fontWeight: 700 }}>
                    ₹{subtotal.toFixed(2)}
                  </Typography>
                </Box>

                {discountAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
                    <Typography sx={{ fontSize: '13px', color: '#059669', fontWeight: 600 }}>Discount:</Typography>
                    <Typography sx={{ fontSize: '13px', color: '#059669', fontWeight: 700 }}>
                      -₹{discountAmount.toFixed(2)}
                    </Typography>
                  </Box>
                )}

                {packingAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
                    <Typography sx={{ fontSize: '12.5px', color: '#786C58', fontWeight: 600 }}>
                      Packing Charges ({packing.includes('%') ? packing : `${packing}%`}):
                    </Typography>
                    <Typography sx={{ fontSize: '12.5px', color: '#1F1714', fontWeight: 700 }}>
                      +₹{packingAmount.toFixed(2)}
                    </Typography>
                  </Box>
                )}

                {taxAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
                    <Typography sx={{ fontSize: '12.5px', color: '#786C58', fontWeight: 600 }}>
                      GST / Tax ({tax.includes('%') ? tax : `${tax}%`}):
                    </Typography>
                    <Typography sx={{ fontSize: '12.5px', color: '#1F1714', fontWeight: 700 }}>
                      +₹{taxAmount.toFixed(2)}
                    </Typography>
                  </Box>
                )}

                {totalCases > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
                    <Typography sx={{ fontSize: '12px', color: '#92400E', fontWeight: 600 }}>Total Qty / Cases:</Typography>
                    <Typography sx={{ fontSize: '12.5px', color: '#92400E', fontWeight: 700 }}>
                      {totalCases}
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ my: 1, borderColor: '#FDE68A' }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#991B1B' }}>
                    Grand Total:
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 900, color: '#B91C1C' }}>
                    ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Box>

              {/* Save & Print Action Buttons */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => handleSaveBill(false)}
                    disabled={savingBill || productRows.length === 0}
                    sx={{
                      borderColor: '#F59E0B',
                      color: '#92400E',
                      fontWeight: 700,
                      textTransform: 'none',
                      py: 1,
                      borderRadius: '8px',
                      '&:hover': { borderColor: '#B45309', backgroundColor: '#FFFBEB' },
                    }}
                  >
                    Save Bill
                  </Button>

                  <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    onClick={() => handleSaveBill(true)}
                    disabled={savingBill || productRows.length === 0}
                    startIcon={savingBill ? <CircularProgress size={16} color="inherit" /> : <PrintOutlinedIcon />}
                    sx={{
                      background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      textTransform: 'none',
                      py: 1,
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                      '&:hover': { background: 'linear-gradient(135deg, #B91C1C 0%, #991B1B 100%)' },
                    }}
                  >
                    Save & Print
                  </Button>
                </Box>

                {(productRows.length > 0 || customerName.trim() !== '') && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleClearDraft}
                    startIcon={<ClearRoundedIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      color: '#991B1B',
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'none',
                      py: 0.4,
                      '&:hover': { backgroundColor: '#FEF2F2' },
                    }}
                  >
                    Clear Current Draft Form
                  </Button>
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Right Column: Product Selector & Current Bill Table */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: '14px',
              border: '1.5px solid #FDE68A',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 4px 20px -2px rgba(217, 119, 6, 0.08)',
              overflow: 'hidden',
              mb: 3,
            }}
          >
            {/* Top Product Entry Bar */}
            <Box
              sx={{
                background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                borderBottom: '2px solid #F59E0B',
                p: 2,
                px: { xs: 2, sm: 2.5 },
                color: '#FFFFFF',
              }}
            >
              <Typography sx={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em', mb: 1.5 }}>
                2. Add Products from Price List
              </Typography>

              {/* Product Selection + Qty + Rate + Add Row */}
              <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
                {/* Autocomplete Product Dropdown */}
                <Grid size={{ xs: 12, sm: 5 }}>
                  <Autocomplete
                    size="small"
                    autoHighlight
                    options={productOptions}
                    getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                    isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                    value={productOptions.find((p) => p.name === selectedProduct) || null}
                    onChange={(_, val) => {
                      if (val) {
                        setSelectedProduct(val.name);
                        if (val.rate !== undefined && val.rate > 0) {
                          setRate(String(val.rate));
                        }
                        if (val.unit) {
                          setUnit(val.unit);
                        }
                      } else {
                        setSelectedProduct('');
                      }
                    }}
                    renderOption={(props, option) => (
                      <Box
                        component="li"
                        {...props}
                        key={option.id || option.name}
                        sx={{
                          display: 'flex !important',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                          py: 0.8,
                          px: 1.5,
                          gap: 1,
                          borderBottom: '1px solid #FEF3C7',
                          '&:last-child': { borderBottom: 'none' },
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography sx={{ fontSize: '13.5px', fontWeight: 700, color: '#1F1714' }}>
                            {option.name}
                          </Typography>
                          {option.category && (
                            <Typography sx={{ fontSize: '11px', color: '#D97706', fontWeight: 600 }}>
                              {option.category}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          {option.rate !== undefined && option.rate > 0 && (
                            <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#B91C1C' }}>
                              ₹{Number(option.rate).toLocaleString('en-IN')}
                            </Typography>
                          )}
                          {option.unit && (
                            <Typography sx={{ fontSize: '10.5px', color: '#6B7280' }}>
                              / {option.unit}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search product from price list..."
                        sx={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiInputBase-input': {
                            fontSize: '13px',
                            fontWeight: 600,
                          },
                        }}
                      />
                    )}
                  />
                </Grid>

                {/* Quantity */}
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Qty"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddProductItem();
                      }
                    }}
                    sx={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      '& .MuiInputBase-input': { fontSize: '13px', fontWeight: 600, textAlign: 'center' },
                    }}
                  />
                </Grid>

                {/* Rate */}
                <Grid size={{ xs: 6, sm: 2.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Rate (₹)"
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddProductItem();
                      }
                    }}
                    sx={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      '& .MuiInputBase-input': { fontSize: '13px', fontWeight: 800, color: '#B91C1C' },
                    }}
                  />
                </Grid>

                {/* Add Item Button */}
                <Grid size={{ xs: 12, sm: 2.5 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    onClick={handleAddProductItem}
                    startIcon={<AddRoundedIcon sx={{ fontSize: 18 }} />}
                    sx={{
                      backgroundColor: '#FFFFFF',
                      color: '#B91C1C',
                      border: '1.5px solid #FDE68A',
                      fontWeight: 800,
                      fontSize: '13px',
                      textTransform: 'none',
                      height: '38px',
                      borderRadius: '6px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      '&:hover': { backgroundColor: '#FFFBEB' },
                    }}
                  >
                    Add Item
                  </Button>
                </Grid>
              </Grid>
            </Box>

            {/* Current Bill Items Table */}
            <TableContainer sx={{ minHeight: '260px', maxHeight: '460px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Table stickyHeader size="small" aria-label="bill items table" sx={{ minWidth: { xs: '540px', sm: '100%' } }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#FFFBEB' }}>
                    <TableCell sx={{ fontWeight: 800, fontSize: '11.5px', color: '#7C2D12', width: '50px', backgroundColor: '#FFFBEB' }}>
                      #
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '11.5px', color: '#7C2D12', backgroundColor: '#FFFBEB' }}>
                      PRODUCT / PARTICULAR
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: '11.5px', color: '#7C2D12', width: '80px', backgroundColor: '#FFFBEB' }}>
                      UNIT
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: '11.5px', color: '#7C2D12', width: '80px', backgroundColor: '#FFFBEB' }}>
                      QTY
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '11.5px', color: '#7C2D12', width: '100px', backgroundColor: '#FFFBEB' }}>
                      RATE (₹)
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '11.5px', color: '#7C2D12', width: '110px', backgroundColor: '#FFFBEB' }}>
                      AMOUNT (₹)
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: '11.5px', color: '#7C2D12', width: '60px', backgroundColor: '#FFFBEB' }}>
                      ACTION
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#9CA3AF' }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#786C58' }}>
                          No products added to this invoice yet.
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#A8998A' }}>
                          Select a product from the top bar and click "Add Item" to build the bill.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    productRows.map((row, idx) => (
                      <TableRow key={row.id} sx={{ '&:hover': { backgroundColor: '#FEFDF5' } }}>
                        <TableCell sx={{ fontSize: '13px', fontWeight: 700, color: '#786C58' }}>
                          {idx + 1}
                        </TableCell>
                        <TableCell sx={{ fontSize: '13.5px', fontWeight: 700, color: '#1F1714' }}>
                          {row.particular}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '12px', color: '#57463A' }}>
                          {row.pktUnit}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '13.5px', fontWeight: 700 }}>
                          {row.quantity}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '13.5px', fontWeight: 700, color: '#78350F' }}>
                          ₹{Number(row.rate || 0).toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '14px', fontWeight: 800, color: '#B91C1C' }}>
                          ₹{Number(row.amount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteRow(row.id)}
                            sx={{ color: '#DC2626', p: 0.5, '&:hover': { backgroundColor: '#FEF2F2' } }}
                          >
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Print Bill Modal */}
      {printModalOpen && selectedBillForPrint && (
        <BillPrintModal
          open={printModalOpen}
          onClose={() => {
            setPrintModalOpen(false);
            setSelectedBillForPrint(null);
          }}
          bill={selectedBillForPrint}
        />
      )}
    </Box>
  );
};
