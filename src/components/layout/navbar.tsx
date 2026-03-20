"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Menu, X, Sun, Moon, User, ChevronDown, FileText, Laptop, 
  Clock, GraduationCap, Home, LayoutDashboard, Users, BookOpen, 
  Briefcase, Building, LogOut, Sparkles, Wand2, Bot, TrendingUp, 
  MessageCircle, Network, BriefcaseBusiness
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";

type DropdownItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
};

type NavLink = {
  name: string;
  href: string;
  icon?: React.ReactNode;
  dropdown?: DropdownItem[];
};

const Navbar = () => {
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Navigation links configuration
  const navLinks: NavLink[] = [
    { name: "Home", href: "/", icon: <Home className="w-4 h-4" /> },
    { name: "Community", href: "/posts", icon: <Users className="w-4 h-4" /> },
    { name: "Messages", href: "/messages", icon: <MessageCircle className="w-4 h-4" /> },
    { name: "Network", href: "/network", icon: <Network className="w-4 h-4" /> },
    { 
      name: "Jobs", 
      href: "/jobs",
      icon: <Briefcase className="w-4 h-4" />,
      dropdown: [
        { name: "All Jobs", href: "/jobs", icon: <BriefcaseBusiness className="w-4 h-4" /> },
        { name: "Remote Jobs", href: "/jobs/remote", icon: <Laptop className="w-4 h-4" /> },
        { name: "Full Time", href: "/jobs/full-time", icon: <Clock className="w-4 h-4" /> },
        { name: "Part Time", href: "/jobs/part-time", icon: <Clock className="w-4 h-4" /> },
        { name: "Internship", href: "/jobs/internship", icon: <GraduationCap className="w-4 h-4" /> },
      ] 
    },
    { name: "Companies", href: "/companies", icon: <Building className="w-4 h-4" /> },
    { 
      name: "Resume Builder", 
      href: "/resume-builder",
      icon: <FileText className="w-4 h-4" />,
      dropdown: [
        { name: "Create Resume", href: "/resume-builder/create", icon: <FileText className="w-4 h-4" /> },
        { name: "My Resumes", href: "/resume-builder/my-resumes", icon: <BookOpen className="w-4 h-4" /> },
        { name: "Templates", href: "/resume-builder/templates", icon: <FileText className="w-4 h-4" /> },
      ] 
    },
    { 
      name: "AI Tools", 
      href: "/ai-tools",
      icon: <Sparkles className="w-4 h-4" />,
      dropdown: [
        { name: "AI Interview", href: "/mock-interview", icon: <Bot className="w-4 h-4" /> },
        { name: "Resume Enhancer", href: "/ai-tools/resume-enhancer", icon: <Wand2 className="w-4 h-4" /> },
        { name: "Career Path Advisor", href: "/ai-tools/career-path-advisor", icon: <TrendingUp className="w-4 h-4" /> },
        { name: "Cover Letter Generator", href: "/ai-tools/cover-letter", icon: <FileText className="w-4 h-4" /> },
        { name: "Interview Prep", href: "/ai-tools/interview-prep", icon: <Users className="w-4 h-4" /> },
      ] 
    },
  ];

  // Add dashboard link based on user role
  if (session?.user) {
    const userRole = (session.user as any)?.role;
    if (userRole === "jobseeker") {
      navLinks.push({ 
        name: "Dashboard", 
        href: "/dashboard/job-seeker",
        icon: <LayoutDashboard className="w-4 h-4" />
      });
    } else if (userRole === "recruiter") {
      navLinks.push({ 
        name: "Dashboard", 
        href: "/dashboard/recruiter",
        icon: <LayoutDashboard className="w-4 h-4" />
      });
    }
  }

  // Recruiter links based on session
  const getRecruiterLinks = (): DropdownItem[] => {
    const userRole = (session?.user as any)?.role;
    
    if (!session) {
      return [
        { name: "Recruiter Login", href: "/auth/recruiter/login", icon: <User className="w-4 h-4" /> },
        { name: "Job Seeker Login", href: "/auth/jobseeker/login", icon: <User className="w-4 h-4" /> },
        { name: "Recruiter Register", href: "/auth/recruiter/register", icon: <User className="w-4 h-4" /> },
        { name: "Recruiter Dashboard", href: "/dashboard/recruiter", icon: <LayoutDashboard className="w-4 h-4" /> },
      ];
    } else if (userRole === "jobseeker") {
      return [
        { name: "Switch to Recruiter", href: "/auth/recruiter/login", icon: <User className="w-4 h-4" /> },
      ];
    }
    
    return [];
  };

  const recruiterLinks = getRecruiterLinks();
  const showRecruiterDropdown = recruiterLinks.length > 0;

  // Effects
  useEffect(() => {
    setMounted(true);
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
    document.body.style.overflow = 'unset';
  }, [pathname]);

  // Handlers
  const toggleMobileMenu = () => {
    const newState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newState);
    document.body.style.overflow = newState ? 'hidden' : 'unset';
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
    document.body.style.overflow = 'unset';
  };

  const toggleDropdown = (name: string) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  const handleDropdownItemClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Just navigate - the pathname useEffect will close the menu automatically
    router.push(href);
  };

  const handleLogout = async () => {
    closeMobileMenu();
    await signOut();
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(href + "/");
  };

  const mobileMenuTop = scrolled ? 80 : 96;

  return (
    <header 
      className={`fixed top-0 w-full z-50 backdrop-blur-md transition-all duration-300 ${
        scrolled ? "py-2 shadow-md bg-background/95" : "py-4 bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6">
        <nav className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center relative z-[70]">
            <img 
              src="/connectflow.jpg" 
              alt="ConnectFlow Logo" 
              className="w-16 h-16 rounded-lg object-cover hover:opacity-90 transition-opacity"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center justify-center flex-1 mx-6" ref={dropdownRef}>
            <div className="flex items-center space-x-4">
              {navLinks.map((link) => (
                <div 
                  key={link.name} 
                  className="relative"
                  onMouseEnter={() => link.dropdown && setActiveDropdown(link.name)}
                  onMouseLeave={() => link.dropdown && setActiveDropdown(null)}
                >
                  {link.dropdown ? (
                    <>
                      <button
                        onClick={() => toggleDropdown(link.name)}
                        className={`text-sm font-medium transition-colors flex items-center gap-1 hover:text-primary py-2 ${
                          isActive(link.href) && link.href !== "#" ? "text-primary" : "text-foreground/70"
                        }`}
                      >
                        {link.icon}
                        <span>{link.name}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${
                          activeDropdown === link.name ? "rotate-180" : ""
                        }`} />
                      </button>
                      {activeDropdown === link.name && (
                        <div className="absolute left-0 top-full pt-2 w-56 z-50">
                          <div className="rounded-lg shadow-lg bg-background border border-border overflow-hidden">
                            <div className="py-2">
                              {link.dropdown.map((item) => (
                                <Link
                                  key={item.name}
                                  href={item.href}
                                  onClick={() => setActiveDropdown(null)}
                                  className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors ${
                                    pathname === item.href ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"
                                  }`}
                                >
                                  {item.icon}
                                  <span>{item.name}</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={link.href}
                      className={`text-sm font-medium transition-colors flex items-center gap-1 hover:text-primary ${
                        isActive(link.href) ? "text-primary" : "text-foreground/70"
                      }`}
                    >
                      {link.icon}
                      {link.name}
                    </Link>
                  )}
                </div>
              ))}

              {/* Recruiter Dropdown */}
              {showRecruiterDropdown && (
                <div 
                  className="relative"
                  onMouseEnter={() => setActiveDropdown("recruiters")}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button
                    onClick={() => toggleDropdown("recruiters")}
                    className={`text-sm font-medium transition-colors flex items-center gap-1 hover:text-primary py-2 ${
                      pathname?.startsWith("/auth/recruiter") || pathname?.startsWith("/dashboard/recruiter")
                        ? "text-primary" : "text-foreground/70"
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    <span>For Recruiters</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${
                      activeDropdown === "recruiters" ? "rotate-180" : ""
                    }`} />
                  </button>
                  {activeDropdown === "recruiters" && (
                    <div className="absolute right-0 top-full pt-2 w-56 z-50">
                      <div className="rounded-lg shadow-lg bg-background border border-border overflow-hidden">
                        <div className="py-2">
                          {recruiterLinks.map((item) => (
                            <Link
                              key={item.name}
                              href={item.href}
                              onClick={() => setActiveDropdown(null)}
                              className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors ${
                                pathname === item.href ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"
                              }`}
                            >
                              {item.icon}
                              <span>{item.name}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Right Side */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-full p-2 hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {mounted && (theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />)}
            </button>
            
            {session && <NotificationBell />}
            
            {session && (
              <span className="text-sm font-medium text-primary max-w-[200px] truncate">
                Welcome, {(session.user?.name || session.user?.email || '').split('@')[0]}!
              </span>
            )}
            
            {session ? (
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 flex items-center gap-2 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-sm font-medium rounded-full text-foreground hover:bg-muted transition-all"
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-2 text-sm font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Right Side */}
          <div className="flex items-center gap-3 lg:hidden relative z-[70]">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {mounted && (theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />)}
            </button>
            
            {session && <NotificationBell />}
            
            <button 
              onClick={toggleMobileMenu}
              className="p-2 rounded-full hover:bg-muted transition-colors relative z-[70]"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="lg:hidden fixed inset-0 bg-white/80 dark:bg-black/80 z-[60]" 
              onClick={closeMobileMenu}
            />
            
            {/* Menu Content */}
            <div 
              className="lg:hidden fixed left-0 right-0 bottom-0 bg-background z-[65] overflow-y-auto shadow-2xl border-t border-border"
              style={{
                top: mobileMenuTop,
                minHeight: `calc(100vh - ${mobileMenuTop}px)`,
              }}
            >
              <div className="px-4 py-6">
                <nav className="space-y-1">
                {/* User Welcome Message */}
                {session && (
                  <div className="pb-4 mb-4 border-b border-border">
                    <p className="text-sm font-medium text-primary">
                      Welcome, {session.user?.name || session.user?.email}!
                    </p>
                  </div>
                )}

                {/* Navigation Links */}
                {navLinks.map((link) => (
                  <div key={link.name}>
                    {link.dropdown ? (
                      <div>
                        <button
                          onClick={() => toggleDropdown(link.name)}
                          className={`w-full flex items-center justify-between py-3 px-4 rounded-lg text-base font-medium transition-colors ${
                            isActive(link.href) && link.href !== "#"
                              ? "text-primary bg-primary/10"
                              : "text-foreground hover:bg-muted"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            {link.icon}
                            {link.name}
                          </span>
                          <ChevronDown className={`w-5 h-5 transition-transform ${
                            activeDropdown === link.name ? "rotate-180" : ""
                          }`} />
                        </button>
                        
                        {activeDropdown === link.name && (
                          <div className="mt-1 ml-4 pl-4 border-l-2 border-border space-y-1">
                            {link.dropdown.map((item) => (
                              <button
                                key={item.name}
                                onClick={(e) => handleDropdownItemClick(e, item.href)}
                                className={`w-full flex items-center gap-3 py-2 px-4 rounded-lg text-sm transition-colors text-left ${
                                  pathname === item.href
                                    ? "text-primary font-medium bg-primary/10"
                                    : "text-foreground/80 hover:bg-muted"
                                }`}
                              >
                                {item.icon}
                                <span>{item.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={(e) => handleDropdownItemClick(e, link.href)}
                        className={`w-full flex items-center gap-3 py-3 px-4 rounded-lg text-base font-medium transition-colors text-left ${
                          isActive(link.href)
                            ? "text-primary bg-primary/10"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        {link.icon}
                        {link.name}
                      </button>
                    )}
                  </div>
                ))}

                {/* Recruiter Links */}
                {showRecruiterDropdown && (
                  <div>
                    <button
                      onClick={() => toggleDropdown("recruiters")}
                      className={`w-full flex items-center justify-between py-3 px-4 rounded-lg text-base font-medium transition-colors ${
                        pathname?.startsWith("/auth/recruiter") || pathname?.startsWith("/dashboard/recruiter")
                          ? "text-primary bg-primary/10"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Building className="w-4 h-4" />
                        For Recruiters
                      </span>
                      <ChevronDown className={`w-5 h-5 transition-transform ${
                        activeDropdown === "recruiters" ? "rotate-180" : ""
                      }`} />
                    </button>
                    
                    {activeDropdown === "recruiters" && (
                      <div className="mt-1 ml-4 pl-4 border-l-2 border-border space-y-1">
                        {recruiterLinks.map((item) => (
                          <button
                            key={item.name}
                            onClick={(e) => handleDropdownItemClick(e, item.href)}
                            className={`w-full flex items-center gap-3 py-2 px-4 rounded-lg text-sm transition-colors text-left ${
                              pathname === item.href
                                ? "text-primary font-medium bg-primary/10"
                                : "text-foreground/80 hover:bg-muted"
                            }`}
                          >
                            {item.icon}
                            <span>{item.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Auth Buttons */}
                <div className="pt-6 mt-6 border-t border-border space-y-3">
                  {session ? (
                    <button
                      onClick={handleLogout}
                      className="w-full py-3 px-4 rounded-lg text-base font-medium bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-5 h-5" />
                      Logout
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => handleDropdownItemClick(e, "/auth/login")}
                        className="block w-full py-3 px-4 rounded-lg text-base font-medium text-center border border-border hover:bg-muted transition-colors"
                      >
                        Login
                      </button>
                      <button
                        onClick={(e) => handleDropdownItemClick(e, "/auth/register")}
                        className="block w-full py-3 px-4 rounded-lg text-base font-medium text-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Register
                      </button>
                    </>
                  )}
                </div>
              </nav>
            </div>
          </div>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
