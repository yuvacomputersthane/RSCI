
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { User, Check, Save, ChevronsUpDown, Calculator, RotateCcw, XCircle, PackageSearch, AlertTriangle, PencilLine, Settings, ShoppingCart, CreditCard, Mail, Phone } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import { getServices, type Service as ServiceType } from "@/app/admin/services/actions";
import { getProducts, type Product as ProductType } from "@/app/admin/products/actions";
import { getCustomers, type Customer } from '@/app/admin/customers/actions';
import LoadingSpinner from "./LoadingSpinner";
import { Separator } from "./ui/separator";
import CustomChargeDialog from "./CustomChargeDialog";

type BillableItem = (ServiceType | ProductType) & { itemType: 'service' | 'product' | 'custom' };

interface LineItem extends BillableItem {
  instanceId: string;
}

export const billingSchema = z.object({
  customerId: z.string().min(1, { message: "You must select a registered customer." }),
  customerName: z.string(), // This will be populated automatically
  customerEmail: z.string().email({ message: "Invalid email format." }).optional().or(z.literal('')),
  customerNumber: z.string().optional(),
  amount: z.preprocess(
    (val) => parseFloat(String(val).replace('₹', '')),
    z.number().nonnegative({ message: "Amount cannot be negative." })
  ),
});

export type BillingFormValues = z.infer<typeof billingSchema>;

export interface TransformedBillingData {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerNumber?: string;
  selectedServices: Array<{ id: string; name: string; price: number }>;
  amount: number;
  paymentStatus: 'Paid' | 'Credit';
}

interface BillingFormProps {
  onSubmit: (data: TransformedBillingData) => void;
  initialData?: Partial<BillingFormValues>;
  isSubmitting?: boolean;
}

export default function CreditBillingForm({ onSubmit, initialData, isSubmitting }: BillingFormProps) {
  const { toast } = useToast();
  const [isItemPopoverOpen, setIsItemPopoverOpen] = useState(false);
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  
  const [isCustomChargeDialogOpen, setIsCustomChargeDialogOpen] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  
  const [availableServices, setAvailableServices] = useState<ServiceType[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ProductType[]>([]);
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [errorLoadingItems, setErrorLoadingItems] = useState<string | null>(null);

  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
        ...initialData,
        amount: 0
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingItems(true);
      setErrorLoadingItems(null);
      try {
        const [servicesResult, productsResult, customersResult] = await Promise.all([
            getServices(),
            getProducts(),
            getCustomers(),
        ]);

        if (servicesResult.success && servicesResult.services) {
            setAvailableServices(servicesResult.services.sort((a, b) => a.price - b.price));
        } else {
            throw new Error(servicesResult.message || "Failed to load services.");
        }

        if (productsResult.success && productsResult.products) {
            const stockItems = productsResult.products.filter(p => p.itemType === 'Stock');
            setAvailableProducts(stockItems.sort((a, b) => a.price - b.price));
        } else {
            throw new Error(productsResult.message || "Failed to load products.");
        }
        
        if (customersResult.success && customersResult.customers) {
            setAvailableCustomers(customersResult.customers);
        } else {
            throw new Error(customersResult.message || "Failed to load customers.");
        }
        
      } catch (error: any) {
        const errorMessage = error.message || "An error occurred while fetching items.";
        setErrorLoadingItems(errorMessage);
        console.error('[BillingForm] Error fetching items:', error);
        toast({
          title: "Error Fetching Data",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoadingItems(false);
      }
    };
    fetchData();
  }, [toast]);
  
  const handleAddItemDirectly = (item: ServiceType | ProductType, type: 'service' | 'product' | 'custom') => {
    const newLineItem: LineItem = {
      ...item, 
      itemType: type,
      instanceId: `item-${new Date().getTime()}-${Math.random().toString(36).substring(7)}-${item.id}`,
    };
    setLineItems(prevItems => [...prevItems, newLineItem]);
  };

  const handleAddCustomCharge = (name: string, price: number) => {
    const customItem: BillableItem = {
      id: `custom-${new Date().getTime()}-${Math.random()}`,
      name: name,
      price: price,
      description: '',
      createdAt: new Date().toISOString(),
      itemType: 'custom',
      quantity: 1, // Custom charges have a quantity of 1
    };
    handleAddItemDirectly(customItem, 'custom');
  };

  const handleRemoveLineItem = (instanceIdToRemove: string) => {
    const itemToRemove = lineItems.find(item => item.instanceId === instanceIdToRemove);
    setLineItems(prevItems => prevItems.filter(item => item.instanceId !== instanceIdToRemove));
    if (itemToRemove) {
      toast({
        title: "Item Removed",
        description: `${itemToRemove.name} (₹${itemToRemove.price.toFixed(2)}) has been removed from the bill.`,
      });
    }
  };

  const handleCalculateAmount = () => {
    const totalServiceAmount = lineItems.reduce((sum, item) => sum + item.price, 0);
    
    if (lineItems.length === 0) {
      toast({
        title: "No Items Added",
        description: "Please add services or products to calculate the total.",
        variant: "default",
      });
      form.setValue("amount", 0, { shouldValidate: true });
      return;
    }

    form.setValue("amount", totalServiceAmount, { shouldValidate: true });
    toast({
      title: "Total Amount Calculated",
      description: `The displayed billing amount has been updated to ₹${totalServiceAmount.toFixed(2)}.`,
    });
  };

   const processAndTransformData = (formData: BillingFormValues, paymentStatus: 'Paid' | 'Credit'): TransformedBillingData | null => {
    if (lineItems.length === 0) {
      toast({
        title: "Items Required",
        description: "Please add at least one service or product.",
        variant: "destructive",
      });
      return null;
    }
     if (!formData.customerId) {
        toast({ title: "Customer Required", description: "Please select a registered customer.", variant: "destructive" });
        return null;
    }

    const servicesForInvoice = lineItems.map(item => ({ id: item.id, name: item.name, price: item.price }));
    
    const calculatedAmount = servicesForInvoice.reduce((sum, item) => sum + item.price, 0);
    form.setValue("amount", calculatedAmount, { shouldValidate: true });

    return {
      customerId: formData.customerId,
      customerName: formData.customerName,
      customerEmail: formData.customerEmail || "",
      customerNumber: formData.customerNumber,
      selectedServices: servicesForInvoice,
      amount: calculatedAmount,
      paymentStatus: paymentStatus,
    };
  };

  const internalFormSubmitHandler = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please select a customer.",
        variant: "destructive"
      });
      return;
    }

    const dataFromHookForm = form.getValues();
    const transformedData = processAndTransformData(dataFromHookForm, 'Credit');
    if (transformedData) {
      onSubmit(transformedData);
    }
  };


  const handleClearForm = () => {
    form.reset({ customerId: '', customerName: '', customerEmail: '', customerNumber: '', amount: 0 });
    setLineItems([]);
    toast({
      title: "Form Cleared",
      description: "All fields and added items have been reset.",
    });
  };


  return (
    <>
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Create Credit Invoice</CardTitle>
        <CardDescription>Select a registered customer, add items, and save the invoice as a credit transaction.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
          <CardContent className="space-y-6">
            {(errorLoadingItems || isLoadingItems) && (
              <div className="p-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-start gap-3">
                {isLoadingItems ? <LoadingSpinner size={20} className="text-white"/> : <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />}
                <div>
                  <p className="font-semibold">{isLoadingItems ? "Loading Data..." : "Failed to load data"}</p>
                  <p className="text-destructive-foreground/90 text-xs mt-1">{isLoadingItems ? "Please wait while services and products are loaded." : errorLoadingItems}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
                 <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-primary" />Select Customer</FormLabel>
                       <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                        <PopoverTrigger asChild>
                           <FormControl>
                            <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                                )}
                                disabled={isLoadingItems}
                            >
                                {field.value
                                ? availableCustomers.find(
                                    (customer) => customer.id === field.value
                                )?.fullName
                                : "Select a registered customer"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                           </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search customers..." />
                                <CommandList>
                                    <CommandEmpty>No customers found.</CommandEmpty>
                                    <CommandGroup>
                                        {availableCustomers.map((customer) => (
                                        <CommandItem
                                            value={customer.fullName}
                                            key={customer.id}
                                            onSelect={() => {
                                                form.setValue("customerId", customer.id);
                                                form.setValue("customerName", customer.fullName);
                                                form.setValue("customerEmail", customer.email);
                                                form.setValue("customerNumber", customer.phone);
                                                setIsCustomerPopoverOpen(false);
                                            }}
                                        >
                                            <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                customer.id === field.value
                                                ? "opacity-100"
                                                : "opacity-0"
                                            )}
                                            />
                                            {customer.fullName}
                                        </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>


            <FormItem className="flex flex-col">
              <FormLabel>Add Items to Bill</FormLabel>
              <Popover open={isItemPopoverOpen} onOpenChange={setIsItemPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isItemPopoverOpen}
                    className={cn(
                      "w-full sm:w-[500px] justify-between min-w-[200px]",
                      "text-muted-foreground"
                    )}
                    disabled={!!errorLoadingItems || isLoadingItems}
                  >
                    <span className="truncate max-w-[calc(100%-2rem)]">
                      Add a service, product, or charge...
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] sm:w-[500px] p-0">
                  <Command>
                    <CommandInput placeholder="Search items..." />
                    <CommandList>
                       {isLoadingItems ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          <LoadingSpinner size={20} className="inline mr-2" /> Loading...
                        </div>
                      ) : (
                        <>
                        <CommandGroup heading={<span className="flex items-center"><Settings className="mr-2 h-3.5 w-3.5"/>Services</span>}>
                          {availableServices.length > 0 ? availableServices.map((service) => (
                            <CommandItem
                              key={service.id}
                              value={`service-${service.name}`} 
                              onSelect={() => {
                                handleAddItemDirectly(service, 'service');
                              }}
                              className="cursor-pointer"
                            >
                              <span className="flex-1">{service.name}</span>
                              <span className="ml-3 text-xs text-muted-foreground">
                                ₹{service.price.toFixed(2)}
                              </span>
                            </CommandItem>
                          )) : (
                            <CommandEmpty>No services found.</CommandEmpty>
                          )}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading={<span className="flex items-center"><ShoppingCart className="mr-2 h-3.5 w-3.5"/>Products (Stock)</span>}>
                          {availableProducts.length > 0 ? availableProducts.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={`product-${product.name}`} 
                              onSelect={() => {
                                handleAddItemDirectly(product, 'product');
                              }}
                              className="cursor-pointer"
                            >
                              <span className="flex-1">{product.name}</span>
                               <span className="ml-2 text-xs text-muted-foreground">(Stock: {product.quantity})</span>
                              <span className="ml-3 text-xs text-muted-foreground">
                                ₹{product.price.toFixed(2)}
                              </span>
                            </CommandItem>
                          )) : (
                            <CommandEmpty>No stock items found.</CommandEmpty>
                          )}
                        </CommandGroup>
                        <CommandSeparator />
                         <CommandGroup>
                            <CommandItem
                            onSelect={() => {
                                setIsItemPopoverOpen(false);
                                setIsCustomChargeDialogOpen(true);
                            }}
                            className="cursor-pointer"
                            >
                            <PencilLine className="mr-2 h-4 w-4" />
                            <span>Add Custom Charge...</span>
                            </CommandItem>
                        </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormDescription>
                Select from predefined services/products or add a one-time charge.
              </FormDescription>
            </FormItem>

            {lineItems.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-md font-medium">Items Added to Bill:</h3>
                <ScrollArea className="h-[150px] w-full rounded-md border p-3">
                  <ul className="space-y-2">
                    {lineItems.map((item) => (
                      <li key={item.instanceId} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                        <div className="flex-1">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">(₹{item.price.toFixed(2)})</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLineItem(item.instanceId)}
                          className="text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
            
            <Separator />
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <Button type="button" variant="secondary" onClick={handleCalculateAmount} className="shadow-sm">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Displayed Total
              </Button>
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">Billing Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="₹0.00"
                      value={`₹${(typeof field.value === 'number' ? field.value : 0).toFixed(2)}`}
                      disabled
                      className="bg-muted/80 cursor-not-allowed font-bold text-lg"
                      readOnly 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-6 gap-4">
            <Button type="button" variant="ghost" onClick={handleClearForm} disabled={isSubmitting}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear Form
            </Button>
            <div className="flex gap-2">
                <Button 
                    type="button" 
                    onClick={internalFormSubmitHandler}
                    size="lg" 
                    variant="destructive"
                    disabled={isSubmitting || lineItems.length === 0}
                >
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Saving..." : "Save as Credit Invoice"}
                </Button>
            </div>
          </CardFooter>
        </form>
      </Form>
    </Card>

    <CustomChargeDialog
        isOpen={isCustomChargeDialogOpen}
        setIsOpen={setIsCustomChargeDialogOpen}
        onAddCharge={handleAddCustomCharge}
    />
    </>
  );
}
