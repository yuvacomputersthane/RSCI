
'use server';
/**
 * @fileOverview AI agent for simulating OTP sending and verification.
 *
 * - sendOtp - Simulates sending an OTP to a phone number.
 * - verifyOtp - Simulates verifying an OTP.
 * - OtpRequest - Input type for sendOtp.
 * - OtpResponse - Output type for sendOtp.
 * - VerifyOtpRequest - Input type for verifyOtp.
 * - VerifyOtpResponse - Output type for verifyOtp.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db, adminSDKInitializationError } from '@/lib/firebase-admin'; // Import firestore
import { Timestamp } from 'firebase-admin/firestore'; // Import Timestamp

const OTP_COLLECTION = 'otp_requests';
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const OtpRequestSchema = z.object({
  phoneNumber: z.string().min(10, { message: "Phone number must be at least 10 digits." })
    .regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid mobile number format."}),
});
export type OtpRequest = z.infer<typeof OtpRequestSchema>;

const OtpResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  otp: z.string().optional().describe("The generated OTP, returned for development/testing purposes."),
});
export type OtpResponse = z.infer<typeof OtpResponseSchema>;

const VerifyOtpRequestSchema = z.object({
  phoneNumber: z.string().min(10, { message: "Phone number must be at least 10 digits." })
    .regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid mobile number format."}),
  otp: z.string().length(6, { message: "OTP must be 6 digits." }),
});
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;

const VerifyOtpResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;


export async function sendOtp(input: OtpRequest): Promise<OtpResponse> {
  return sendOtpFlow(input);
}

export async function verifyOtp(input: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  return verifyOtpFlow(input);
}

const sendOtpFlow = ai.defineFlow(
  {
    name: 'sendOtpFlow',
    inputSchema: OtpRequestSchema,
    outputSchema: OtpResponseSchema,
  },
  async (input) => {
    if (adminSDKInitializationError) {
      return { success: false, message: adminSDKInitializationError };
    }
    
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
      const otpDocRef = db.collection(OTP_COLLECTION).doc(input.phoneNumber);
      await otpDocRef.set({
        otp: generatedOtp,
        createdAt: Timestamp.now(),
      });

      // Log the OTP to the server console FOR DEVELOPMENT/TESTING PURPOSES ONLY
      console.log(`[SIMULATED OTP] For phoneNumber ${input.phoneNumber}: ${generatedOtp}`);

      return {
        success: true,
        message: `An OTP has been sent to ${input.phoneNumber}. It is displayed in the app for testing.`,
        otp: generatedOtp,
      };
    } catch (error: any) {
        console.error('Error saving OTP to Firestore:', error);
        if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
          return {
              success: false,
              message: `Firestore permission denied. The service account used by the server does not have permission to write to the OTP collection. **FIX: Go to the Google Cloud Console -> IAM, find your service account (e.g., 'firebase-adminsdk-...'), and grant it the 'Cloud Datastore User' role.**`,
          };
      }
        return {
            success: false,
            message: `Failed to process OTP request: ${error.message || 'Unknown Firestore error'}`,
        };
    }
  }
);

const verifyOtpFlow = ai.defineFlow(
  {
    name: 'verifyOtpFlow',
    inputSchema: VerifyOtpRequestSchema,
    outputSchema: VerifyOtpResponseSchema,
  },
  async (input) => {
     if (adminSDKInitializationError) {
      return { success: false, message: adminSDKInitializationError };
    }
    
    try {
        const otpDocRef = db.collection(OTP_COLLECTION).doc(input.phoneNumber);
        const otpDoc = await otpDocRef.get();

        if (!otpDoc.exists) {
            return { success: false, message: 'No OTP found. Please request a new one.' };
        }

        const data = otpDoc.data()!;
        const createdAt = (data.createdAt as Timestamp).toDate();

        if (new Date().getTime() - createdAt.getTime() > OTP_EXPIRY_MS) {
            await otpDocRef.delete(); // Clean up expired OTP
            return { success: false, message: 'OTP has expired. Please request a new one.' };
        }

        if (data.otp === input.otp) {
            await otpDocRef.delete(); // OTP verified, remove it
            return { success: true, message: 'Mobile number verified successfully.' };
        } else {
            return { success: false, message: 'Invalid OTP. Please try again.' };
        }

    } catch (error: any) {
        console.error('Error verifying OTP from Firestore:', error);
         if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
          return {
              success: false,
              message: `Firestore permission denied. The service account used by the server does not have permission to read/delete from the OTP collection. **FIX: Go to the Google Cloud Console -> IAM, find your service account (e.g., 'firebase-adminsdk-...'), and grant it the 'Cloud Datastore User' role.**`,
          };
      }
        return {
            success: false,
            message: `Failed to verify OTP: ${error.message || 'Unknown Firestore error'}`,
        };
    }
  }
);
