"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, ListChecks, PackageSearch, AlertTriangle, RefreshCw, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import AddCategoryDialog from '@/components/admin/AddCategoryDialog';
import EditCategoryDialog from '@/components/admin/EditCategoryDialog';
import { getCategories, deleteCategory, type Category } from './actions';
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

export default function CategoryManagementPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCategories = async () => {
    setIsLoading(true);
    setErrorLoading(null);
    try {
      const result = await getCategories();
      if (result.success && result.categories) {
        setCategories(result.categories);
      } else {
        throw new Error(result.message || "Failed to load categories.");
      }
    } catch (error: any) {
      setErrorLoading(error.message);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCategoryAdded = (newCategory: Category | undefined) => {
    if (newCategory) {
      setCategories(prev => [newCategory, ...prev]);
    }
  };

  const handleEditClick = (category: Category) => {
    setCategoryToEdit(category);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };
  
  const executeDelete = async () => {
    if (!categoryToDelete) return;
    
    setIsProcessingAction(categoryToDelete.id);
    const result = await deleteCategory(categoryToDelete.id);
    
    if (result.success) {
      toast({ title: "Category Deleted", description: result.message });
      setCategories(prev => prev.filter(c => c.id !== categoryToDelete.id));
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    
    setIsProcessingAction(null);
    setIsDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  return (
    <>
      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <CardTitle className="text-2xl flex items-center">
              <ListChecks className="mr-2 h-6 w-6 text-primary" /> Category Management
            </CardTitle>
            <CardDescription>Add, edit, or delete categories to organize your products and services.</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={fetchCategories} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Category
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading categories...</p>
            </div>
          ) : errorLoading ? (
             <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              {errorLoading}
            </div>
          ) : categories.length > 0 ? (
            <ScrollArea className="h-[60vh] rounded-md border">
              <Table>
                <TableCaption>A list of all categories from Firestore.</TableCaption>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Category Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id} className={isProcessingAction === category.id ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-sm truncate" title={category.description}>
                        {category.description || 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(category.createdAt), 'PPpp')}
                      </TableCell>
                      <TableCell className="text-right">
                        {isProcessingAction === category.id ? (
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
                              <DropdownMenuItem onSelect={() => handleEditClick(category)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => handleDeleteClick(category)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
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
              <p className="mt-4 text-sm text-muted-foreground">No categories found.</p>
              <p className="text-xs text-muted-foreground">
                Click "Add New Category" to create your first one.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddCategoryDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        onCategoryAdded={handleCategoryAdded}
      />
      
      <EditCategoryDialog
        category={categoryToEdit}
        isOpen={isEditDialogOpen}
        setIsOpen={setIsEditDialogOpen}
        onCategoryUpdated={fetchCategories}
      />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the category
              <span className="font-semibold"> "{categoryToDelete?.name}"</span>.
              This will NOT delete the products or services within it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCategoryToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
