
"use client";

import AppHeader from "@/components/AppHeader";
import LoginForm, { type LoginFormValues } from "@/components/LoginForm";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { signIn, user, userProfile, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // This effect handles redirection AFTER user state and profile state are resolved.
    if (!authLoading && user) {
      if (isAdmin) {
        router.push('/admin');
      } else if (userProfile) {
         if (userProfile.status === 'approved') {
            router.push('/');
         } else {
            // For 'pending_approval' or 'rejected', they will be handled by the main page component.
            // We can just send them to the homepage and it will display the correct status.
            router.push('/');
         }
      }
      // If user exists but userProfile is still loading or null, the authLoading flag in `useAuth`
      // should still be true, so this effect won't run prematurely. If it does,
      // the main page will handle the 'complete profile' case.
    }
  }, [user, userProfile, authLoading, isAdmin, router]);


  const handleLogin = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await signIn(data);
      // Redirection is now handled by the useEffect above.
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
    } catch (error: any) {
      let errorMessage = "An unexpected error occurred. Please try again.";
      // Check for common, expected user credential errors and handle them gracefully without a console log.
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect email or password. Please check your credentials and try again.";
      } else {
        // For any other unexpected errors, we still log them for debugging.
        console.error("Login failed:", error);
        if (error.message) {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Login Failed",
        description: errorMessage,
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
        <p className="mt-4 text-lg text-foreground">Loading Login Page...</p>
      </div>
    );
  }
  
  if (user) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size={48}/>
        <p className="mt-4 text-lg text-foreground">Redirecting...</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
      <AppHeader />
      <main className="flex-grow flex flex-col items-center justify-center p-4">
        <LoginForm onLogin={handleLogin} isLoading={isLoading} />
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} Rising Sun Computers. All rights reserved.
      </footer>
    </div>
  );
}
