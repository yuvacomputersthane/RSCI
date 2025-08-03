
'use server';

import { auth, db, adminSDKInitializationError } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { UserProfile, PermissionModule } from '@/types/user';
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters."),
  confirmPassword: z.string().min(6),
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  role: z.enum(['admin', 'user'], { required_error: "User role is required."}),
  monthlySalary: z.number().nonnegative({ message: "Monthly salary must be a non-negative number." }).optional(),
  franchiseId: z.string().optional(),
  franchiseName: z.string().optional(),
  modulePermissions: z.array(z.string()).optional(),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});


export interface CreateUserResult {
  success: boolean;
  message: string;
  userId?: string;
}

export async function createUserInFirebase(data: z.infer<typeof CreateUserSchema>): Promise<CreateUserResult> {
  console.log(`Attempting to create user: ${data.email}`);

  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }

  const validation = CreateUserSchema.safeParse(data);
  if (!validation.success) {
      const firstError = Object.values(validation.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, message: firstError || "Invalid data provided." };
  }

  const { email, password, fullName, role, monthlySalary, franchiseId, franchiseName, modulePermissions } = validation.data;

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: false, // User is created, but email itself is not verified yet.
    });

    // Automatically create a corresponding user profile in Firestore with 'approved' status
    const userProfileRef = db.collection('users').doc(userRecord.uid);
    await userProfileRef.set({
      email: userRecord.email,
      fullName: fullName,
      role: role,
      monthlySalary: monthlySalary || 0,
      franchiseId: franchiseId || 'head_branch',
      franchiseName: franchiseName || 'Head Branch',
      status: 'approved', // Automatically approved since an admin is creating it
      profileCreatedAt: Timestamp.now(),
      profileStatusUpdatedAt: Timestamp.now(),
      modulePermissions: modulePermissions || [],
    });

    return { success: true, message: 'User created successfully and profile has been approved!', userId: userRecord.uid };
  } catch (error: any) {
    console.error('Firebase Admin createUser error:', error);
    
    if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        return {
            success: false,
            message: `User may have been created in Auth, but a Firestore permission error occurred. The service account does not have permission to create user profiles. **FIX: Grant the 'Cloud Datastore User' role to your service account in the Google Cloud Console -> IAM.**`,
        };
    }

    let errorMessage = 'Failed to create user in Firebase.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = `The email address ${email} is already in use by another account.`;
    } else if (error.code === 'auth/invalid-password') {
      errorMessage = 'The password must be a string with at least six characters.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage };
  }
}

export interface FirebaseUserListItem {
  uid: string;
  email: string | undefined;
  creationTime: string;
  lastSignInTime: string;
  emailVerified: boolean;
  disabled: boolean;
  firestoreStatus?: 'pending_approval' | 'approved' | 'rejected' | string;
  profileData?: UserProfile;
}

export interface GetUsersResult {
  success: boolean;
  users?: FirebaseUserListItem[];
  totalUserCount?: number;
  message?: string;
}

export async function getFirebaseUsers(maxResults: number = 1000): Promise<GetUsersResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  
  try {
    // Step 1: Fetch all user profiles from Firestore and create a map for efficient lookup.
    const userProfilesSnapshot = await db.collection('users').get();
    const userProfilesMap = new Map<string, {
        firestoreStatus?: FirebaseUserListItem['firestoreStatus'];
        profileData?: FirebaseUserListItem['profileData'];
    }>();

    userProfilesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.profileCreatedAt instanceof Timestamp) {
          data.profileCreatedAt = data.profileCreatedAt.toDate().toISOString();
        }
        if (data.profileStatusUpdatedAt instanceof Timestamp) {
          data.profileStatusUpdatedAt = data.profileStatusUpdatedAt.toDate().toISOString();
        }
        if (data.dateOfBirth instanceof Timestamp) {
            data.dateOfBirth = data.dateOfBirth.toDate().toISOString();
        }
        
        userProfilesMap.set(doc.id, {
            firestoreStatus: data?.status,
            profileData: data as UserProfile,
        });
    });

    // Step 2: Fetch all users from Firebase Auth.
    const listUsersResult = await auth.listUsers(maxResults);
    
    // Step 3: Combine Auth data with Firestore data using the map (N+1 problem solved).
    const combinedUsers = listUsersResult.users.map(userRecord => {
        const profileInfo = userProfilesMap.get(userRecord.uid) || {};
        return {
          uid: userRecord.uid,
          email: userRecord.email,
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
          emailVerified: userRecord.emailVerified,
          disabled: userRecord.disabled,
          firestoreStatus: profileInfo.firestoreStatus,
          profileData: profileInfo.profileData,
        };
    });
    
    return { success: true, users: combinedUsers, totalUserCount: combinedUsers.length };
  } catch (error: any) {
    console.error('Firebase Admin listUsers or Firestore fetch error:', error);
    if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        return {
            success: false,
            message: `Firestore permission denied. This is the most common error. The service account used by the server does not have permission to read user profiles from Firestore. **FIX: Grant the 'Cloud Datastore User' role to your service account in the Google Cloud Console -> IAM.** It may take a minute to apply.`,
        };
    }
    if (error.code === 5 || (error.message && error.message.includes('NOT_FOUND'))) {
        return {
            success: false,
            message: `Firestore query failed (NOT_FOUND). This usually means the Firestore database has not been created or is not in the correct location for this project. Please go to the Firebase Console, select your project, go to the "Firestore Database" section, and ensure a database has been created.`,
        };
    }
    return { success: false, message: error.message || 'Failed to fetch users or profile data.' };
  }
}

export interface UserActionResult {
  success: boolean;
  message: string;
}

export async function deleteFirebaseUser(uid: string): Promise<UserActionResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  if (uid === process.env.NEXT_PUBLIC_MASTER_USER_UID) {
    return { success: false, message: "The master user account cannot be deleted." };
  }

  try {
    await auth.deleteUser(uid);
    try {
      await db.collection('users').doc(uid).delete();
    } catch (firestoreError: any) {
       console.warn(`User ${uid} Auth account deleted, but failed to delete Firestore document: ${firestoreError.message}`);
       if (firestoreError.code === 7 || (firestoreError.message && firestoreError.message.includes('PERMISSION_DENIED'))) {
            return { success: true, message: `User Auth account deleted, but the Firestore profile could not be removed due to a permission error. Please grant 'Cloud Datastore User' role and remove the document manually.` };
       }
    }
    return { success: true, message: 'User Auth account and profile data deleted successfully.' };
  } catch (error: any) {
    console.error('Firebase Admin deleteUser error:', error);
    return { success: false, message: error.message || 'Failed to delete user.' };
  }
}

export async function toggleUserDisabledStatus(uid: string, currentDisabledStatus: boolean): Promise<UserActionResult & { newDisabledStatus?: boolean }> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  
  if (uid === process.env.NEXT_PUBLIC_MASTER_USER_UID && !currentDisabledStatus) {
    return { success: false, message: "The master user account cannot be disabled." };
  }

  const newDisabledStatus = !currentDisabledStatus;
  try {
    await auth.updateUser(uid, {
      disabled: newDisabledStatus,
    });
    return { success: true, message: `User account ${newDisabledStatus ? 'disabled' : 'enabled'} successfully.`, newDisabledStatus };
  } catch (error: any) {
    console.error('Firebase Admin updateUser (disabled status) error:', error);
    return { success: false, message: error.message || 'Failed to update user status.' };
  }
}

export async function updateUserProfileStatus(userId: string, newStatus: 'approved' | 'rejected'): Promise<UserActionResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      return { success: false, message: `User profile document not found for user ID ${userId}. Cannot update status.`};
    }
    
    await userDocRef.update({
      status: newStatus,
      profileStatusUpdatedAt: Timestamp.now(), 
    });
    
    if (newStatus === 'approved') {
        const userAuthRecord = await auth.getUser(userId);
        if (userAuthRecord.disabled) {
           await auth.updateUser(userId, { disabled: false });
           console.log(`User Auth account for ${userId} has been enabled upon profile approval.`);
        }
    } else if (newStatus === 'rejected') {
       if (userId !== process.env.NEXT_PUBLIC_MASTER_USER_UID) {
         await auth.updateUser(userId, { disabled: true });
         console.log(`User Auth account for ${userId} has been disabled upon profile rejection.`);
       }
    }

    return { success: true, message: `User profile status updated to ${newStatus}.` };
  } catch (error: any)
  {
    console.error(`Error updating profile status for user ${userId} to ${newStatus}:`, error);
    if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        return {
            success: false,
            message: `Firestore permission denied. This is the most common error. The service account used by the server does not have permission to update Firestore documents. **FIX: Go to the Google Cloud Console -> IAM, find your service account (e.g., 'firebase-adminsdk-...'), and grant it the 'Cloud Datastore User' role.** It may take a minute to apply.`,
        };
    }
     if (error.code === 5 || (error.message && error.message.includes('NOT_FOUND'))) {
        return {
            success: false,
            message: `Firestore query failed (NOT_FOUND). This usually means the Firestore database has not been created or is not in the correct location for this project. Please go to the Firebase Console, select your project, go to the "Firestore Database" section, and ensure a database has been created.`,
        };
    }
    return { success: false, message: (error as Error).message || `Failed to update profile status.` };
  }
}


export interface UpdateUserDataResult {
  success: boolean;
  message: string;
}

export async function updateUserData(userId: string, data: { fullName?: string; monthlySalary?: number, franchiseId?: string, franchiseName?: string, role?: 'admin' | 'user', modulePermissions?: string[] }): Promise<UpdateUserDataResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }

  const { fullName, monthlySalary, franchiseId, franchiseName, role, modulePermissions } = data;

  if (!userId) {
      return { success: false, message: "User ID is required." };
  }
  
  const dataToUpdate: { [key: string]: any } = {};

  if (fullName) {
      if (fullName.length < 2) return { success: false, message: "Full name must be at least 2 characters." };
      dataToUpdate.fullName = fullName;
  }

  if (typeof monthlySalary !== 'undefined') {
      if (isNaN(monthlySalary) || monthlySalary < 0) return { success: false, message: "Monthly salary must be a non-negative number."};
      dataToUpdate.monthlySalary = monthlySalary;
  }
  
  if (typeof franchiseId !== 'undefined' && typeof franchiseName !== 'undefined') {
      dataToUpdate.franchiseId = franchiseId;
      dataToUpdate.franchiseName = franchiseName;
  }
  
  if (role) {
    dataToUpdate.role = role;
  }

  if (modulePermissions) {
    dataToUpdate.modulePermissions = modulePermissions;
  }


  if (Object.keys(dataToUpdate).length === 0) {
      return { success: false, message: "No data provided to update." };
  }

  try {
    // Update Auth displayName if fullName is provided
    if (fullName) {
      await auth.updateUser(userId, {
        displayName: fullName
      });
    }

    // Update Firestore user document
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (userDoc.exists) {
        await userDocRef.update(dataToUpdate);
    } else {
        await userDocRef.set(dataToUpdate, { merge: true }); // Create if doesn't exist
        console.warn(`Firestore document for user ${userId} not found, creating a new one.`);
    }

    return { success: true, message: "User profile updated successfully." };

  } catch (error: any) {
    console.error(`Error updating data for user ${userId}:`, error);
     if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        return {
            success: false,
            message: `Firestore or Auth permission denied. The service account may not have permission to update user profiles or Auth records. **FIX: Grant the 'Cloud Datastore User' and 'Firebase Authentication Admin' roles to your service account in the Google Cloud Console -> IAM.**`,
        };
    }
    if (error.code === 'auth/user-not-found') {
      return { success: false, message: `User with ID ${userId} not found in Firebase Auth.` };
    }
    return { success: false, message: `Failed to update user data: ${error.message || 'Unknown error'}` };
  }
}


export interface GetUserProfileResult {
  success: boolean;
  profile?: UserProfile;
  message?: string;
}

export async function getUserProfile(userId: string): Promise<GetUserProfileResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  if (!userId) {
    return { success: false, message: 'User ID is required.' };
  }

  try {
    const profileRef = db.collection('users').doc(userId);
    const profileSnap = await profileRef.get();

    if (profileSnap.exists) {
      const profileData = profileSnap.data();
      
      if (profileData) {
        // Convert any Timestamp fields to ISO strings for serialization
        const serializableProfileData = { ...profileData };
        for (const key in serializableProfileData) {
          if (serializableProfileData[key] instanceof Timestamp) {
            serializableProfileData[key] = (serializableProfileData[key] as Timestamp).toDate().toISOString();
          }
        }
        return { success: true, profile: serializableProfileData as UserProfile };
      }
      return { success: true, profile: undefined }; // Should not happen if doc exists
    } else {
      // This is not an error, the profile just doesn't exist yet for new users.
      return { success: true, profile: undefined };
    }
  } catch (error: any) {
    console.error(`Error fetching profile for user ${userId}:`, error);
     if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        return {
            success: false,
            message: `Firestore permission denied. The service account does not have permission to read user profiles. **FIX: Grant the 'Cloud Datastore User' role to your service account in the Google Cloud Console -> IAM.**`,
        };
    }
    return { success: false, message: `Failed to fetch user profile: ${error.message}` };
  }
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<UserActionResult> {
    if (adminSDKInitializationError) {
        return { success: false, message: adminSDKInitializationError };
    }
    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters long.' };
    }

    try {
        await auth.updateUser(userId, {
            password: newPassword,
        });
        return { success: true, message: 'User password updated successfully.' };
    } catch (error: any) {
        console.error(`Error updating password for user ${userId}:`, error);
        if (error.code === 'auth/user-not-found') {
            return { success: false, message: `User with ID ${userId} not found in Firebase Auth.` };
        }
        return { success: false, message: `Failed to update password: ${error.message || 'Unknown error'}` };
    }
}
