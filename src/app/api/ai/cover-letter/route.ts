import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface CoverLetterAIResponse {
  coverLetter: string;
  suggestions?: string[];
  placeholders?: Array<{ key: string; label: string; hint: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const { jobDescription } = await request.json();

    if (!jobDescription || typeof jobDescription !== 'string') {
      return NextResponse.json(
        { error: 'Job description is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          coverLetter: 'OpenAI API key not configured. Please set OPENAI_API_KEY to generate a tailored cover letter.',
          suggestions: [
            'Fill in your experience and achievements in the placeholders.',
            'Match your skills to the job description requirements.',
            'Keep the tone professional and concise.',
          ],
          placeholders: [
            { key: 'PROJECT_NAME', label: 'Relevant Project Name', hint: 'Add a notable project closely matching the role' },
            { key: 'TECH_STACK', label: 'Tech Stack', hint: 'List core tools/frameworks used in the project' },
            { key: 'IMPACT_METRIC', label: 'Impact Metric', hint: 'Quantify outcomes (e.g., performance, revenue, users)' },
            { key: 'COMPANY_VALUE', label: 'Company Value/Initiative', hint: 'Tie motivation to a specific value/initiative from the company' },
            { key: 'LEADERSHIP_EXAMPLE', label: 'Leadership Example', hint: 'Brief example of ownership, mentoring, or collaboration' },
          ],
        },
        { status: 200 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `You are an expert career writer. Based on the JOB DESCRIPTION below, draft a tailored, professional cover letter.

IMPORTANT CONSTRAINTS:
- The letter MUST include clearly marked placeholders wrapped in square brackets for the candidate to fill later, such as: [PROJECT_NAME], [TECH_STACK], [IMPACT_METRIC], [COMPANY_VALUE], [LEADERSHIP_EXAMPLE].
- Do not invent personal details. Use placeholders instead.
- Keep it concise (250-350 words), results-oriented, and aligned with the job description.
- Use a friendly but professional tone.

JOB DESCRIPTION:
${jobDescription}

Return ONLY valid JSON in the following shape:
{
  "coverLetter": "the full letter text including placeholders like [PROJECT_NAME], [TECH_STACK], etc.",
  "suggestions": [
    "What types of projects or achievements the candidate could add in [PROJECT_NAME]",
    "What metrics could be used in [IMPACT_METRIC]",
    "What stacks might fit [TECH_STACK] based on the description"
  ],
  "placeholders": [
    { "key": "PROJECT_NAME", "label": "Relevant Project Name", "hint": "Add a notable project closely matching the role" },
    { "key": "TECH_STACK", "label": "Tech Stack", "hint": "List core tools/frameworks used in the project" },
    { "key": "IMPACT_METRIC", "label": "Impact Metric", "hint": "Quantify outcomes (e.g., performance, revenue, users)" },
    { "key": "COMPANY_VALUE", "label": "Company Value/Initiative", "hint": "Tie motivation to a specific value/initiative from the company" },
    { "key": "LEADERSHIP_EXAMPLE", "label": "Leadership Example", "hint": "Brief example of ownership, mentoring, or collaboration" }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert cover letter writer. Always return strictly valid JSON as instructed.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1200
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    let data: CoverLetterAIResponse | null = null;
    try {
      data = JSON.parse(content) as CoverLetterAIResponse;
    } catch (err) {
      // Fallback: wrap the content as a plain cover letter with standard placeholders
      data = {
        coverLetter:
          `${content}\n\nP.S. Fill these placeholders: [PROJECT_NAME], [TECH_STACK], [IMPACT_METRIC], [COMPANY_VALUE], [LEADERSHIP_EXAMPLE]`,
        suggestions: [
          'Add a high-impact project aligned to the job focus',
          'Quantify results with concrete metrics',
          'List key frameworks and tools used'
        ],
        placeholders: [
          { key: 'PROJECT_NAME', label: 'Relevant Project Name', hint: 'Add a notable project closely matching the role' },
          { key: 'TECH_STACK', label: 'Tech Stack', hint: 'List core tools/frameworks used in the project' },
          { key: 'IMPACT_METRIC', label: 'Impact Metric', hint: 'Quantify outcomes (e.g., performance, revenue, users)' },
          { key: 'COMPANY_VALUE', label: 'Company Value/Initiative', hint: 'Tie motivation to a specific value/initiative from the company' },
          { key: 'LEADERSHIP_EXAMPLE', label: 'Leadership Example', hint: 'Brief example of ownership, mentoring, or collaboration' }
        ]
      };
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Error generating cover letter:', error);
    return NextResponse.json(
      { error: 'Failed to generate cover letter' },
      { status: 500 }
    );
  }
}


