
'use server';

import { z } from 'zod';
import { db, adminSDKInitializationError } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { AttendanceRecord } from '@/types/attendance';
import { formatDistance } from 'date-fns';

const LocationSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
});

// --- ACTIONS ---

export async function clockInOnServer(userId: string, userName: string, location: { latitude: number, longitude: number }): Promise<{ success: boolean; message: string; record?: AttendanceRecord }> {
    if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

    try {
        // Check for an existing active session for this user
        const activeSessionQuery = await db.collection('attendance')
            .where('userId', '==', userId)
            .where('status', '==', 'clocked-in')
            .limit(1)
            .get();

        if (!activeSessionQuery.empty) {
            return { success: false, message: "You must clock out from your previous session before clocking in again." };
        }

        const now = Timestamp.now();
        const newRecordRef = db.collection('attendance').doc();

        const newRecordForFirestore = {
            userId,
            userName,
            clockInTime: now,
            status: 'clocked-in',
            latitude: location.latitude,
            longitude: location.longitude,
            clockOutTime: null,
            duration: null,
        };

        await newRecordRef.set(newRecordForFirestore);

        const newRecordForClient: AttendanceRecord = {
            id: newRecordRef.id,
            userId,
            userName,
            clockInTime: now.toDate().toISOString(),
            status: 'clocked-in',
            latitude: location.latitude,
            longitude: location.longitude,
        };

        return { success: true, message: 'Clocked in successfully.', record: newRecordForClient };
    } catch (error: any) {
        console.error('Error clocking in on server:', error);
        return { success: false, message: `Failed to clock in: ${error.message}` };
    }
}

export async function clockOutOnServer(recordId: string): Promise<{ success: boolean; message: string; record?: AttendanceRecord }> {
    if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

    try {
        const recordRef = db.collection('attendance').doc(recordId);
        const recordDoc = await recordRef.get();

        if (!recordDoc.exists) {
            return { success: false, message: "Attendance record not found." };
        }

        const recordData = recordDoc.data() as any;
        if (recordData.status === 'clocked-out') {
             return { success: false, message: "This session has already been clocked out." };
        }

        const clockInTime = (recordData.clockInTime as Timestamp).toDate();
        const clockOutTime = new Date();
        const duration = formatDistance(clockOutTime, clockInTime);

        const updatedData = {
            clockOutTime: Timestamp.fromDate(clockOutTime),
            status: 'clocked-out',
            duration,
        };

        await recordRef.update(updatedData);

        const updatedRecordForClient: AttendanceRecord = {
            id: recordDoc.id,
            ...recordData,
            clockInTime: clockInTime.toISOString(),
            clockOutTime: clockOutTime.toISOString(),
            status: 'clocked-out',
            duration,
        };
        
        return { success: true, message: `Clocked out. Duration: ${duration}`, record: updatedRecordForClient };

    } catch (error: any) {
        console.error('Error clocking out on server:', error);
        return { success: false, message: `Failed to clock out: ${error.message}` };
    }
}

export interface GetAttendanceResult {
    success: boolean;
    records?: AttendanceRecord[];
    message?: string;
}

function docToAttendanceRecord(doc: FirebaseFirestore.DocumentSnapshot): AttendanceRecord {
    const data = doc.data()!;
    const clockInTime = (data.clockInTime as Timestamp).toDate();
    const clockOutTime = data.clockOutTime ? (data.clockOutTime as Timestamp).toDate() : undefined;
    return {
        id: doc.id,
        userId: data.userId,
        userName: data.userName,
        clockInTime: clockInTime.toISOString(),
        clockOutTime: clockOutTime?.toISOString(),
        status: data.status,
        duration: data.duration,
        latitude: data.latitude,
        longitude: data.longitude,
    };
}


export async function getAttendanceRecordsFromServer(): Promise<GetAttendanceResult> {
    if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

    try {
        const snapshot = await db.collection('attendance').orderBy('clockInTime', 'desc').get();
        const records = snapshot.docs.map(docToAttendanceRecord);
        return { success: true, records };
    } catch (error: any) {
        console.error('Error getting attendance records from server:', error);
        if (error.code === 9 || (error.message && error.message.includes('FAILED_PRECONDITION'))) {
            return {
                success: false,
                message: `Firestore query failed due to a missing index for the 'attendance' collection. The error logs in your terminal should contain a direct link to create the required index in the Firebase Console. The query requires a descending index on the 'clockInTime' field.`,
            };
        }
        return { success: false, message: `Failed to get attendance records: ${error.message}` };
    }
}

export async function getUserAttendanceRecords(userId?: string): Promise<GetAttendanceResult> {
    if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };
    
    try {
        let query: FirebaseFirestore.Query = db.collection('attendance');
        if (userId) {
             query = query.where('userId', '==', userId);
        }
        
        const snapshot = await query.get();
        const records = snapshot.docs.map(docToAttendanceRecord);

        // Manually sort by date descending in code to avoid composite index requirement
        records.sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime());
        return { success: true, records };
    } catch(error: any) {
        console.error(`Error getting attendance for user ${userId}:`, error);
        return { success: false, message: `Failed to get user attendance: ${error.message}` };
    }
}

export async function getActiveSession(userId: string): Promise<{ success: boolean; record?: AttendanceRecord; message?: string }> {
    if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };
    if (!userId) return { success: false, message: 'User ID is required.' };

    try {
        const snapshot = await db.collection('attendance')
            .where('userId', '==', userId)
            .where('status', '==', 'clocked-in')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return { success: true, record: undefined };
        }

        const record = docToAttendanceRecord(snapshot.docs[0]);
        return { success: true, record };

    } catch (error: any) {
        console.error(`Error getting active session for user ${userId}:`, error);
        return { success: false, message: `Failed to get active session: ${error.message}` };
    }
}
