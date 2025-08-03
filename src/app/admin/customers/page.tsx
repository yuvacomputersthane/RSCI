
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, BookUser, AlertTriangle, RefreshCw, MoreHorizontal, Edit, Trash2, Search, PackageSearch } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import AddCustomerDialog from '@/components/admin/AddCustomerDialog';
import EditCustomerDialog from '@/components/admin/EditCustomerDialog';
import { getCustomers, deleteCustomer, type Customer } from './actions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';

export default function CustomerManagementPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setErrorLoading(null);
    try {
      const result = await getCustomers();
      if (result.success && result.customers) {
        setAllCustomers(result.customers);
      } else {
        throw new Error(result.message || "Failed to load customers.");
      }
    } catch (error: any) {
      setErrorLoading(error.message);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return allCustomers;
    const lowercasedFilter = searchTerm.toLowerCase();
    return allCustomers.filter(customer =>
      customer.fullName.toLowerCase().includes(lowercasedFilter) ||
      customer.email?.toLowerCase().includes(lowercasedFilter) ||
      customer.phone?.toLowerCase().includes(lowercasedFilter)
    );
  }, [allCustomers, searchTerm]);

  const handleCustomerAdded = (newCustomer: Customer) => {
    setAllCustomers(prev => [newCustomer, ...prev]);
  };

  const handleEditClick = (customer: Customer) => {
    setCustomerToEdit(customer);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
  };
  
  const executeDelete = async () => {
    if (!customerToDelete) return;
    
    setIsProcessingAction(customerToDelete.id);
    const result = await deleteCustomer(customerToDelete.id);
    
    if (result.success) {
      toast({ title: "Customer Deleted", description: result.message });
      setAllCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    
    setIsProcessingAction(null);
    setIsDeleteDialogOpen(false);
    setCustomerToDelete(null);
  };

  return (
    <>
      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <CardTitle className="text-2xl flex items-center">
              <BookUser className="mr-3 h-6 w-6 text-primary" /> Customer Management
            </CardTitle>
            <CardDescription>View, add, edit, or delete customer profiles from your Firestore database.</CardDescription>
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:w-[200px] md:w-[250px] h-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchCustomers} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)} className="h-9">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading customers...</p>
            </div>
          ) : errorLoading ? (
             <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              {errorLoading}
            </div>
          ) : filteredCustomers.length > 0 ? (
            <ScrollArea className="h-[60vh] rounded-md border">
              <Table>
                <TableCaption>A list of all customers from Firestore.</TableCaption>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} className={isProcessingAction === customer.id ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{customer.fullName}</TableCell>
                      <TableCell className="text-xs">
                        <div>{customer.email || 'N/A'}</div>
                        <div className="text-muted-foreground">{customer.phone || 'N/A'}</div>
                      </TableCell>
                       <TableCell className="text-xs text-muted-foreground max-w-sm truncate" title={customer.address}>
                        {customer.city}{customer.city && customer.state ? ', ' : ''}{customer.state}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(customer.createdAt), 'PP')}
                      </TableCell>
                      <TableCell className="text-right">
                        {isProcessingAction === customer.id ? (
                            <LoadingSpinner size={16} />
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={() => handleEditClick(customer)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => handleDeleteClick(customer)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="mt-6 border border-dashed rounded-lg p-8 text-center">
              <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                {allCustomers.length > 0 ? 'No customers match your search.' : 'No customers found.'}
              </p>
              <p className="text-xs text-muted-foreground">
                {allCustomers.length > 0 ? 'Try a different search term.' : 'Click "Add New" to create your first customer.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddCustomerDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        onCustomerAdded={handleCustomerAdded}
      />
      
      <EditCustomerDialog
        customer={customerToEdit}
        isOpen={isEditDialogOpen}
        setIsOpen={setIsEditDialogOpen}
        onCustomerUpdated={fetchCustomers}
      />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the profile for
              <span className="font-semibold"> "{customerToDelete?.fullName}"</span>.
              This will NOT affect any past invoices associated with this customer's name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
