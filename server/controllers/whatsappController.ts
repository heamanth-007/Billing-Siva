import { Request, Response, NextFunction } from 'express';
import { Settings } from '../models/Settings';
import { uploadToCloudinary, isCloudinaryConfigured } from '../config/cloudinary';

/**
 * Clean phone number to E.164 without '+'
 */
const formatWhatsAppPhone = (rawPhone: string): string => {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits;
};

/**
 * Sends a PDF bill document directly into the customer's WhatsApp chat via configured Gateway
 */
export const sendBillPdfViaWhatsApp = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  try {
    const { customerPhone, pdfData, pdfName, billNo, customerName, total } = req.body;

    if (!customerPhone) {
      res.status(400).json({ success: false, error: 'Customer phone number is required' });
      return;
    }

    const cleanPhone = formatWhatsAppPhone(customerPhone);
    const settings = (await Settings.findOne()) || ({} as any);

    let documentUrl = '';

    // If Cloudinary is configured and base64 pdfData is provided, upload for high-speed CDN delivery
    if (pdfData && isCloudinaryConfigured()) {
      try {
        const fileName = pdfName || `Invoice-${billNo || Date.now()}`;
        const uploadRes = await uploadToCloudinary(pdfData, 'dheeksha_trade/whatsapp_bills', fileName);
        documentUrl = uploadRes.secure_url;
      } catch (cloudErr) {
        console.warn('[Cloudinary Warning in WhatsApp Dispatch]:', cloudErr);
      }
    }

    const fileName = pdfName ? (pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`) : `Invoice-${billNo || 'Bill'}.pdf`;
    const caption = `📄 *TAX INVOICE #${billNo || ''}*\n🏢 *${settings.companyName || 'Siva Balaji Crackers'}*\n👤 *Customer:* ${customerName || 'Valued Customer'}\n💰 *Total:* ₹${total || '0.00'}`;

    // 1. UltraMsg Gateway Provider
    if (
      settings.whatsappGatewayEnabled &&
      settings.whatsappGatewayProvider === 'ultramsg' &&
      settings.whatsappInstanceId &&
      settings.whatsappApiToken
    ) {
      const instanceId = settings.whatsappInstanceId.trim();
      const token = settings.whatsappApiToken.trim();

      const ultramsgUrl = `https://api.ultramsg.com/${instanceId}/messages/document`;
      const bodyPayload = new URLSearchParams();
      bodyPayload.append('token', token);
      bodyPayload.append('to', cleanPhone);
      bodyPayload.append('filename', fileName);
      bodyPayload.append('document', documentUrl || pdfData);
      bodyPayload.append('caption', caption);

      const gatewayResponse = await fetch(ultramsgUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyPayload.toString(),
      });

      const gatewayResult = await gatewayResponse.json();

      if (gatewayResult.sent === 'true' || gatewayResult.id || gatewayResponse.ok) {
        res.status(200).json({
          success: true,
          method: 'gateway',
          message: `✅ PDF Invoice #${billNo} sent directly to ${customerPhone} on WhatsApp!`,
          data: gatewayResult,
        });
        return;
      } else {
        console.error('[UltraMsg Error Response]:', gatewayResult);
        throw new Error(gatewayResult.message || gatewayResult.error || 'UltraMsg failed to deliver document');
      }
    }

    // 2. Green-API Gateway Provider
    if (
      settings.whatsappGatewayEnabled &&
      settings.whatsappGatewayProvider === 'greenapi' &&
      settings.whatsappInstanceId &&
      settings.whatsappApiToken
    ) {
      const idInstance = settings.whatsappInstanceId.trim();
      const apiTokenInstance = settings.whatsappApiToken.trim();
      const greenApiUrl = `https://api.green-api.com/waInstance${idInstance}/sendFileByUrl/${apiTokenInstance}`;

      const greenPayload = {
        chatId: `${cleanPhone}@c.us`,
        urlFile: documentUrl || pdfData,
        fileName: fileName,
        caption: caption,
      };

      const greenRes = await fetch(greenApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(greenPayload),
      });

      const greenJson = await greenRes.json();

      if (greenJson.idMessage || greenRes.ok) {
        res.status(200).json({
          success: true,
          method: 'gateway',
          message: `✅ PDF Invoice #${billNo} sent directly to ${customerPhone} on WhatsApp!`,
          data: greenJson,
        });
        return;
      } else {
        console.error('[Green-API Error Response]:', greenJson);
        throw new Error(greenJson.message || 'Green-API failed to send document');
      }
    }

    // Fallback if gateway is not yet enabled in Settings
    res.status(200).json({
      success: true,
      method: 'not_configured',
      documentUrl,
      message: 'WhatsApp Gateway not enabled in Settings. Please configure UltraMsg/GreenAPI in Settings for 100% automated background delivery.',
    });
  } catch (err: any) {
    console.error('[WhatsApp Send Error]:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to send WhatsApp message via gateway',
    });
  }
};

/**
 * Tests WhatsApp Gateway Connection
 */
export const testWhatsAppGateway = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  try {
    const { provider, instanceId, apiToken, testPhone } = req.body;

    if (!instanceId || !apiToken) {
      res.status(400).json({ success: false, error: 'Instance ID and API Token are required' });
      return;
    }

    const cleanPhone = formatWhatsAppPhone(testPhone || '919876543210');

    if (provider === 'ultramsg') {
      const testUrl = `https://api.ultramsg.com/${instanceId.trim()}/messages/chat`;
      const body = new URLSearchParams();
      body.append('token', apiToken.trim());
      body.append('to', cleanPhone);
      body.append('body', '🎉 WhatsApp Gateway connected successfully with Dheeksha Trade Billing!');

      const response = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const json = await response.json();
      if (json.sent === 'true' || json.id || response.ok) {
        res.status(200).json({ success: true, message: '✅ Connection test successful! Test message sent to WhatsApp.', data: json });
        return;
      } else {
        throw new Error(json.message || json.error || 'Failed to connect to UltraMsg');
      }
    }

    res.status(200).json({ success: true, message: 'Settings validated' });
  } catch (err: any) {
    console.error('[WhatsApp Test Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Gateway connection test failed' });
  }
};
