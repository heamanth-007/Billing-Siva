import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  TextField,
  Grid,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  CircularProgress,
  Tooltip,
  Divider,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import { ParticularsApi } from '../services/api';

export interface EditProductRow {
  particular: string;
  quantity: string | number;
  rate: string | number;
  pktUnit: string;
  amount: string | number;
}

interface EditBillModalProps {
  open: boolean;
  onClose: () => void;
  bill: any | null;
  onBillUpdated?: () => void;
}

export const EditBillModal: React.FC<EditBillModalProps> = ({
  open,
  onClose,
  bill,
  onBillUpdated,
}) => {
  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGst, setCustomerGst] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [transport, setTransport] = useState('');
  const [caseCount, setCaseCount] = useState('');
  const [discount, setDiscount] = useState('0');
  const [packing, setPacking] = useState('0');
  const [tax, setTax] = useState('0');
  const [products, setProducts] = useState<EditProductRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bill) {
      setBillNo(bill.billNo || '');
      setBillDate(bill.date || '');
      setCustomerName(bill.customerName || '');
      setCustomerPhone(bill.customerPhone || '');
      setCustomerAddress(bill.customerAddress || '');
      setCustomerGst(bill.customerGst || '');
      setCompanyName(bill.companyName || '');
      setTransport(bill.transport || '');
      setCaseCount(String(bill.caseCount || '0'));
      setDiscount(String(bill.discount ?? '0'));
      setPacking(String(bill.packing ?? '0'));
      setTax(String(bill.tax ?? '0'));

      const initialProducts = (bill.products || []).map((p: any) => ({
        particular: p.particular || p.name || '',
        quantity: p.quantity ?? '1',
        rate: p.rate ?? '0',
        pktUnit: p.pktUnit || 'Box',
        amount: p.amount ?? '0',
      }));

      if (initialProducts.length === 0) {
        initialProducts.push({
          particular: '',
          quantity: '1',
          rate: '0',
          pktUnit: 'Box',
          amount: '0',
        });
      }

      setProducts(initialProducts);
    }
  }, [bill, open]);

  // Product row handlers
  const handleProductChange = (index: number, field: keyof EditProductRow, val: string) => {
    setProducts((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: val };

      if (field === 'quantity' || field === 'rate') {
        const q = parseFloat(String(field === 'quantity' ? val : item.quantity)) || 0;
        const r = parseFloat(String(field === 'rate' ? val : item.rate)) || 0;
        item.amount = (q * r).toFixed(2);
      }
      next[index] = item;
      return next;
    });
  };

  const handleAddProductRow = () => {
    setProducts((prev) => [
      ...prev,
      {
        particular: '',
        quantity: '1',
        rate: '0',
        pktUnit: 'Box',
        amount: '0.00',
      },
    ]);
  };

  const handleRemoveProductRow = (index: number) => {
    if (products.length <= 1) {
      setProducts([
        {
          particular: '',
          quantity: '1',
          rate: '0',
          pktUnit: 'Box',
          amount: '0.00',
        },
      ]);
      return;
    }
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = useMemo(() => {
    return products.reduce((acc, p) => {
      const amt = parseFloat(String(p.amount).replace(/,/g, '')) || 0;
      return acc + amt;
    }, 0);
  }, [products]);

  const discountAmt = useMemo(() => {
    const raw = String(discount).trim();
    const num = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
    if (num <= 0) return 0;
    if (raw.includes('%') || (num <= 100 && !raw.startsWith('₹'))) {
      return (subtotal * num) / 100;
    }
    return num;
  }, [discount, subtotal]);

  const packingAmt = useMemo(() => {
    const raw = String(packing).trim();
    const num = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
    if (num <= 0) return 0;
    if (raw.includes('%')) {
      return (subtotal * num) / 100;
    }
    return num;
  }, [packing, subtotal]);

  const taxAmt = useMemo(() => {
    const raw = String(tax).trim();
    const num = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
    if (num <= 0) return 0;
    const base = Math.max(0, subtotal - discountAmt + packingAmt);
    return (base * num) / 100;
  }, [tax, subtotal, discountAmt, packingAmt]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmt + packingAmt + taxAmt);
  }, [subtotal, discountAmt, packingAmt, taxAmt]);

  const handleSave = async () => {
    if (!bill) return;
    const billId = bill._id || bill.id;
    if (!billId) return;

    if (!customerName.trim()) {
      alert('Please enter a Customer Name');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        billNo: billNo.trim(),
        date: billDate.trim(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        customerGst: customerGst.trim(),
        companyName: companyName.trim() || 'General',
        transport: transport.trim(),
        caseCount: caseCount.trim(),
        discount: discount.trim(),
        packing: packing.trim(),
        tax: tax.trim(),
        amount: subtotal.toFixed(2),
        total: totalAmount.toFixed(2),
        products: products
          .filter((p) => p.particular.trim() !== '')
          .map((p) => ({
            particular: p.particular.trim(),
            quantity: String(p.quantity || '1'),
            rate: String(p.rate || '0'),
            pktUnit: p.pktUnit || 'Box',
            amount: String(p.amount || '0'),
          })),
      };

      await ParticularsApi.update(billId, payload);
      alert('✅ Bill updated successfully!');
      onBillUpdated?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to update bill:', err);
      alert(err.message || 'Error updating bill');
    } finally {
      setSaving(false);
    }
  };

  if (!bill) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '14px',
            overflow: 'hidden',
            border: '1.5px solid #FDE68A',
            boxShadow: '0 20px 40px -15px rgba(217, 119, 6, 0.25)',
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
          borderBottom: '2px solid #F59E0B',
          px: 3,
          py: 1.6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#FFFFFF',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ModeEditOutlineRoundedIcon sx={{ fontSize: 22, color: '#FEF08A' }} />
          <Box>
            <Typography sx={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              Edit Bill #{bill.billNo || ''}
            </Typography>
            <Typography sx={{ fontSize: '11.5px', color: '#FEF3C7', fontWeight: 600 }}>
              Update customer details, items, pricing & extra charges
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#FFFFFF', p: 0.6 }}>
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Body */}
      <DialogContent sx={{ p: { xs: 2, sm: 2.8 }, backgroundColor: '#FFFDF9', overflowY: 'auto' }}>
        {/* Row 1: Bill No, Date, Company */}
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              size="small"
              label="Bill Number"
              value={billNo}
              onChange={(e) => setBillNo(e.target.value)}
              sx={{ backgroundColor: '#FFFFFF' }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              size="small"
              label="Bill Date (DD-MM-YYYY)"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              sx={{ backgroundColor: '#FFFFFF' }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              size="small"
              label="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              sx={{ backgroundColor: '#FFFFFF' }}
            />
          </Grid>
        </Grid>

        {/* Row 2: Customer Details */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: '10px',
            border: '1px solid #FDE68A',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#92400E', mb: 1.5 }}>
            Customer Information
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="Customer Name *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="Phone / Mobile"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                size="small"
                label="Address / Destination"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                size="small"
                label="GSTIN"
                value={customerGst}
                onChange={(e) => setCustomerGst(e.target.value.toUpperCase())}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Row 3: Transport & Cases */}
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              size="small"
              label="Transport / Lorry Name"
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
              placeholder="e.g. ABT / VRL / SRS"
              sx={{ backgroundColor: '#FFFFFF' }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              size="small"
              label="Total No. of Cases"
              value={caseCount}
              onChange={(e) => setCaseCount(e.target.value)}
              placeholder="e.g. 5"
              sx={{ backgroundColor: '#FFFFFF' }}
            />
          </Grid>
        </Grid>

        {/* Row 4: Products Table */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: '10px',
            border: '1px solid #FDE68A',
            overflow: 'hidden',
            mb: 2.5,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.2,
              backgroundColor: '#FFFBEB',
              borderBottom: '1px solid #FDE68A',
            }}
          >
            <Typography sx={{ fontSize: '13.5px', fontWeight: 800, color: '#7C2D12' }}>
              Products & Items ({products.length})
            </Typography>
            <Button
              size="small"
              variant="contained"
              disableElevation
              onClick={handleAddProductRow}
              startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'none',
                px: 1.5,
                py: 0.4,
                borderRadius: '6px',
              }}
            >
              Add Item
            </Button>
          </Box>

          <TableContainer sx={{ maxHeight: 280 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: '11px', color: '#7C2D12', width: '36px', p: 1 }}>
                    #
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '11px', color: '#7C2D12', p: 1 }}>
                    ITEM / PARTICULAR
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '11px', color: '#7C2D12', width: '90px', p: 1 }}>
                    QTY
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '11px', color: '#7C2D12', width: '105px', p: 1 }}>
                    RATE (₹)
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '11px', color: '#7C2D12', width: '90px', p: 1 }}>
                    UNIT
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: '11px', color: '#7C2D12', width: '110px', p: 1 }}>
                    AMOUNT (₹)
                  </TableCell>
                  <TableCell align="center" sx={{ width: '45px', p: 1 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((row, idx) => (
                  <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#FEFDF5' } }}>
                    <TableCell sx={{ p: 1, fontSize: '12px', fontWeight: 700, color: '#786C58' }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell sx={{ p: 0.8 }}>
                      <TextField
                        fullWidth
                        size="small"
                        value={row.particular}
                        onChange={(e) => handleProductChange(idx, 'particular', e.target.value)}
                        placeholder="Product description"
                        sx={{ '& .MuiInputBase-input': { fontSize: '12.5px', p: '5px 8px' } }}
                      />
                    </TableCell>
                    <TableCell sx={{ p: 0.8 }}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={row.quantity}
                        onChange={(e) => handleProductChange(idx, 'quantity', e.target.value)}
                        sx={{ '& .MuiInputBase-input': { fontSize: '12.5px', p: '5px 8px', textAlign: 'center' } }}
                      />
                    </TableCell>
                    <TableCell sx={{ p: 0.8 }}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={row.rate}
                        onChange={(e) => handleProductChange(idx, 'rate', e.target.value)}
                        sx={{ '& .MuiInputBase-input': { fontSize: '12.5px', p: '5px 8px', textAlign: 'right' } }}
                      />
                    </TableCell>
                    <TableCell sx={{ p: 0.8 }}>
                      <TextField
                        fullWidth
                        size="small"
                        value={row.pktUnit}
                        onChange={(e) => handleProductChange(idx, 'pktUnit', e.target.value)}
                        placeholder="Box"
                        sx={{ '& .MuiInputBase-input': { fontSize: '12.5px', p: '5px 8px', textAlign: 'center' } }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ p: 1, fontWeight: 800, fontSize: '13px', color: '#B91C1C' }}>
                      ₹{parseFloat(String(row.amount || 0)).toFixed(2)}
                    </TableCell>
                    <TableCell align="center" sx={{ p: 0.5 }}>
                      <Tooltip title="Delete Item">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveProductRow(idx)}
                          sx={{ p: 0.5 }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Row 5: Calculations & Summary */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '10px',
                border: '1px solid #FDE68A',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#92400E', mb: 1.5 }}>
                Discounts, Packing & Tax
              </Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Discount (₹ or %)"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Packing (₹ or %)"
                    value={packing}
                    onChange={(e) => setPacking(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="GST / Tax Rate (%)"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '10px',
                border: '1px solid #FDE68A',
                backgroundColor: '#FFFDF7',
              }}
            >
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#92400E', mb: 1 }}>
                Live Total Summary
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '12.5px', color: '#64748B' }}>Subtotal:</Typography>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#1E293B' }}>₹{subtotal.toFixed(2)}</Typography>
              </Box>
              {discountAmt > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: '12.5px', color: '#64748B' }}>Discount:</Typography>
                  <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#DC2626' }}>-₹{discountAmt.toFixed(2)}</Typography>
                </Box>
              )}
              {packingAmt > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: '12.5px', color: '#64748B' }}>Packing:</Typography>
                  <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#1E293B' }}>+₹{packingAmt.toFixed(2)}</Typography>
                </Box>
              )}
              {taxAmt > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: '12.5px', color: '#64748B' }}>Tax / GST:</Typography>
                  <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#1E293B' }}>+₹{taxAmt.toFixed(2)}</Typography>
                </Box>
              )}
              <Divider sx={{ my: 1, borderColor: '#FDE68A' }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 900, color: '#92400E' }}>Grand Total:</Typography>
                <Typography sx={{ fontSize: '17px', fontWeight: 900, color: '#B91C1C' }}>
                  ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, py: 1.5, backgroundColor: '#FFFFFF', borderTop: '1px solid #FEF3C7', justifyContent: 'space-between' }}>
        <Button
          onClick={onClose}
          sx={{ color: '#78350F', fontSize: '13px', fontWeight: 600, textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          disabled={saving}
          onClick={handleSave}
          startIcon={saving ? <CircularProgress size={16} sx={{ color: '#FFFFFF' }} /> : <SaveRoundedIcon sx={{ fontSize: 18 }} />}
          sx={{
            background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 800,
            textTransform: 'none',
            px: 3,
            py: 0.8,
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
            '&:hover': { background: 'linear-gradient(135deg, #B91C1C 0%, #991B1B 100%)' },
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
