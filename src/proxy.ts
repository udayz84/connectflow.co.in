import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) {
    const { pathname } = req.nextUrl;
    const { token } = req.nextauth;

    // If user is authenticated and trying to access login pages, redirect to their dashboard
    if (
      token &&
      (pathname.startsWith("/auth/login") ||
        pathname.startsWith("/auth/jobseeker/login") ||
        pathname.startsWith("/auth/recruiter/login"))
    ) {
      const role = (token as { role?: string })?.role;
      if (role === "recruiter") {
        return NextResponse.redirect(new URL("/dashboard/recruiter", req.url));
      } else if (role === "jobseeker") {
        return NextResponse.redirect(new URL("/dashboard/job-seeker", req.url));
      }
      // Fallback to posts page if role is not recognized
      return NextResponse.redirect(new URL("/posts", req.url));
    }

    // If user is not authenticated and trying to access protected routes, redirect to login
    if (!token && pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    // Role-based access control for dashboard routes
    if (token && pathname.startsWith("/dashboard")) {
      const role = (token as { role?: string })?.role;

      // Recruiter trying to access job seeker routes - redirect to recruiter dashboard
      if (role === "recruiter" && pathname.startsWith("/dashboard/job-seeker")) {
        return NextResponse.redirect(new URL("/dashboard/recruiter", req.url));
      }

      // Job seeker trying to access recruiter routes - redirect to job seeker dashboard
      if (role === "jobseeker" && pathname.startsWith("/dashboard/recruiter")) {
        return NextResponse.redirect(new URL("/dashboard/job-seeker", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Public routes that don't require authentication
        const publicRoutes = [
          "/",
          "/jobs",
          "/companies",
          "/about",
          "/contact",
          "/auth/login",
          "/auth/jobseeker/login",
          "/auth/recruiter/login",
          "/auth/register",
          "/auth/jobseeker/register",
          "/auth/recruiter/register",
          "/api/auth",
          "/api/jobs",
          "/api/companies",
        ];

        // Check if the route is public
        if (publicRoutes.some((route) => pathname.startsWith(route))) {
          return true;
        }

        // Dashboard routes require authentication
        if (pathname.startsWith("/dashboard")) {
          return !!token;
        }

        // Job detail pages are public
        if (pathname.startsWith("/jobs/") && !pathname.startsWith("/jobs/apply")) {
          return true;
        }

        // Job application pages require authentication
        if (pathname.startsWith("/jobs/") && pathname.includes("/apply")) {
          return !!token;
        }

        // API routes that require authentication
        const protectedApiRoutes = ["/api/applications", "/api/jobseeker", "/api/recruiter"];

        if (protectedApiRoutes.some((route) => pathname.startsWith(route))) {
          return !!token;
        }

        // Default to allowing access
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};

