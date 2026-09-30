import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  InputAdornment,
  CircularProgress,
  Paper,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhoneAndroidRoundedIcon from '@mui/icons-material/PhoneAndroidRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { BillPrintData } from './BillPrintTemplate';
import { getCleanWhatsAppNumber } from '../utils/whatsappUtils';
import { downloadBillPdf, shareBillPdfToWhatsApp, generateBillPdfFile } from '../utils/pdfUtils';
import { WhatsAppApi } from '../services/api';

interface WhatsAppShareModalProps {
  open: boolean;
  onClose: () => void;
  bill: BillPrintData | null;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({ open, onClose, bill }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [statusSnackbar, setStatusSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    if (bill) {
      setPhoneNumber(bill.customerPhone || '');
    }
  }, [bill]);

  if (!bill) return null;

  const fileName = `Invoice-${bill.billNo ? bill.billNo.replace(/[^a-zA-Z0-9-_]/g, '_') : 'Bill'}.pdf`;
  const cleanNum = getCleanWhatsAppNumber(phoneNumber);

  // 1. Generate & Share PDF to WhatsApp (Direct automated gateway or native document)
  const handleSharePdfWhatsApp = async () => {
    try {
      setGeneratingPdf(true);
      const { dataUrl, fileName: pdfFileName } = await generateBillPdfFile(bill);

      // Try Backend Automated Gateway first (UltraMsg / GreenAPI)
      try {
        const backendRes = await WhatsAppApi.sendBillPdf({
          customerPhone: phoneNumber,
          pdfData: dataUrl,
          pdfName: pdfFileName,
          billNo: bill.billNo,
          customerName: bill.customerName,
          total: String(bill.total || bill.amount || '0'),
        });

        if (backendRes.method === 'gateway') {
          setStatusSnackbar({
            open: true,
            message: `🎉 PDF Invoice #${bill.billNo} sent directly to ${phoneNumber} on WhatsApp!`,
            severity: 'success',
          });
          setTimeout(() => {
            onClose();
          }, 1500);
          return;
        }
      } catch (backendErr) {
        console.warn('Backend gateway not active or failed, using client share:', backendErr);
      }

      // Fallback: Web Share API or Local Download + WhatsApp chat
      const res = await shareBillPdfToWhatsApp(bill, phoneNumber);
      if (res.method === 'native-share') {
        setStatusSnackbar({
          open: true,
          message: `✅ PDF Invoice "${res.fileName}" shared to WhatsApp!`,
          severity: 'success',
        });
      } else {
        setStatusSnackbar({
          open: true,
          message: `📄 PDF "${res.fileName}" downloaded & WhatsApp chat opened! Please attach the PDF in chat.`,
          severity: 'info',
        });
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Failed to share PDF on WhatsApp:', err);
      setStatusSnackbar({
        open: true,
        message: err.message || 'Error generating PDF for WhatsApp',
        severity: 'error',
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // 2. Download PDF Only
  const handleDownloadOnly = async () => {
    try {
      setDownloadingPdf(true);
      const downloadedName = await downloadBillPdf(bill);
      setStatusSnackbar({
        open: true,
        message: `✅ Invoice PDF "${downloadedName}" downloaded successfully!`,
        severity: 'success',
      });
    } catch (err: any) {
      console.error('Failed to download PDF:', err);
      setStatusSnackbar({
        open: true,
        message: err.message || 'Error downloading PDF',
        severity: 'error',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const prodCount = (bill.products || []).length;
  const billTotalFormatted = bill.total || bill.amount || '0';

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1.5px solid #25D366',
              boxShadow: '0 20px 40px -15px rgba(37, 211, 102, 0.25)',
              backgroundColor: '#FFFFFF',
            },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 3,
            py: 2,
            background: 'linear-gradient(135deg, #128C7E 0%, #25D366 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <WhatsAppIcon sx={{ fontSize: 24, color: '#FFFFFF' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                Share Bill PDF on WhatsApp
              </Typography>
              <Typography sx={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                Invoice #{bill.billNo} • {bill.customerName}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{ color: '#FFFFFF', p: 0.5, '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.15)' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Body */}
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.2 }}>
          {/* PDF Invoice Preview Card */}
          <Paper
            elevation={0}
            sx={{
              p: 2.2,
              borderRadius: '12px',
              border: '1.5px solid #BBF7D0',
              backgroundColor: '#F0FDF4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '10px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(220, 38, 38, 0.25)',
                  flexShrink: 0,
                }}
              >
                <PictureAsPdfRoundedIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Typography sx={{ fontSize: '14.5px', fontWeight: 800, color: '#14532D' }}>
                    {fileName}
                  </Typography>
                  <CheckCircleRoundedIcon sx={{ fontSize: 16, color: '#16A34A' }} />
                </Box>
                <Typography sx={{ fontSize: '12.5px', color: '#15803D', fontWeight: 600, mt: 0.3 }}>
                  A4 Tax Invoice • {prodCount} {prodCount === 1 ? 'item' : 'items'} • <b>₹{billTotalFormatted}</b>
                </Typography>
              </Box>
            </Box>

            <Tooltip title="Download PDF to your computer" arrow>
              <Button
                size="small"
                variant="outlined"
                onClick={handleDownloadOnly}
                disabled={downloadingPdf || generatingPdf}
                startIcon={
                  downloadingPdf ? <CircularProgress size={14} color="inherit" /> : <DownloadRoundedIcon sx={{ fontSize: 16 }} />
                }
                sx={{
                  borderColor: '#86EFAC',
                  color: '#15803D',
                  backgroundColor: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                  textTransform: 'none',
                  px: 1.8,
                  py: 0.6,
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    borderColor: '#16A34A',
                    backgroundColor: '#DCFCE7',
                  },
                }}
              >
                {downloadingPdf ? 'Downloading...' : 'Download PDF'}
              </Button>
            </Tooltip>
          </Paper>

          {/* Customer Phone Input */}
          <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1F2937', mb: 0.8 }}>
              Recipient Mobile / WhatsApp Number *
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g. 9876543210 (10-digit mobile number)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneAndroidRoundedIcon sx={{ fontSize: 19, color: '#25D366' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                backgroundColor: '#F9FAFB',
                borderRadius: '8px',
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': {
                    borderColor: '#25D366',
                  },
                },
              }}
            />
            {cleanNum ? (
              <Typography sx={{ fontSize: '11.5px', color: '#059669', fontWeight: 600, mt: 0.5 }}>
                ✓ Will share PDF to WhatsApp number: +{cleanNum}
              </Typography>
            ) : (
              <Typography sx={{ fontSize: '11.5px', color: '#D97706', fontWeight: 500, mt: 0.5 }}>
                ⚠️ If empty, WhatsApp opens allowing you to select any contact or group chat.
              </Typography>
            )}
          </Box>

          {/* Info Notice Box */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: '8px',
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 20, color: '#16A34A', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '12px', color: '#166534', fontWeight: 500, lineHeight: 1.4 }}>
              Clicking <b>"Share PDF on WhatsApp"</b> generates the official <b>{fileName}</b> invoice and opens WhatsApp to send the PDF file directly to your customer.
            </Typography>
          </Box>
        </DialogContent>

        {/* Actions */}
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            backgroundColor: '#F9FAFB',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Button
            onClick={onClose}
            sx={{
              color: '#6B7280',
              fontWeight: 600,
              fontSize: '13px',
              textTransform: 'none',
              '&:hover': { backgroundColor: '#F3F4F6' },
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            disableElevation
            onClick={handleSharePdfWhatsApp}
            disabled={generatingPdf}
            startIcon={
              generatingPdf ? <CircularProgress size={18} sx={{ color: '#FFFFFF' }} /> : <PictureAsPdfRoundedIcon sx={{ fontSize: 20 }} />
            }
            endIcon={!generatingPdf && <ShareRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{
              background: 'linear-gradient(135deg, #128C7E 0%, #25D366 100%)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '13.5px',
              textTransform: 'none',
              px: 3.2,
              py: 1,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.35)',
              '&:hover': {
                background: 'linear-gradient(135deg, #075E54 0%, #128C7E 100%)',
                boxShadow: '0 6px 16px rgba(37, 211, 102, 0.45)',
              },
            }}
          >
            {generatingPdf ? 'Generating PDF...' : 'Share PDF on WhatsApp'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Snackbar */}
      <Snackbar
        open={statusSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setStatusSnackbar({ ...statusSnackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={statusSnackbar.severity} variant="filled" sx={{ width: '100%', fontWeight: 700 }}>
          {statusSnackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};
