import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if ((session.user as any)?.role !== "jobseeker") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sessionEmail = (session.user as any)?.email?.toLowerCase().trim();
    if (!sessionEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const resume = formData.get("resume") as File;
    const emailFromBody = formData.get("email") as string | null;

    if (emailFromBody && emailFromBody.toLowerCase().trim() !== sessionEmail) {
      // Never allow the client to choose which email record to update.
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!resume) {
      return NextResponse.json(
        { error: "Resume file is required" },
        { status: 400 }
      );
    }

    // Hard allowlist for upload types.
    // Note: we still limit by MIME type; for stronger guarantees consider content-sniffing.
    const allowedMimeTypes: Record<string, string> = {
      "application/pdf": ".pdf",
      "application/msword": ".doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    };

    if (!resume.type || !allowedMimeTypes[resume.type]) {
      return NextResponse.json({ error: "Only PDF/DOC/DOCX files are allowed" }, { status: 400 });
    }

    // 5MB max (must match client expectations)
    const maxBytes = 5 * 1024 * 1024;
    if (resume.size > maxBytes) {
      return NextResponse.json({ error: "File size should be less than 5MB" }, { status: 400 });
    }

    // Never trust email or resume.name when writing paths.
    const uploadsDir = join(process.cwd(), "public", "uploads", "resumes");
    await mkdir(uploadsDir, { recursive: true });

    const extension = allowedMimeTypes[resume.type];
    const safeFilename = `${sessionEmail.replace(/[^a-z0-9]/gi, "_").slice(0, 50)}-${randomUUID()}${extension}`;
    const uploadPath = join(uploadsDir, safeFilename);
    await writeFile(uploadPath, Buffer.from(await resume.arrayBuffer()));

    // Update the resume URL in the database
    const resumeUrl = `/uploads/resumes/${safeFilename}`;
    const updatedProfile = await prisma.jobSeeker.update({
      where: { email: sessionEmail },
      data: { resume: resumeUrl },
    });

    // Remove sensitive data
    const { password, ...profileWithoutPassword } = updatedProfile;

    return NextResponse.json({
      message: "Resume uploaded successfully",
      resumeUrl,
      profile: profileWithoutPassword,
    });
  } catch (error) {
    console.error("Error uploading resume:", error);
    return NextResponse.json(
      { error: "Failed to upload resume" },
      { status: 500 }
    );
  }
} 