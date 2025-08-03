
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  getFranchises,
  getFranchiseConfig,
  updateFranchiseConfig,
  addFranchise,
  deleteFranchise,
  type Franchise,
  type FranchiseConfig,
  type FranchiseFormData
} from './actions';
import { getFirebaseUsers, type FirebaseUserListItem } from '../users/actions';
import { Store, PlusCircle, AlertTriangle, Save, Trash2, User } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { DatePicker } from '@/components/ui/date-picker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const franchiseFormSchema = z.object({
  name: z.string().min(3, { message: "Franchise name must be at least 3 characters." }),
  ownerName: z.string().min(2, { message: "Owner name is required." }),
  address: z.string().min(3, { message: "Street address is required." }),
  city: z.string().min(2, { message: "City is required." }),
  state: z.string().min(2, { message: "State is required." }),
  zipCode: z.string().min(5, { message: "ZIP code is required." }),
  contactEmail: z.string().email({ message: "Invalid email format." }),
  contactPhone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  openingDate: z.date({
    required_error: "Opening date is required.",
    invalid_type_error: "That's not a valid date!",
  }),
  assignedUserId: z.string().optional(),
  assignedUserName: z.string().optional(),
});

export default function FranchiseManagementPage() {
  const { toast } = useToast();
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [users, setUsers] = useState<FirebaseUserListItem[]>([]);
  const [config, setConfig] = useState<FranchiseConfig>({ targetFranchises: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const form = useForm<FranchiseFormData>({
    resolver: zodResolver(franchiseFormSchema),
    defaultValues: {
      name: "", ownerName: "", address: "", city: "", state: "", zipCode: "", contactEmail: "", contactPhone: ""
    }
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [franchisesResult, configResult, usersResult] = await Promise.all([
        getFranchises(), 
        getFranchiseConfig(),
        getFirebaseUsers()
      ]);

      if (franchisesResult.success && franchisesResult.franchises) {
        setFranchises(franchisesResult.franchises);
      } else {
        throw new Error(franchisesResult.message || 'Failed to load franchises.');
      }

      if (configResult.success && configResult.config) {
        setConfig(configResult.config);
      } else {
        throw new Error(configResult.message || 'Failed to load franchise configuration.');
      }
      
      if (usersResult.success && usersResult.users) {
        setUsers(usersResult.users);
      } else {
        throw new Error(usersResult.message || 'Failed to load users.');
      }

    } catch (e: any) {
      setError(e.message);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    const result = await updateFranchiseConfig(config);
    if (result.success) {
      toast({ title: 'Success', description: result.message });
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
    setIsSavingConfig(false);
  };

  const onAddFranchiseSubmit = async (values: FranchiseFormData) => {
    
    const isUserSelected = values.assignedUserId && values.assignedUserId !== 'none';
    const assignedUser = isUserSelected ? users.find(u => u.uid === values.assignedUserId) : undefined;
    
    const dataToSend = {
      ...values,
      assignedUserId: isUserSelected ? values.assignedUserId : undefined,
      assignedUserName: assignedUser ? (assignedUser.profileData?.fullName || assignedUser.email) : undefined
    };
    
    const result = await addFranchise(dataToSend);
    if (result.success) {
      toast({ title: 'Franchise Added', description: result.message });
      fetchData();
      setIsAddDialogOpen(false);
      form.reset();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
  };

  const handleDeleteFranchise = async (franchiseId: string) => {
    if (!window.confirm('Are you sure you want to delete this franchise? This action cannot be undone.')) return;
    const result = await deleteFranchise(franchiseId);
    if (result.success) {
      toast({ title: 'Franchise Deleted', description: result.message });
      fetchData();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
  };

  const franchisesToOpen = Math.max(0, config.targetFranchises - franchises.length);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size={32} />
        <p className="ml-2 text-muted-foreground">Loading franchise data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
        <AlertTriangle className="h-5 w-5 mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Store className="mr-3 h-6 w-6 text-primary" /> Franchise Management
          </CardTitle>
          <CardDescription>Track your current franchises and set goals for expansion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Current Franchises</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{franchises.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Target Franchises</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.targetFranchises}
                  onChange={(e) => setConfig({ ...config, targetFranchises: parseInt(e.target.value, 10) || 0 })}
                  className="w-24 text-4xl font-bold p-0 h-auto border-none focus-visible:ring-0 bg-transparent shadow-none"
                />
                <Button onClick={handleSaveConfig} size="sm" disabled={isSavingConfig}>
                  {isSavingConfig ? <LoadingSpinner size={16} /> : <Save className="h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Slots Remaining</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{franchisesToOpen}</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Franchise List</CardTitle>
            <CardDescription>A list of all your current franchise locations.</CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Franchise
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[40vh] rounded-md border">
            <Table>
              <TableCaption>Franchise locations and owners.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Assigned User</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Opening Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {franchises.length > 0 ? (
                  franchises.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="text-xs">
                        {f.assignedUserName || <span className="text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell>{f.ownerName}</TableCell>
                      <TableCell className="text-xs">{f.address}, {f.city}, {f.state} {f.zipCode}</TableCell>
                      <TableCell>{format(new Date(f.openingDate), 'PPP')}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeleteFranchise(f.id)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No franchises added yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Add New Franchise</DialogTitle>
                <DialogDescription>
                    Enter the details for the new franchise location.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onAddFranchiseSubmit)} className="space-y-4">
                  <ScrollArea className="h-96 pr-6">
                    <div className="space-y-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel>Franchise Name</FormLabel><FormControl><Input placeholder="Rising Sun Computers - South Delhi" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="ownerName" render={({ field }) => (
                          <FormItem><FormLabel>Owner's Full Name</FormLabel><FormControl><Input placeholder="Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                       <FormField control={form.control} name="address" render={({ field }) => (
                          <FormItem><FormLabel>Street Address</FormLabel><FormControl><Input placeholder="123 Shopping Complex" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="city" render={({ field }) => (
                            <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="New Delhi" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="state" render={({ field }) => (
                            <FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="Delhi" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="zipCode" render={({ field }) => (
                            <FormItem><FormLabel>ZIP Code</FormLabel><FormControl><Input placeholder="110019" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="contactEmail" render={({ field }) => (
                          <FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" placeholder="jane.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="contactPhone" render={({ field }) => (
                          <FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input type="tel" placeholder="+91..." {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="openingDate" render={({ field }) => (
                          <FormItem className="flex flex-col"><FormLabel>Opening Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} placeholder="Select a date" /></FormControl><FormMessage /></FormItem>
                      )} />
                       <FormField
                        control={form.control}
                        name="assignedUserId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4" />Assign User (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a user to assign..." />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {users.filter(u => u.firestoreStatus === 'approved').map(user => (
                                        <SelectItem key={user.uid} value={user.uid}>
                                            {user.profileData?.fullName || user.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                  </ScrollArea>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? <LoadingSpinner size={16} /> : 'Add Franchise'}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
