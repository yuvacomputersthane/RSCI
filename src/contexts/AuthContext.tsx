
"use client";

import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useCallback,
} from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import type { LoginFormValues } from '@/components/LoginForm';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { UserProfile } from '@/types/user';
import { getUserProfile } from '@/app/admin/users/actions';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  isMasterUser: boolean;
  loading: boolean;
  signIn: (data: LoginFormValues) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOGIN_TIMESTAMP_KEY = 'risingSunLoginTimestamp';
const SESSION_DURATION_HOURS = 3;
const SESSION_DURATION_MS = SESSION_DURATION_HOURS * 60 * 60 * 1000; // 3 hours in milliseconds
const PERIODIC_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isMasterUser, setIsMasterUser] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const performSignOut = useCallback(async (isSessionExpired = false) => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem(LOGIN_TIMESTAMP_KEY);
      // State reset (user, userProfile, isMasterUser) is handled by onAuthStateChanged
      if (isSessionExpired) {
        console.log("Session expired. Signing out.");
      }
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  }, [router]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const loginTimestampStr = localStorage.getItem(LOGIN_TIMESTAMP_KEY);
        if (loginTimestampStr) {
          const loginTime = parseInt(loginTimestampStr, 10);
          const currentTime = new Date().getTime();
          if (currentTime - loginTime > SESSION_DURATION_MS) {
            await performSignOut(true);
            return;
          }
        } else {
          localStorage.setItem(LOGIN_TIMESTAMP_KEY, new Date().getTime().toString());
        }

        setUser(firebaseUser);
        const masterUid = process.env.NEXT_PUBLIC_MASTER_USER_UID;
        setIsMasterUser(!!(masterUid && firebaseUser.uid === masterUid));
        
        // Fetch user profile using server action
        const profileResult = await getUserProfile(firebaseUser.uid);
        if (profileResult.success) {
            setUserProfile(profileResult.profile || null);
        } else {
            console.error("Error fetching user profile:", profileResult.message);
            setUserProfile(null);
        }
        
        setLoading(false); // Set loading to false only after profile is fetched
      } else {
        setUser(null);
        setUserProfile(null);
        setIsMasterUser(false);
        localStorage.removeItem(LOGIN_TIMESTAMP_KEY);
        setLoading(false); // Also set loading to false for the logged-out state
      }
    });

    return () => unsubscribe();
  }, [performSignOut]);

  // Periodic check for session expiry
  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(() => {
      const loginTimestampStr = localStorage.getItem(LOGIN_TIMESTAMP_KEY);
      if (loginTimestampStr) {
        const loginTime = parseInt(loginTimestampStr, 10);
        const currentTime = new Date().getTime();
        if (currentTime - loginTime > SESSION_DURATION_MS) {
          performSignOut(true);
        }
      } else {
        performSignOut(true);
      }
    }, PERIODIC_CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [user, performSignOut]);


  const signIn = useCallback(async (data: LoginFormValues) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      localStorage.setItem(LOGIN_TIMESTAMP_KEY, new Date().getTime().toString());
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, []);
  
  if (loading && !user) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="mt-4 text-lg text-foreground">Authenticating...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, isMasterUser, loading, signIn, signOut: performSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
