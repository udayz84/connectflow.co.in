import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/connections/pending - Get pending connection requests
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    console.log('=== PENDING CONNECTIONS API SESSION ===');
    console.log('Session:', session);
    console.log('Session user:', session?.user);
    
    if (!session?.user) {
      console.log('No session found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = (session.user as any).id;
    console.log('Current user ID from session:', currentUserId);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'received'; // 'received' or 'sent'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    console.log('=== PENDING CONNECTIONS API ===');
    console.log('Current user ID:', currentUserId);
    console.log('Current user ID type:', typeof currentUserId);
    console.log('Type:', type);
    console.log('Page:', page, 'Limit:', limit);

    const skip = (page - 1) * limit;

    let whereClause;
    if (type === 'received') {
      whereClause = {
        connectedUserId: currentUserId,
        status: 'pending'
      };
    } else {
      whereClause = {
        userId: currentUserId,
        status: 'pending'
      };
    }

    console.log('Where clause:', whereClause);

    // Also check all connections to see what's in the database
    const allConnections = await prisma.connection.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    console.log('All connections in database:', allConnections);

    const connections = await prisma.connection.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    console.log('Found connections:', connections.length);
    console.log('Connections:', connections);

    // Helper function to get user info
    const getUserInfo = async (userId: string) => {
      // Try User table first
      let user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          profileImage: true,
          headline: true,
          role: true,
          companyName: true,
          location: true
        }
      });

      if (user) return user;

      // Try JobSeeker table
      const jobSeeker = await prisma.jobSeeker.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          currentJobTitle: true,
          city: true,
          state: true,
          country: true
        }
      });

      if (jobSeeker) {
        return {
          id: jobSeeker.id,
          fullName: jobSeeker.fullName,
          profileImage: null,
          headline: jobSeeker.currentJobTitle,
          role: 'jobseeker',
          companyName: null,
          location: [jobSeeker.city, jobSeeker.state, jobSeeker.country].filter(Boolean).join(', ')
        };
      }

      // Try Recruiter table
      const recruiter = await prisma.recruiter.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          position: true,
          companyName: true,
          city: true,
          state: true,
          country: true
        }
      });

      if (recruiter) {
        return {
          id: recruiter.id,
          fullName: recruiter.fullName,
          profileImage: null,
          headline: recruiter.position,
          role: 'recruiter',
          companyName: recruiter.companyName,
          location: [recruiter.city, recruiter.state, recruiter.country].filter(Boolean).join(', ')
        };
      }

      return null;
    };

    // Get user info for all connections
    const transformedConnections = await Promise.all(
      connections.map(async (conn: { id: string; status: string; message: string | null; createdAt: Date; userId: string; connectedUserId: string }) => {
        const otherUserId = type === 'received' ? conn.userId : conn.connectedUserId;
        const otherUser = await getUserInfo(otherUserId);
        
        return {
          id: conn.id,
          status: conn.status,
          message: conn.message,
          createdAt: conn.createdAt,
          otherUser: otherUser || {
            id: otherUserId,
            fullName: 'Unknown User',
            profileImage: null,
            headline: null,
            role: 'unknown',
            companyName: null,
            location: null
          },
          isInitiator: conn.userId === currentUserId
        };
      })
    );

    const total = await prisma.connection.count({
      where: whereClause
    });

    console.log('Transformed connections:', transformedConnections.length);
    console.log('Final response:', {
      connections: transformedConnections,
      pagination: {
        page,
        limit,
        total,
        hasNext: skip + limit < total
      }
    });

    return NextResponse.json({
      connections: transformedConnections,
      pagination: {
        page,
        limit,
        total,
        hasNext: skip + limit < total
      }
    });
  } catch (error) {
    console.error('Error fetching pending connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending connections' },
      { status: 500 }
    );
  }
}


