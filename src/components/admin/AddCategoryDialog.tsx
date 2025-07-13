"use client";

import { useState, type Dispatch, type SetStateAction } from 'react';
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
import { addCategory, type CategoryActionResult, type Category } from '@/app/admin/categories/actions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { PlusCircle, ListChecks } from 'lucide-react';

const categoryFormSchema = z.object({
  name: z.string().min(2, { message: "Category name must be at least 2 characters." }),
  description: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface AddCategoryDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onCategoryAdded?: (category: Category | undefined) => void;
}

export default function AddCategoryDialog({ isOpen, setIsOpen, onCategoryAdded }: AddCategoryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = async (values: CategoryFormValues) => {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('name', values.name);
    if (values.description) {
      formData.append('description', values.description);
    }

    try {
      const result: CategoryActionResult = await addCategory(formData);
      if (result.success) {
        toast({ title: "Category Created", description: result.message });
        onCategoryAdded?.(result.category);
        form.reset();
        setIsOpen(false);
      } else {
        toast({ title: "Error Creating Category", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      setIsOpen(open);
      if (!open) form.reset();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <ListChecks className="mr-2 h-5 w-5 text-primary" /> Add New Category
          </DialogTitle>
          <DialogDescription>
            Enter details for the new category to organize products and services.
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
                    <Input placeholder="e.g., Computer Peripherals" {...field} />
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
                    <Textarea placeholder="Describe what this category includes." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoadingSpinner size={16} className="mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Adding..." : "Add Category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
