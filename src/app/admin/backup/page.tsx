
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HardDriveDownload, Server, CheckCircle } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { getFirestoreBackupData } from './actions';
import { format } from 'date-fns';

interface BackupStatus {
  firestoreFetched: boolean;
}

export default function BackupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<BackupStatus>({ firestoreFetched: false });
  const { toast } = useToast();

  const handleGenerateBackup = async () => {
    setIsLoading(true);
    setStatus({ firestoreFetched: false });
    
    try {
      const firestoreResult = await getFirestoreBackupData();
      
      if (!firestoreResult.success && !firestoreResult.data) {
        throw new Error(firestoreResult.message || 'Failed to fetch server data.');
      }
      if(firestoreResult.message){
         toast({
            title: "Partial Backup Warning",
            description: firestoreResult.message,
            variant: "destructive",
            duration: 8000
        });
      }
      setStatus(prev => ({ ...prev, firestoreFetched: true }));

      const fullBackup = {
        generatedAt: new Date().toISOString(),
        source: 'Rising Sun Computers Backup',
        data: {
          firestore: {
            users: firestoreResult.data?.users.users || [],
            customers: firestoreResult.data?.customers.customers || [],
            services: firestoreResult.data?.services.services || [],
            products: firestoreResult.data?.products.products || [],
            tasks: firestoreResult.data?.tasks.tasks || [],
            invoices: firestoreResult.data?.invoices.invoices || [],
            attendance: firestoreResult.data?.attendance.records || [],
            categories: firestoreResult.data?.categories.categories || [],
            salaryAdvances: firestoreResult.data?.salaryAdvances.advances || [],
            companyProfile: firestoreResult.data?.companyProfile.profile || {},
          },
        },
      };

      const jsonString = JSON.stringify(fullBackup, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const formattedDate = format(new Date(), 'yyyy-MM-dd-HHmm');
      link.download = `rising-sun-computers-backup-${formattedDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Backup Downloaded",
        description: "Your data backup file has been generated and downloaded.",
      });

    } catch (error: any) {
      toast({
        title: "Backup Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-md w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <HardDriveDownload className="mr-3 h-6 w-6 text-primary" /> Data Backup & Export
        </CardTitle>
        <CardDescription>
          Generate a full offline backup of all application data from Firestore. The backup will be a single JSON (.json) file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">Data to be included:</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li><span className="font-medium text-foreground">Firestore Data:</span> All Users, Customers, Services, Products, Tasks, Invoices, Attendance, Categories, Salary Advances, and Company Profile.</li>
            </ul>
             <p className="text-xs text-muted-foreground pt-2">
                All application data is now centrally stored and will be included in this backup.
            </p>
        </div>

        <Button onClick={handleGenerateBackup} disabled={isLoading} className="w-full text-lg py-6">
          {isLoading ? (
            <>
              <LoadingSpinner size={20} className="mr-2" /> Generating Backup...
            </>
          ) : (
            <>
             <HardDriveDownload className="mr-3 h-5 w-5" /> Generate & Download Backup
            </>
          )}
        </Button>
        
        {isLoading && (
            <div className="space-y-2 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Server className="h-4 w-4" />
                    <p>Fetching all Firestore data...</p>
                    {status.firestoreFetched ? <CheckCircle className="h-5 w-5 text-green-500" /> : <LoadingSpinner size={16} />}
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
