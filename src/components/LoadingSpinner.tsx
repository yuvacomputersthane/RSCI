
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

export default function LoadingSpinner({ size = 24, className }: LoadingSpinnerProps) {
  return <Loader2 className={cn("animate-spin text-primary", className)} style={{ width: size, height: size }} />;
}

