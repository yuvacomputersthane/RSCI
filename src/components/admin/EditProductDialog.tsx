
"use client";

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { type Product, updateProduct, type ProductActionResult } from '@/app/admin/products/actions';
import { getCategories, type Category } from '@/app/admin/categories/actions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const editProductSchema = z.object({
  name: z.string().min(3, { message: "Item name must be at least 3 characters." }),
  itemType: z.enum(['Stock', 'Asset'], { required_error: "You must select an item type." }),
  quantity: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseInt(val, 10) : val),
    z.number({
      required_error: "Quantity is required.",
      invalid_type_error: "Quantity must be a valid number."
    }).int().nonnegative({ message: "Quantity must be a non-negative whole number." })
  ),
  price: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val.replace('₹', '')) : val),
    z.number({
      required_error: "Price is required.",
      invalid_type_error: "Price must be a valid number."
    }).nonnegative({ message: "Price must be a non-negative number." })
  ),
  purchasePrice: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().nonnegative({ message: "Purchase price must be a non-negative number." }).optional()
  ),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
});

type EditProductFormValues = z.infer<typeof editProductSchema>;

interface EditProductDialogProps {
  product: Product | null;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onProductUpdated: () => void;
}

export default function EditProductDialog({ product, isOpen, setIsOpen, onProductUpdated }: EditProductDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();

  const form = useForm<EditProductFormValues>({
    resolver: zodResolver(editProductSchema),
  });
  
  const itemType = form.watch('itemType');
  
  useEffect(() => {
    async function fetchCategories() {
        if (isOpen) {
            const result = await getCategories();
            if (result.success && result.categories) {
                setCategories(result.categories);
            } else {
                toast({ title: "Error", description: "Could not load categories.", variant: "destructive" });
            }
        }
    }
    fetchCategories();
  }, [isOpen, toast]);

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        price: product.price,
        purchasePrice: product.purchasePrice,
        description: product.description,
        itemType: product.itemType,
        quantity: product.quantity,
        categoryId: product.categoryId || '',
        categoryName: product.categoryName || '',
      });
    }
  }, [product, form]);

  const onSubmit: SubmitHandler<EditProductFormValues> = async (data) => {
    if (!product) return;
    setIsSubmitting(true);
    
    const selectedCategory = categories.find(c => c.id === data.categoryId);
    const dataToSend = {
      ...data,
      categoryName: selectedCategory ? selectedCategory.name : undefined,
    };
    
    try {
      const result: ProductActionResult = await updateProduct(product.id, dataToSend);
      if (result.success) {
        toast({
          title: "Item Updated",
          description: result.message,
        });
        onProductUpdated();
        setIsOpen(false);
      } else {
        toast({
          title: "Update Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Edit className="mr-2 h-5 w-5 text-primary" /> Edit Item
          </DialogTitle>
          <DialogDescription>
            Modify the details for this item. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Gaming Mouse" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
               <FormField
                  control={form.control}
                  name="itemType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Stock">Stock (for sale)</SelectItem>
                          <SelectItem value="Asset">Asset (internal)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" placeholder="e.g., 50" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Category (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="">No Category</SelectItem>
                        {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                            {category.name}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
             <FormField
              control={form.control}
              name="purchasePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Price (₹, Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 1800.00"
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        field.onChange(val === '' || val === null ? undefined : parseFloat(val));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {itemType === 'Asset' ? 'Value (₹, Optional)' : 'Sale Price (₹)'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 2500.00"
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        field.onChange(val === '' || val === null ? '' : parseFloat(val) || val);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., 'RGB gaming mouse with 16000 DPI'" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoadingSpinner size={16} className="mr-2" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
