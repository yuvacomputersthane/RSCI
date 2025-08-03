
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Settings, PackageSearch, AlertTriangle, RefreshCw, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import AddServiceDialog from '@/components/admin/AddServiceDialog';
import EditServiceDialog from '@/components/admin/EditServiceDialog';
import { getServices, deleteService, type Service } from './actions';
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
import { getCategories, type Category } from '@/app/admin/categories/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export default function ServiceManagementPage() {
  const [isAddServiceDialogOpen, setIsAddServiceDialogOpen] = useState(false);
  const [isEditServiceDialogOpen, setIsEditServiceDialogOpen] = useState(false);
  const [isDeleteServiceDialogOpen, setIsDeleteServiceDialogOpen] = useState(false);

  const [serviceToEdit, setServiceToEdit] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorLoading(null);
    try {
      const [servicesResult, categoriesResult] = await Promise.all([
        getServices(),
        getCategories(),
      ]);
      
      if (servicesResult.success && servicesResult.services) {
        setAllServices(servicesResult.services);
      } else {
        throw new Error(servicesResult.message || "Failed to load services.");
      }

       if (categoriesResult.success && categoriesResult.categories) {
        setCategories(categoriesResult.categories);
      } else {
        toast({ title: "Warning", description: "Could not load categories for filtering.", variant: "destructive" });
      }

    } catch (error: any) {
      const message = error.message || "An unexpected error occurred.";
      setErrorLoading(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredServices = useMemo(() => {
    if (categoryFilter === 'all') {
      return allServices;
    }
    return allServices.filter(s => s.categoryId === categoryFilter);
  }, [allServices, categoryFilter]);


  const handleServiceAdded = (newService: Service | undefined) => {
    if (newService) {
      setAllServices(prevServices => [newService, ...prevServices]);
    }
  };

  const handleEditClick = (service: Service) => {
    setServiceToEdit(service);
    setIsEditServiceDialogOpen(true);
  };
  
  const handleDeleteClick = (service: Service) => {
    setServiceToDelete(service);
    setIsDeleteServiceDialogOpen(true);
  };
  
  const executeDeleteService = async () => {
    if (!serviceToDelete) return;
    
    setIsProcessingAction(serviceToDelete.id);
    const result = await deleteService(serviceToDelete.id);
    
    if (result.success) {
      toast({ title: "Service Deleted", description: result.message });
      setAllServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
    } else {
      toast({ title: "Error Deleting Service", description: result.message, variant: "destructive" });
    }
    
    setIsProcessingAction(null);
    setIsDeleteServiceDialogOpen(false);
    setServiceToDelete(null);
  };

  return (
    <>
      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <CardTitle className="text-2xl flex items-center">
              <Settings className="mr-2 h-6 w-6 text-primary" /> Service Management
            </CardTitle>
            <CardDescription>View, add, edit, or delete services offered by Rising Sun Computers. Services are stored in Firestore.</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={isLoading || categories.length === 0}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <SelectValue placeholder="Filter by category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
            <Button onClick={() => setIsAddServiceDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Service
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading services...</p>
            </div>
          ) : errorLoading ? (
             <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              {errorLoading}
            </div>
          ) : filteredServices.length > 0 ? (
            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableCaption>
                  A list of currently offered services from Firestore.
                </TableCaption>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Service Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Cost Price (₹)</TableHead>
                    <TableHead className="text-right">Selling Price (₹)</TableHead>
                    <TableHead className="text-right">Profit (₹)</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((service) => {
                    const cost = typeof service.costPrice === 'number' ? service.costPrice : 0;
                    const profit = service.price - cost;
                    return (
                      <TableRow key={service.id} className={isProcessingAction === service.id ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {service.categoryName || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          {typeof service.costPrice === 'number' ? `₹${service.costPrice.toFixed(2)}` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">₹{typeof service.price === 'number' ? service.price.toFixed(2) : 'N/A'}</TableCell>
                        <TableCell className={`text-right font-semibold ${profit < 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {typeof service.costPrice === 'number' ? `₹${profit.toFixed(2)}` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          {isProcessingAction === service.id ? (
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
                                <DropdownMenuItem onSelect={() => handleEditClick(service)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  <span>Edit</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => handleDeleteClick(service)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="mt-6 border border-dashed rounded-lg p-8 text-center">
              <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">No services found matching your filter.</p>
              <p className="text-xs text-muted-foreground">
                Click "Add New Service" to add your first service.
              </p>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            The main billing form now uses this dynamic list from Firestore.
          </p>
        </CardContent>
      </Card>

      <AddServiceDialog
        isOpen={isAddServiceDialogOpen}
        setIsOpen={setIsAddServiceDialogOpen}
        onServiceAdded={handleServiceAdded}
      />
      
      <EditServiceDialog
        service={serviceToEdit}
        isOpen={isEditServiceDialogOpen}
        setIsOpen={setIsEditServiceDialogOpen}
        onServiceUpdated={fetchData}
      />
      
      <AlertDialog open={isDeleteServiceDialogOpen} onOpenChange={setIsDeleteServiceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the service 
              <span className="font-semibold"> "{serviceToDelete?.name}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setServiceToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteService}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
