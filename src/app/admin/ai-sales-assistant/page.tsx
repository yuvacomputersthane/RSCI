
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Wand2, Sparkles, User, Bot, AlertTriangle, Send } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { getInvoices } from '@/app/admin/invoices/actions';
import { analyzeSalesData } from '@/ai/flows/sales-assistant-flow';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

export default function AiSalesAssistantPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const { toast } = useToast();

  const handleQuerySubmit = async () => {
    if (!query.trim()) {
      toast({ title: "Query is empty", description: "Please enter a question to ask the sales assistant.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const userMessage: ChatMessage = { role: 'user', content: query };
    setChatHistory(prev => [...prev, userMessage]);
    const currentQuery = query;
    setQuery(''); // Clear input field immediately

    try {
      const invoicesResult = await getInvoices();
      if (!invoicesResult.success || !invoicesResult.invoices) {
          throw new Error(invoicesResult.message || "Could not load invoice data from Firestore.");
      }
      
      if (invoicesResult.invoices.length === 0) {
          throw new Error("No invoice data found in Firestore. Please create some invoices first.");
      }

      const result = await analyzeSalesData({
        query: currentQuery,
        invoicesJson: JSON.stringify(invoicesResult.invoices),
      });

      if (result.success && result.analysis) {
        const assistantMessage: ChatMessage = { role: 'assistant', content: result.analysis };
        setChatHistory(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessage = { role: 'error', content: result.message || 'An unknown error occurred.' };
        setChatHistory(prev => [...prev, errorMessage]);
      }

    } catch (error: any) {
      const errorMessage: ChatMessage = { role: 'error', content: error.message };
      setChatHistory(prev => [...prev, errorMessage]);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuerySubmit();
  }

  return (
    <Card className="shadow-md w-full">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <Wand2 className="mr-3 h-6 w-6 text-primary" /> AI Sales Assistant
        </CardTitle>
        <CardDescription>
          Ask questions about your sales data in plain English. The AI will analyze your complete invoice history from Firestore.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[50vh] rounded-md border bg-muted/30 p-4">
            <ScrollArea className="h-full pr-4">
                 <div className="flex flex-col gap-4">
                    {chatHistory.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                            <Sparkles className="h-12 w-12 mb-4" />
                            <p className="font-semibold">Ready to help!</p>
                            <p className="text-sm">Ask me something like "What were the total sales this month?"</p>
                        </div>
                    )}
                    {chatHistory.map((message, index) => (
                    <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                        {message.role === 'assistant' && <div className="p-2 rounded-full bg-primary/20"><Bot className="h-5 w-5 text-primary" /></div>}
                        {message.role === 'error' && <div className="p-2 rounded-full bg-destructive/20"><AlertTriangle className="h-5 w-5 text-destructive" /></div>}
                        
                        <div className={`max-w-xl p-3 rounded-lg ${
                            message.role === 'user' ? 'bg-primary text-primary-foreground' : 
                            message.role === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-background'
                        }`}>
                             <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                                {message.content}
                            </ReactMarkdown>
                        </div>

                         {message.role === 'user' && <div className="p-2 rounded-full bg-secondary"><User className="h-5 w-5 text-secondary-foreground" /></div>}
                    </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-primary/20"><Bot className="h-5 w-5 text-primary" /></div>
                            <div className="max-w-xl p-3 rounded-lg bg-background flex items-center gap-2">
                                <LoadingSpinner size={16}/>
                                <span className="text-muted-foreground text-sm">Thinking...</span>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>

        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., How many services did we sell last week?"
            className="flex-grow resize-none"
            rows={1}
            disabled={isLoading}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleQuerySubmit();
                }
            }}
          />
          <Button type="submit" disabled={isLoading || !query.trim()} size="icon" className="shrink-0">
            {isLoading ? <LoadingSpinner size={16} /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
