
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
import { UserCog, DollarSign, Store, Shield, ListChecks, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { type Franchise } from '@/app/admin/franchises/actions';
import { type PermissionModule, PERMISSION_MODULES } from '@/types/user';
import { Checkbox } from '../ui/checkbox';


const editUserSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email().optional(), // email is not editable for now.
  role: z.enum(['admin', 'user'], { required_error: "User role is required."}),
  monthlySalary: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().nonnegative({ message: "Monthly salary must be 0 or a positive number." }).optional()
  ),
  franchiseId: z.string().optional(),
  modulePermissions: z.array(z.string()).optional(),
});


type EditUserFormValues = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  user: FirebaseUserListItem | null;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onUserUpdated: () => void;
  franchises: Franchise[];
}

export default function EditUserDialog({ user, isOpen, setIsOpen, onUserUpdated, franchises }: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
  });
  
  const selectedRole = form.watch("role");

  useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.profileData?.fullName || '',
        email: user.email || '',
        monthlySalary: user.profileData?.monthlySalary,
        franchiseId: user.profileData?.franchiseId || 'head_branch',
        role: user.profileData?.role || 'user',
        modulePermissions: user.profileData?.modulePermissions || [],
      });
    }
  }, [user, form]);

  const onSubmit: SubmitHandler<EditUserFormValues> = async (data) => {
    if (!user) return;
    setIsSubmitting(true);
    
    try {
        const selectedFranchise = data.franchiseId === 'head_branch'
            ? { id: 'head_branch', name: 'Head Branch' }
            : franchises.find(f => f.id === data.franchiseId);

      const result: UpdateUserDataResult = await updateUserData(user.uid, { 
        fullName: data.fullName,
        monthlySalary: data.monthlySalary,
        franchiseId: selectedFranchise?.id,
        franchiseName: selectedFranchise?.name,
        role: data.role,
        modulePermissions: data.role === 'admin' ? data.modulePermissions : [],
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
      <DialogContent className="sm:max-w-md">
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Shield className="mr-2 h-4 w-4" />User Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">Basic Billing User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthlySalary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <DollarSign className="mr-2 h-4 w-4 text-primary" /> Monthly Salary (₹)
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      step="0.01"
                      placeholder="e.g., 50000.00"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                    />
                  </FormControl>
                   <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="franchiseId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center"><Store className="mr-2 h-4 w-4 text-muted-foreground" />Franchise Assignment</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a franchise" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="head_branch">Head Branch</SelectItem>
                        {franchises.map(franchise => (
                            <SelectItem key={franchise.id} value={franchise.id}>
                            {franchise.name}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
             {selectedRole === 'admin' && (
                <FormField
                  control={form.control}
                  name="modulePermissions"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base flex items-center">
                          <ListChecks className="mr-2 h-4 w-4" />
                           Module Permissions
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Select which admin modules this user can access.
                        </p>
                      </div>
                      <div className="p-4 border rounded-md grid grid-cols-2 gap-4">
                        {(Object.keys(PERMISSION_MODULES) as PermissionModule[]).map((moduleKey) => (
                          <FormField
                            key={moduleKey}
                            control={form.control}
                            name="modulePermissions"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={moduleKey}
                                  className="flex flex-row items-center space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(moduleKey)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([
                                              ...(field.value || []),
                                              moduleKey,
                                            ])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== moduleKey
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    {PERMISSION_MODULES[moduleKey]}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
