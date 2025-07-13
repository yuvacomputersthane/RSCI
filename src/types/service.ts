
// Updated Service interface to use a string for createdAt for client-side serialization
export interface Service {
  id: string;
  name: string;
  price: number;
  createdAt: string; 
  categoryId?: string;
  categoryName?: string;
}
