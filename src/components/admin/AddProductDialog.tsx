
"use client";

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { useForm } from "react-hook-form";
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
  DialogClose,
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
import { addProduct, type AddProductResult, type Product } from '@/app/admin/products/actions';
import { getCategories, type Category } from '@/app/admin/categories/actions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { PlusCircle, ShoppingCart } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from '../ui/scroll-area';

const productFormSchema = z.object({
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
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val).replace('₹', ''))),
    z.number().nonnegative({ message: "Purchase price must be a non-negative number." }).optional()
  ),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface AddProductDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onProductAdded?: (product: Product | undefined) => void;
}

export default function AddProductDialog({ isOpen, setIsOpen, onProductAdded }: AddProductDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();

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

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      price: '' as any,
      purchasePrice: '' as any,
      quantity: '' as any,
      description: "",
      itemType: 'Stock',
      categoryId: '',
      categoryName: '',
    },
  });
  
  const itemType = form.watch('itemType');

  const onSubmit = async (values: ProductFormValues) => {
    setIsSubmitting(true);
    
    const selectedCategory = categories.find(c => c.id === values.categoryId);
    const dataToSend = {
      ...values,
      categoryName: selectedCategory ? selectedCategory.name : undefined,
    };

    try {
      const result: AddProductResult = await addProduct(dataToSend);
      if (result.success) {
        toast({
          title: "Item Added to Firestore",
          description: result.message,
        });
        onProductAdded?.(result.product);
        form.reset();
        setIsOpen(false);
      } else {
        toast({
          title: "Error Adding Item",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Add item error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while adding the item.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isSubmitting) {
        setIsOpen(open);
        if (!open) {
          form.reset();
        }
      }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <ShoppingCart className="mr-2 h-5 w-5 text-primary" /> Add New Inventory Item
          </DialogTitle>
          <DialogDescription>
            Enter details for the new item. 'Stock' is for sale, 'Asset' is for internal tracking.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <ScrollArea className="h-96 pr-6 -mr-6">
            <div className="space-y-4 pr-6">
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
                          <Input type="number" step="1" placeholder="e.g., 50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price (₹)</FormLabel>
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
                        {itemType === 'Asset' ? 'Value (₹)' : 'Sale Price (₹)'}
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
                            field.onChange(val === '' || val === null ? '' : parseFloat(val));
                          }}
                        />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoadingSpinner size={16} className="mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Adding..." : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
