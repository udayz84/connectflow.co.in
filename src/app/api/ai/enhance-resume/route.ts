import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { resume, jobDescription } = await request.json();

    if (!resume || !jobDescription) {
      return NextResponse.json(
        { error: 'Resume and job description are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Return a safe fallback so builds/prerendering won't fail when env vars are missing.
      return NextResponse.json(
        {
          suggestions: [],
          summary: 'OpenAI API key not configured.',
        },
        { status: 200 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // Create the prompt for OpenAI
    const prompt = `You are an expert resume writer and career coach. Please analyze the following resume against the job description and provide specific improvement suggestions.

Job Description:
${jobDescription}

Original Resume:
${resume}

Please provide specific suggestions for improving the resume to better match the job description. Focus on:

1. **Content Improvements**: Add relevant keywords from the job description
2. **Language Enhancements**: Suggest more professional and impactful language
3. **ATS Optimization**: Ensure the resume passes Applicant Tracking Systems
4. **Achievement Quantification**: Add specific numbers and metrics where possible
5. **Structure Improvements**: Suggest better organization and formatting

Please format your response as JSON with the following structure:
{
  "suggestions": [
    {
      "id": "1",
      "type": "content|style|grammar|format|keyword|achievement",
      "section": "which section of the resume (e.g., 'Experience', 'Skills', 'Summary')",
      "original": "the current text or describe what to add",
      "suggestion": "the specific improvement or addition",
      "explanation": "why this change helps and how it relates to the job description",
      "priority": "high|medium|low",
      "action": "replace|add|remove|reorganize"
    }
  ],
  "summary": "A brief summary of the key improvements needed"
}

Focus on providing actionable, specific suggestions rather than rewriting the entire resume.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert resume writer and career coach. Provide professional, actionable advice for resume enhancement."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Try to parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch (parseError) {
      // If JSON parsing fails, create a fallback response
      parsedResponse = {
        enhancedResume: response,
        suggestions: [
          {
            id: "1",
            type: "content",
            original: "Resume content",
            suggestion: "Enhanced content provided by AI",
            explanation: "AI has provided an enhanced version of your resume",
            priority: "high"
          }
        ]
      };
    }

    return NextResponse.json(parsedResponse);

  } catch (error) {
    console.error('Error enhancing resume:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to enhance resume',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 