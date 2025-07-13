
'use server';

import { z } from 'zod';
import { db, adminSDKInitializationError } from '@/lib/firebase-admin';
import type { CompanyProfile } from '@/types/company';

const CONFIG_COLLECTION = '_config';
const PROFILE_DOC_ID = 'companyProfile';

const profileSchema = z.object({
  companyName: z.string().min(2, "Company name is required."),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email format.").optional().or(z.literal('')),
  taxId: z.string().optional(),
});

export type CompanyProfileFormData = z.infer<typeof profileSchema>;

export interface GetCompanyProfileResult {
    success: boolean;
    profile?: CompanyProfile;
    message?: string;
}

export async function getCompanyProfile(): Promise<GetCompanyProfileResult> {
    if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

    try {
        const docRef = db.collection(CONFIG_COLLECTION).doc(PROFILE_DOC_ID);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            return { success: true, profile: docSnap.data() as CompanyProfile };
        }
        return { success: true, profile: undefined };
    } catch (error: any) {
        return { success: false, message: `Failed to get company profile: ${error.message}` };
    }
}

export interface UpdateCompanyProfileResult {
    success: boolean;
    message: string;
}

export async function updateCompanyProfile(data: CompanyProfileFormData): Promise<UpdateCompanyProfileResult> {
     if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

    const validation = profileSchema.safeParse(data);
    if (!validation.success) {
        const errors = validation.error.flatten().fieldErrors;
        const firstError = Object.values(errors)[0]?.[0];
        return { success: false, message: firstError || 'Invalid data provided.' };
    }

    try {
        const docRef = db.collection(CONFIG_COLLECTION).doc(PROFILE_DOC_ID);
        await docRef.set(validation.data, { merge: true });
        return { success: true, message: 'Company profile updated successfully.' };
    } catch (error: any) {
        return { success: false, message: `Failed to update company profile: ${error.message}` };
    }
}
