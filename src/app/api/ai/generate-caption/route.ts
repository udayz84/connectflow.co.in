import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageUrl, postType = 'general', userContext } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: true,
          captions: [
            {
              text: 'Sharing this post with my professional network!',
              tone: 'professional',
              hashtags: ['#networking', '#professional'],
              emoji: '✨',
            },
            {
              text: 'Great opportunity to connect and learn from others.',
              tone: 'enthusiastic',
              hashtags: ['#community', '#growth'],
              emoji: '🚀',
            },
            {
              text: 'Excited to share and engage with the community.',
              tone: 'casual',
              hashtags: ['#learning', '#updates'],
              emoji: '💪',
            },
          ],
          imageUrl,
        },
        { status: 200 }
      );
    }

    const openai = new OpenAI({ apiKey });

    console.log('Generating captions for image:', imageUrl, 'Post type:', postType);

    // Generate caption using OpenAI Vision API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Vision-capable model
      messages: [
        {
          role: "system",
          content: `You are an expert social media caption writer. Generate engaging, professional captions for posts based on the uploaded image. 
          
          Guidelines:
          - Keep captions between 10-50 words
          - Use appropriate emojis (1-3 max)
          - Match the tone to the post type: ${postType}
          - Be professional but engaging
          - Include relevant hashtags (2-4 max)
          - Consider the user's context: ${userContext || 'general professional'}
          
          Return 3 different caption options in this exact format:
          {
            "captions": [
              {
                "text": "Caption text here",
                "tone": "professional|casual|enthusiastic",
                "hashtags": ["#tag1", "#tag2"],
                "emoji": "🚀"
              }
            ]
          }`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Generate captions for this ${postType} post image. User context: ${userContext || 'professional networking'}.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
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
          text: "Excited to share this moment with my professional network!",
          tone: "enthusiastic",
          hashtags: ["#networking", "#professional"],
          emoji: "🚀"
        },
        {
          text: "Great experience worth sharing with the community.",
          tone: "professional",
          hashtags: ["#community", "#experience"],
          emoji: "✨"
        },
        {
          text: "Proud to be part of this amazing journey!",
          tone: "casual",
          hashtags: ["#journey", "#proud"],
          emoji: "💪"
        }
      ];
    }
    
    return NextResponse.json({
      success: true,
      captions: captions,
      imageUrl
    });

  } catch (error) {
    console.error('Error generating captions:', error);
    return NextResponse.json(
      { error: 'Failed to generate captions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
