import type { Request, Response, NextFunction } from 'express';
import { Settings } from '../models/Settings';

/**
 * Get the current company settings from MongoDB database.
 */
export const getSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        companyName: 'Siva Balaji Crackers',
        tagline: 'Wholesale & Retail Crackers',
        city: 'Sivakasi',
        state: 'Tamil Nadu',
      });
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

/**
 * Update company settings in MongoDB database.
 */
export const updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { _id, id, createdAt, updatedAt, __v, ...cleanedData } = req.body;
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: cleanedData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Company settings updated successfully in database',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};
