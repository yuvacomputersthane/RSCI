
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
import { addCustomer, type Customer, type CustomerFormData, type CustomerActionResult } from '@/app/admin/customers/actions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { PlusCircle, BookUser } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

const customerFormSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email format." }).optional().or(z.literal('')),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  notes: z.string().optional(),
});

interface AddCustomerDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onCustomerAdded?: (customer: Customer) => void;
}

export default function AddCustomerDialog({ isOpen, setIsOpen, onCustomerAdded }: AddCustomerDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      fullName: "", email: "", phone: "", address: "", city: "", state: "", zipCode: "", notes: ""
    },
  });

  const onSubmit = async (values: CustomerFormData) => {
    setIsSubmitting(true);
    try {
      const result: CustomerActionResult = await addCustomer(values);
      if (result.success && result.customer) {
        toast({ title: "Customer Created", description: result.message });
        onCustomerAdded?.(result.customer);
        form.reset();
        setIsOpen(false);
      } else {
        toast({ title: "Error Creating Customer", description: result.message, variant: "destructive" });
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <BookUser className="mr-2 h-5 w-5 text-primary" /> Add New Customer
          </DialogTitle>
          <DialogDescription>
            Enter the customer's details. This will create a new customer profile in Firestore.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="h-96 pr-6">
                <div className="space-y-4">
                    <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Email (Optional)</FormLabel>
                            <FormControl><Input type="email" placeholder="john.doe@example.com" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                     <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Street Address (Optional)</FormLabel>
                            <FormControl><Input placeholder="123 Main Street" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>City</FormLabel>
                                <FormControl><Input placeholder="New Delhi" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        <FormField
                            control={form.control}
                            name="state"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>State</FormLabel>
                                <FormControl><Input placeholder="Delhi" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        <FormField
                            control={form.control}
                            name="zipCode"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>ZIP Code</FormLabel>
                                <FormControl><Input placeholder="110001" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                     </div>
                     <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl><Textarea placeholder="e.g., Prefers contact by email." {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoadingSpinner size={16} className="mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Adding..." : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
