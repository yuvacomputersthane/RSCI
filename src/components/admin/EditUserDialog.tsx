
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
import { type FirebaseUserListItem, updateUserData, type UpdateUserDataResult } from '@/app/admin/users/actions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { UserCog, DollarSign } from 'lucide-react';

const editUserSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email().optional(), // email is not editable for now.
  hourlyRate: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().nonnegative({ message: "Hourly rate must be 0 or a positive number." }).optional()
  ),
});


type EditUserFormValues = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  user: FirebaseUserListItem | null;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onUserUpdated: () => void;
}

export default function EditUserDialog({ user, isOpen, setIsOpen, onUserUpdated }: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      hourlyRate: undefined,
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.profileData?.fullName || '',
        email: user.email || '',
        hourlyRate: user.profileData?.hourlyRate,
      });
    }
  }, [user, form]);

  const onSubmit: SubmitHandler<EditUserFormValues> = async (data) => {
    if (!user) return;
    setIsSubmitting(true);
    
    try {
      const result: UpdateUserDataResult = await updateUserData(user.uid, { 
        fullName: data.fullName,
        hourlyRate: data.hourlyRate 
      });
      if (result.success) {
        toast({
          title: "User Updated",
          description: result.message,
        });
        onUserUpdated();
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

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <UserCog className="mr-2 h-5 w-5 text-primary" /> Edit User
          </DialogTitle>
          <DialogDescription>
            Modify the details for {user.email || 'this user'}. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (read-only)</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hourlyRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <DollarSign className="mr-2 h-4 w-4 text-primary" /> Hourly Rate (₹)
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      step="0.01"
                      placeholder="e.g., 250.00"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
                    />
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
