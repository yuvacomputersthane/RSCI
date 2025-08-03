
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
import { useToast } from "@/hooks/use-toast";
import { type Service, updateService, type ServiceActionResult } from '@/app/admin/services/actions';
import { getCategories, type Category } from '@/app/admin/categories/actions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const editServiceSchema = z.object({
  name: z.string().min(3, { message: "Service name must be at least 3 characters." }),
  price: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val.replace('₹', '')) : val),
    z.number({
      required_error: "Selling price is required.",
      invalid_type_error: "Price must be a valid number."
    }).positive({ message: "Selling price must be a positive number." })
  ),
  costPrice: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val).replace('₹', ''))),
    z.number().nonnegative({ message: "Cost price must be a non-negative number." }).optional()
  ),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
});

type EditServiceFormValues = z.infer<typeof editServiceSchema>;

interface EditServiceDialogProps {
  service: Service | null;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onServiceUpdated: () => void;
}

export default function EditServiceDialog({ service, isOpen, setIsOpen, onServiceUpdated }: EditServiceDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();

  const form = useForm<EditServiceFormValues>({
    resolver: zodResolver(editServiceSchema),
    defaultValues: {
      name: "",
      price: '' as any,
    },
  });

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
    if (service) {
      form.reset({
        name: service.name,
        price: service.price,
        costPrice: service.costPrice,
        categoryId: service.categoryId || '',
        categoryName: service.categoryName || '',
      });
    }
  }, [service, form]);

  const onSubmit: SubmitHandler<EditServiceFormValues> = async (data) => {
    if (!service) return;
    setIsSubmitting(true);
    
    const selectedCategory = categories.find(c => c.id === data.categoryId);
    const dataToSend = {
      ...data,
      categoryName: selectedCategory ? selectedCategory.name : undefined,
    };
    
    try {
      const result: ServiceActionResult = await updateService(service.id, dataToSend);
      if (result.success) {
        toast({
          title: "Service Updated",
          description: result.message,
        });
        onServiceUpdated();
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

  if (!service) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Edit className="mr-2 h-5 w-5 text-primary" /> Edit Service
          </DialogTitle>
          <DialogDescription>
            Modify the details for this service. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Laptop Repair" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Price (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 800.00"
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
                    <FormLabel>Selling Price (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 1500.00"
                        {...field}
                        value={field.value ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || val === null) {
                            field.onChange('');
                          } else {
                            const parsed = parseFloat(val);
                            field.onChange(isNaN(parsed) ? val : parsed);
                          }
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
