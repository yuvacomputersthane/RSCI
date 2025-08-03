
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, ShoppingCart, PackageSearch, AlertTriangle, RefreshCw, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import AddProductDialog from '@/components/admin/AddProductDialog';
import EditProductDialog from '@/components/admin/EditProductDialog';
import { getProducts, deleteProduct, type Product } from './actions';
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


export default function ProductManagementPage() {
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
  const [isDeleteProductDialogOpen, setIsDeleteProductDialogOpen] = useState(false);

  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  
  const [allProducts, setAllProducts] = useState<Product[]>([]);
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
      const [productsResult, categoriesResult] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);

      if (productsResult.success && productsResult.products) {
        setAllProducts(productsResult.products);
      } else {
        throw new Error(productsResult.message || "Failed to load items.");
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

  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'all') {
      return allProducts;
    }
    return allProducts.filter(p => p.categoryId === categoryFilter);
  }, [allProducts, categoryFilter]);


  const handleProductAdded = (newProduct: Product | undefined) => {
    if (newProduct) {
      setAllProducts(prevProducts => [newProduct, ...prevProducts]);
    }
  };

  const handleEditClick = (product: Product) => {
    setProductToEdit(product);
    setIsEditProductDialogOpen(true);
  };
  
  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteProductDialogOpen(true);
  };
  
  const executeDeleteProduct = async () => {
    if (!productToDelete) return;
    
    setIsProcessingAction(productToDelete.id);
    const result = await deleteProduct(productToDelete.id);
    
    if (result.success) {
      toast({ title: "Item Deleted", description: result.message });
      setAllProducts(prev => prev.filter(p => p.id !== productToDelete.id));
    } else {
      toast({ title: "Error Deleting Item", description: result.message, variant: "destructive" });
    }
    
    setIsProcessingAction(null);
    setIsDeleteProductDialogOpen(false);
    setProductToDelete(null);
  };

  return (
    <>
      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <CardTitle className="text-2xl flex items-center">
              <ShoppingCart className="mr-2 h-6 w-6 text-primary" /> Inventory Management
            </CardTitle>
            <CardDescription>Manage sellable stock and internal company assets. Data is stored in Firestore.</CardDescription>
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
            <Button onClick={() => setIsAddProductDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading inventory...</p>
            </div>
          ) : errorLoading ? (
             <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              {errorLoading}
            </div>
          ) : filteredProducts.length > 0 ? (
            <ScrollArea className="h-[60vh] rounded-md border">
              <Table>
                <TableCaption>
                  A list of all inventory items from Firestore.
                </TableCaption>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Purchase Price (₹)</TableHead>
                    <TableHead className="text-right">Sale Price (₹)</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className={isProcessingAction === product.id ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {product.categoryName || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.itemType === 'Stock' ? 'default' : 'secondary'}>
                          {product.itemType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{product.quantity}</TableCell>
                      <TableCell className="text-right">
                        {typeof product.purchasePrice === 'number' ? `₹${product.purchasePrice.toFixed(2)}` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.itemType === 'Stock' ? `₹${typeof product.price === 'number' ? product.price.toFixed(2) : 'N/A'}` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {isProcessingAction === product.id ? (
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
                              <DropdownMenuItem onSelect={() => handleEditClick(product)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => handleDeleteClick(product)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
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
              <p className="mt-4 text-sm text-muted-foreground">No inventory items found matching your filter.</p>
              <p className="text-xs text-muted-foreground">
                Try a different category or add a new item.
              </p>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Only items marked as 'Stock' will appear in the main billing form.
          </p>
        </CardContent>
      </Card>

      <AddProductDialog
        isOpen={isAddProductDialogOpen}
        setIsOpen={setIsAddProductDialogOpen}
        onProductAdded={handleProductAdded}
      />
      
      <EditProductDialog
        product={productToEdit}
        isOpen={isEditProductDialogOpen}
        setIsOpen={setIsEditProductDialogOpen}
        onProductUpdated={fetchData}
      />
      
      <AlertDialog open={isDeleteProductDialogOpen} onOpenChange={setIsDeleteProductDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the item
              <span className="font-semibold"> "{productToDelete?.name}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
