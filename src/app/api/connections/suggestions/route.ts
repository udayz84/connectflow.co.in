import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/connections/suggestions - Get connection suggestions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get current user's connections to exclude them from suggestions
    const userConnections = await prisma.connection.findMany({
      where: {
        OR: [
          { userId: currentUserId },
          { connectedUserId: currentUserId }
        ]
      },
      select: {
        userId: true,
        connectedUserId: true
      }
    });

    const connectedUserIds = new Set([
      currentUserId,
      ...userConnections.map((conn: { userId: string; connectedUserId: string }) => 
        conn.userId === currentUserId ? conn.connectedUserId : conn.userId
      )
    ]);

    // Get current user's profile for matching - check all user tables
    let currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        role: true,
        location: true,
        headline: true
      }
    });

    // If not found in User table, try JobSeeker table
    if (!currentUser) {
      const jobSeeker = await prisma.jobSeeker.findUnique({
        where: { id: currentUserId },
        select: {
          city: true,
          state: true,
          country: true
        }
      });

      if (jobSeeker) {
        currentUser = {
          role: 'jobseeker',
          location: [jobSeeker.city, jobSeeker.state, jobSeeker.country].filter(Boolean).join(', '),
          headline: null
        };
      } else {
        // Try Recruiter table
        const recruiter = await prisma.recruiter.findUnique({
          where: { id: currentUserId },
          select: {
            city: true,
            state: true,
            country: true
          }
        });

        if (recruiter) {
          currentUser = {
            role: 'recruiter',
            location: [recruiter.city, recruiter.state, recruiter.country].filter(Boolean).join(', '),
            headline: null
          };
        }
      }
    }

    // Add location-based filtering if available
    const currentUserCity = currentUser?.location?.split(',')[0];

    // Get suggestions from both JobSeeker and Recruiter tables
    const [jobSeekerSuggestions, recruiterSuggestions] = await Promise.all([
      prisma.jobSeeker.findMany({
        where: {
          id: { notIn: Array.from(connectedUserIds) },
          isActive: true,
          ...(currentUserCity && {
            city: {
              contains: currentUserCity,
              mode: 'insensitive'
            }
          })
        },
        select: {
          id: true,
          fullName: true,
          currentJobTitle: true,
          city: true,
          state: true,
          country: true,
          skills: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 2)
      }),
      prisma.recruiter.findMany({
        where: {
          id: { notIn: Array.from(connectedUserIds) },
          isActive: true,
          ...(currentUserCity && {
            city: {
              contains: currentUserCity,
              mode: 'insensitive'
            }
          })
        },
        select: {
          id: true,
          fullName: true,
          companyName: true,
          position: true,
          city: true,
          state: true,
          country: true,
          industry: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 2)
      })
    ]);

    // Helper function to get or create unified User ID from legacy tables
    const getUnifiedUserId = async (email: string, role: 'jobseeker' | 'recruiter', legacyData: any) => {
      const unifiedUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: email.toLowerCase().trim(),
            mode: 'insensitive'
          }
        },
        select: { id: true }
      });

      if (unifiedUser) {
        return unifiedUser.id;
      }

      // Create unified user if doesn't exist
      const newUnifiedUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          fullName: legacyData.fullName,
          role: role,
          location: [legacyData.city, legacyData.state, legacyData.country].filter(Boolean).join(', ') || null,
          headline: role === 'jobseeker' ? legacyData.currentJobTitle : legacyData.position,
          companyName: role === 'recruiter' ? legacyData.companyName : null
        }
      });
      return newUnifiedUser.id;
    };

    // Get emails for all suggestions to map to unified User IDs
    const jobSeekerEmails = await prisma.jobSeeker.findMany({
      where: {
        id: { in: jobSeekerSuggestions.map((u: { id: string }) => u.id) }
      },
      select: { id: true, email: true }
    });

    const recruiterEmails = await prisma.recruiter.findMany({
      where: {
        id: { in: recruiterSuggestions.map((u: { id: string }) => u.id) }
      },
      select: { id: true, email: true }
    });

    const emailMap = new Map<string, string>([
      ...jobSeekerEmails.map((u: { id: string; email: string | null }) => [u.id, u.email] as [string, string]),
      ...recruiterEmails.map((u: { id: string; email: string | null }) => [u.id, u.email] as [string, string])
    ]);

    // Transform and combine suggestions with unified User IDs
    const suggestions = await Promise.all([
      ...jobSeekerSuggestions.map(async (user) => {
        const email = emailMap.get(user.id);
        const unifiedId = email ? await getUnifiedUserId(email, 'jobseeker', user) : user.id;
        return {
          id: unifiedId,
          fullName: user.fullName,
          profileImage: null,
          headline: user.currentJobTitle || 'Job Seeker',
          role: 'jobseeker',
          companyName: null,
          location: [user.city, user.state, user.country].filter(Boolean).join(', '),
          skills: user.skills,
          createdAt: user.createdAt
        };
      }),
      ...recruiterSuggestions.map(async (user) => {
        const email = emailMap.get(user.id);
        const unifiedId = email ? await getUnifiedUserId(email, 'recruiter', user) : user.id;
        return {
          id: unifiedId,
          fullName: user.fullName,
          profileImage: null,
          headline: user.position || 'Recruiter',
          role: 'recruiter',
          companyName: user.companyName,
          location: [user.city, user.state, user.country].filter(Boolean).join(', '),
          industry: user.industry,
          createdAt: user.createdAt
        };
      })
    ]);

    // Calculate mutual connections for each suggestion
    const suggestionsWithMutualConnections = await Promise.all(
      suggestions.map(async (user) => {
        // Get connections of the suggested user
        const suggestedUserConnections = await prisma.connection.findMany({
          where: {
            OR: [
              { userId: user.id },
              { connectedUserId: user.id }
            ],
            status: 'accepted'
          },
          select: {
            userId: true,
            connectedUserId: true
          }
        });

        const suggestedUserConnectedIds = new Set(
          suggestedUserConnections.map(conn => 
            conn.userId === user.id ? conn.connectedUserId : conn.userId
          )
        );

        // Count mutual connections (intersection of current user's connections and suggested user's connections)
        const mutualConnections = Array.from(connectedUserIds).filter(id => 
          suggestedUserConnectedIds.has(id) && id !== currentUserId
        ).length;

        return {
          ...user,
          mutualConnections
        };
      })
    );

    // Sort by mutual connections and recency
    const sortedSuggestions = suggestionsWithMutualConnections.sort((a, b) => {
      if (a.mutualConnections !== b.mutualConnections) {
        return b.mutualConnections - a.mutualConnections;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    console.log('Returning suggestions:', sortedSuggestions.length);
    return NextResponse.json({
      suggestions: sortedSuggestions
    });
  } catch (error) {
    console.error('Error fetching connection suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connection suggestions' },
      { status: 500 }
    );
  }
}

