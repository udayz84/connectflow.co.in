import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/connections - Get user's connections
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'accepted';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const skip = (page - 1) * limit;

    const connections = await prisma.connection.findMany({
      where: {
        OR: [
          { userId: currentUserId, status },
          { connectedUserId: currentUserId, status }
        ]
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit
    });

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
          profileImage: null, // JobSeeker doesn't have profileImage
          headline: jobSeeker.currentJobTitle,
          role: 'jobseeker',
          companyName: null, // JobSeeker doesn't have companyName
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
          profileImage: null, // Recruiter doesn't have profileImage
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
      connections.map(async (conn: { id: string; status: string; message: string | null; createdAt: Date; acceptedAt: Date | null; userId: string; connectedUserId: string }) => {
        const [user, connectedUser] = await Promise.all([
          getUserInfo(conn.userId),
          getUserInfo(conn.connectedUserId)
        ]);

        return {
          id: conn.id,
          status: conn.status,
          message: conn.message,
          createdAt: conn.createdAt,
          acceptedAt: conn.acceptedAt,
          otherUser: conn.userId === currentUserId ? connectedUser : user,
          isInitiator: conn.userId === currentUserId
        };
      })
    );

    const total = await prisma.connection.count({
      where: {
        OR: [
          { userId: currentUserId, status },
          { connectedUserId: currentUserId, status }
        ]
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
    console.error('Error fetching connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

// POST /api/connections - Send a connection request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = (session.user as any).id;
    const body = await request.json();
    const { targetUserId, message } = body;

    console.log('=== CONNECTION CREATION ===');
    console.log('Current user ID:', currentUserId);
    console.log('Current user ID type:', typeof currentUserId);
    console.log('Target user ID:', targetUserId);
    console.log('Target user ID type:', typeof targetUserId);


    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Missing required field: targetUserId' },
        { status: 400 }
      );
    }

    if (targetUserId === currentUserId) {
      return NextResponse.json(
        { error: 'Cannot connect to yourself' },
        { status: 400 }
      );
    }

    // IMPORTANT: Always get the unified User table ID for the target user
    // This ensures consistency when querying for received connection requests
    let unifiedTargetUserId = targetUserId;
    
    // Check if target user exists in unified User table
    const targetUserExists = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true }
    });

    if (!targetUserExists) {
      // If not found in User table, check JobSeeker or Recruiter tables
      // and get their email to find the unified User record
      let targetEmail: string | null = null;
      
      const jobSeekerExists = await prisma.jobSeeker.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true }
      });

      if (jobSeekerExists) {
        targetEmail = jobSeekerExists.email;
      } else {
        const recruiterExists = await prisma.recruiter.findUnique({
          where: { id: targetUserId },
          select: { id: true, email: true }
        });

        if (recruiterExists) {
          targetEmail = recruiterExists.email;
        }
      }

      if (!targetEmail) {
        return NextResponse.json(
          { error: 'Target user not found' },
          { status: 404 }
        );
      }

      // Find the unified User record by email
      const unifiedUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: targetEmail.toLowerCase().trim(),
            mode: 'insensitive'
          }
        },
        select: { id: true }
      });

      if (!unifiedUser) {
        // If unified user doesn't exist yet, create it
        // Fetch full user data for the legacy user
        let legacyUserData = null;
        
        if (jobSeekerExists) {
          legacyUserData = await prisma.jobSeeker.findUnique({
            where: { id: targetUserId },
            select: {
              id: true,
              email: true,
              fullName: true,
              city: true,
              state: true,
              country: true,
              currentJobTitle: true
            }
          });
        } else {
          legacyUserData = await prisma.recruiter.findUnique({
            where: { id: targetUserId },
            select: {
              id: true,
              email: true,
              fullName: true,
              city: true,
              state: true,
              country: true,
              companyName: true,
              position: true
            }
          });
        }

        if (legacyUserData) {
          const location = [
            legacyUserData.city, 
            (legacyUserData as any).state, 
            (legacyUserData as any).country
          ].filter(Boolean).join(', ') || null;
          
          const newUnifiedUser = await prisma.user.create({
            data: {
              email: targetEmail.toLowerCase().trim(),
              fullName: legacyUserData.fullName,
              role: jobSeekerExists ? 'jobseeker' : 'recruiter',
              location: location,
              headline: jobSeekerExists ? (legacyUserData as any).currentJobTitle : (legacyUserData as any).position,
              companyName: jobSeekerExists ? null : (legacyUserData as any).companyName
            }
          });
          unifiedTargetUserId = newUnifiedUser.id;
        } else {
          return NextResponse.json(
            { error: 'Target user not found' },
            { status: 404 }
          );
        }
      } else {
        unifiedTargetUserId = unifiedUser.id;
      }
    }

    console.log('Unified Target User ID:', unifiedTargetUserId);

    // Check if connection already exists (using unified IDs)
    const existingConnection = await prisma.connection.findFirst({
      where: {
        OR: [
          { userId: currentUserId, connectedUserId: unifiedTargetUserId },
          { userId: unifiedTargetUserId, connectedUserId: currentUserId }
        ]
      }
    });

    if (existingConnection) {
      return NextResponse.json(
        { error: 'Connection already exists' },
        { status: 400 }
      );
    }

    // Create connection request using unified User IDs
    const connection = await prisma.connection.create({
      data: {
        userId: currentUserId,
        connectedUserId: unifiedTargetUserId,
        status: 'pending',
        message: message || null
      }
    });

    console.log('Created connection:', connection);
    console.log('Connection ID:', connection.id);
    console.log('Connection userId:', connection.userId);
    console.log('Connection connectedUserId:', connection.connectedUserId);

    // Get target user's information for response (using unified ID)
    const targetUser = await prisma.user.findUnique({
      where: { id: unifiedTargetUserId },
      select: {
        id: true,
        fullName: true,
        profileImage: true,
        headline: true,
        role: true,
        companyName: true
      }
    });

    // Get sender's information for notification
    const sender = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        fullName: true,
        profileImage: true,
        headline: true,
        role: true,
        companyName: true
      }
    });

    // Create notification for the recipient (using unified ID)
    if (sender) {
      await prisma.notification.create({
        data: {
          userId: unifiedTargetUserId,
          type: 'connection_request',
          title: 'New Connection Request',
          message: `${sender.fullName} wants to connect with you`,
          data: JSON.stringify({
            connectionId: connection.id,
            senderId: currentUserId,
            senderName: sender.fullName,
            senderProfileImage: sender.profileImage,
            senderHeadline: sender.headline,
            senderRole: sender.role,
            senderCompany: sender.companyName,
            message: message || null
          })
        }
      });
    }

    return NextResponse.json({
      ...connection,
      connectedUser: targetUser
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to create connection',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

