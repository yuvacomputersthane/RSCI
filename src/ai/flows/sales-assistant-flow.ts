
'use server';
/**
 * @fileOverview An AI-powered sales data analyst.
 *
 * - analyzeSalesData - A function that analyzes sales data based on a user query.
 * - SalesAnalysisRequest - The input type for the analyzeSalesData function.
 * - SalesAnalysisResponse - The return type for the analyzeSalesData function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAllServicesTool, getAllUsersTool, getAllProductsTool, getAllTasksTool, getAllAttendanceRecordsTool, getAllCustomersTool } from '@/ai/tools/sales-tools';

const SalesAnalysisRequestSchema = z.object({
  query: z.string().describe('The user\'s question about the sales data.'),
  invoicesJson: z.string().describe('A JSON string representing an array of all invoice objects. This is the primary dataset for sales analysis.'),
});
export type SalesAnalysisRequest = z.infer<typeof SalesAnalysisRequestSchema>;

const SalesAnalysisResponseSchema = z.object({
  success: z.boolean(),
  analysis: z.string().optional().describe('The natural language analysis and answer to the user\'s query. Should be formatted in Markdown.'),
  message: z.string().optional().describe('An error or status message.'),
});
export type SalesAnalysisResponse = z.infer<typeof SalesAnalysisResponseSchema>;


export async function analyzeSalesData(input: SalesAnalysisRequest): Promise<SalesAnalysisResponse> {
  return salesAnalysisFlow(input);
}

const salesAnalysisPrompt = ai.definePrompt({
  name: 'salesAnalysisPrompt',
  input: { schema: SalesAnalysisRequestSchema },
  tools: [getAllServicesTool, getAllUsersTool, getAllProductsTool, getAllTasksTool, getAllAttendanceRecordsTool, getAllCustomersTool],
  // No output schema needed as we want free-form text.
  system: `You are an expert business analyst for a company named Rising Sun Computers.
Your task is to analyze the provided data and answer the user's question about the company's operations, including sales, inventory, customers, and employee performance. Today's date is ${new Date().toDateString()}.

You have access to a comprehensive set of tools to fetch data from the company's Firestore database. Use them whenever the user's query requires data beyond the provided invoice history.

- **Invoice Data**: The primary sales data is provided in the prompt as a JSON string of invoice objects. Use this for all sales-related queries first.
- **Tools for Additional Data**:
  - \`getAllCustomers\`: Use to find information about a specific customer not present in the invoice list, or to list all customers.
  - \`getAllServices\`: Use this for questions about services that haven't been sold (e.g., "worst selling service").
  - \`getAllUsers\`: Use this for questions about salespeople who haven't made sales.
  - \`getAllProducts\`: Use this to answer questions about inventory, stock levels, assets, or product profitability (compare 'purchasePrice' and 'price').
  - \`getAllTasks\`: Use this to analyze employee productivity, see who has completed the most tasks, or check on pending work.
  - \`getAllAttendanceRecords\`: Use this to analyze employee work hours, check who is currently clocked in, or calculate total hours worked in a period.

Combine information from multiple sources if needed to answer complex questions (e.g., "Who is my most productive employee based on sales, tasks, and hours worked?").

Analyze the data and provide a clear, concise, and helpful answer.
Format your response using Markdown for readability. You can use lists, bold text, and tables if it helps clarify the information.
If the data and tools are insufficient to answer the question, state that clearly.
For any monetary values, use the Indian Rupee symbol (₹).`,
  prompt: `Here is the invoice data:
\`\`\`json
{{{invoicesJson}}}
\`\`\`

Here is the user's question:
"{{{query}}}"`,
});

const salesAnalysisFlow = ai.defineFlow(
  {
    name: 'salesAnalysisFlow',
    inputSchema: SalesAnalysisRequestSchema,
    outputSchema: SalesAnalysisResponseSchema,
  },
  async (input) => {
    try {
        const { text } = await salesAnalysisPrompt(input);
        return {
            success: true,
            analysis: text,
        };
    } catch (error: any) {
        console.error("Error in sales analysis flow:", error);
        return {
            success: false,
            message: `The AI analysis failed: ${error.message || 'An unexpected error occurred.'}`,
        };
    }
  }
);
