
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import LoadingSpinner from '@/components/LoadingSpinner';
import { getCompanyProfile, updateCompanyProfile, type CompanyProfileFormData } from './actions';
import { Building, Save, Mail, Phone, MapPin, Hash } from 'lucide-react';

const profileSchema = z.object({
  companyName: z.string().min(2, "Company name is required."),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email format.").optional().or(z.literal('')),
  taxId: z.string().optional(),
});

export default function CompanyProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<CompanyProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      companyName: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      phone: "",
      email: "",
      taxId: "",
    },
  });

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    const result = await getCompanyProfile();
    if (result.success && result.profile) {
      form.reset(result.profile);
    } else if (!result.success) {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [form, toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);
  
  const onSubmit = async (data: CompanyProfileFormData) => {
    setIsSaving(true);
    const result = await updateCompanyProfile(data);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      fetchProfile();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size={32} />
        <p className="ml-2 text-muted-foreground">Loading company profile...</p>
      </div>
    );
  }

  return (
    <Card className="shadow-md max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <Building className="mr-3 h-6 w-6 text-primary" /> Company Profile
        </CardTitle>
        <CardDescription>
          Manage your company's details for invoices and other official documents. This information is stored securely in Firestore.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl><Input placeholder="Rising Sun Computers Inc." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Mail className="h-4 w-4 mr-2 text-muted-foreground"/>Contact Email</FormLabel>
                    <FormControl><Input type="email" placeholder="contact@risingsun.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Phone className="h-4 w-4 mr-2 text-muted-foreground"/>Contact Phone</FormLabel>
                    <FormControl><Input placeholder="+91 11 4123 4567" {...field} /></FormControl>
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
                    <FormLabel className="flex items-center"><MapPin className="h-4 w-4 mr-2 text-muted-foreground"/>Street Address</FormLabel>
                    <FormControl><Input placeholder="123 Nehru Place" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    <FormLabel>State / Province</FormLabel>
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
                    <FormLabel>ZIP / Postal Code</FormLabel>
                    <FormControl><Input placeholder="110019" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Hash className="h-4 w-4 mr-2 text-muted-foreground"/>Tax ID (e.g., GSTIN)</FormLabel>
                  <FormControl><Input placeholder="07AAPCS1234A1Z5" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoadingSpinner size={16} className="mr-2"/> : <Save className="mr-2 h-4 w-4"/>}
                {isSaving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
