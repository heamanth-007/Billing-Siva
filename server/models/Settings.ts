import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  companyName: string;
  tagline?: string;
  ownerName?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  pincode?: string;
  state?: string;
  gstin?: string;
  pan?: string;
  logoUrl?: string;
  enableTax?: boolean;
  defaultTaxRate?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  upiId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema: Schema = new Schema(
  {
    companyName: { type: String, default: 'Siva Balaji Crackers', trim: true },
    tagline: { type: String, default: 'Wholesale & Retail Crackers', trim: true },
    ownerName: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    whatsapp: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    city: { type: String, default: 'Sivakasi', trim: true },
    pincode: { type: String, default: '', trim: true },
    state: { type: String, default: 'Tamil Nadu', trim: true },
    gstin: { type: String, default: '', trim: true },
    pan: { type: String, default: '', trim: true },
    logoUrl: { type: String, default: '' },
    enableTax: { type: Boolean, default: false },
    defaultTaxRate: { type: String, default: '18' },
    bankName: { type: String, default: '', trim: true },
    bankAccountNo: { type: String, default: '', trim: true },
    bankIfsc: { type: String, default: '', trim: true },
    bankBranch: { type: String, default: '', trim: true },
    upiId: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);
