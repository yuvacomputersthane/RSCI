
'use server';

import { z } from 'zod';
import { db, auth, storage, adminSDKInitializationError } from '@/lib/firebase-admin'; 
import { Timestamp } from 'firebase-admin/firestore';

const MAX_FILE_SIZE_SERVER = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES_SERVER_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,/;


// This schema should now reflect all fields that can be saved to the user's Firestore profile.
const userProfileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  dateOfBirth: z.date({
    required_error: "Date of birth is required.",
    invalid_type_error: "That's not a valid date!",
  }),
  mobileNumber: z.string().min(10, "Mobile number must be at least 10 digits.")
                   .regex(/^\+?[1-9]\d{1,14}$/, "Invalid mobile number format."),
  address: z.string().optional(),
  city: z.string().optional(),
  photoDataUri: z.string().optional()
    .refine(
      (dataUri) => !dataUri || (dataUri.length < MAX_FILE_SIZE_SERVER * 1.4 && ACCEPTED_IMAGE_TYPES_SERVER_REGEX.test(dataUri)), // Approx check for base64 size, and MIME type
      { message: "Invalid image format or size (max 2MB, JPG, PNG, WEBP)." }
    ),
});


export interface UserProfileData {
  fullName: string;
  dateOfBirth: Date;
  mobileNumber: string;
  address?: string;
  city?: string;
  photoDataUri?: string;
}


export interface SubmitProfileResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
}

export async function submitProfileDetails(
  userId: string,
  data: UserProfileData 
): Promise<SubmitProfileResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }

  console.log("Received profile data on server for user:", userId, { ...data, photoDataUri: data.photoDataUri ? data.photoDataUri.substring(0, 50) + "..." : "No photo" });

  if (!userId) {
    return {
      success: false,
      message: "User ID is missing. Cannot submit profile.",
    };
  }

  const profileDataToValidate = {
    fullName: data.fullName,
    dateOfBirth: data.dateOfBirth,
    mobileNumber: data.mobileNumber,
    address: data.address,
    city: data.city,
    photoDataUri: data.photoDataUri,
  };

  const validationResult = userProfileSchema.safeParse(profileDataToValidate);

  if (!validationResult.success) {
    console.error("Server-side validation failed for profile details:", validationResult.error.issues);
    return {
      success: false,
      message: "Invalid profile data submitted. Please check your inputs. " + (validationResult.error.flatten().fieldErrors.photoDataUri?.[0] || validationResult.error.issues.map(i => i.message).join(' ')),
      errors: validationResult.error.issues,
    };
  }

  try {
    const userProfileRef = db.collection('users').doc(userId);
    
    const { photoDataUri, ...profileDetailsToSave } = validationResult.data;

    const dataToSave: any = {
      ...profileDetailsToSave,
      userId: userId,
      status: 'pending_approval',
      profileCreatedAt: Timestamp.now(),
      profileStatusUpdatedAt: Timestamp.now(),
      photoURL: null, // Default to null
    };

    let publicPhotoUrl: string | null = null;

    if (photoDataUri) {
      console.log("Uploading photo to Firebase Storage for user:", userId);
      const bucket = storage.bucket();
      const mimeType = photoDataUri.match(/data:(.*);base64,/)?.[1] || 'image/png';
      const fileExtension = mimeType.split('/')[1] || 'png';
      const base64EncodedImageString = photoDataUri.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64EncodedImageString, 'base64');
      
      const filePath = `profile-pictures/${userId}.${fileExtension}`;
      const file = bucket.file(filePath);

      await file.save(imageBuffer, {
        metadata: { contentType: mimeType },
        public: true,
      });
      
      publicPhotoUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      dataToSave.photoURL = publicPhotoUrl;
      console.log("Photo uploaded successfully. Public URL:", publicPhotoUrl);
    }
    
    // Update Firebase Auth record with photoURL and displayName
    await auth.updateUser(userId, {
        displayName: dataToSave.fullName,
        ...(publicPhotoUrl && { photoURL: publicPhotoUrl }),
    });
    console.log("Firebase Auth user record updated with displayName and photoURL.");


    if (typeof dataToSave.address === 'undefined') {
      delete dataToSave.address;
    }
    if (typeof dataToSave.city === 'undefined') {
      delete dataToSave.city;
    }


    await userProfileRef.set(dataToSave, { merge: true });

    console.log("Profile data saved to Firestore for user:", userId);
    return {
      success: true,
      message: "Profile submitted successfully for review. An admin will approve your account. You will be logged out shortly.",
    };
  } catch (error: any) {
    console.error("Error saving profile data to Firestore/Storage:", error);
    if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        return {
            success: false,
            message: `Storage or Firestore permission denied. The service account needs 'Storage Object Admin' role for uploads and 'Cloud Datastore User' for database writes. **FIX: Check both roles in the Google Cloud Console -> IAM for your service account (e.g., 'firebase-adminsdk-...').**`,
        };
    }
    if (error.code === 5 || (error.message && error.message.includes('NOT_FOUND'))) {
        return {
            success: false,
            message: `Firestore query failed (NOT_FOUND). This usually means the Firestore database has not been created or is not in the correct location for this project. Please go to the Firebase Console, select your project, go to the "Firestore Database" section, and ensure a database has been created.`,
        };
    }
    return {
      success: false,
      message: `Failed to submit profile: ${error.message || "Please try again."}`,
    };
  }
}
