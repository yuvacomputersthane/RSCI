
'use server';

import { z } from 'zod';
import { db, adminSDKInitializationError } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { Product } from '@/types/product';
import admin from 'firebase-admin';

export interface AddProductResult {
  success: boolean;
  message: string;
  product?: Product;
}

const productSchema = z.object({
  name: z.string().min(3, { message: "Item name must be at least 3 characters." }),
  price: z.preprocess(
    (val) => parseFloat(String(val)),
    z.number().nonnegative({ message: "Price must be a non-negative number." })
  ),
  purchasePrice: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().nonnegative({ message: "Purchase price must be a non-negative number." }).optional()
  ),
  itemType: z.enum(['Stock', 'Asset'], { required_error: "You must select an item type." }),
  quantity: z.preprocess(
    (val) => parseInt(String(val), 10),
    z.number().int().nonnegative({ message: "Quantity must be a whole number." })
  ),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;

export async function addProduct(data: ProductFormData): Promise<AddProductResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  
  const validationResult = productSchema.safeParse(data);

  if (!validationResult.success) {
    return {
      success: false,
      message: "Invalid item data. " + Object.values(validationResult.error.flatten().fieldErrors).flat().join(' '),
    };
  }

  const { name, price, description, itemType, quantity, purchasePrice, categoryId, categoryName } = validationResult.data;

  try {
    const now = Timestamp.now();
    const dataToSave: any = {
      name,
      price,
      description: description || '',
      itemType,
      quantity,
      createdAt: now,
      categoryId: categoryId || null,
      categoryName: categoryName || null,
    };

    if (purchasePrice !== undefined) {
      dataToSave.purchasePrice = purchasePrice;
    }

    const productRef = await db.collection('products').add(dataToSave);
    
    const newProduct: Product = { 
      id: productRef.id, 
      ...validationResult.data,
      description: description || '',
      createdAt: now.toDate().toISOString() 
    };
    
    return {
      success: true,
      message: `Item "${name}" has been added to Firestore.`,
      product: newProduct,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to add item to Firestore: ${error.message || 'Unknown error'}`,
    };
  }
}

export interface GetProductsResult {
  success: boolean;
  products?: Product[];
  message?: string;
}

export async function getProducts(): Promise<GetProductsResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  
  try {
    const productsSnapshot = await db.collection('products').get();
    
    const productsList: Product[] = productsSnapshot.docs.map(doc => {
      const data = doc.data();
      const createdAtTimestamp = data.createdAt as Timestamp;
      return {
        id: doc.id,
        name: data.name,
        price: data.price,
        purchasePrice: data.purchasePrice,
        description: data.description || '',
        createdAt: createdAtTimestamp ? createdAtTimestamp.toDate().toISOString() : new Date().toISOString(),
        itemType: data.itemType || 'Stock', // Default old items to 'Stock'
        quantity: data.quantity || 0, // Default old items to 0
        categoryId: data.categoryId,
        categoryName: data.categoryName,
      };
    });

    productsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, products: productsList };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to fetch products: ${error.message || 'Unknown error'}`,
    };
  }
}


export interface ProductActionResult {
  success: boolean;
  message: string;
}

export async function deleteProduct(productId: string): Promise<ProductActionResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  try {
    await db.collection('products').doc(productId).delete();
    return { success: true, message: 'Item deleted successfully.' };
  } catch (error: any) {
    return { success: false, message: `Failed to delete item: ${error.message}` };
  }
}

export async function updateProduct(productId: string, data: ProductFormData): Promise<ProductActionResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  
  const validationResult = productSchema.safeParse(data);
  if (!validationResult.success) {
    return {
      success: false,
      message: "Invalid item data. " + Object.values(validationResult.error.flatten().fieldErrors).flat().join(' '),
    };
  }

  try {
    const { name, price, description, itemType, quantity, purchasePrice, categoryId, categoryName } = validationResult.data;
    const dataToUpdate: any = {
        name,
        price,
        description: description || '',
        itemType,
        quantity,
        categoryId: categoryId || null,
        categoryName: categoryName || null,
    };
    if (purchasePrice !== undefined) {
        dataToUpdate.purchasePrice = purchasePrice;
    } else {
        dataToUpdate.purchasePrice = admin.firestore.FieldValue.delete();
    }
    
    await db.collection('products').doc(productId).update(dataToUpdate);
    return { success: true, message: 'Item updated successfully.' };
  } catch (error: any) {
    return { success: false, message: `Failed to update item: ${error.message}` };
  }
}
