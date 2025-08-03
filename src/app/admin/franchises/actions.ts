
'use server';

import { z } from 'zod';
import { db, adminSDKInitializationError } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { Franchise, FranchiseConfig } from '@/types/franchise';

const CONFIG_COLLECTION = '_config';
const FRANCHISE_CONFIG_DOC_ID = 'franchiseConfig';
const FRANCHISE_COLLECTION = 'franchises';

const franchiseSchema = z.object({
  name: z.string().min(3, { message: "Franchise name must be at least 3 characters." }),
  ownerName: z.string().min(2, { message: "Owner name is required." }),
  address: z.string().min(3, { message: "Street address is required." }),
  city: z.string().min(2, { message: "City is required." }),
  state: z.string().min(2, { message: "State is required." }),
  zipCode: z.string().min(5, { message: "ZIP code is required." }),
  contactEmail: z.string().email({ message: "Invalid email format." }),
  contactPhone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  openingDate: z.date({
    required_error: "Opening date is required.",
    invalid_type_error: "That's not a valid date!",
  }),
  assignedUserId: z.string().optional(),
  assignedUserName: z.string().optional(),
});

export type FranchiseFormData = z.infer<typeof franchiseSchema>;

export interface FranchiseActionResult {
  success: boolean;
  message: string;
  franchise?: Franchise;
}

export async function addFranchise(data: FranchiseFormData): Promise<FranchiseActionResult> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

  const validation = franchiseSchema.safeParse(data);
  if (!validation.success) {
    const firstError = Object.values(validation.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, message: firstError || 'Invalid data.' };
  }

  try {
    const now = Timestamp.now();
    const docRef = await db.collection(FRANCHISE_COLLECTION).add({
      ...validation.data,
      openingDate: Timestamp.fromDate(validation.data.openingDate),
      createdAt: now,
    });
    
    const newFranchise: Franchise = { 
      id: docRef.id, 
      ...validation.data,
      openingDate: validation.data.openingDate.toISOString(),
      createdAt: now.toDate().toISOString()
    };

    return { success: true, message: `Franchise "${validation.data.name}" added successfully.`, franchise: newFranchise };
  } catch (error: any) {
    return { success: false, message: `Failed to add franchise: ${error.message}` };
  }
}

export interface GetFranchisesResult {
  success: boolean;
  franchises?: Franchise[];
  message?: string;
}

export async function getFranchises(): Promise<GetFranchisesResult> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

  try {
    const snapshot = await db.collection(FRANCHISE_COLLECTION).orderBy('createdAt', 'desc').get();
    const franchises: Franchise[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            ownerName: data.ownerName,
            address: data.address,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            contactEmail: data.contactEmail,
            contactPhone: data.contactPhone,
            openingDate: (data.openingDate as Timestamp).toDate().toISOString(),
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            assignedUserId: data.assignedUserId,
            assignedUserName: data.assignedUserName,
        } as Franchise;
    });
    return { success: true, franchises };
  } catch (error: any) {
    if (error.code === 9) {
        return { success: false, message: `Firestore index for 'franchises' collection is missing. Check server logs for a creation link.` };
    }
    return { success: false, message: `Failed to get franchises: ${error.message}` };
  }
}


export async function deleteFranchise(franchiseId: string): Promise<Omit<FranchiseActionResult, 'franchise'>> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

  try {
    await db.collection(FRANCHISE_COLLECTION).doc(franchiseId).delete();
    return { success: true, message: 'Franchise deleted successfully.' };
  } catch (error: any) {
    return { success: false, message: `Failed to delete franchise: ${error.message}` };
  }
}

export interface GetFranchiseConfigResult {
    success: boolean;
    config?: FranchiseConfig;
    message?: string;
}

export async function getFranchiseConfig(): Promise<GetFranchiseConfigResult> {
    if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

    try {
        const docRef = db.collection(CONFIG_COLLECTION).doc(FRANCHISE_CONFIG_DOC_ID);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            return { success: true, config: docSnap.data() as FranchiseConfig };
        }
        return { success: true, config: { targetFranchises: 0 } }; // Default config
    } catch (error: any) {
        return { success: false, message: `Failed to get franchise config: ${error.message}` };
    }
}

export interface UpdateFranchiseConfigResult {
    success: boolean;
    message: string;
}

const franchiseConfigSchema = z.object({
  targetFranchises: z.number().int().min(0, "Target must be a non-negative number."),
});


export async function updateFranchiseConfig(data: { targetFranchises: number }): Promise<UpdateFranchiseConfigResult> {
    if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

    const validation = franchiseConfigSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, message: validation.error.flatten().fieldErrors.targetFranchises?.[0] || 'Invalid data provided.' };
    }

    try {
        const docRef = db.collection(CONFIG_COLLECTION).doc(FRANCHISE_CONFIG_DOC_ID);
        await docRef.set(validation.data, { merge: true });
        return { success: true, message: 'Franchise target updated successfully.' };
    } catch (error: any) {
        return { success: false, message: `Failed to update franchise target: ${error.message}` };
    }
}
