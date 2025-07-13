
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { User, CalendarDays, Phone, Send, Home, MapPin, ImagePlus, CircleUser, MessageSquare, CheckCircle } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import LoadingSpinner from "./LoadingSpinner";
import { useState, type ChangeEvent, useEffect } from "react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { sendOtp, verifyOtp } from "@/ai/flows/otp-service-flow";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const profileCompletionSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  dateOfBirth: z.date({
    required_error: "Date of birth is required.",
    invalid_type_error: "That's not a valid date!",
  }),
  mobileNumber: z.string().min(10, { message: "Mobile number must be at least 10 digits." })
                   .regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid mobile number format."}),
  address: z.string().optional(),
  city: z.string().optional(),
  photoDataUri: z.string().optional(),
});

export type ProfileCompletionFormValues = z.infer<typeof profileCompletionSchema>;

interface ProfileCompletionFormProps {
  onSubmit: (data: ProfileCompletionFormValues) => Promise<void>;
  isLoading?: boolean;
  initialData?: Partial<ProfileCompletionFormValues>;
}

export default function ProfileCompletionForm({ onSubmit, isLoading, initialData }: ProfileCompletionFormProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [mobileVerified, setMobileVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const form = useForm<ProfileCompletionFormValues>({
    resolver: zodResolver(profileCompletionSchema),
    defaultValues: {
      fullName: initialData?.fullName || "",
      mobileNumber: "+91",
      address: "",
      city: "",
      photoDataUri: "",
    },
  });
  
  useEffect(() => {
    if (initialData?.fullName) {
      form.setValue("fullName", initialData.fullName);
    }
  }, [initialData, form]);

  const isDateDisabled = (date: Date) => {
    return date > new Date() || date < new Date("1900-01-01");
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "Image Too Large", description: "Please select an image smaller than 2MB.", variant: "destructive" });
        form.setValue("photoDataUri", undefined);
        setImagePreview(null);
        event.target.value = "";
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({ title: "Invalid Image Type", description: "Please select a JPG, JPEG, PNG, or WEBP image.", variant: "destructive" });
        form.setValue("photoDataUri", undefined);
        setImagePreview(null);
        event.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        form.setValue("photoDataUri", reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
      form.setValue("photoDataUri", undefined);
    }
  };

  const handleSendOtp = async () => {
    const mobileNumber = form.getValues("mobileNumber");
    const mobileNumberValidation = z.string().min(10).regex(/^\+?[1-9]\d{1,14}$/).safeParse(mobileNumber);

    if (!mobileNumberValidation.success) {
      form.setError("mobileNumber", {
        type: "manual",
        message: "Please enter a valid mobile number to send OTP.",
      });
      return;
    }

    setIsSendingOtp(true);
    try {
      const result = await sendOtp({ phoneNumber: mobileNumber });
      if (result.success) {
        setOtpSent(true);
        setMobileVerified(false);
        toast({
          title: "OTP Sent (Simulated)",
          description: result.otp 
            ? `For testing, your OTP is: ${result.otp}` 
            : result.message,
          duration: 10000,
        });
      } else {
        toast({
          title: "Failed to Send OTP",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error Sending OTP",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    const mobileNumber = form.getValues("mobileNumber");
    if (otpValue.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "OTP must be 6 digits.",
        variant: "destructive",
      });
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const result = await verifyOtp({ phoneNumber: mobileNumber, otp: otpValue });
      if (result.success) {
        setMobileVerified(true);
        toast({
          title: "Mobile Verified",
          description: result.message,
        });
      } else {
        toast({
          title: "OTP Verification Failed",
          description: result.message,
          variant: "destructive",
        });
        setMobileVerified(false);
      }
    } catch (error: any) {
       toast({
        title: "Error Verifying OTP",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
      setMobileVerified(false);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSubmit = async (values: ProfileCompletionFormValues) => {
    if (!mobileVerified) {
        toast({
            title: "Mobile Verification Required",
            description: "Please verify your mobile number before submitting your profile.",
            variant: "destructive",
        });
        return;
    }
    await onSubmit(values);
  };


  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
        <CardDescription>Please provide your details and verify your mobile to finish setup.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <CardContent className="space-y-6">
            <FormItem>
              <FormLabel className="flex items-center"><ImagePlus className="mr-2 h-4 w-4 text-primary" />Profile Picture (Optional)</FormLabel>
              <div className="flex items-center space-x-4">
                {imagePreview ? (
                  <Image src={imagePreview} alt="Profile preview" width={80} height={80} className="rounded-full h-20 w-20 object-cover border" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border">
                    <CircleUser className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <FormControl>
                  <Input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp" 
                    onChange={handleImageChange} 
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    disabled={isLoading || isSendingOtp || isVerifyingOtp}
                  />
                </FormControl>
              </div>
              <FormMessage>{form.formState.errors.photoDataUri?.message}</FormMessage>
               <FormDescription>Max 2MB. JPG, PNG, WEBP accepted.</FormDescription>
            </FormItem>

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-primary" />Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} disabled={isLoading || isSendingOtp || isVerifyingOtp} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-primary" />Date of Birth</FormLabel>
                  <FormControl>
                     <DatePicker
                        date={field.value}
                        setDate={field.onChange}
                        placeholder="Select your date of birth"
                        disabled={isDateDisabled}
                      />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="mobileNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-primary" />Mobile Number</FormLabel>
                  <div className="flex items-start space-x-2">
                    <FormControl className="flex-grow">
                      <Input 
                        type="tel" 
                        placeholder="9876543210" 
                        {...field} 
                        disabled={isLoading || mobileVerified || isSendingOtp || isVerifyingOtp} 
                      />
                    </FormControl>
                    {!mobileVerified && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleSendOtp} 
                        disabled={isLoading || isSendingOtp || !field.value || form.getFieldState("mobileNumber").invalid}
                        className="shrink-0"
                      >
                        {isSendingOtp ? <LoadingSpinner size={16} /> : (otpSent ? "Resend OTP" : "Send OTP")}
                      </Button>
                    )}
                    {mobileVerified && (
                      <div className="flex items-center text-green-600 pt-2">
                        <CheckCircle className="mr-1 h-5 w-5" /> Verified
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {otpSent && !mobileVerified && (
              <FormField
                control={form.control} 
                name="otp" 
                render={() => ( 
                  <FormItem>
                    <FormLabel className="flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-primary" />Enter OTP</FormLabel>
                    <div className="flex items-center space-x-2">
                    <FormControl className="flex-grow">
                      <Input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={otpValue}
                        onChange={(e) => setOtpValue(e.target.value)}
                        maxLength={6}
                        disabled={isLoading || isVerifyingOtp}
                      />
                    </FormControl>
                    <Button 
                      type="button" 
                      onClick={handleVerifyOtp} 
                      disabled={isLoading || isVerifyingOtp || otpValue.length !== 6}
                      className="shrink-0"
                    >
                      {isVerifyingOtp ? <LoadingSpinner size={16} /> : "Verify OTP"}
                    </Button>
                    </div>
                    <FormDescription>
                      Check the toast notification for the simulated OTP.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Home className="mr-2 h-4 w-4 text-primary" />Address (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="123 Main St, Apartment 4B" {...field} disabled={isLoading || isSendingOtp || isVerifyingOtp}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-primary" />City (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="New Delhi" {...field} disabled={isLoading || isSendingOtp || isVerifyingOtp}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="pt-6">
            <Button type="submit" className="w-full" disabled={isLoading || !mobileVerified}>
              {isLoading ? <LoadingSpinner size={16} className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
              {isLoading ? "Submitting..." : "Submit Profile for Review"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
