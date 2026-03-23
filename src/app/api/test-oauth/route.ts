import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, name } = await request.json();
    
    // Simulate Google OAuth user creation
    let existingUser = await prisma.jobSeeker.findUnique({
      where: { email },
    });
    
    if (!existingUser) {
      console.log("Creating new job seeker for Google user:", email);
      existingUser = await prisma.jobSeeker.create({
        data: {
          email,
          fullName: name || email.split('@')[0] || "Google User",
          password: null,
          profileComplete: false,
          currentJobTitle: "",
          bio: "",
          education: "",
          yearsOfExperience: "",
          city: "",
          country: "",
          skills: [],
          certifications: [],
        },
      });
      console.log("Created new user with ID:", existingUser.id);
    } else {
      console.log("Found existing user:", existingUser.id);
    }

    return NextResponse.json({
      message: "OAuth user creation test successful",
      user: {
        id: existingUser.id,
        email: existingUser.email,
        fullName: existingUser.fullName,
        role: "jobseeker"
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("OAuth user creation test error:", error);
    return NextResponse.json(
      {
        message: "OAuth user creation test failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
} 