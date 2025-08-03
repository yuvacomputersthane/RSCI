
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getFirebaseUsers, type FirebaseUserListItem } from '../users/actions';
import { addSalaryAdvance, getSalaryAdvances, deleteSalaryAdvance, type SalaryAdvance } from './actions';
import { AlertTriangle, HandCoins, PlusCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const addAdvanceSchema = z.object({
  userId: z.string().min(1, "You must select an employee."),
  amount: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val.replace('₹', '')) : val),
    z.number({ required_error: "Amount is required." }).positive({ message: "Amount must be a positive number." })
  ),
  notes: z.string().optional(),
});

type AddAdvanceFormValues = z.infer<typeof addAdvanceSchema>;

export default function SalaryAdvancesPage() {
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [users, setUsers] = useState<FirebaseUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: adminUser } = useAuth();
  const { toast } = useToast();

  const form = useForm<AddAdvanceFormValues>({
    resolver: zodResolver(addAdvanceSchema),
    defaultValues: { amount: undefined, notes: "" },
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersResult, advancesResult] = await Promise.all([
        getFirebaseUsers(),
        getSalaryAdvances()
      ]);
      if (!usersResult.success || !usersResult.users) throw new Error(usersResult.message || "Failed to load users.");
      if (!advancesResult.success || !advancesResult.advances) throw new Error(advancesResult.message || "Failed to load advances.");
      
      setUsers(usersResult.users.filter(u => u.firestoreStatus === 'approved'));
      setAdvances(advancesResult.advances);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onAddAdvanceSubmit = async (values: AddAdvanceFormValues) => {
    if (!adminUser) {
        toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
        return;
    }
    const selectedUser = users.find(u => u.uid === values.userId);
    if (!selectedUser) {
        toast({ title: "Error", description: "Selected user not found.", variant: "destructive" });
        return;
    }

    const result = await addSalaryAdvance({
        ...values,
        userName: selectedUser.profileData?.fullName || selectedUser.email || 'Unknown User',
        recordedByUid: adminUser.uid,
        recordedByName: adminUser.displayName || 'Admin'
    });

    if (result.success) {
        toast({ title: "Success", description: "Salary advance recorded successfully." });
        form.reset();
        fetchData();
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };
  
  const handleDeleteAdvance = async (advanceId: string) => {
    if (!window.confirm("Are you sure you want to delete this advance record? This action cannot be undone.")) return;
    const result = await deleteSalaryAdvance(advanceId);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      fetchData();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <HandCoins className="mr-2 h-6 w-6 text-primary" /> Salary Advance Management
          </CardTitle>
          <CardDescription>Record and manage advance salary payments for employees.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAddAdvanceSubmit)} className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                 <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select an employee" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {users.map(u => (
                                    <SelectItem key={u.uid} value={u.uid}>{u.profileData?.fullName || u.email}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                 <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Amount (₹)</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" placeholder="e.g. 5000" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Reason for advance..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                   {form.formState.isSubmitting ? <LoadingSpinner size={16} /> : <PlusCircle className="mr-2 h-4 w-4" />}
                   Record Advance
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advance History</CardTitle>
          <CardDescription>A complete log of all salary advances given.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size={32} /><p className="ml-2 text-muted-foreground">Loading history...</p>
                </div>
            ) : error ? (
                <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" /> {error}
                </div>
            ) : (
                <ScrollArea className="h-[400px] rounded-md border">
                    <Table>
                        <TableCaption>Salary advance records from Firestore.</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Employee</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead>Recorded By</TableHead>
                                <TableHead className="text-right">Amount (₹)</TableHead>
                                <TableHead className="text-center">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {advances.length > 0 ? (
                                advances.map(advance => (
                                    <TableRow key={advance.id}>
                                        <TableCell>{format(parseISO(advance.date), 'PPP')}</TableCell>
                                        <TableCell>{advance.userName}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{advance.notes || 'N/A'}</TableCell>
                                        <TableCell>{advance.recordedByName}</TableCell>
                                        <TableCell className="text-right font-semibold">₹{advance.amount.toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDeleteAdvance(advance.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">No advance records found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
