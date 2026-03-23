import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Configure Cloudinary
const hasCloudinaryConfig = process.env.CLOUDINARY_CLOUD_NAME && 
                           process.env.CLOUDINARY_API_KEY && 
                           process.env.CLOUDINARY_API_SECRET;

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// POST /api/test-cloudinary - Test Cloudinary credentials
export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🧪 Testing Cloudinary credentials...');
    
    // Check if credentials are configured
    if (!hasCloudinaryConfig) {
      console.log('❌ Cloudinary credentials not configured');
      return NextResponse.json({
        success: false,
        error: 'Cloudinary credentials not configured',
        details: {
          cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Not set',
          apiKey: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
          apiSecret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set',
        },
        setup: {
          message: 'Add Cloudinary credentials to .env.local',
          required: [
            'CLOUDINARY_CLOUD_NAME',
            'CLOUDINARY_API_KEY', 
            'CLOUDINARY_API_SECRET'
          ]
        }
      }, { status: 400 });
    }

    console.log('✅ Cloudinary credentials found, testing connection...');

    // Test Cloudinary connection by getting account details
    try {
      const result = await cloudinary.api.ping();
      console.log('✅ Cloudinary ping successful:', result);
      
      // Test upload with a small test image
      const testUploadResult = await cloudinary.uploader.upload(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        {
          folder: 'rozgarhub/test',
          public_id: `test_${Date.now()}`,
          resource_type: 'image'
        }
      );

      console.log('✅ Test upload successful:', testUploadResult.public_id);

      // Clean up test image
      await cloudinary.uploader.destroy(testUploadResult.public_id);
      console.log('✅ Test image cleaned up');

      return NextResponse.json({
        success: true,
        message: 'Cloudinary is working perfectly!',
        details: {
          cloudName: process.env.CLOUDINARY_CLOUD_NAME,
          apiKey: 'Set (hidden for security)',
          apiSecret: 'Set (hidden for security)',
          testUpload: true,
          pingResult: result,
          testImageId: testUploadResult.public_id
        },
        setup: {
          status: 'Complete',
          message: 'All credentials are working correctly'
        }
      });

    } catch (cloudinaryError) {
      console.error('❌ Cloudinary test failed:', cloudinaryError);
      
      return NextResponse.json({
        success: false,
        error: 'Cloudinary connection failed',
        details: {
          cloudName: process.env.CLOUDINARY_CLOUD_NAME,
          apiKey: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
          apiSecret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set',
          error: cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error',
          code: (cloudinaryError as any)?.code || 'UNKNOWN'
        },
        setup: {
          message: 'Check your Cloudinary credentials',
          troubleshooting: [
            'Verify cloud name is correct',
            'Check API key and secret',
            'Ensure account is active',
            'Check if you have upload permissions'
          ]
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test Cloudinary',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

// GET /api/test-cloudinary - Get credential status
export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasCloudName = !!process.env.CLOUDINARY_CLOUD_NAME;
    const hasApiKey = !!process.env.CLOUDINARY_API_KEY;
    const hasApiSecret = !!process.env.CLOUDINARY_API_SECRET;
    
    const allConfigured = hasCloudName && hasApiKey && hasApiSecret;
    
    return NextResponse.json({
      configured: allConfigured,
      credentials: {
        cloudName: hasCloudName,
        apiKey: hasApiKey,
        apiSecret: hasApiSecret
      },
      status: allConfigured ? 'Ready to test' : 'Missing credentials'
    });
  } catch (error) {
    return NextResponse.json({
      configured: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
