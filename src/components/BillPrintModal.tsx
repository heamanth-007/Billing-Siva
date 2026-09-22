import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CropLandscapeRoundedIcon from '@mui/icons-material/CropLandscapeRounded';
import FilterFramesRoundedIcon from '@mui/icons-material/FilterFramesRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { BillPrintTemplate, type BillPrintData, type BillPrintFormat } from './BillPrintTemplate';
import { printBillDirectly } from '../utils/printUtils';
import { getStoredSettings } from './SettingsPage';

interface BillPrintModalProps {
  open: boolean;
  onClose: () => void;
  bill: BillPrintData | null;
}

export const BillPrintModal: React.FC<BillPrintModalProps> = ({ open, onClose, bill }) => {
  const [selectedFormat, setSelectedFormat] = useState<BillPrintFormat>(() => {
    const saved = getStoredSettings();
    if (saved.defaultPrintFormat && ['a4-portrait', 'a4-landscape', 'a4-dual', 'thermal'].includes(saved.defaultPrintFormat)) {
      return saved.defaultPrintFormat as BillPrintFormat;
    }
    const local = localStorage.getItem('dheeksha_bill_print_format') as BillPrintFormat | null;
    return local || 'a4-portrait';
  });

  if (!bill) return null;

  const handleFormatChange = (_: React.MouseEvent<HTMLElement>, newFormat: BillPrintFormat | null) => {
    if (newFormat) {
      setSelectedFormat(newFormat);
      localStorage.setItem('dheeksha_bill_print_format', newFormat);
    }
  };

  const handleTriggerPrint = () => {
    printBillDirectly(bill, selectedFormat);
  };

  return (
    <>
      {/* Screen Dialog for Previewing */}
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth={selectedFormat === 'thermal' ? 'sm' : 'lg'}
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '16px',
            overflow: 'hidden',
            backgroundColor: '#FEFDF9',
            border: '1px solid #FDE68A',
            boxShadow: '0 20px 40px -15px rgba(217, 119, 6, 0.25)',
          },
        }}
      >
        {/* Modal Top Bar */}
        <Box
          className="dheeksha-no-print"
          sx={{
            px: { xs: 2, sm: 3 },
            py: 1.5,
            background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
            borderBottom: '2px solid #F59E0B',
            color: '#FFFFFF',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                Bill Preview - #{bill.billNo || 'New'}
              </Typography>
              <Chip
                label={bill.companyName || 'General'}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#FEF3C7',
                  fontWeight: 700,
                  fontSize: '11px',
                  height: '22px',
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '12px', color: '#FEF3C7', fontWeight: 500, mt: 0.2 }}>
              Customer: <b>{bill.customerName || '-'}</b> {bill.customerPhone ? `(${bill.customerPhone})` : ''} | Total: <b>₹{bill.total || bill.amount || '0'}</b>
            </Typography>
          </Box>

          {/* Format Selector Tabs */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <ToggleButtonGroup
              value={selectedFormat}
              exclusive
              onChange={handleFormatChange}
              size="small"
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                p: '3px',
                borderRadius: '10px',
                '& .MuiToggleButton-root': {
                  color: '#FEF3C7',
                  border: 'none',
                  borderRadius: '8px !important',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'none',
                  px: 1.2,
                  py: 0.4,
                  gap: 0.6,
                  '&.Mui-selected': {
                    backgroundColor: '#FFFFFF',
                    color: '#991B1B',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                    '&:hover': {
                      backgroundColor: '#FFFFFF',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                },
              }}
            >
              <ToggleButton value="a4-portrait">
                <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />
                <span>A4 Portrait</span>
              </ToggleButton>
              <ToggleButton value="a4-landscape">
                <CropLandscapeRoundedIcon sx={{ fontSize: 16 }} />
                <span>A4 Landscape</span>
              </ToggleButton>
              <ToggleButton value="a4-dual">
                <FilterFramesRoundedIcon sx={{ fontSize: 16 }} />
                <span>A4 2-in-1 Dual</span>
              </ToggleButton>
              <ToggleButton value="thermal">
                <ReceiptLongRoundedIcon sx={{ fontSize: 16 }} />
                <span>Thermal (80mm)</span>
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="contained"
              disableElevation
              onClick={handleTriggerPrint}
              startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important', color: '#7C2D12' }} />}
              sx={{
                backgroundColor: '#FEF3C7',
                color: '#7C2D12',
                border: '1px solid #FDE68A',
                fontSize: '13px',
                fontWeight: 800,
                textTransform: 'none',
                px: 2,
                py: 0.6,
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                '&:hover': {
                  backgroundColor: '#FDE68A',
                },
              }}
            >
              Print
            </Button>

            <IconButton onClick={onClose} sx={{ color: '#FFFFFF', p: 0.8 }}>
              <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Modal Body with Bill Document Preview */}
        <DialogContent
          sx={{
            p: { xs: 1.5, sm: 3 },
            backgroundColor: '#F8FAFC',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            overflowY: 'auto',
            maxHeight: 'calc(85vh - 120px)',
          }}
        >
          <Box
            sx={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              borderRadius: '4px',
              border: '1px solid #E2E8F0',
              width: '100%',
              maxWidth: selectedFormat === 'thermal' ? '340px' : selectedFormat === 'a4-landscape' || selectedFormat === 'a4-dual' ? '920px' : '820px',
              p: selectedFormat === 'thermal' ? 0 : 0.5,
              transition: 'all 0.2s ease',
            }}
          >
            <BillPrintTemplate bill={bill} format={selectedFormat} />
          </Box>
        </DialogContent>

        {/* Modal Bottom Actions */}
        <DialogActions
          className="dheeksha-no-print"
          sx={{
            px: 3,
            py: 1.2,
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #FEF3C7',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography sx={{ fontSize: '12px', color: '#78350F', fontWeight: 600 }}>
            Active Format: <b>{selectedFormat === 'a4-portrait' ? '📄 A4 Portrait (Full Page)' : selectedFormat === 'a4-landscape' ? '🖼️ A4 Landscape (Wide)' : selectedFormat === 'a4-dual' ? '📑 A4 2-in-1 Dual Copy (Customer + Office)' : '🧾 80mm Thermal POS Slip'}</b>
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              onClick={onClose}
              sx={{
                color: '#78350F',
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { backgroundColor: '#FFFBEB' },
              }}
            >
              Close
            </Button>

            <Button
              variant="contained"
              disableElevation
              onClick={handleTriggerPrint}
              startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important' }} />}
              sx={{
                background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'none',
                px: 3,
                py: 0.8,
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #B91C1C 0%, #991B1B 100%)',
                },
              }}
            >
              Print ({selectedFormat === 'a4-portrait' ? 'A4 Portrait' : selectedFormat === 'a4-landscape' ? 'A4 Landscape' : selectedFormat === 'a4-dual' ? 'A4 2-in-1 Dual' : 'Thermal'})
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
};
