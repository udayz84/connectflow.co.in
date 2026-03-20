import OpenAI from 'openai';

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({ apiKey });
}

// Generate interview questions using OpenAI
export async function generateInterviewQuestions(role: string, domain: string): Promise<any[]> {
  try {
    const prompt = `Generate 5 realistic interview questions for a ${role} position in ${domain}. 
    
    Requirements:
    - Mix of technical, behavioral, and domain-specific questions
    - Vary difficulty levels (Easy, Medium, Hard)
    - Make them professional and role-specific
    - Include 2-3 tips for each question
    
    Return the response as a JSON array with this exact structure:
    [
      {
        "text": "Question text here",
        "category": "Technical|Behavioral|Domain-specific",
        "difficulty": "Easy|Medium|Hard",
        "orderIndex": 1,
        "tips": ["Tip 1", "Tip 2", "Tip 3"]
      }
    ]`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert HR professional and technical interviewer. Generate realistic interview questions and return them in the exact JSON format specified."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Try to parse JSON response
    try {
      const questions = JSON.parse(response);
      return questions;
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      // Return fallback questions if parsing fails
      return generateFallbackQuestions(role, domain);
    }

  } catch (error) {
    console.error('Error generating interview questions:', error);
    return generateFallbackQuestions(role, domain);
  }
}

// Generate feedback using OpenAI
export async function generateFeedback(question: string, transcript: string): Promise<any> {
  try {
    const prompt = `You are a professional technical interviewer providing detailed feedback on a candidate's answer. 

Question: "${question}"
Candidate's Answer: "${transcript}"

Provide comprehensive, constructive feedback in the exact JSON format below:

{
  "score": 7.5,
  "communicationScore": 8.0,
  "technicalScore": 7.0,
  "strengths": ["Clear technical explanation", "Good use of specific examples", "Demonstrates problem-solving approach"],
  "weaknesses": ["Could provide more technical depth", "Missing specific implementation details"],
  "suggestions": ["Elaborate on technical challenges faced", "Provide more specific examples of technologies used"],
  "overallFeedback": "Strong technical foundation demonstrated. Continue to provide specific examples and technical details to showcase your expertise."
}

Provide feedback that:
- Evaluates technical knowledge and communication skills
- Gives 2-3 specific strengths and areas for improvement
- Provides actionable suggestions for development
- Maintains professional, constructive tone`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a senior technical interviewer who provides comprehensive, constructive feedback. Evaluate technical knowledge, communication skills, and provide actionable suggestions for improvement. Return feedback in the exact JSON format specified."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Try to parse JSON response
    try {
      const feedback = JSON.parse(response);
      return feedback;
    } catch (parseError) {
      console.error('Failed to parse OpenAI feedback as JSON:', parseError);
      return generateFallbackFeedback(question, transcript);
    }

  } catch (error) {
    console.error('Error generating feedback:', error);
    return generateFallbackFeedback(question, transcript);
  }
}

// Clean up common Whisper transcription artifacts
function cleanWhisperTranscript(transcript: string): string {
  if (!transcript) {
    console.log('No transcript provided to clean');
    return '';
  }
  
  let cleaned = transcript.trim();
  
  console.log('Cleaning transcript - Original:', JSON.stringify(cleaned));
  console.log('Cleaning transcript - Length:', cleaned.length);
  
  // If transcript is already empty or very short, return as is
  if (cleaned.length < 2) {
    console.log('Transcript too short to clean');
    return cleaned;
  }
  
  // Define common Whisper artifacts that should be removed
  const artifactPatterns = [
    // ESO transcription artifacts - be more specific
    /^Transcription by ESO\. Translation by[—\-–]\s*/i,
    /^Transcription by ESO[—\-–]\s*/i,
    /^Translation by[—\-–]\s*/i,
    /^tjis s comin from whisper model[—\-–]\s*/i,
    
    // Other common artifacts
    /^\[Music\]\s*/i,
    /^\[Applause\]\s*/i,
    /^\[Laughter\]\s*/i,
    /^\[Silence\]\s*/i,
    /^\[Background noise\]\s*/i,
    /^\[Noise\]\s*/i,
    /^\[Static\]\s*/i,
  ];
  
  // Remove artifacts from the beginning
  for (const pattern of artifactPatterns) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, '').trim();
    if (before !== cleaned) {
      console.log('Removed artifact pattern:', pattern.toString(), 'Result:', JSON.stringify(cleaned));
    }
  }
  
  // Also try simple string replacement for exact matches
  const artifactStrings = [
    'Transcription by ESO. Translation by —',
    'Transcription by ESO. Translation by -',
    'Transcription by ESO. Translation by –',
    'Transcription by ESO —',
    'Transcription by ESO -',
    'Transcription by ESO –',
    'Translation by —',
    'Translation by -',
    'Translation by –',
    'Transcription by ESO.',
    'Translation by',
  ];
  
  for (const artifact of artifactStrings) {
    if (cleaned.toLowerCase().startsWith(artifact.toLowerCase())) {
      cleaned = cleaned.substring(artifact.length).trim();
      console.log('Removed artifact string:', artifact, 'Result:', JSON.stringify(cleaned));
    }
  }
  
  // Clean up extra whitespace and normalize
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  console.log('After cleaning - Result:', JSON.stringify(cleaned));
  console.log('After cleaning - Length:', cleaned.length);
  
  // Check if the cleaned transcript is empty or contains only artifacts
  if (!cleaned || cleaned.length < 2) {
    console.log('Transcript is empty or too short after cleaning');
    return '';
  }
  
  // Additional check: if it still starts with known artifact patterns, it's likely just artifacts
  const remainingArtifacts = /^(transcription|translation|tjis|music|applause|laughter|silence|background|noise|static)/i;
  if (remainingArtifacts.test(cleaned) && cleaned.length < 50) {
    console.log('Transcript appears to contain only artifacts after cleaning');
    return '';
  }
  
  console.log('Final cleaned transcript:', JSON.stringify(cleaned));
  
  return cleaned;
}

// Transcribe audio using OpenAI Whisper
export async function transcribeAudio(audioBase64: string): Promise<string> {
  try {
    console.log('Starting Whisper transcription...');
    console.log('Audio data length:', audioBase64.length);
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    // Validate audio data
    if (!audioBase64 || audioBase64.length < 100) {
      throw new Error('Audio data is too short or empty. Please record a longer audio clip.');
    }

    const byteCharacters = atob(audioBase64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    
    // Check minimum audio size (at least 1KB)
    if (byteArray.length < 1024) {
      throw new Error('Audio file is too small. Please ensure you recorded audio with sufficient length.');
    }
    
    // Check for reasonable audio duration (estimate based on file size)
    // WebM audio at 16kHz typically uses ~1KB per second, so 1KB = ~1 second
    const estimatedDurationSeconds = byteArray.length / 1024;
    if (estimatedDurationSeconds < 0.5) {
      throw new Error('Audio recording is too short. Please record at least 1-2 seconds of speech.');
    }
    
    // Determine the correct MIME type based on the audio data
    let mimeType = 'audio/webm';
    if (byteArray.length > 4) {
      // Check for common audio file signatures
      const signature = Array.from(byteArray.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
      if (signature.startsWith('1a45dfa3')) {
        mimeType = 'audio/webm';
      } else if (signature.startsWith('52494646')) {
        mimeType = 'audio/wav';
      } else if (signature.startsWith('fffb') || signature.startsWith('fff3')) {
        mimeType = 'audio/mpeg';
      }
    }
    
    const blob = new Blob([byteArray], { type: mimeType });
    console.log('Detected audio format:', mimeType);
    console.log('Audio blob size:', blob.size, 'bytes');

    // Check if blob size is reasonable (at least 1KB, max 25MB for Whisper)
    if (blob.size < 1024) {
      throw new Error('Audio file is too small. Please record a longer audio clip.');
    }
    if (blob.size > 25 * 1024 * 1024) {
      throw new Error('Audio file is too large. Please record a shorter audio clip (max 25MB).');
    }

    // Try transcription with different parameters
    const transcriptionAttempts = [
      {
        name: 'Primary attempt with English prompt',
        params: {
          language: 'en',
          prompt: 'This is an interview response in English. Please transcribe accurately.'
        }
      },
      {
        name: 'Fallback attempt without language restriction',
        params: {
          // No language parameter - let Whisper auto-detect
          prompt: 'Please transcribe this audio accurately.'
        }
      },
      {
        name: 'Final attempt with minimal parameters',
        params: {
          // Minimal parameters
        }
      }
    ];

    let lastError: Error | null = null;
    
    for (let attemptIndex = 0; attemptIndex < transcriptionAttempts.length; attemptIndex++) {
      const attempt = transcriptionAttempts[attemptIndex];
      console.log(`Transcription attempt ${attemptIndex + 1}: ${attempt.name}`);
      
      try {
    const formData = new FormData();
    const filename = mimeType === 'audio/webm' ? 'audio.webm' : 
                    mimeType === 'audio/wav' ? 'audio.wav' : 
                    mimeType === 'audio/mpeg' ? 'audio.mp3' : 'audio.webm';
    formData.append('file', blob, filename);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
        
        // Add parameters based on attempt
        if (attempt.params.language) {
          formData.append('language', attempt.params.language);
        }
        if (attempt.params.prompt) {
          formData.append('prompt', attempt.params.prompt);
        }

        console.log(`Sending request to OpenAI Whisper API (attempt ${attemptIndex + 1})...`);
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData
    });

        console.log(`Whisper API response status (attempt ${attemptIndex + 1}):`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
          console.error(`Whisper API error response (attempt ${attemptIndex + 1}):`, errorText);
          
          // If this is the last attempt, throw the error
          if (attemptIndex === transcriptionAttempts.length - 1) {
            if (response.status === 400) {
              throw new Error('Invalid audio format or corrupted audio data. Please try recording again.');
            } else if (response.status === 401) {
              throw new Error('OpenAI API authentication failed. Please check API key configuration.');
            } else if (response.status === 429) {
              throw new Error('Rate limit exceeded. Please wait a moment and try again.');
            } else {
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
            }
          } else {
            // Continue to next attempt
            lastError = new Error(`Attempt ${attemptIndex + 1} failed: ${response.status} - ${errorText}`);
            continue;
          }
    }

    let transcript = await response.text();
        console.log(`Raw Whisper transcription (attempt ${attemptIndex + 1}):`, JSON.stringify(transcript));
        console.log(`Raw transcript length (attempt ${attemptIndex + 1}):`, transcript.length);
        console.log(`Raw transcript type (attempt ${attemptIndex + 1}):`, typeof transcript);
        
        // Log the exact characters in the transcript for debugging
        console.log(`Raw transcript character codes (attempt ${attemptIndex + 1}):`, Array.from(transcript).map(c => c.charCodeAt(0)));
        
        // Always clean the transcript to remove any artifacts
        const cleanedTranscript = cleanWhisperTranscript(transcript);
        console.log(`Cleaned transcription (attempt ${attemptIndex + 1}):`, JSON.stringify(cleanedTranscript));
        console.log(`Cleaned transcript length (attempt ${attemptIndex + 1}):`, cleanedTranscript.length);
    
    // Check if we have a valid transcription
        if (cleanedTranscript && cleanedTranscript.length >= 2) {
          console.log(`Transcription successful on attempt ${attemptIndex + 1}`);
          return cleanedTranscript;
        } else {
          console.log(`Attempt ${attemptIndex + 1} resulted in empty transcript`);
          if (attemptIndex === transcriptionAttempts.length - 1) {
            // This was the last attempt
            console.log('All transcription attempts failed');
            console.log('Original transcript was:', JSON.stringify(transcript));
            console.log('Cleaned transcript was:', JSON.stringify(cleanedTranscript));
            
            // Try a different approach - maybe the audio is just very short or contains only silence
            if (transcript.trim().length === 0) {
              throw new Error('Audio appears to be silent or very quiet. Please speak clearly and try again.');
            } else {
      throw new Error('No speech detected in audio. Please ensure the audio contains clear speech and try again.');
            }
          } else {
            // Continue to next attempt
            lastError = new Error(`Attempt ${attemptIndex + 1} produced empty transcript`);
            continue;
          }
        }
      } catch (error) {
        console.error(`Error in transcription attempt ${attemptIndex + 1}:`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // If this is the last attempt, throw the error
        if (attemptIndex === transcriptionAttempts.length - 1) {
          throw lastError;
        }
        // Otherwise, continue to next attempt
      }
    }
    
        // This should never be reached, but just in case
    throw lastError || new Error('All transcription attempts failed');
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error; // Re-throw the error instead of returning fallback text
  }
}

// Fallback questions if AI fails - EXPORT THIS FUNCTION
export function generateFallbackQuestions(role: string, domain: string): any[] {
  const baseQuestions = [
    {
      text: `Tell me about your experience with ${domain} and how it relates to the ${role} position.`,
      category: "Domain-specific",
      difficulty: "Medium",
      orderIndex: 1,
      tips: ["Focus on relevant experience", "Connect skills to the role", "Provide specific examples"]
    },
    {
      text: "Describe a challenging project you worked on and how you overcame obstacles.",
      category: "Behavioral",
      difficulty: "Medium",
      orderIndex: 2,
      tips: ["Use STAR method", "Be specific about challenges", "Highlight problem-solving skills"]
    },
    {
      text: `What are the key technologies and tools you use in ${domain}?`,
      category: "Technical",
      difficulty: "Easy",
      orderIndex: 3,
      tips: ["List current tools", "Explain why you chose them", "Show continuous learning"]
    },
    {
      text: "How do you stay updated with industry trends and new technologies?",
      category: "Behavioral",
      difficulty: "Easy",
      orderIndex: 4,
      tips: ["Mention learning resources", "Show initiative", "Discuss practical application"]
    },
    {
      text: `Walk me through how you would approach a complex ${domain} problem.`,
      category: "Technical",
      difficulty: "Hard",
      orderIndex: 5,
      tips: ["Break down the problem", "Explain your reasoning", "Consider multiple approaches"]
    }
  ];

  return baseQuestions;
}

// Generate follow-up question based on response
export async function generateFollowUpQuestion(
  role: string, 
  domain: string, 
  transcript: string, 
  conversationHistory: any[], 
  isIntroduction: boolean
): Promise<string> {
  try {
    console.log('generateFollowUpQuestion called with:', {
      role,
      domain,
      transcript: transcript.substring(0, 100) + '...',
      conversationHistoryLength: conversationHistory.length,
      isIntroduction
    });

    const prompt = `You are a professional technical interviewer conducting a ${role} interview in ${domain}. You are experienced, analytical, and thorough.

    CONVERSATION HISTORY:
    ${conversationHistory.map(msg => `${msg.type === 'ai' ? 'Interviewer' : 'Candidate'}: ${msg.content}`).join('\n')}
    
    CANDIDATE'S RESPONSE: "${transcript}"
    
    YOUR TASK:
    Ask a technical, professional follow-up question that evaluates their expertise and experience.
    
    GUIDELINES:
    - Ask technical questions relevant to ${role} in ${domain}
    - Probe deeper into their technical knowledge and experience
    - Ask about specific technologies, methodologies, or challenges
    - Evaluate problem-solving skills and technical depth
    - Keep questions professional but not overly complex
    
    QUESTION STYLE FOR ${role} IN ${domain}:
    - "Can you walk me through the technical architecture of a project you've worked on?"
    - "What specific technologies and frameworks did you use, and why did you choose them?"
    - "How do you approach debugging and troubleshooting in your development process?"
    - "Can you describe a challenging technical problem you solved and your approach?"
    - "What's your experience with [relevant technology] and how have you implemented it?"
    - "How do you ensure code quality and maintainability in your projects?"
    - "Can you explain your experience with [domain-specific concept]?"
    
    Return only a professional, technical follow-up question.`;

    console.log('Sending prompt to OpenAI...');

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional technical interviewer who asks insightful, technical follow-up questions. Evaluate candidates' expertise, problem-solving skills, and technical depth. Ask questions that reveal their real-world experience and technical knowledge."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    console.log('OpenAI completion response:', completion);
    const response = completion.choices[0]?.message?.content;
    console.log('Extracted response:', response);
    
    if (!response) {
      console.error('No response from OpenAI');
      throw new Error('No response from OpenAI');
    }

    const trimmedResponse = response.trim();
    console.log('Trimmed response:', trimmedResponse);
    return trimmedResponse;
  } catch (error) {
    console.error('Error generating follow-up question:', error);
    throw error;
  }
}

// Fallback follow-up question if AI fails
export function generateFallbackFollowUpQuestion(role: string, domain: string, isIntroduction: boolean): string {
  console.log('generateFallbackFollowUpQuestion called with:', { role, domain, isIntroduction });
  
  if (isIntroduction) {
    const question = `Thank you for that introduction. Can you walk me through a specific technical project you've worked on in ${domain}? I'd like to understand the technical challenges you faced and how you solved them.`;
    console.log('Generated introduction follow-up:', question);
    return question;
  }
  
  const technicalQuestions = [
    `Can you describe the technical architecture of a project you've worked on?`,
    `What specific technologies and frameworks did you use, and why did you choose them?`,
    `How do you approach debugging and troubleshooting in your development process?`,
    `Can you walk me through a challenging technical problem you solved?`,
    `What's your experience with version control and collaborative development?`,
    `How do you ensure code quality and maintainability in your projects?`,
    `Can you explain your testing strategy and approach?`,
    `What's your experience with performance optimization and scalability?`,
    `How do you stay updated with the latest technologies in ${domain}?`,
    `Can you describe a time when you had to learn a new technology quickly?`
  ];
  
  const selectedQuestion = technicalQuestions[Math.floor(Math.random() * technicalQuestions.length)];
  console.log('Generated fallback follow-up:', selectedQuestion);
  return selectedQuestion;
}

// Generate comprehensive final feedback for complete interview
export async function generateComprehensiveFeedback(
  role: string,
  domain: string,
  allResponses: string,
  questionCount: number
): Promise<any> {
  try {
    const prompt = `Based on this complete interview conversation, provide comprehensive feedback:

    ROLE: ${role}
    DOMAIN: ${domain}
    TOTAL QUESTIONS: ${questionCount}
    
    CANDIDATE RESPONSES: "${allResponses}"
    
    Please provide a detailed assessment in JSON format:
    {
      "overallScore": 7.5,
      "technicalAssessment": "Detailed technical knowledge evaluation",
      "communicationAssessment": "Communication skills assessment",
      "strengths": ["Strength 1", "Strength 2", "Strength 3"],
      "improvements": ["Area 1", "Area 2", "Area 3"],
      "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"],
      "nextSteps": "Specific recommendations for career development"
    }`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a senior technical interviewer providing comprehensive feedback. Return only valid JSON format with the specified structure."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    console.log('Raw comprehensive feedback response:', responseText);
    
    try {
      const feedback = JSON.parse(responseText);
      console.log('Parsed comprehensive feedback:', feedback);
      return feedback;
    } catch (parseError) {
      console.error('Failed to parse comprehensive feedback JSON:', parseError);
      return generateFallbackComprehensiveFeedback();
    }
    
  } catch (error) {
    console.error('Error generating comprehensive feedback:', error);
    return generateFallbackComprehensiveFeedback();
  }
}

// Fallback comprehensive feedback
export function generateFallbackComprehensiveFeedback(): any {
  return {
    overallScore: 7.5,
    technicalAssessment: "Good technical foundation demonstrated with room for growth in specific areas.",
    communicationAssessment: "Clear communication with good structure and examples.",
    strengths: ["Strong problem-solving approach", "Good use of examples", "Clear technical explanations"],
    improvements: ["Provide more technical depth", "Include specific implementation details", "Share more real-world examples"],
    suggestions: ["Practice explaining complex technical concepts", "Build more hands-on projects", "Stay updated with latest technologies"],
    nextSteps: "Continue building your technical portfolio and practice explaining your projects in detail."
  };
}

// AI Job Recommendation Functions

// Generate job recommendations using AI
export async function generateJobRecommendations(
  userProfile: any,
  availableJobs: any[],
  limit: number = 10
): Promise<any[]> {
  try {
    const prompt = `You are an expert career counselor and job matching specialist. Analyze the following user profile and available jobs to provide personalized job recommendations.

USER PROFILE:
- Name: ${userProfile.fullName}
- Current Role: ${userProfile.currentJobTitle || 'Not specified'}
- Experience: ${userProfile.yearsOfExperience || 'Not specified'}
- Education: ${userProfile.education || 'Not specified'}
- Skills: ${userProfile.skills.join(', ')}
- Location: ${userProfile.city}, ${userProfile.state}, ${userProfile.country}
- Bio: ${userProfile.bio || 'Not provided'}
- Preferred Job Types: ${userProfile.preferredJobTypes.join(', ')}
- Expected Salary: ${userProfile.expectedSalary || 'Not specified'}
- Languages: ${userProfile.languages.join(', ')}
- Certifications: ${userProfile.certifications.join(', ')}

AVAILABLE JOBS:
${availableJobs.map((job, index) => `
Job ${index + 1}:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Type: ${job.employmentType}
- Experience Level: ${job.experienceLevel || 'Not specified'}
- Salary: ${job.salaryMin ? `$${job.salaryMin.toLocaleString()}` : 'Not specified'} - ${job.salaryMax ? `$${job.salaryMax.toLocaleString()}` : 'Not specified'}
- Description: ${job.description.substring(0, 500)}...
- Requirements: ${job.requirements.join(', ')}
- Responsibilities: ${job.responsibilities.join(', ')}
- Benefits: ${job.benefits.join(', ')}
- Company Description: ${job.recruiter?.companyDescription || 'Not provided'}
- Company Benefits: ${job.recruiter?.companyBenefits?.join(', ') || 'Not provided'}
`).join('\n')}

Please analyze each job and provide personalized recommendations based on:
1. Skill match (technical skills, soft skills, experience level)
2. Career progression alignment
3. Location preferences and remote work options
4. Salary expectations
5. Company culture fit
6. Growth opportunities
7. Industry relevance

Return your analysis as a JSON array with this exact structure:
[
  {
    "jobId": "job_id_here",
    "matchScore": 8.5,
    "reasons": [
      "Strong technical skill match with React and Node.js",
      "Career progression opportunity to senior level",
      "Remote work option aligns with preferences"
    ],
    "strengths": [
      "Perfect skill alignment",
      "Growth potential",
      "Company culture fit"
    ],
    "considerations": [
      "Salary might be below expectations",
      "Requires relocation consideration"
    ],
    "recommendation": "Highly recommended - excellent match for career growth",
    "priority": "high|medium|low"
  }
]

Focus on providing 5-10 most relevant recommendations with detailed analysis.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert career counselor and job matching specialist. Analyze user profiles and job requirements to provide personalized, actionable job recommendations. Always return responses in the exact JSON format specified."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    try {
      const recommendations = JSON.parse(response);
      
      // Sort by match score and limit results
      const sortedRecommendations = recommendations
        .sort((a: any, b: any) => b.matchScore - a.matchScore)
        .slice(0, limit);

      // Enrich with full job data
      const enrichedRecommendations = sortedRecommendations.map((rec: any) => {
        const job = availableJobs.find(j => j.id === rec.jobId);
        return {
          ...rec,
          job: job ? {
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            employmentType: job.employmentType,
            experienceLevel: job.experienceLevel,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            description: job.description,
            requirements: job.requirements,
            responsibilities: job.responsibilities,
            benefits: job.benefits,
            postedDate: job.postedDate,
            recruiter: job.recruiter
          } : null
        };
      });

      return enrichedRecommendations;
    } catch (parseError) {
      console.error('Failed to parse job recommendations JSON:', parseError);
      return generateFallbackJobRecommendations(availableJobs, limit);
    }

  } catch (error) {
    console.error('Error generating AI job recommendations:', error);
    return generateFallbackJobRecommendations(availableJobs, limit);
  }
}

// Generate recommendation analysis
export async function generateRecommendationAnalysis(
  userProfile: any,
  recommendations: any[]
): Promise<any> {
  try {
    const prompt = `Analyze the following job recommendations for this user and provide insights about their career trajectory and job search strategy.

USER PROFILE:
- Name: ${userProfile.fullName}
- Current Role: ${userProfile.currentJobTitle || 'Not specified'}
- Experience: ${userProfile.yearsOfExperience || 'Not specified'}
- Skills: ${userProfile.skills.join(', ')}
- Location: ${userProfile.city}, ${userProfile.state}, ${userProfile.country}

RECOMMENDATIONS:
${recommendations.map((rec, index) => `
${index + 1}. ${rec.job?.title} at ${rec.job?.company}
   - Match Score: ${rec.matchScore}/10
   - Priority: ${rec.priority}
   - Reasons: ${rec.reasons.join(', ')}
`).join('\n')}

Provide analysis in this JSON format:
{
  "overallAssessment": "Overall assessment of the user's job search prospects",
  "skillGaps": ["Skill gap 1", "Skill gap 2"],
  "strengths": ["Strength 1", "Strength 2"],
  "marketInsights": {
    "demand": "Current market demand for their skills",
    "trends": ["Trend 1", "Trend 2"],
    "opportunities": ["Opportunity 1", "Opportunity 2"]
  },
  "recommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2"
  ],
  "nextSteps": [
    "Next step 1",
    "Next step 2"
  ]
}`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert career counselor providing strategic career advice. Analyze job recommendations and provide actionable insights for career development."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    try {
      return JSON.parse(response);
    } catch (parseError) {
      console.error('Failed to parse analysis JSON:', parseError);
      return generateFallbackRecommendationAnalysis();
    }

  } catch (error) {
    console.error('Error generating analysis:', error);
    return generateFallbackRecommendationAnalysis();
  }
}

// Fallback job recommendations
export function generateFallbackJobRecommendations(jobs: any[], limit: number): any[] {
  return jobs.slice(0, limit).map((job, index) => ({
    jobId: job.id,
    matchScore: 7.0 - (index * 0.5), // Decreasing score
    reasons: [
      'Good opportunity in your field',
      'Company appears to be growing',
      'Location matches your preferences'
    ],
    strengths: [
      'Relevant job title',
      'Good company reputation',
      'Competitive benefits'
    ],
    considerations: [
      'Review full job description',
      'Consider salary expectations',
      'Evaluate company culture fit'
    ],
    recommendation: 'Worth considering - good match for your profile',
    priority: index < 3 ? 'high' : index < 6 ? 'medium' : 'low',
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      description: job.description,
      requirements: job.requirements,
      responsibilities: job.responsibilities,
      benefits: job.benefits,
      postedDate: job.postedDate,
      recruiter: job.recruiter
    }
  }));
}

// Fallback recommendation analysis
export function generateFallbackRecommendationAnalysis(): any {
  return {
    overallAssessment: "Your profile shows strong potential for career growth. The recommended jobs align well with your skills and experience.",
    skillGaps: ["Consider developing additional technical skills", "Focus on leadership and communication skills"],
    strengths: ["Strong technical foundation", "Good problem-solving abilities", "Relevant experience"],
    marketInsights: {
      demand: "High demand for professionals with your skill set",
      trends: ["Remote work opportunities", "AI and automation integration", "Focus on soft skills"],
      opportunities: ["Senior level positions", "Leadership roles", "Specialized technical roles"]
    },
    recommendations: [
      "Continue building your technical portfolio",
      "Network with professionals in your field",
      "Consider additional certifications"
    ],
    nextSteps: [
      "Apply to the recommended positions",
      "Update your resume with recent achievements",
      "Prepare for technical interviews"
    ]
  };
}

// Fallback feedback if AI fails
export function generateFallbackFeedback(question: string, transcript: string): any {
  const wordCount = transcript.split(' ').length;
  const hasExamples = transcript.toLowerCase().includes('example') || transcript.toLowerCase().includes('instance');
  const hasTechnicalTerms = /(api|database|algorithm|framework|library|tool)/i.test(transcript);
  
  let score = 6.0;
  let communicationScore = 6.0;
  let technicalScore = 6.0;
  
  if (wordCount > 50) score += 1;
  if (hasExamples) score += 1;
  if (hasTechnicalTerms) score += 1;
  
  const strengths = [];
  const weaknesses = [];
  const suggestions = [];
  
  if (wordCount > 50) {
    strengths.push("Good answer length and detail");
  } else {
    weaknesses.push("Answer could be more detailed");
    suggestions.push("Provide more context and examples");
  }
  
  if (hasExamples) {
    strengths.push("Good use of examples");
  } else {
    weaknesses.push("Could benefit from specific examples");
    suggestions.push("Include real-world examples to illustrate your points");
  }
  
  if (hasTechnicalTerms) {
    strengths.push("Shows technical knowledge");
  } else {
    weaknesses.push("Could demonstrate more technical depth");
    suggestions.push("Use technical terminology relevant to the question");
  }
  
  return {
    score: Math.min(10, Math.max(0, score)),
    communicationScore: Math.min(10, Math.max(0, communicationScore)),
    technicalScore: Math.min(10, Math.max(0, technicalScore)),
    strengths: strengths.length > 0 ? strengths : ["Good effort in answering the question"],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Could provide more specific details"],
    suggestions: suggestions.length > 0 ? suggestions : ["Practice providing more detailed responses"],
    overallFeedback: "This is a fallback assessment. The AI feedback system encountered an issue."
  };
}

// Job Description Enhancement Functions

// Enhance job description with AI
export async function enhanceJobDescription(description: string): Promise<any> {
  try {
    const prompt = `You are an expert HR professional and job description writer. Enhance the following job description and extract structured requirements and responsibilities.

JOB DESCRIPTION TO ENHANCE:
"${description}"

Please provide a comprehensive enhancement in the exact JSON format below:

{
  "enhancedDescription": "The improved job description with better language, structure, and ATS optimization",
  "requirements": [
    "Requirement 1",
    "Requirement 2", 
    "Requirement 3"
  ],
  "responsibilities": [
    "Responsibility 1",
    "Responsibility 2",
    "Responsibility 3"
  ],
  "biasAnalysis": {
    "score": 8.5,
    "issues": ["Issue 1", "Issue 2"],
    "suggestions": ["Suggestion 1", "Suggestion 2"]
  },
  "atsOptimization": {
    "score": 9.0,
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "suggestions": ["ATS suggestion 1", "ATS suggestion 2"]
  },
  "readabilityScore": 8.0,
  "suggestions": ["General suggestion 1", "General suggestion 2"]
}

ENHANCEMENT GUIDELINES:
1. Remove gender-biased language (e.g., "rockstar", "ninja", "guru")
2. Use inclusive language and avoid age-related terms
3. Focus on skills and qualifications rather than personal characteristics
4. Include relevant industry keywords for ATS optimization
5. Use clear, professional language
6. Structure with proper headings and bullet points
7. Include specific requirements and responsibilities
8. Add company culture and benefits information if missing
9. Ensure the description is scannable and easy to read
10. Remove unnecessary jargon and acronyms

REQUIREMENTS EXTRACTION:
- Extract 4-6 key requirements from the job description
- Include technical skills, education, experience level
- Focus on must-have qualifications
- Use clear, specific language
- Avoid vague or generic requirements

RESPONSIBILITIES EXTRACTION:
- Extract 4-6 key responsibilities from the job description
- Include daily tasks, projects, and duties
- Focus on what the person will actually do
- Use action-oriented language
- Be specific and measurable where possible

BIAS DETECTION FOCUS:
- Gender bias (masculine/feminine coded words)
- Age bias (terms like "young", "recent graduate", "seasoned")
- Cultural bias (location-specific requirements)
- Disability bias (physical requirements not essential to the role)
- Educational bias (unnecessary degree requirements)

ATS OPTIMIZATION FOCUS:
- Include relevant keywords from the job title and industry
- Use standard job titles and terminology
- Include both technical and soft skills
- Use bullet points for easy scanning
- Include location and salary range if appropriate

Return only the JSON response.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert HR professional specializing in job description writing, bias detection, and ATS optimization. You help recruiters create inclusive, professional, and effective job descriptions. Always return responses in the exact JSON format specified."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    try {
      const result = JSON.parse(response);
      return result;
    } catch (parseError) {
      console.error('Failed to parse job description enhancement JSON:', parseError);
      return generateFallbackJobDescriptionEnhancement(description);
    }

  } catch (error) {
    console.error('Error enhancing job description:', error);
    return generateFallbackJobDescriptionEnhancement(description);
  }
}

// Fallback job description enhancement
export function generateFallbackJobDescriptionEnhancement(description: string): any {
  // Basic enhancement without AI
  let enhanced = description;
  
  // Simple bias detection and replacement
  const biasReplacements = {
    'rockstar': 'expert',
    'ninja': 'specialist',
    'guru': 'expert',
    'young': 'early-career',
    'recent graduate': 'entry-level',
    'seasoned': 'experienced',
    'energetic': 'motivated',
    'dynamic': 'adaptable'
  };

  Object.entries(biasReplacements).forEach(([bias, replacement]) => {
    const regex = new RegExp(`\\b${bias}\\b`, 'gi');
    enhanced = enhanced.replace(regex, replacement);
  });

  // Basic ATS optimization - add common keywords
  const commonKeywords = [
    'collaborative',
    'problem-solving',
    'communication skills',
    'team player',
    'self-motivated',
    'detail-oriented',
    'results-driven'
  ];

  // Add keywords if not present
  const lowerDescription = enhanced.toLowerCase();
  const missingKeywords = commonKeywords.filter(keyword => 
    !lowerDescription.includes(keyword.toLowerCase())
  );

  if (missingKeywords.length > 0) {
    enhanced += `\n\nRequired Skills:\n• ${missingKeywords.slice(0, 3).join('\n• ')}`;
  }

  // Calculate basic scores
  const wordCount = enhanced.split(' ').length;
  const hasBulletPoints = enhanced.includes('•') || enhanced.includes('-');
  const hasKeywords = commonKeywords.some(keyword => 
    lowerDescription.includes(keyword.toLowerCase())
  );

  const biasScore = 7.0; // Basic score after replacements
  const atsScore = hasKeywords && hasBulletPoints ? 8.0 : 6.0;
  const readabilityScore = wordCount > 200 && wordCount < 800 ? 8.0 : 6.0;

  // Extract basic requirements and responsibilities
  const basicRequirements = [
    'Bachelor\'s degree in relevant field',
    '2+ years of relevant experience',
    'Strong communication skills',
    'Problem-solving abilities',
    'Team collaboration skills'
  ];

  const basicResponsibilities = [
    'Execute daily tasks and projects',
    'Collaborate with team members',
    'Meet project deadlines',
    'Maintain quality standards',
    'Contribute to team goals'
  ];

  return {
    enhancedDescription: enhanced,
    requirements: basicRequirements,
    responsibilities: basicResponsibilities,
    biasAnalysis: {
      score: biasScore,
      issues: ['Basic bias detection applied', 'Manual review recommended'],
      suggestions: ['Review for gender-neutral language', 'Ensure inclusive requirements']
    },
    atsOptimization: {
      score: atsScore,
      keywords: commonKeywords.slice(0, 5),
      suggestions: ['Add more industry-specific keywords', 'Include technical skills']
    },
    readabilityScore: readabilityScore,
    suggestions: [
      'Consider adding more specific requirements',
      'Include company culture information',
      'Add salary range if appropriate'
    ]
  };
}

// Career Path Analysis Functions

// Analyze career path and provide recommendations
export async function analyzeCareerPath(
  currentRole: string,
  experience: string,
  skills: string,
  goals: string = ""
): Promise<any> {
  try {
    const prompt = `You are an expert career counselor and professional development advisor. Analyze the following career information and provide comprehensive career guidance.

CURRENT ROLE: ${currentRole}
EXPERIENCE LEVEL: ${experience}
CURRENT SKILLS: ${skills}
CAREER GOALS: ${goals || "Not specified"}

Please provide a detailed career analysis in the exact JSON format below:

{
  "currentLevel": "Senior Level",
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "improvementAreas": ["Area 1", "Area 2", "Area 3"],
  "careerPaths": [
    {
      "title": "Career Path Title",
      "description": "Detailed description of this career path",
      "timeToAchieve": "2-3 years",
      "difficulty": "Intermediate",
             "salaryRange": "₹6,00,000 - ₹9,00,000",
      "growthPotential": 8.5,
      "skills": ["Skill 1", "Skill 2", "Skill 3"],
      "certifications": ["Cert 1", "Cert 2", "Cert 3"],
      "nextSteps": ["Step 1", "Step 2", "Step 3"]
    }
  ],
  "upskillingRecommendations": {
    "skills": ["Skill 1", "Skill 2", "Skill 3"],
    "courses": ["Course 1", "Course 2", "Course 3"],
    "certifications": ["Cert 1", "Cert 2", "Cert 3"]
  },
  "marketInsights": {
    "demand": "High demand in current market",
    "trends": ["Trend 1", "Trend 2", "Trend 3"],
    "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"]
  },
  "studentRoadmaps": [
    {
      "title": "Student Roadmap Title",
      "description": "Detailed description of this educational path",
      "duration": "2-4 years",
      "difficulty": "Intermediate",
      "careerOutcomes": ["Outcome 1", "Outcome 2", "Outcome 3"],
      "milestones": [
        {
          "phase": "Phase 1",
          "duration": "6 months",
          "activities": ["Activity 1", "Activity 2"],
          "skills": ["Skill 1", "Skill 2"]
        }
      ],
      "resources": {
        "courses": ["Course 1", "Course 2"],
        "books": ["Book 1", "Book 2"],
        "projects": ["Project 1", "Project 2"],
        "internships": ["Internship 1", "Internship 2"]
      },
      "certifications": ["Cert 1", "Cert 2"],
      "nextSteps": ["Step 1", "Step 2", "Step 3"]
    }
  ]
}

ANALYSIS GUIDELINES:
1. Provide 3-4 realistic career paths based on their current role and skills
2. Include both lateral moves and vertical promotions
3. Consider industry trends and market demand
4. Provide specific, actionable recommendations
5. Include relevant certifications and courses
6. Consider their experience level and goals
7. Focus on skills that are in high demand
 8. Provide realistic timelines and salary expectations in INR (Indian Rupees)
9. Include both technical and soft skills
10. Consider remote work opportunities and location flexibility

CAREER PATH DIVERSITY:
- Include at least one path in their current field (advancement)
- Include one path in a related field (lateral move)
- Include one path in an emerging field (pivot)
- Include one path in leadership/management (if applicable)

MARKET ANALYSIS:
- Research current job market trends
- Consider remote work opportunities
- Include salary ranges in INR based on location and experience
- Mention in-demand skills and technologies
- Consider industry growth projections

STUDENT ROADMAP GUIDELINES:
- Provide 3 comprehensive educational roadmaps: Foundation Path, Advanced Specialization Path, and Professional Advancement Path
- Include detailed step-by-step learning milestones with specific timelines
- Focus on practical projects and hands-on experience with project descriptions
- Include extensive lists of relevant courses, books, tutorials, and resources
- Suggest internships, practical experience opportunities, and networking events
- Provide clear career outcomes, job prospects, and salary expectations
- Include recommended certifications, credentials, and skill assessments
- Consider different learning styles, time commitments, and learning paths
- Focus on building a strong foundation, portfolio, and professional network
- Include detailed weekly/monthly learning schedules and study plans
- Provide specific project ideas with difficulty levels and estimated completion times
- Include mentorship opportunities, study groups, and community engagement
- Detail assessment methods, progress tracking, and milestone evaluations
- Include industry-specific tools, technologies, and best practices
- Provide guidance on building online presence, GitHub profile, and professional branding
- Include professional roadmaps for experienced professionals seeking career advancement
- Focus on leadership development, management skills, and strategic thinking
- Include career transition options and salary progression paths
- Provide guidance on building industry recognition and thought leadership

Return only the JSON response.`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert career counselor with deep knowledge of job markets, career progression, and professional development. You help professionals identify growth opportunities, plan their career paths, and make informed decisions about their professional development. Always return responses in the exact JSON format specified."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    try {
      const result = JSON.parse(response);
      return result;
    } catch (parseError) {
      console.error('Failed to parse career path analysis JSON:', parseError);
      return generateFallbackCareerAnalysis(currentRole, experience, skills, goals);
    }

  } catch (error) {
    console.error('Error analyzing career path:', error);
    return generateFallbackCareerAnalysis(currentRole, experience, skills, goals);
  }
}

// Fallback career analysis
export function generateFallbackCareerAnalysis(
  currentRole: string,
  experience: string,
  skills: string,
  goals: string
): any {
  const experienceLevel = experience.includes('0-1') ? 'Entry Level' :
                         experience.includes('2-3') ? 'Junior Level' :
                         experience.includes('4-6') ? 'Mid Level' :
                         experience.includes('7-10') ? 'Senior Level' : 'Expert Level';
  
  // Salary ranges based on experience level (in INR)
  const getSalaryRange = (level: string) => {
    switch (level) {
      case 'Entry Level': return '₹3,00,000 - ₹5,00,000';
      case 'Junior Level': return '₹4,00,000 - ₹6,50,000';
      case 'Mid Level': return '₹5,50,000 - ₹8,50,000';
      case 'Senior Level': return '₹7,00,000 - ₹12,00,000';
      case 'Expert Level': return '₹10,00,000 - ₹20,00,000';
      default: return '₹4,00,000 - ₹7,00,000';
    }
  };

  const basicCareerPaths = [
    {
      title: `${currentRole} - Senior Level`,
      description: `Advance to senior level in your current role with increased responsibilities and leadership opportunities.`,
      timeToAchieve: "1-2 years",
      difficulty: "Intermediate",
      salaryRange: getSalaryRange('Senior Level'),
      growthPotential: 7.5,
      skills: ["Leadership", "Advanced Technical Skills", "Mentoring"],
      certifications: ["Professional Certification", "Leadership Course"],
      nextSteps: ["Take on more complex projects", "Mentor junior team members", "Lead a team"]
    },
    {
      title: "Team Lead / Manager",
      description: `Transition to a leadership role managing a team of ${currentRole.toLowerCase()}s.`,
      timeToAchieve: "2-3 years",
      difficulty: "Advanced",
      salaryRange: getSalaryRange('Senior Level'),
      growthPotential: 8.0,
      skills: ["Team Management", "Project Planning", "Communication"],
      certifications: ["PMP Certification", "Management Course"],
      nextSteps: ["Develop leadership skills", "Take management courses", "Lead small projects"]
    },
    {
      title: "Technical Specialist",
      description: `Become a subject matter expert in a specific area of ${currentRole.toLowerCase()}.`,
      timeToAchieve: "1-2 years",
      difficulty: "Intermediate",
      salaryRange: getSalaryRange('Mid Level'),
      growthPotential: 7.0,
      skills: ["Deep Technical Knowledge", "Problem Solving", "Innovation"],
      certifications: ["Advanced Technical Certification", "Specialized Training"],
      nextSteps: ["Choose specialization area", "Get advanced training", "Contribute to open source"]
    }
  ];

  return {
    currentLevel: experienceLevel,
    strengths: ["Strong technical foundation", "Good problem-solving skills", "Adaptable to new technologies"],
    improvementAreas: ["Leadership skills", "Communication", "Project management"],
    careerPaths: basicCareerPaths,
    upskillingRecommendations: {
      skills: ["Leadership", "Communication", "Project Management", "Advanced Technical Skills"],
      courses: ["Leadership Development", "Project Management Fundamentals", "Advanced Technical Training"],
      certifications: ["Professional Certification", "Leadership Certificate", "Technical Specialization"]
    },
    marketInsights: {
      demand: "High demand for experienced professionals in this field across Indian IT hubs",
      trends: ["Remote work opportunities", "AI and automation integration", "Focus on soft skills", "Digital transformation", "Startup ecosystem growth"],
      opportunities: ["Remote positions", "Startup opportunities in Bangalore/Mumbai", "Consulting roles", "Freelance work", "Product companies", "Service-based companies"]
    },
    studentRoadmaps: [
      {
        title: `${currentRole} - Comprehensive Foundation Path`,
        description: `A detailed, step-by-step roadmap to build a strong foundation in ${currentRole.toLowerCase()} through structured learning, hands-on projects, and professional development. This roadmap is designed for complete beginners and provides a clear path to entry-level positions.`,
        duration: "12-18 months",
        difficulty: "Beginner to Intermediate",
        timeCommitment: "15-20 hours per week",
        careerOutcomes: [
          "Entry-level position with ₹3,00,000 - ₹5,00,000 salary",
          "Strong foundation for rapid career growth",
          "Comprehensive portfolio with 5-8 projects",
          "Professional network and industry connections",
          "Industry-recognized certifications",
          "Confidence to tackle real-world challenges"
        ],
        prerequisites: [
          "Basic computer literacy",
          "High school mathematics",
          "Willingness to learn and practice daily",
          "Access to computer and internet",
          "Commitment to 15-20 hours per week"
        ],
        milestones: [
          {
            phase: "Foundation Learning (Months 1-3)",
            duration: "3 months",
            weeklyHours: "15-20 hours",
            activities: [
              "Complete comprehensive online courses (2-3 courses)",
              "Set up development environment and tools",
              "Join 3-5 relevant online communities",
              "Create learning schedule and track progress",
              "Start building basic projects (2-3 small projects)",
              "Attend virtual meetups and webinars",
              "Begin networking with professionals in the field"
            ],
            skills: [
              "Core technical concepts and fundamentals",
              "Basic tools and software proficiency",
              "Problem-solving and logical thinking",
              "Version control (Git/GitHub)",
              "Basic project management",
              "Research and self-learning techniques"
            ],
            projects: [
              {
                name: "Hello World Project",
                description: "First project to understand basic concepts",
                duration: "1 week",
                difficulty: "Beginner",
                skills: ["Basic syntax", "Environment setup"]
              },
              {
                name: "Personal Learning Blog",
                description: "Document your learning journey",
                duration: "2 weeks",
                difficulty: "Beginner",
                skills: ["Documentation", "Basic web development"]
              },
              {
                name: "Calculator Application",
                description: "Build a simple calculator with basic operations",
                duration: "3 weeks",
                difficulty: "Beginner-Intermediate",
                skills: ["Logic implementation", "User interface"]
              }
            ],
            assessments: [
              "Weekly coding challenges",
              "Monthly project reviews",
              "Peer code reviews",
              "Self-assessment quizzes",
              "Progress tracking journal"
            ]
          },
          {
            phase: "Skill Building (Months 4-8)",
            duration: "5 months",
            weeklyHours: "18-20 hours",
            activities: [
              "Complete intermediate-level courses",
              "Work on 4-5 medium-complexity projects",
              "Contribute to open source projects",
              "Participate in coding competitions",
              "Attend workshops and conferences",
              "Start building professional network",
              "Create detailed portfolio website",
              "Begin job search preparation"
            ],
            skills: [
              "Intermediate technical skills",
              "Project management and planning",
              "Collaboration and teamwork",
              "Code review and best practices",
              "Testing and debugging",
              "Documentation and communication"
            ],
            projects: [
              {
                name: "E-commerce Website",
                description: "Full-stack e-commerce application with user authentication",
                duration: "6 weeks",
                difficulty: "Intermediate",
                skills: ["Full-stack development", "Database design", "User authentication"]
              },
              {
                name: "API Integration Project",
                description: "Build application that integrates with external APIs",
                duration: "4 weeks",
                difficulty: "Intermediate",
                skills: ["API integration", "Data processing", "Error handling"]
              },
              {
                name: "Mobile Application",
                description: "Cross-platform mobile app with core functionality",
                duration: "8 weeks",
                difficulty: "Intermediate-Advanced",
                skills: ["Mobile development", "UI/UX design", "Performance optimization"]
              }
            ],
            assessments: [
              "Monthly technical interviews (mock)",
              "Project portfolio reviews",
              "Code quality assessments",
              "Peer feedback sessions",
              "Industry mentor evaluations"
            ]
          },
          {
            phase: "Professional Preparation (Months 9-12)",
            duration: "4 months",
            weeklyHours: "20+ hours",
            activities: [
              "Complete advanced courses and specializations",
              "Build 2-3 complex, production-ready projects",
              "Contribute significantly to open source",
              "Complete internships or freelance work",
              "Prepare for technical interviews",
              "Build strong professional network",
              "Create comprehensive portfolio",
              "Apply for entry-level positions"
            ],
            skills: [
              "Advanced technical expertise",
              "Production-ready development",
              "System design and architecture",
              "Performance optimization",
              "Security best practices",
              "Professional communication"
            ],
            projects: [
              {
                name: "Full-Stack Web Application",
                description: "Production-ready web application with all modern features",
                duration: "10 weeks",
                difficulty: "Advanced",
                skills: ["Full-stack expertise", "Deployment", "Monitoring"]
              },
              {
                name: "Open Source Contribution",
                description: "Significant contribution to popular open source project",
                duration: "8 weeks",
                difficulty: "Advanced",
                skills: ["Open source collaboration", "Code review", "Community engagement"]
              }
            ],
            assessments: [
              "Technical interview preparation",
              "Portfolio presentation",
              "Industry project reviews",
              "Professional skill assessments",
              "Career readiness evaluation"
            ]
          }
        ],
        resources: {
          courses: [
            "Complete Beginner Course (Coursera/Udemy) - 40 hours",
            "Intermediate Specialization - 60 hours",
            "Advanced Project-Based Course - 80 hours",
            "Industry-Specific Certification - 30 hours",
            "Soft Skills and Communication - 20 hours"
          ],
          books: [
            "Fundamentals: 'Clean Code' by Robert Martin",
            "Practice: 'Cracking the Coding Interview' by Gayle McDowell",
            "Industry Insights: 'The Pragmatic Programmer' by Hunt & Thomas",
            "Career Guide: 'Soft Skills' by John Sonmez",
            "Technical Deep Dive: Industry-specific technical books"
          ],
          tutorials: [
            "YouTube: FreeCodeCamp, Traversy Media, The Net Ninja",
            "Interactive: Codecademy, freeCodeCamp, Khan Academy",
            "Documentation: Official language/framework documentation",
            "Blogs: Dev.to, Medium, personal blogs of industry experts",
            "Podcasts: Software Engineering Daily, CodeNewbie"
          ],
          projects: [
            "Portfolio Website with Blog",
            "E-commerce Application",
            "Social Media Dashboard",
            "API Integration Project",
            "Mobile Application",
            "Open Source Contribution",
            "Data Analysis Project",
            "Machine Learning Model"
          ],
          internships: [
            "Summer Internship Program (3 months)",
            "Part-time Remote Internship (6 months)",
            "Volunteer Work for Non-profits",
            "Freelance Projects on Upwork/Fiverr",
            "Startup Internship Programs",
            "Corporate Internship Programs"
          ],
          communities: [
            "GitHub: Contribute to open source projects",
            "Discord/Slack: Join developer communities",
            "Meetup.com: Attend local tech meetups",
            "LinkedIn: Connect with industry professionals",
            "Reddit: r/learnprogramming, r/cscareerquestions",
            "Stack Overflow: Ask questions and help others"
          ]
        },
        certifications: [
          "Industry-Recognized Technical Certification",
          "Project Management Fundamentals (PMP)",
          "Cloud Platform Certification (AWS/Azure/GCP)",
          "Agile/Scrum Master Certification",
          "Soft Skills and Communication Certificate"
        ],
        mentorship: {
          description: "Connect with industry professionals for guidance and career advice",
          opportunities: [
            "Find mentor through LinkedIn or professional networks",
            "Join mentorship programs offered by tech companies",
            "Participate in coding bootcamp mentorship programs",
            "Connect with alumni from your educational background",
            "Join online mentorship platforms like ADPList"
          ],
          expectations: [
            "Monthly 1-hour mentoring sessions",
            "Code review and feedback",
            "Career guidance and advice",
            "Industry insights and trends",
            "Network introductions and referrals"
          ]
        },
        studySchedule: {
          weekly: {
            monday: "2-3 hours: Course content and theory",
            tuesday: "2-3 hours: Hands-on practice and coding",
            wednesday: "2-3 hours: Project work and implementation",
            thursday: "2-3 hours: Review, debug, and optimize",
            friday: "2-3 hours: New concepts and exploration",
            saturday: "4-5 hours: Major project work and portfolio building",
            sunday: "3-4 hours: Review, planning, and community engagement"
          },
          monthly: {
            week1: "Focus on new concepts and learning",
            week2: "Practice and hands-on application",
            week3: "Project work and implementation",
            week4: "Review, assessment, and planning next month"
          }
        },
        assessmentMethods: [
          "Weekly coding challenges and problem-solving",
          "Monthly project reviews and presentations",
          "Peer code reviews and feedback sessions",
          "Self-assessment quizzes and reflection journals",
          "Industry mentor evaluations and feedback",
          "Portfolio reviews and improvement suggestions",
          "Mock technical interviews and preparation",
          "Community engagement and contribution tracking"
        ],
        nextSteps: [
          "Set up development environment and accounts",
          "Create detailed learning schedule and timeline",
          "Join 3-5 relevant online communities",
          "Start with the foundation course immediately",
          "Set up project tracking and portfolio website",
          "Connect with potential mentors and industry professionals",
          "Begin documenting your learning journey",
          "Start building your professional network"
        ],
        successMetrics: [
          "Complete 5-8 substantial projects in portfolio",
          "Contribute to 2-3 open source projects",
          "Build network of 50+ industry professionals",
          "Earn 2-3 relevant certifications",
          "Successfully complete 3+ technical interviews",
          "Secure entry-level position or internship",
          "Maintain consistent learning and practice schedule",
          "Develop strong problem-solving and communication skills"
        ]
      },
      {
        title: `${currentRole} - Advanced Specialization Path`,
        description: `An intensive roadmap for students with some technical background who want to specialize in specific areas of ${currentRole.toLowerCase()} and advance quickly to mid-level positions.`,
        duration: "8-12 months",
        difficulty: "Intermediate to Advanced",
        timeCommitment: "25-30 hours per week",
        careerOutcomes: [
          "Mid-level position with ₹5,50,000 - ₹8,50,000 salary",
          "Specialized expertise in chosen domain",
          "Advanced portfolio with 8-12 complex projects",
          "Strong industry network and recognition",
          "Multiple industry certifications"
        ],
        prerequisites: [
          "1-2 years of programming experience",
          "Basic understanding of software development",
          "Completed foundation-level courses",
          "Portfolio with 2-3 basic projects"
        ],
        milestones: [
          {
            phase: "Specialization Foundation (Months 1-3)",
            duration: "3 months",
            weeklyHours: "25-30 hours",
            activities: [
              "Choose specialization area (Frontend, Backend, Mobile, Data Science)",
              "Complete advanced courses in chosen specialization",
              "Set up professional development environment",
              "Join specialized communities and forums",
              "Start contributing to open source projects",
              "Build 3-4 intermediate-level projects"
            ],
            skills: [
              "Advanced technical concepts in specialization",
              "Industry-standard tools and frameworks",
              "System design and architecture principles",
              "Performance optimization techniques",
              "Testing and quality assurance"
            ],
            projects: [
              {
                name: "Specialized Portfolio Project",
                description: "Comprehensive project showcasing specialization skills",
                duration: "6 weeks",
                difficulty: "Intermediate-Advanced",
                skills: ["Specialized frameworks", "Advanced patterns", "Performance optimization"]
              }
            ],
            assessments: [
              "Technical skill assessments",
              "Code quality reviews",
              "Project complexity evaluations",
              "Industry mentor feedback"
            ]
          },
          {
            phase: "Advanced Implementation (Months 4-7)",
            duration: "4 months",
            weeklyHours: "28-30 hours",
            activities: [
              "Complete advanced specializations and certifications",
              "Build 4-5 production-ready projects",
              "Lead open source project contributions",
              "Participate in hackathons and competitions",
              "Mentor junior developers",
              "Start freelancing or consulting work"
            ],
            skills: [
              "Expert-level technical expertise",
              "System architecture and design",
              "Leadership and mentoring",
              "Project management and planning",
              "Client communication and requirements"
            ],
            projects: [
              {
                name: "Production-Ready Application",
                description: "Full-scale application with deployment and monitoring",
                duration: "10 weeks",
                difficulty: "Advanced",
                skills: ["Full-stack expertise", "DevOps", "Scalability", "Security"]
              }
            ],
            assessments: [
              "Senior-level technical interviews",
              "Portfolio and project presentations",
              "Leadership and mentoring evaluations",
              "Industry expert reviews"
            ]
          }
        ],
        resources: {
          courses: [
            "Advanced Specialization Course - 100 hours",
            "Expert-Level Certification Program - 80 hours",
            "System Design and Architecture - 60 hours",
            "Leadership and Management - 40 hours"
          ],
          books: [
            "System Design: 'Designing Data-Intensive Applications' by Martin Kleppmann",
            "Architecture: 'Clean Architecture' by Robert Martin",
            "Leadership: 'The Manager's Path' by Camille Fournier",
            "Business: 'The Lean Startup' by Eric Ries"
          ],
          tutorials: [
            "Advanced YouTube channels and technical content",
            "Professional development platforms and courses",
            "Industry conference talks and presentations",
            "Technical blogs and publications"
          ],
          projects: [
            "Enterprise Web Application",
            "Mobile App with Backend",
            "Data Pipeline and Analytics",
            "Machine Learning Model",
            "Open Source Library/Tool"
          ]
        },
        certifications: [
          "Expert-Level Technical Certification",
          "System Design and Architecture Certification",
          "Cloud Platform Expert Certification",
          "Leadership and Management Certification"
        ],
        studySchedule: {
          weekly: {
            monday: "3-4 hours: Advanced course content and theory",
            tuesday: "3-4 hours: Hands-on practice and implementation",
            wednesday: "3-4 hours: Project work and development",
            thursday: "3-4 hours: Code review, optimization, and testing",
            friday: "3-4 hours: New technologies and exploration",
            saturday: "6-8 hours: Major project work and portfolio building",
            sunday: "4-6 hours: Review, planning, and community engagement"
          }
        },
        nextSteps: [
          "Choose specialization area and set learning goals",
          "Set up advanced development environment and tools",
          "Join specialized communities and professional groups",
          "Start advanced courses and certification programs",
          "Begin contributing to open source projects"
        ],
        successMetrics: [
          "Complete 8-12 advanced projects in portfolio",
          "Lead or significantly contribute to 3-5 open source projects",
          "Build network of 100+ industry professionals",
          "Earn 3-5 advanced certifications",
          "Secure mid-level position or advanced internship"
        ]
      },
      {
        title: `${currentRole} - Professional Advancement Path`,
        description: `A comprehensive roadmap for experienced professionals looking to advance their careers, transition to new roles, or develop leadership skills.`,
        duration: "6-12 months",
        difficulty: "Advanced to Expert",
        timeCommitment: "10-15 hours per week",
        careerOutcomes: [
          "Senior-level position with ₹7,00,000 - ₹12,00,000 salary",
          "Leadership or management role",
          "Expert-level technical expertise",
          "Strong industry recognition and network"
        ],
        prerequisites: [
          "3+ years of professional experience",
          "Current mid-level position or equivalent",
          "Strong technical foundation",
          "Portfolio with 5+ professional projects"
        ],
        milestones: [
          {
            phase: "Skill Enhancement & Specialization (Months 1-4)",
            duration: "4 months",
            weeklyHours: "10-12 hours",
            activities: [
              "Identify skill gaps and career goals",
              "Complete advanced courses and specializations",
              "Obtain industry-recognized certifications",
              "Contribute to open source projects",
              "Attend professional conferences and workshops"
            ],
            skills: [
              "Advanced technical expertise in chosen domain",
              "System design and architecture mastery",
              "Leadership and team management",
              "Strategic thinking and planning"
            ],
            projects: [
              {
                name: "Technical Leadership Project",
                description: "Lead a complex technical project or initiative",
                duration: "8 weeks",
                difficulty: "Advanced",
                skills: ["Project leadership", "Technical architecture", "Team coordination"]
              }
            ],
            assessments: [
              "360-degree feedback from peers and managers",
              "Technical skill assessments and certifications",
              "Leadership competency evaluations"
            ]
          },
          {
            phase: "Leadership Development (Months 5-8)",
            duration: "4 months",
            weeklyHours: "12-15 hours",
            activities: [
              "Complete leadership and management courses",
              "Take on mentoring responsibilities",
              "Lead cross-functional projects",
              "Speak at conferences and meetups"
            ],
            skills: [
              "Advanced leadership and management",
              "Strategic planning and execution",
              "Team building and development",
              "Business strategy and operations"
            ],
            projects: [
              {
                name: "Team Leadership Initiative",
                description: "Lead a team of 3-5 professionals on a major project",
                duration: "10 weeks",
                difficulty: "Expert",
                skills: ["Team leadership", "Project management", "Stakeholder communication"]
              }
            ],
            assessments: [
              "Leadership competency assessments",
              "Team feedback and 360-degree reviews",
              "Business impact and results measurement"
            ]
          }
        ],
        resources: {
          courses: [
            "Executive Leadership Program - 60 hours",
            "Advanced Technical Specialization - 80 hours",
            "Business Strategy and Management - 50 hours",
            "Digital Transformation Leadership - 40 hours"
          ],
          books: [
            "Leadership: 'The 7 Habits of Highly Effective People' by Stephen Covey",
            "Strategy: 'Good to Great' by Jim Collins",
            "Management: 'The Manager's Path' by Camille Fournier",
            "Innovation: 'The Lean Startup' by Eric Ries"
          ],
          tutorials: [
            "Executive education platforms and courses",
            "Leadership development programs",
            "Industry conference talks and presentations",
            "Business and management podcasts"
          ],
          projects: [
            "Strategic Business Initiative",
            "Team Leadership and Management",
            "Industry Conference Presentation",
            "Mentorship Program Development"
          ]
        },
        certifications: [
          "Executive Leadership Certification",
          "Advanced Technical Specialization",
          "Project Management Professional (PMP)",
          "Business Strategy and Management"
        ],
        studySchedule: {
          weekly: {
            monday: "2-3 hours: Leadership and management courses",
            tuesday: "2-3 hours: Technical skill development",
            wednesday: "2-3 hours: Business strategy and planning",
            thursday: "2-3 hours: Networking and relationship building",
            friday: "2-3 hours: Project work and implementation",
            saturday: "4-6 hours: Major projects and portfolio building",
            sunday: "2-3 hours: Review, planning, and reflection"
          }
        },
        nextSteps: [
          "Conduct comprehensive career assessment and goal setting",
          "Identify skill gaps and development areas",
          "Create detailed professional development plan",
          "Join executive and leadership networks",
          "Start advanced courses and certification programs"
        ],
        successMetrics: [
          "Complete 3-5 advanced certifications",
          "Build network of 200+ industry professionals",
          "Lead 2-3 major projects or initiatives",
          "Speak at 2+ industry conferences or events",
          "Secure senior-level position or promotion"
        ]
      }
    ]
  };
}

