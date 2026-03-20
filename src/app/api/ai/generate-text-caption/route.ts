import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, postType = 'general', userContext } = await request.json();

    if (!text || text.trim().length < 3) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: true,
          captions: [
            {
              text: `Excited to share: ${text}`,
              tone: 'enthusiastic',
              hashtags: ['#sharing', '#professional'],
              emoji: '🚀',
            },
            {
              text: `Thoughts on: ${text}`,
              tone: 'professional',
              hashtags: ['#thoughts', '#insights'],
              emoji: '💭',
            },
            {
              text: `Wanted to share this: ${text}`,
              tone: 'casual',
              hashtags: ['#sharing', '#community'],
              emoji: '✨',
            },
          ],
          originalText: text,
        },
        { status: 200 }
      );
    }

    const openai = new OpenAI({ apiKey });

    console.log('Generating captions for text:', text.substring(0, 50) + '...', 'Post type:', postType);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert social media caption writer. Based on the user's text content, generate engaging captions that enhance and expand on their message.
          
          Guidelines:
          - Enhance the original message while keeping its essence
          - Add relevant emojis (1-3 max)
          - Include appropriate hashtags (2-4 max)
          - Match the tone: ${postType}
          - Keep it professional but engaging
          - Length: 15-60 words
          
          Return 3 different caption options in this exact format:
          {
            "captions": [
              {
                "text": "Enhanced caption text here",
                "tone": "professional|casual|enthusiastic",
                "hashtags": ["#tag1", "#tag2"],
                "emoji": "🚀"
              }
            ]
          }`
        },
        {
          role: "user",
          content: `Original text: "${text}"\nPost type: ${postType}\nUser context: ${userContext || 'professional networking'}`
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    console.log('OpenAI response:', response);
    
    // Parse JSON response
    let captions;
    try {
      const parsed = JSON.parse(response);
      captions = parsed.captions || [];
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      // Return fallback captions if parsing fails
      captions = [
        {
          text: `Excited to share: ${text}`,
          tone: "enthusiastic",
          hashtags: ["#sharing", "#professional"],
          emoji: "🚀"
        },
        {
          text: `Thoughts on: ${text}`,
          tone: "professional",
          hashtags: ["#thoughts", "#insights"],
          emoji: "💭"
        },
        {
          text: `Wanted to share this: ${text}`,
          tone: "casual",
          hashtags: ["#sharing", "#community"],
          emoji: "✨"
        }
      ];
    }
    
    return NextResponse.json({
      success: true,
      captions: captions,
      originalText: text
    });

  } catch (error) {
    console.error('Error generating text captions:', error);
    return NextResponse.json(
      { error: 'Failed to generate captions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
