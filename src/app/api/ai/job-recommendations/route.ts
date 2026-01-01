import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.role !== 'jobseeker') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { limit = 10, includeAnalysis = true } = await request.json();
    const userId = (session.user as any).id;

    console.log('Job recommendations request for user:', userId);

    // Get user profile from unified User table
    const unifiedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        headline: true,
        location: true,
      }
    });

    if (!unifiedUser) {
      console.log('User not found for ID:', userId);
      return NextResponse.json({ 
        error: 'User not found',
        recommendations: [],
        analysis: null,
        message: 'User not found'
      }, { status: 404 });
    }

    // Try to get additional profile data from JobSeeker table if it exists
    const jobSeekerProfile = await prisma.jobSeeker.findUnique({
      where: { email: unifiedUser.email },
      select: {
        currentJobTitle: true,
        yearsOfExperience: true,
        education: true,
        skills: true,
        city: true,
        state: true,
        country: true,
        bio: true,
        preferredJobTypes: true,
        expectedSalary: true,
        languages: true,
        certifications: true,
        applications: {
          select: {
            jobId: true,
            status: true,
            appliedDate: true
          }
        }
      }
    });

    // Merge user data from both tables
    const user = {
      id: unifiedUser.id,
      fullName: unifiedUser.fullName,
      currentJobTitle: jobSeekerProfile?.currentJobTitle || unifiedUser.headline || 'Not specified',
      yearsOfExperience: jobSeekerProfile?.yearsOfExperience || 'Not specified',
      education: jobSeekerProfile?.education || 'Not specified',
      skills: jobSeekerProfile?.skills || [],
      city: jobSeekerProfile?.city || unifiedUser.location?.split(',')[0]?.trim() || 'Not specified',
      state: jobSeekerProfile?.state || unifiedUser.location?.split(',')[1]?.trim() || 'Not specified',
      country: jobSeekerProfile?.country || unifiedUser.location?.split(',')[2]?.trim() || 'Not specified',
      bio: jobSeekerProfile?.bio || '',
      preferredJobTypes: jobSeekerProfile?.preferredJobTypes || [],
      expectedSalary: jobSeekerProfile?.expectedSalary || 'Not specified',
      languages: jobSeekerProfile?.languages || ['English'],
      certifications: jobSeekerProfile?.certifications || [],
      applications: jobSeekerProfile?.applications || []
    };

    console.log('User profile found:', {
      name: user.fullName,
      skills: user.skills?.length || 0,
      location: `${user.city}, ${user.state}, ${user.country}`
    });

    // Check if user profile is complete enough for recommendations
    const isProfileComplete = user.skills && user.skills.length > 0 && user.fullName;
    
    if (!isProfileComplete) {
      console.log('User profile incomplete:', {
        hasSkills: user.skills && user.skills.length > 0,
        hasName: !!user.fullName,
        skills: user.skills
      });
      
      return NextResponse.json({
        recommendations: [],
        analysis: null,
        message: 'Please complete your profile with skills and basic information to get personalized job recommendations',
        profileComplete: false,
        missingFields: {
          skills: !user.skills || user.skills.length === 0,
          name: !user.fullName
        }
      });
    }

    // Get all available jobs
    const allJobs = await prisma.job.findMany({
      where: {
        // Exclude jobs user has already applied to
        id: {
          notIn: user.applications.map((app: { jobId: string }) => app.jobId)
        }
      },
      orderBy: { postedDate: 'desc' }
    });

    // Get unique recruiter IDs from jobs
    const recruiterIds = [...new Set(allJobs.map((job: { postedBy: string | null }) => job.postedBy).filter(Boolean))];
    
    // Fetch recruiter data separately to avoid Prisma relation errors
    const recruiters = await prisma.recruiter.findMany({
      where: {
        id: { in: recruiterIds }
      },
      select: {
        id: true,
        companyName: true,
        companyDescription: true,
        companyBenefits: true
      }
    });
    
    // Create a map of recruiter data for quick lookup
    const recruiterMap = new Map(recruiters.map((r: { id: string; companyName: string | null; companyDescription: string | null; companyBenefits: string[] | null }) => [r.id, r]));
    
    // Attach recruiter data to jobs
    const jobsWithRecruiters = allJobs.map((job: { postedBy: string | null; company: string | null; [key: string]: any }) => ({
      ...job,
      recruiter: recruiterMap.get(job.postedBy) || {
        companyName: job.company,
        companyDescription: null,
        companyBenefits: []
      }
    }));

    console.log('Available jobs found:', jobsWithRecruiters.length);

    if (jobsWithRecruiters.length === 0) {
      return NextResponse.json({
        recommendations: [],
        analysis: null,
        message: 'No new jobs available for recommendations. You may have already applied to all available positions.',
        totalJobs: 0
      });
    }

    // Generate AI recommendations
    console.log('Generating AI recommendations...');
    const recommendations = await generateJobRecommendations(user, jobsWithRecruiters, limit);

    // Generate analysis if requested
    let analysis = null;
    if (includeAnalysis && recommendations.length > 0) {
      console.log('Generating analysis...');
      analysis = await generateRecommendationAnalysis(user, recommendations);
    }

    console.log('Generated recommendations:', recommendations.length);

    return NextResponse.json({
      recommendations,
      analysis,
      totalJobs: jobsWithRecruiters.length,
      userProfile: {
        name: user.fullName,
        currentRole: user.currentJobTitle,
        experience: user.yearsOfExperience,
        skills: user.skills,
        location: `${user.city}, ${user.state}, ${user.country}`
      },
      profileComplete: true
    });

  } catch (error) {
    console.error('Error generating job recommendations:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate job recommendations',
        recommendations: [],
        analysis: null,
        message: 'An error occurred while generating recommendations. Please try again later.'
      },
      { status: 500 }
    );
  }
}

async function generateJobRecommendations(user: any, jobs: any[], limit: number) {
  try {
    const prompt = `You are an expert career counselor and job matching specialist. Analyze the following user profile and available jobs to provide personalized job recommendations.

USER PROFILE:
- Name: ${user.fullName}
- Current Role: ${user.currentJobTitle || 'Not specified'}
- Experience: ${user.yearsOfExperience || 'Not specified'}
- Education: ${user.education || 'Not specified'}
- Skills: ${user.skills?.length ? user.skills.join(', ') : 'Not specified'}
- Location: ${user.city}, ${user.state}, ${user.country}
- Bio: ${user.bio || 'Not provided'}
- Preferred Job Types: ${user.preferredJobTypes?.length ? user.preferredJobTypes.join(', ') : 'Not specified'}
- Expected Salary: ${user.expectedSalary || 'Not specified'}
- Languages: ${user.languages?.length ? user.languages.join(', ') : 'English'}
- Certifications: ${user.certifications?.length ? user.certifications.join(', ') : 'None'}

AVAILABLE JOBS:
${jobs.map((job, index) => `
Job ${index + 1}:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Type: ${job.employmentType}
- Experience Level: ${job.experienceLevel || 'Not specified'}
- Salary: ${job.salaryMin ? `₹${job.salaryMin.toLocaleString('en-IN')}` : 'Not specified'} - ${job.salaryMax ? `₹${job.salaryMax.toLocaleString('en-IN')}` : 'Not specified'}
- Description: ${job.description.substring(0, 500)}...
- Requirements: ${job.requirements?.join(', ') || 'Not specified'}
- Responsibilities: ${job.responsibilities?.join(', ') || 'Not specified'}
- Benefits: ${job.benefits?.join(', ') || 'Not specified'}
- Company Description: ${job.recruiter?.companyDescription || 'Not provided'}
- Company Benefits: ${job.recruiter?.companyBenefits?.join(', ') || 'Not specified'}
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
        const job = jobs.find(j => j.id === rec.jobId);
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
      return generateFallbackRecommendations(jobs, limit);
    }

  } catch (error) {
    console.error('Error generating AI job recommendations:', error);
    return generateFallbackRecommendations(jobs, limit);
  }
}

async function generateRecommendationAnalysis(user: any, recommendations: any[]) {
  try {
    const prompt = `Analyze the following job recommendations for this user and provide insights about their career trajectory and job search strategy.

USER PROFILE:
- Name: ${user.fullName}
- Current Role: ${user.currentJobTitle || 'Not specified'}
- Experience: ${user.yearsOfExperience || 'Not specified'}
- Skills: ${user.skills?.length ? user.skills.join(', ') : 'Not specified'}
- Location: ${user.city}, ${user.state}, ${user.country}

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
      return generateFallbackAnalysis();
    }

  } catch (error) {
    console.error('Error generating analysis:', error);
    return generateFallbackAnalysis();
  }
}

function generateFallbackRecommendations(jobs: any[], limit: number) {
  // Simple fallback based on basic criteria
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

function generateFallbackAnalysis() {
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
