
"use client";

import AppHeader from "@/components/AppHeader";
import RegisterForm, { type RegisterFormValues } from "@/components/RegisterForm";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleRegister = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      // Step 1: Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        // Step 2: Update the new user's Auth profile with their full name.
        // The rest of the profile data will be collected on the complete-profile page.
        await updateProfile(firebaseUser, {
          displayName: data.fullName
        });

        toast({
            title: "Account Created!",
            description: "Please log in to complete your profile.",
            duration: 5000,
        });
        router.push('/login');
        
      } else {
        throw new Error("User creation failed, no user object returned.");
      }

    } catch (error: any) {
      console.error("Registration failed:", error);
      let errorMessage = "An unexpected error occurred during registration.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email address is already in use by another account.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. Please choose a stronger password.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!mounted || authLoading || user) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="mt-4 text-lg text-foreground">Loading Registration Page...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
      <AppHeader />
      <main className="flex-grow flex flex-col items-center justify-center p-4">
        <RegisterForm onRegister={handleRegister} isLoading={isLoading} />
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} Rising Sun Computers. All rights reserved.
      </footer>
    </div>
  );
}
