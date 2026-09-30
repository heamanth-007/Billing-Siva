import { Router } from 'express';
import { sendBillPdfViaWhatsApp, testWhatsAppGateway } from '../controllers/whatsappController';

const router = Router();

router.post('/send-bill-pdf', sendBillPdfViaWhatsApp);
router.post('/test-gateway', testWhatsAppGateway);

export default router;
