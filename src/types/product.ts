
export interface Product {
  id: string;
  name: string;
  price: number;
  purchasePrice?: number;
  description: string;
  createdAt: string; 
  itemType: 'Stock' | 'Asset';
  quantity: number;
  categoryId?: string;
  categoryName?: string;
}
