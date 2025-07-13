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
import { type Category, updateCategory, type CategoryActionResult } from '@/app/admin/categories/actions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Edit } from 'lucide-react';

const editCategorySchema = z.object({
  name: z.string().min(2, { message: "Category name must be at least 2 characters." }),
  description: z.string().optional(),
});

type EditCategoryFormValues = z.infer<typeof editCategorySchema>;

interface EditCategoryDialogProps {
  category: Category | null;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onCategoryUpdated: () => void;
}

export default function EditCategoryDialog({ category, isOpen, setIsOpen, onCategoryUpdated }: EditCategoryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<EditCategoryFormValues>({
    resolver: zodResolver(editCategorySchema),
  });

  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        description: category.description,
      });
    }
  }, [category, form]);

  const onSubmit: SubmitHandler<EditCategoryFormValues> = async (data) => {
    if (!category) return;
    setIsSubmitting(true);
    
    try {
      const result: CategoryActionResult = await updateCategory(category.id, data);
      if (result.success) {
        toast({ title: "Category Updated", description: result.message });
        onCategoryUpdated();
        setIsOpen(false);
      } else {
        toast({ title: "Update Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!category) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Edit className="mr-2 h-5 w-5 text-primary" /> Edit Category
          </DialogTitle>
          <DialogDescription>
            Modify the details for this category. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Textarea {...field} />
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
