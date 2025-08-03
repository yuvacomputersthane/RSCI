
'use server';

import { z } from 'zod';
import { db, adminSDKInitializationError } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { Service } from '@/types/service';
import admin from 'firebase-admin';

export interface AddServiceResult {
  success: boolean;
  message: string;
  service?: Service;
}

const serviceSchema = z.object({
  name: z.string().min(3, { message: "Service name must be at least 3 characters." }),
  price: z.preprocess(
    (val) => parseFloat(String(val)),
    z.number().positive({ message: "Selling price must be a positive number." })
  ),
  costPrice: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().nonnegative({ message: "Cost price must be a non-negative number." }).optional()
  ),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
});

export type ServiceFormData = z.infer<typeof serviceSchema>;


export async function addService(data: ServiceFormData): Promise<AddServiceResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  
  const validationResult = serviceSchema.safeParse(data);

  if (!validationResult.success) {
    console.error("Add Service Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Invalid service data. " + Object.values(validationResult.error.flatten().fieldErrors).flat().join(' '),
    };
  }

  const { name, price, costPrice, categoryId, categoryName } = validationResult.data;

  try {
    const now = Timestamp.now();
    
    const dataToSave: any = {
      name,
      price,
      createdAt: now,
      categoryId: categoryId || null,
      categoryName: categoryName || null,
    };

    if (costPrice !== undefined) {
      dataToSave.costPrice = costPrice;
    }

    const serviceRef = await db.collection('services').add(dataToSave);
    
    const newService: Service = { 
        id: serviceRef.id, 
        name, 
        price,
        costPrice,
        createdAt: now.toDate().toISOString(),
        categoryId,
        categoryName
    };
    console.log("Service added to Firestore:", newService);
    return {
      success: true,
      message: `Service "${name}" (₹${price.toFixed(2)}) has been added to Firestore.`,
      service: newService,
    };
  } catch (error: any) {
    console.error('Error adding service to Firestore:', error);
    if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        return {
            success: false,
            message: `Firestore permission denied. This is the most common error. The service account used by the server does not have permission to write to Firestore. **FIX: Go to the Google Cloud Console -> IAM, find your service account (e.g., 'firebase-adminsdk-...'), and grant it the 'Cloud Datastore User' role.** It may take a minute to apply.`,
        };
    }
    if (error.code === 5 || (error.message && error.message.includes('NOT_FOUND'))) {
        return {
            success: false,
            message: `Firestore query failed (NOT_FOUND). This usually means the Firestore database has not been created or is not in the correct location for this project. Please go to the Firebase Console, select your project, go to the "Firestore Database" section, and ensure a database has been created.`,
        };
    }
    return {
      success: false,
      message: `Failed to add service to Firestore: ${error.message || 'Unknown error'}`,
    };
  }
}

export interface GetServicesResult {
  success: boolean;
  services?: Service[];
  message?: string;
}

export async function getServices(): Promise<GetServicesResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  
  try {
    const servicesSnapshot = await db.collection('services').get();
    
    const servicesList: Service[] = servicesSnapshot.docs.map(doc => {
      const data = doc.data();
      const createdAtTimestamp = data.createdAt as Timestamp;
      return {
        id: doc.id,
        name: data.name,
        price: data.price,
        costPrice: data.costPrice,
        createdAt: createdAtTimestamp ? createdAtTimestamp.toDate().toISOString() : new Date().toISOString(),
        categoryId: data.categoryId,
        categoryName: data.categoryName,
      };
    });

    servicesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, services: servicesList };
  } catch (error: any) {
    console.error('Error fetching services from Firestore:', error);
    if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        return {
            success: false,
            message: `Firestore permission denied. This is the most common error. The service account used by the server does not have permission to read from Firestore. **FIX: Go to the Google Cloud Console -> IAM, find your service account (e.g., 'firebase-adminsdk-...'), and grant it the 'Cloud Datastore User' role.** It may take a minute to apply.`,
        };
    }
    if (error.code === 5 || (error.message && error.message.includes('NOT_FOUND'))) {
        return {
            success: false,
            message: `Firestore query failed (NOT_FOUND). This usually means the Firestore database has not been created or is not in the correct location for this project. Please go to the Firebase Console, select your project, go to the "Firestore Database" section, and ensure a database has been created.`,
        };
    }
    if (error.code === 9 || (error.message && error.message.includes('FAILED_PRECONDITION'))) {
        return {
            success: false,
            message: `Firestore query failed due to a missing index. The error logs in your terminal should contain a direct link to create the required index in the Firebase Console. Click the link, create the index, and wait a few minutes for it to build. Error: ${error.message}`,
        };
    }
    return {
      success: false,
      message: `Failed to fetch services: ${error.message || 'Unknown error'}`,
    };
  }
}


export interface ServiceActionResult {
  success: boolean;
  message: string;
}

export async function deleteService(serviceId: string): Promise<ServiceActionResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  try {
    await db.collection('services').doc(serviceId).delete();
    return { success: true, message: 'Service deleted successfully.' };
  } catch (error: any) {
    console.error('Error deleting service from Firestore:', error);
    if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        return {
            success: false,
            message: `Firestore permission denied. The service account does not have permission to delete documents. **FIX: Grant the 'Cloud Datastore User' role to your service account in the Google Cloud Console -> IAM.**`,
        };
    }
    return { success: false, message: `Failed to delete service: ${error.message}` };
  }
}

export async function updateService(serviceId: string, data: ServiceFormData): Promise<ServiceActionResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  
  const validationResult = serviceSchema.safeParse(data);
  if (!validationResult.success) {
    return {
      success: false,
      message: "Invalid service data. " + Object.values(validationResult.error.flatten().fieldErrors).flat().join(' '),
    };
  }
  
  const { categoryId, categoryName, costPrice, ...rest } = validationResult.data;
  
  const dataToUpdate: any = {
    ...rest,
    categoryId: categoryId || null,
    categoryName: categoryName || null
  };

  if (costPrice !== undefined) {
    dataToUpdate.costPrice = costPrice;
  } else {
    dataToUpdate.costPrice = admin.firestore.FieldValue.delete();
  }

  try {
    await db.collection('services').doc(serviceId).update(dataToUpdate);
    return { success: true, message: 'Service updated successfully.' };
  } catch (error: any) {
    console.error('Error updating service in Firestore:', error);
    if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        return {
            success: false,
            message: `Firestore permission denied. The service account does not have permission to update documents. **FIX: Grant the 'Cloud Datastore User' role to your service account in the Google Cloud Console -> IAM.**`,
        };
    }
    return { success: false, message: `Failed to update service: ${error.message}` };
  }
}
