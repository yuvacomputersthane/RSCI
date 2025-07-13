
"use client";

import AppHeader from "@/components/AppHeader";
import ProfileCompletionForm, { type ProfileCompletionFormValues } from "@/components/ProfileCompletionForm";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { submitProfileDetails, type SubmitProfileResult } from "./actions";
import { auth } from "@/lib/firebase";

export default function CompleteProfilePage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !authLoading && !user) {
      router.push('/login');
    }
    // If a user has an approved profile, they shouldn't be on this page.
    if (userProfile?.status === 'approved') {
        toast({ title: "Profile Already Complete", description: "Redirecting you to the homepage."});
        router.push('/');
    }

  }, [user, userProfile, authLoading, router, mounted, toast]);

  const handleSubmitProfile = async (data: ProfileCompletionFormValues) => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      toast({
        title: "Authentication Error",
        description: "You are no longer logged in. Please log in again to submit your profile.",
        variant: "destructive",
      });
      router.push('/login');
      return;
    }

    setIsLoading(true);
    try {
      // The full name from this form should be the definitive one.
      // We pass the UID and the complete profile data to the server action.
      const result: SubmitProfileResult = await submitProfileDetails(currentUser.uid, {
        ...data,
        fullName: data.fullName // Ensure fullName is passed
      });

      if (result.success) {
        toast({
          title: "Profile Submitted!",
          description: result.message,
          duration: 5000, 
        });
        setTimeout(async () => {
          await signOut(); 
        }, 4500); 
      } else {
        toast({
          title: "Submission Failed",
          description: result.message || "Please check the form for errors.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Profile submission error:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted || authLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="mt-4 text-lg text-foreground">Loading Profile Completion...</p>
      </div>
    );
  }

  if (!user) {
     return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="mt-4 text-lg text-foreground">Redirecting...</p>
      </div>
    );
  }
  
  // Pass the user's display name from Auth as the initial value for the full name field.
  const initialFormValues = {
    fullName: user.displayName || "",
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
      <AppHeader />
      <main className="flex-grow flex flex-col items-center justify-center p-4">
        <ProfileCompletionForm 
            onSubmit={handleSubmitProfile} 
            isLoading={isLoading}
            initialData={initialFormValues}
        />
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} Rising Sun Computers. All rights reserved.
      </footer>
    </div>
  );
}
