
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
import LoadingSpinner from '@/components/LoadingSpinner';
import { PencilLine, PlusCircle } from 'lucide-react';

const customChargeSchema = z.object({
  name: z.string().min(3, { message: "Description must be at least 3 characters." }),
  price: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val.replace('₹', '')) : val),
    z.number({
      required_error: "Price is required.",
      invalid_type_error: "Price must be a valid number."
    }).positive({ message: "Price must be a positive number." })
  )
});

type CustomChargeFormValues = z.infer<typeof customChargeSchema>;

interface CustomChargeDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onAddCharge: (name: string, price: number) => void;
}

export default function CustomChargeDialog({ isOpen, setIsOpen, onAddCharge }: CustomChargeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CustomChargeFormValues>({
    resolver: zodResolver(customChargeSchema),
    defaultValues: { name: "", price: undefined },
  });

  const onSubmit = (values: CustomChargeFormValues) => {
    setIsSubmitting(true);
    onAddCharge(values.name, values.price);
    form.reset();
    setIsOpen(false);
    setIsSubmitting(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      setIsOpen(open);
      if (!open) {
        form.reset();
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <PencilLine className="mr-2 h-5 w-5 text-primary" /> Add Custom Charge
          </DialogTitle>
          <DialogDescription>
            Enter a description and amount for a one-time charge. This will be added as a line item to the bill.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., On-site visit fee" {...field} />
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
                  <FormLabel>Amount (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 250.00"
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '' || val === null) {
                           field.onChange('');
                        } else {
                          const parsed = parseFloat(val);
                          field.onChange(isNaN(parsed) ? '' : parsed);
                        }
                      }}
                    />
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
                {isSubmitting ? "Adding..." : "Add to Bill"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
