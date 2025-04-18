import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});


const stripHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

export async function POST(req) {
  try {
    const { text } = await req.json();
    
   
    const plainText = stripHtml(text);
    
   
    console.log('Received text length:', text?.length);
    console.log('Cleaned text length:', plainText?.length);
    
  
    if (!plainText || plainText.trim() === '') {
      return new Response('No text provided', { status: 400 });
    }
    
    const result = await streamText({
      model: google('gemini-1.5-flash-latest'),
      prompt: `Please generate a proper professional blog with introduction, body, conclusion on this topic with this many words written beside the topic name: "${plainText}"`,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error in generateBlog API:', error);
    return new Response('Error processing your request: ' + error.message, { status: 500 });
  }
}