'use server';

import { z } from 'zod';
import { db, adminSDKInitializationError } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { Category } from '@/types/category';

export interface CategoryActionResult {
  success: boolean;
  message: string;
  category?: Category;
}

const categorySchema = z.object({
  name: z.string().min(2, { message: "Category name must be at least 2 characters." }),
  description: z.string().optional(),
});

export async function addCategory(formData: FormData): Promise<CategoryActionResult> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };
  
  const validation = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
  });

  if (!validation.success) {
    return { success: false, message: validation.error.flatten().fieldErrors.name?.[0] || 'Invalid data.' };
  }

  const { name, description } = validation.data;

  try {
    const now = Timestamp.now();
    const docRef = await db.collection('categories').add({
      name,
      description: description || '',
      createdAt: now,
    });
    
    const newCategory: Category = { 
      id: docRef.id, 
      name, 
      description: description || '', 
      createdAt: now.toDate().toISOString() 
    };

    return { success: true, message: `Category "${name}" created.`, category: newCategory };
  } catch (error: any) {
    return { success: false, message: `Failed to create category: ${error.message}` };
  }
}

export interface GetCategoriesResult {
  success: boolean;
  categories?: Category[];
  message?: string;
}

export async function getCategories(): Promise<GetCategoriesResult> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

  try {
    const snapshot = await db.collection('categories').orderBy('createdAt', 'desc').get();
    const categories: Category[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            description: data.description || '',
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        }
    });
    return { success: true, categories };
  } catch (error: any) {
    if (error.code === 9) {
        return { success: false, message: `Firestore index for 'categories' collection is missing. Please check the server logs for a link to create it.` };
    }
    return { success: false, message: `Failed to get categories: ${error.message}` };
  }
}

export async function updateCategory(categoryId: string, data: { name: string; description?: string }): Promise<CategoryActionResult> {
    if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };
    
    const validation = categorySchema.safeParse(data);
    if (!validation.success) {
        return { success: false, message: validation.error.flatten().fieldErrors.name?.[0] || 'Invalid data.' };
    }

    try {
        await db.collection('categories').doc(categoryId).update({
            name: validation.data.name,
            description: validation.data.description || '',
        });
        return { success: true, message: 'Category updated successfully.' };
    } catch (error: any) {
        return { success: false, message: `Failed to update category: ${error.message}` };
    }
}


export async function deleteCategory(categoryId: string): Promise<CategoryActionResult> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

  try {
    await db.collection('categories').doc(categoryId).delete();
    return { success: true, message: 'Category deleted successfully.' };
  } catch (error: any) {
    return { success: false, message: `Failed to delete category: ${error.message}` };
  }
}
