import { useState, useEffect, useMemo, type FC } from 'react';
import {
  Box,
  Typography,
  Button,
  InputBase,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { CustomersApi, ParticularsApi } from '../services/api';
import { printCustomerListDirectly } from '../utils/printUtils';
import { DateRangePrintModal } from './DateRangePrintModal';
import { BillPrintModal } from './BillPrintModal';
import type { BillPrintData } from './BillPrintTemplate';
import { getStoredSettings } from './SettingsPage';

export interface CustomerItem {
  _id?: string;
  id?: string;
  idCode?: string;
  name: string;
  avatarLetter?: string;
  avatarBg?: string;
  avatarColor?: string;
  address: string;
  mobile: string;
  gst: string;
}

interface AllCustomersPageProps {
  onAddNewCustomer?: () => void;
  onSelectCustomerForParticular?: (customerName: string, subTab?: 'Account Details' | 'Create Particular') => void;
}

export const AllCustomersPage: FC<AllCustomersPageProps> = ({
  onAddNewCustomer,
  onSelectCustomerForParticular,
}) => {
  const [storeSettings, setStoreSettings] = useState(() => getStoredSettings());
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Customer Dialog State
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    mobile: '',
    gst: '',
    address: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Date Range Print Modal State
  const [openDatePrintModal, setOpenDatePrintModal] = useState(false);

  // Recent Bills State
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [loadingRecentBills, setLoadingRecentBills] = useState<boolean>(true);
  const [billSearchTerm, setBillSearchTerm] = useState<string>('');
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [selectedBillForPrint, setSelectedBillForPrint] = useState<BillPrintData | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await CustomersApi.getAll();
      setCustomers(data || []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentBills = async () => {
    try {
      setLoadingRecentBills(true);
      const bills = await ParticularsApi.getAll();
      setRecentBills(Array.isArray(bills) ? bills : []);
    } catch (err) {
      console.error('Failed to fetch recent bills:', err);
    } finally {
      setLoadingRecentBills(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchRecentBills();

    const handleSettingsUpdate = () => {
      setStoreSettings(getStoredSettings());
    };
    window.addEventListener('dheeksha_settings_updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('dheeksha_settings_updated', handleSettingsUpdate);
    };
  }, []);

  const handleOpenEdit = (customer: CustomerItem) => {
    setEditingCustomer(customer);
    setEditFormData({
      name: customer.name || '',
      mobile: customer.mobile || '',
      gst: customer.gst || '',
      address: customer.address || '',
    });
    setOpenEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;
    const id = editingCustomer._id || editingCustomer.id;
    if (!id) return;

    if (!editFormData.name.trim() || !editFormData.address.trim()) {
      alert('Please fill in Customer Name and Address');
      return;
    }

    try {
      setEditLoading(true);
      await CustomersApi.update(id, {
        name: editFormData.name.trim(),
        mobile: editFormData.mobile.trim() || 'N/A',
        gst: editFormData.gst.trim() || 'N/A',
        address: editFormData.address.trim(),
        avatarLetter: editFormData.name.trim().charAt(0).toUpperCase(),
      });
      setOpenEditModal(false);
      await fetchCustomers();
    } catch (err: any) {
      console.error('Failed to update customer:', err);
      alert(err.message || 'Error updating customer');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete customer "${name}"? This will delete all associated records.`)) return;

    try {
      await CustomersApi.delete(id);
      setCustomers((prev) => prev.filter((c) => (c._id || c.id) !== id));
      fetchRecentBills();
    } catch (err: any) {
      console.error('Failed to delete customer:', err);
      alert(err.message || 'Error deleting customer');
    }
  };

  // Delete Recent Bill
  const handleDeleteRecentBill = async (bill: any) => {
    const id = bill._id || bill.id;
    if (!id) return;
    if (!window.confirm(`Delete Bill #${bill.billNo || ''} for ${bill.customerName}?`)) return;

    try {
      await ParticularsApi.delete(id);
      setRecentBills((prev) => prev.filter((b) => (b._id || b.id) !== id));
    } catch (err: any) {
      console.error('Failed to delete bill:', err);
      alert(err.message || 'Error deleting bill');
    }
  };

  // Open Print for Recent Bill
  const handlePrintRecentBill = (bill: any) => {
    const printData: BillPrintData = {
      billNo: bill.billNo || '',
      date: bill.date || '',
      customerName: bill.customerName || '',
      customerPhone: bill.customerPhone || '',
      customerAddress: bill.customerAddress || '',
      companyName:
        bill.companyName && bill.companyName.trim() !== '' && bill.companyName !== 'General'
          ? bill.companyName
          : storeSettings.companyName || 'General',
      transport: String(bill.transport || '0'),
      caseCount: String(bill.caseCount || '0'),
      discount: String(bill.discount || '0'),
      packing: String(bill.packing || '0'),
      tax: String(bill.tax || '0'),
      amount: String(bill.amount || bill.total || '0'),
      total: String(bill.total || '0'),
      products: (bill.products || []).map((p: any) => ({
        particular: p.particular || p.name || '',
        quantity: p.quantity || '0',
        rate: p.rate || '0',
        pktUnit: p.pktUnit || 'Box',
        amount: p.amount || '0',
      })),
    };
    setSelectedBillForPrint(printData);
    setPrintModalOpen(true);
  };

  // Filtering Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.address && c.address.toLowerCase().includes(term)) ||
        (c.gst && c.gst.toLowerCase().includes(term)) ||
        (c.mobile && c.mobile.includes(term)) ||
        (c.idCode && c.idCode.toLowerCase().includes(term))
      );
    });
  }, [customers, searchTerm]);

  // Filtered recent bills
  const filteredRecentBills = useMemo(() => {
    if (!billSearchTerm.trim()) return recentBills;
    const term = billSearchTerm.toLowerCase().trim();
    return recentBills.filter(
      (b) =>
        (b.billNo && b.billNo.toLowerCase().includes(term)) ||
        (b.customerName && b.customerName.toLowerCase().includes(term)) ||
        (b.companyName && b.companyName.toLowerCase().includes(term)) ||
        (b.date && b.date.toLowerCase().includes(term))
    );
  }, [recentBills, billSearchTerm]);

  return (
    <Box
      sx={{
        width: '100%',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 2.5, md: 3.5 },
        boxSizing: 'border-box',
      }}
    >
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '24px', sm: '28px', md: '30px' },
                fontWeight: 800,
                color: '#B91C1C',
                letterSpacing: '-0.025em',
                lineHeight: 1.2,
              }}
            >
              All Customers & Invoices Directory
            </Typography>
            <Chip
              label={`${customers.length} Customers`}
              size="small"
              sx={{
                backgroundColor: '#FFFBEB',
                color: '#92400E',
                fontWeight: 800,
                border: '1px solid #FDE68A',
              }}
            />
          </Box>
          <Typography sx={{ fontSize: '13.5px', color: '#786C58', mt: 0.5, fontWeight: 600 }}>
            Directory of all registered customers, contact numbers, and recent invoices history.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            width: { xs: '100%', md: 'auto' },
            flexWrap: 'wrap',
          }}
        >
          {/* Search Box */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1.5px solid #FDE68A',
              px: 1.5,
              height: '40px',
              width: { xs: '100%', sm: '280px' },
              boxSizing: 'border-box',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: '#F59E0B',
              },
              '&:focus-within': {
                borderColor: '#DC2626',
                boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.12)',
              },
            }}
          >
            <SearchRoundedIcon
              sx={{
                color: '#D97706',
                fontSize: 20,
                mr: 1,
              }}
            />
            <InputBase
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: '#1F1714',
                width: '100%',
                '& input': {
                  p: 0,
                  '&::placeholder': {
                    color: '#A8998A',
                    opacity: 1,
                  },
                },
              }}
            />
          </Box>

          {/* Print Customers Report Button */}
          <Button
            variant="outlined"
            onClick={() => setOpenDatePrintModal(true)}
            startIcon={<PrintOutlinedIcon sx={{ fontSize: 19 }} />}
            sx={{
              backgroundColor: '#FFFFFF',
              color: '#7C2D12',
              borderColor: '#FCD34D',
              borderWidth: '1.5px',
              height: '40px',
              px: 2,
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 700,
              textTransform: 'none',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(217, 119, 6, 0.08)',
              '&:hover': {
                backgroundColor: '#FFFBEB',
                borderColor: '#F59E0B',
              },
            }}
          >
            Print Report ({filteredCustomers.length})
          </Button>

          {/* Add New Customer Button */}
          {onAddNewCustomer && (
            <Button
              variant="contained"
              disableElevation
              onClick={onAddNewCustomer}
              startIcon={<AddRoundedIcon sx={{ fontSize: 20 }} />}
              sx={{
                background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                color: '#FFFFFF',
                border: '1px solid #F59E0B',
                height: '40px',
                px: 2.4,
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 700,
                textTransform: 'none',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #B91C1C 0%, #991B1B 100%)',
                },
              }}
            >
              Add Customer
            </Button>
          )}
        </Box>
      </Box>

      {/* Overview Metric Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: '12px',
          border: '1.5px solid #FDE68A',
          backgroundColor: '#FFFBEB',
          boxShadow: '0 2px 8px rgba(217, 119, 6, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              backgroundColor: '#FEF3C7',
              color: '#B91C1C',
              border: '1px solid #FDE68A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <PeopleAltRoundedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#786C58' }}>
              Total Registered Customers
            </Typography>
            <Typography sx={{ fontSize: '22px', fontWeight: 900, color: '#B91C1C', lineHeight: 1.2, mt: 0.2 }}>
              {customers.length}
            </Typography>
          </Box>
        </Box>

        <Typography sx={{ fontSize: '12.5px', color: '#786C58', fontWeight: 600 }}>
          Showing {filteredCustomers.length} of {customers.length} customer records
        </Typography>
      </Paper>

      {/* 1. Main Customers Table Card */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1.5px solid #FDE68A',
          boxShadow: '0 4px 20px -2px rgba(217, 119, 6, 0.08)',
          overflow: 'hidden',
          mb: 4,
        }}
      >
        <TableContainer>
          <Table sx={{ minWidth: 750 }} aria-label="all customers table">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#FFFBEB' }}>
                <TableCell
                  sx={{
                    py: 1.8,
                    px: 2.5,
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#7C2D12',
                    letterSpacing: '0.04em',
                    borderBottom: '2px solid #FDE68A',
                    width: '90px',
                  }}
                >
                  ID
                </TableCell>
                <TableCell
                  sx={{
                    py: 1.8,
                    px: 2.5,
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#7C2D12',
                    letterSpacing: '0.04em',
                    borderBottom: '2px solid #FDE68A',
                  }}
                >
                  CUSTOMER NAME & CONTACT
                </TableCell>
                <TableCell
                  sx={{
                    py: 1.8,
                    px: 2.5,
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#7C2D12',
                    letterSpacing: '0.04em',
                    borderBottom: '2px solid #FDE68A',
                  }}
                >
                  ADDRESS & GSTIN
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    py: 1.8,
                    px: 2.5,
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#7C2D12',
                    letterSpacing: '0.04em',
                    borderBottom: '2px solid #FDE68A',
                    width: '240px',
                  }}
                >
                  ACTIONS
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} sx={{ color: '#DC2626' }} />
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6, color: '#786C58' }}>
                    {searchTerm ? 'No customers match your search criteria.' : 'No customers found.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer, index) => {
                  const isLast = index === filteredCustomers.length - 1;
                  const recordId = customer._id || customer.id || '';
                  const idDisplay = customer.idCode || `#${(index + 1).toString().padStart(4, '0')}`;
                  const avatarInitial = customer.avatarLetter || customer.name.charAt(0).toUpperCase();

                  return (
                    <TableRow
                      key={recordId || index}
                      sx={{
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          backgroundColor: '#FEFDF5',
                        },
                      }}
                    >
                      {/* ID */}
                      <TableCell
                        sx={{
                          py: 1.8,
                          px: 2.5,
                          fontSize: '13px',
                          color: '#B91C1C',
                          fontWeight: 800,
                          borderBottom: isLast ? 'none' : '1px solid #F7EEDB',
                        }}
                      >
                        {idDisplay}
                      </TableCell>

                      {/* Customer Name & Mobile */}
                      <TableCell
                        sx={{
                          py: 1.8,
                          px: 2.5,
                          borderBottom: isLast ? 'none' : '1px solid #F7EEDB',
                        }}
                      >
                        <Box
                          onClick={() => onSelectCustomerForParticular?.(customer.name, 'Account Details')}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            cursor: 'pointer',
                          }}
                        >
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              backgroundColor: customer.avatarBg || '#FEF3C7',
                              color: customer.avatarColor || '#B91C1C',
                              border: '1px solid #FDE68A',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {avatarInitial}
                          </Box>
                          <Box>
                            <Typography
                              sx={{
                                fontSize: '14.5px',
                                fontWeight: 700,
                                color: '#1F1714',
                                letterSpacing: '-0.01em',
                                '&:hover': {
                                  color: '#DC2626',
                                  textDecoration: 'underline',
                                },
                              }}
                            >
                              {customer.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                              <PhoneOutlinedIcon sx={{ fontSize: 13, color: '#D97706' }} />
                              <Typography sx={{ fontSize: '12px', color: '#786C58', fontWeight: 600 }}>
                                {customer.mobile || 'N/A'}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Address & GST */}
                      <TableCell
                        sx={{
                          py: 1.8,
                          px: 2.5,
                          fontSize: '13px',
                          color: '#334155',
                          fontWeight: 500,
                          borderBottom: isLast ? 'none' : '1px solid #F7EEDB',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.6 }}>
                          <LocationOnOutlinedIcon sx={{ fontSize: 15, color: '#64748B', mt: 0.2, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '13px', color: '#334155', fontWeight: 500, maxWidth: '320px' }}>
                            {customer.address || 'N/A'}
                          </Typography>
                        </Box>
                        {customer.gst && customer.gst !== 'N/A' && (
                          <Typography sx={{ fontSize: '11.5px', color: '#D97706', fontWeight: 700, mt: 0.4, pl: 2.6 }}>
                            GSTIN: {customer.gst}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell
                        align="center"
                        sx={{
                          py: 1.8,
                          px: 2,
                          borderBottom: isLast ? 'none' : '1px solid #F7EEDB',
                        }}
                      >
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                          {/* View Statement / Account Details Button */}
                          <Tooltip title="View Account Statement & Billing History" arrow>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onSelectCustomerForParticular?.(customer.name, 'Account Details')}
                              startIcon={<AccountBalanceWalletRoundedIcon sx={{ fontSize: '15px !important' }} />}
                              sx={{
                                height: '32px',
                                px: 1.4,
                                fontSize: '12px',
                                fontWeight: 700,
                                textTransform: 'none',
                                color: '#92400E',
                                borderColor: '#FDE68A',
                                backgroundColor: '#FFFBEB',
                                borderRadius: '6px',
                                '&:hover': {
                                  backgroundColor: '#FDE68A',
                                  borderColor: '#F59E0B',
                                  color: '#78350F',
                                },
                              }}
                            >
                              Statement
                            </Button>
                          </Tooltip>

                          {/* Edit Customer Button */}
                          <Tooltip title="Edit Customer" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEdit(customer)}
                              sx={{
                                color: '#D97706',
                                backgroundColor: '#FFFBEB',
                                border: '1px solid #FDE68A',
                                borderRadius: '6px',
                                p: 0.7,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  color: '#FFFFFF',
                                  backgroundColor: '#D97706',
                                  borderColor: '#D97706',
                                },
                              }}
                            >
                              <ModeEditOutlineRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>

                          {/* Delete Customer Button */}
                          <Tooltip title="Delete Customer" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(recordId, customer.name)}
                              sx={{
                                color: '#DC2626',
                                backgroundColor: '#FEF2F2',
                                border: '1px solid #FECACA',
                                borderRadius: '6px',
                                p: 0.7,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  color: '#FFFFFF',
                                  backgroundColor: '#DC2626',
                                  borderColor: '#DC2626',
                                },
                              }}
                            >
                              <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 2. Recent Bills & Invoices Section */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '14px',
          border: '1.5px solid #FDE68A',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 4px 20px -2px rgba(217, 119, 6, 0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Recent Bills Header */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
            borderBottom: '2px solid #F59E0B',
            px: { xs: 2, sm: 3 },
            py: 1.5,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            minHeight: '56px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ReceiptLongRoundedIcon sx={{ color: '#FFFFFF', fontSize: 22 }} />
            <Typography sx={{ color: '#FFFFFF', fontSize: '17px', fontWeight: 800 }}>
              Recent Bills & Invoices
            </Typography>
            <Typography
              sx={{
                color: '#FEF08A',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: 'rgba(254, 240, 138, 0.2)',
                px: 1.2,
                py: 0.2,
                borderRadius: '10px',
              }}
            >
              {filteredRecentBills.length} bills
            </Typography>
          </Box>

          {/* Search Box & Refresh */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                px: 1.2,
                height: '36px',
                width: { xs: '100%', sm: '220px' },
                border: '1.5px solid #FDE68A',
              }}
            >
              <SearchRoundedIcon sx={{ color: '#D97706', fontSize: 18, mr: 0.8 }} />
              <InputBase
                placeholder="Search bills..."
                value={billSearchTerm}
                onChange={(e) => setBillSearchTerm(e.target.value)}
                sx={{
                  fontSize: '13px',
                  fontWeight: 600,
                  width: '100%',
                  '& input': { p: 0, '&::placeholder': { color: '#A8998A' } },
                }}
              />
              {billSearchTerm && (
                <IconButton size="small" onClick={() => setBillSearchTerm('')} sx={{ p: 0.3 }}>
                  <ClearRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              )}
            </Box>

            <Button
              variant="contained"
              size="small"
              onClick={fetchRecentBills}
              startIcon={<RefreshRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                border: '1px solid rgba(254, 240, 138, 0.4)',
                fontWeight: 700,
                textTransform: 'none',
                height: '36px',
                borderRadius: '8px',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
              }}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Recent Bills Table */}
        <TableContainer sx={{ maxHeight: '420px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Table stickyHeader sx={{ minWidth: { xs: '650px', sm: '100%' } }} aria-label="recent bills table">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#FFFBEB' }}>
                <TableCell sx={{ fontWeight: 800, fontSize: '12px', color: '#7C2D12', backgroundColor: '#FFFBEB', width: '110px' }}>
                  BILL NO
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '12px', color: '#7C2D12', backgroundColor: '#FFFBEB', width: '110px' }}>
                  DATE
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '12px', color: '#7C2D12', backgroundColor: '#FFFBEB' }}>
                  CUSTOMER NAME
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '12px', color: '#7C2D12', backgroundColor: '#FFFBEB', width: '90px' }}>
                  ITEMS
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '12px', color: '#7C2D12', backgroundColor: '#FFFBEB', width: '130px' }}>
                  TOTAL AMOUNT (₹)
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '12px', color: '#7C2D12', backgroundColor: '#FFFBEB', width: '130px' }}>
                  ACTIONS
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingRecentBills ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} sx={{ color: '#DC2626' }} />
                  </TableCell>
                </TableRow>
              ) : filteredRecentBills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#786C58' }}>
                    {billSearchTerm ? `No bills matching "${billSearchTerm}" found.` : 'No bills created yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecentBills.map((bill, index) => {
                  const isLast = index === filteredRecentBills.length - 1;
                  const totalAmt = parseFloat(String(bill.total || bill.amount || '0').replace(/,/g, '')) || 0;
                  const prodCount = (bill.products || []).length;

                  return (
                    <TableRow key={bill._id || bill.id || index} sx={{ '&:hover': { backgroundColor: '#FEFDF5' } }}>
                      <TableCell sx={{ fontSize: '13.5px', fontWeight: 800, color: '#B91C1C', borderBottom: isLast ? 'none' : '1px solid #F7EEDB' }}>
                        #{bill.billNo}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', fontWeight: 600, color: '#57463A', borderBottom: isLast ? 'none' : '1px solid #F7EEDB' }}>
                        {bill.date}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13.5px', fontWeight: 700, color: '#1F1714', borderBottom: isLast ? 'none' : '1px solid #F7EEDB' }}>
                        {bill.customerName}
                      </TableCell>
                      <TableCell align="center" sx={{ borderBottom: isLast ? 'none' : '1px solid #F7EEDB' }}>
                        <Chip
                          label={`${prodCount} ${prodCount === 1 ? 'item' : 'items'}`}
                          size="small"
                          sx={{ fontSize: '11.5px', fontWeight: 700, backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '14.5px', fontWeight: 800, color: '#B91C1C', borderBottom: isLast ? 'none' : '1px solid #F7EEDB' }}>
                        ₹{totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="center" sx={{ borderBottom: isLast ? 'none' : '1px solid #F7EEDB' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          {/* Print Invoice */}
                          <Tooltip title="Print / View Invoice" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handlePrintRecentBill(bill)}
                              sx={{
                                color: '#D97706',
                                backgroundColor: '#FFFBEB',
                                border: '1px solid #FDE68A',
                                borderRadius: '6px',
                                p: 0.6,
                                '&:hover': { color: '#FFFFFF', backgroundColor: '#D97706' },
                              }}
                            >
                              <PrintOutlinedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>

                          {/* Delete Bill */}
                          <Tooltip title="Delete Bill" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteRecentBill(bill)}
                              sx={{
                                color: '#DC2626',
                                backgroundColor: '#FEF2F2',
                                border: '1px solid #FECACA',
                                borderRadius: '6px',
                                p: 0.6,
                                '&:hover': { color: '#FFFFFF', backgroundColor: '#DC2626' },
                              }}
                            >
                              <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Edit Customer Dialog */}
      <Dialog
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '14px',
              border: '1.5px solid #FDE68A',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '18px', color: '#B91C1C', pb: 1 }}>
          Edit Customer Details
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Box>
            <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#786C58', mb: 0.5 }}>
              Customer Full Name *
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#786C58', mb: 0.5 }}>
              Mobile / Contact Number
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={editFormData.mobile}
              onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#786C58', mb: 0.5 }}>
              Address / Town *
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={editFormData.address}
              onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#786C58', mb: 0.5 }}>
              GSTIN
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={editFormData.gst}
              onChange={(e) => setEditFormData({ ...editFormData, gst: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => setOpenEditModal(false)}
            sx={{ textTransform: 'none', color: '#786C58', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveEdit}
            disabled={editLoading}
            sx={{
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              fontWeight: 700,
              textTransform: 'none',
              px: 2.5,
              borderRadius: '6px',
            }}
          >
            {editLoading ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Date Range Print Report Modal */}
      {openDatePrintModal && (
        <DateRangePrintModal
          open={openDatePrintModal}
          onClose={() => setOpenDatePrintModal(false)}
          title="Customers Directory Report"
          items={filteredCustomers}
          getDateFromItem={(item) => item.createdAt || ''}
          onConfirmPrint={(items, dateRangeText) => {
            printCustomerListDirectly(items, 'Customers Directory Report', dateRangeText);
          }}
        />
      )}

      {/* Print Recent Bill Modal */}
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
