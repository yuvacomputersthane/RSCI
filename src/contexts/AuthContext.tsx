
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
import type { UserProfile, PermissionModule } from '@/types/user';
import { getUserProfile } from '@/app/admin/users/actions';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (data: LoginFormValues) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: PermissionModule) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOGIN_TIMESTAMP_KEY = 'risingSunLoginTimestamp';
const SESSION_DURATION_HOURS = 3;
const SESSION_DURATION_MS = SESSION_DURATION_HOURS * 60 * 60 * 1000; // 3 hours in milliseconds
const PERIODIC_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const performSignOut = useCallback(async (isSessionExpired = false) => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem(LOGIN_TIMESTAMP_KEY);
      // State reset (user, userProfile, isAdmin) is handled by onAuthStateChanged
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
        
        // Fetch user profile using server action
        const profileResult = await getUserProfile(firebaseUser.uid);
        if (profileResult.success) {
            const profile = profileResult.profile || null;
            if (profile) {
              profile.userId = firebaseUser.uid; // Manually add uid to profile object
            }
            setUserProfile(profile);
            // Master user is always an admin, OR check the role from the profile
            const masterUid = process.env.NEXT_PUBLIC_MASTER_USER_UID;
            const isMaster = !!(masterUid && firebaseUser.uid === masterUid);
            setIsAdmin(isMaster || profile?.role === 'admin');
        } else {
            console.error("Error fetching user profile:", profileResult.message);
            setUserProfile(null);
            setIsAdmin(false);
        }
        
        setLoading(false); // Set loading to false only after profile is fetched
      } else {
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
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
      // No need to set loading to false here, onAuthStateChanged will handle it.
      // A successful login will trigger onAuthStateChanged, which sets loading to false.
    } catch (error) {
      setLoading(false); // Set loading to false on a failed login attempt.
      // Re-throw the error so the UI component (login page) can catch it and display a message.
      throw error;
    }
  }, []);

  const hasPermission = useCallback((permission: PermissionModule): boolean => {
    if (!userProfile || !isAdmin) return false;

    // Master user and legacy admins (without specific permissions set) have all permissions.
    const masterUid = process.env.NEXT_PUBLIC_MASTER_USER_UID;
    const isMaster = !!(masterUid && userProfile.userId === masterUid);
    if (isMaster || !userProfile.modulePermissions) {
      return true;
    }
    
    return userProfile.modulePermissions.includes(permission);
  }, [userProfile, isAdmin]);
  
  if (loading && !user) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="mt-4 text-lg text-foreground">Authenticating...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, isAdmin, loading, signIn, signOut: performSignOut, hasPermission }}>
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
