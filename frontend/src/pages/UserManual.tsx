import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCheck,
  FlaskConical,
  Layers,
  Lightbulb,
  Megaphone,
  PhoneCall,
  PlayCircle,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface GuideSection {
  id: string;
  tabLabel: string;
  title: string;
  shortDesc: string;
  icon: any;
  steps: {
    title: string;
    description: string;
    tip?: string;
  }[];
  keyBenefits: string[];
  recommendedAction?: {
    label: string;
    to: string;
  };
}

const SECTIONS: GuideSection[] = [
  {
    id: "quick-start",
    tabLabel: "Quick Start",
    title: "The 4-Step Hiring Cycle",
    shortDesc: "The fastest way to launch an automated voice screening campaign from job posting to shortlisted candidates.",
    icon: PlayCircle,
    steps: [
      {
        title: "1. Create a Job Role",
        description:
          "Navigate to the Roles page and click 'Create Role'. Paste your job description. The system automatically extracts required skills, experience level, and salary expectations, and generates an initial screening script.",
        tip: "You can edit auto-generated skills and questions at any time before placing calls.",
      },
      {
        title: "2. Add Candidates to the Role",
        description:
          "Open the role and add candidates with their name, phone number, and current title. The system evaluates their background against your job criteria, providing an initial Match Score with highlighted strengths and missing criteria.",
        tip: "Upload a resume or fill out key details manually for higher initial match accuracy.",
      },
      {
        title: "3. Initiate Automated Voice Interviews",
        description:
          "Click 'Call Candidate' or queue a batch. The voice interviewer dials the candidate, introduces itself on behalf of your company, conducts a conversational interview, asks qualifying questions, and confirms availability.",
        tip: "If a candidate does not pick up, the system schedules gentle redials based on your workspace calling rules.",
      },
      {
        title: "4. Review Scorecards & Advance Top Talent",
        description:
          "Review the call recording and interactive transcript. The system produces an instant scorecard with an Overall Fit Score (0 to 100), key takeaways, confirmed notice period and salary, and an actionable recommendation (Advance, Hold, or Reject).",
        tip: "Use 1-click stage advancement to progress candidates into subsequent rounds.",
      },
    ],
    keyBenefits: [
      "Screen candidates rapidly without manual phone tag",
      "Consistent, objective evaluation across every applicant",
      "Instant transcription and structured decision summaries",
    ],
    recommendedAction: {
      label: "View Your Roles",
      to: "/roles",
    },
  },
  {
    id: "roles",
    tabLabel: "Roles & Funnels",
    title: "Job Roles & Interview Customization",
    shortDesc: "Set up job openings, configure multi-round interview stages, and tailor interviewer tone and questions.",
    icon: Megaphone,
    steps: [
      {
        title: "Drafting a Job Requisition",
        description:
          "Paste any job description or outline into the Role Creation modal. The system parses requirements into Must-Have Skills, Preferred Skills, Experience Range, and Compensation Target.",
        tip: "Include specific certifications, toolsets, or mandatory requirements in the description for tighter screening.",
      },
      {
        title: "Configuring Multi-Round Stages",
        description:
          "Every role supports sequential interview rounds (for example, Round 1: Initial Phone Screen, followed by Round 2: Technical Deep Dive). Each stage has its own focus and interview objectives.",
        tip: "Candidates progress through stages sequentially. Information gathered in Round 1 is remembered and never re-asked in Round 2.",
      },
      {
        title: "Tuning Interviewer Persona & Tone",
        description:
          "Under the 'Rounds & Voice Scripts' tab of your role, give your interviewer a name, select conversational tone (Conversational, Professional, or Casual), and adjust speaking pace.",
        tip: "Choose 'Conversational' for standard roles, and 'Professional' for executive positions.",
      },
      {
        title: "Custom Questions & Objection Handlers",
        description:
          "Add role-specific questions you want asked. Define Objection Handlers to guide how the interviewer responds if candidates ask about remote flexibility, benefits, or travel.",
      },
    ],
    keyBenefits: [
      "Zero prompt engineering required—scripts generate automatically",
      "Seamless multi-round stages with tailored focus per round",
      "Custom objection handlers answer candidate questions accurately",
    ],
    recommendedAction: {
      label: "Create a New Role",
      to: "/roles",
    },
  },
  {
    id: "candidates",
    tabLabel: "Candidates",
    title: "Candidate Management & Pipeline",
    shortDesc: "Manage candidate profiles, view match fit calculations, and track interview progress across stages.",
    icon: Users,
    steps: [
      {
        title: "Adding Candidates via Modal or Bulk Import",
        description:
          "Add candidates directly inside any role or from the central Candidates directory. Provide contact information, location, current title, and optional resume text.",
        tip: "Always ensure phone numbers include country codes for reliable calling.",
      },
      {
        title: "Understanding the Match Fit Score",
        description:
          "Before placing a call, the system calculates a preliminary Match Score comparing candidate profile data against role requirements. Click 'Why?' next to any score to view strengths and gaps.",
      },
      {
        title: "Managing Pipeline Stages",
        description:
          "Filter candidate tables by pipeline status (Sourced, Queued, Calling, Screened, Shortlisted, Archived) or interview round to spot candidates ready for review.",
      },
      {
        title: "360° Candidate Profile",
        description:
          "Click on any candidate name to open their detail view, featuring contact details, full call recording archive, interactive transcripts, and multi-round evaluations.",
      },
    ],
    keyBenefits: [
      "Instant alignment checks before placing calls",
      "Centralized candidate history across multiple openings",
      "Fast filtering by round progress and recommendation status",
    ],
    recommendedAction: {
      label: "Browse Candidates",
      to: "/candidates",
    },
  },
  {
    id: "calling",
    tabLabel: "Calls & Transcripts",
    title: "Automated Voice Calls & Interactive Transcripts",
    shortDesc: "How the voice interviewer conducts phone calls, handles interruptions, and produces interactive transcripts.",
    icon: PhoneCall,
    steps: [
      {
        title: "Triggering a Call",
        description:
          "Click 'Call' next to any candidate in the role pipeline or on their candidate profile. The automated interviewer calls the candidate phone in real time.",
        tip: "Check your calling hours in Settings to ensure calls are placed at appropriate local times.",
      },
      {
        title: "Natural Conversational Handling",
        description:
          "The voice interviewer listens actively, pauses when candidates interrupt or clarify an earlier point, repeats questions if asked, and wraps up courteously if a candidate requests a callback.",
      },
      {
        title: "Variable Speed Audio Playback",
        description:
          "Once a call completes, listen to the full recording directly in your browser. Use the speed toggle (1x, 1.25x, 1.5x, 2x) to review conversations faster.",
      },
      {
        title: "Interactive Click-to-Jump Transcripts",
        description:
          "Read the full speaker-labeled dialogue. Each turn displays an accurate timestamp. Clicking any speech bubble in the transcript instantly seeks the audio player to that exact moment.",
        tip: "Conversational friction points (like salary deflections or callback requests) are tagged for quick review.",
      },
    ],
    keyBenefits: [
      "Natural voice interaction that candidates enjoy",
      "Turn-by-turn timestamps linked directly to audio playback",
      "Automatic detection of candidate callbacks and hesitations",
    ],
    recommendedAction: {
      label: "View Call Logs",
      to: "/calls",
    },
  },
  {
    id: "evaluations",
    tabLabel: "Scorecards",
    title: "AI Screening Scorecards & Evaluation Metrics",
    shortDesc: "How calls are objectively graded across technical competence, seniority, compensation fit, and availability.",
    icon: FileCheck,
    steps: [
      {
        title: "Overall Fit Score & Recommendation",
        description:
          "Every completed interview produces an Overall Score out of 100 alongside an executive recommendation: Advance to Next Round (Green), Under Review / Hold (Amber), or Not a Match (Red).",
      },
      {
        title: "Four-Pillar Score Breakdown",
        description:
          "Inspect four balanced evaluation criteria: Technical Fit (domain competency), Experience & Seniority (depth of past roles), Location Alignment (workplace compatibility), and Compensation Fit (salary expectations).",
      },
      {
        title: "Verified Candidate Facts & Memory Anchors",
        description:
          "The system locks in verified facts during the call: Confirmed Notice Period, Expected Compensation, Relocation Readiness, and Motivation for Switching.",
        tip: "Verified facts are locked into memory so future round interviewers will never re-ask the candidate.",
      },
      {
        title: "Recruiter Summary & Hiring Considerations",
        description:
          "Read the executive recap of the conversation along with bulleted Hiring Considerations highlighting potential gaps or areas for your hiring manager to probe in later rounds.",
      },
    ],
    keyBenefits: [
      "Standardized grading eliminates interviewer bias",
      "Key numbers (salary, notice period) verified upfront",
      "Immediate hiring considerations for your team to follow up",
    ],
  },
  {
    id: "continuity",
    tabLabel: "Multi-Round Memory",
    title: "Multi-Round Hiring & Memory Continuity",
    shortDesc: "How information from early rounds carries forward into later stages so candidates never repeat themselves.",
    icon: Layers,
    steps: [
      {
        title: "Advancing Candidates Across Stages",
        description:
          "When a candidate passes Round 1, click 'Advance' in the candidate header or pipeline table. The candidate moves into the next stage while preserving all previous notes.",
      },
      {
        title: "Zero-Latency Memory Briefing",
        description:
          "Before Round 2 begins, the system compiles a memory briefing of everything confirmed in Round 1: notice period, compensation expectations, relocation status, and already-verified skills.",
      },
      {
        title: "No Repetitive Questions",
        description:
          "When Round 2 interviewer calls, it already knows the candidate salary expectations and notice period. Instead of re-asking, it jumps directly into round-specific topics.",
        tip: "Inspect the exact memory briefing that Round 2 will receive in the candidate 'AI Evals & Rounds' tab.",
      },
      {
        title: "Prior Rounds Chronicle",
        description:
          "Review historical summaries and scores from earlier rounds alongside the active round scorecard to monitor candidate performance progression over time.",
      },
    ],
    keyBenefits: [
      "Candidates enjoy a premium, respectful interview experience",
      "Subsequent interviewers save time by focusing only on new topics",
      "Full chronological record of candidate journey across all rounds",
    ],
  },
  {
    id: "digital-twin",
    tabLabel: "Digital Twin Lab",
    title: "Digital Twin Lab: Stress-Testing Voice Agents",
    shortDesc: "Simulate interviews against realistic candidate personalities to stress-test your voice recruiters before placing live calls.",
    icon: FlaskConical,
    steps: [
      {
        title: "Selecting a Role and Persona",
        description:
          "In the Digital Twin Lab, select the role you want to benchmark and choose a behavioral persona archetype (e.g., The Evasive Candidate, The Aggressive Salary Maximizer, or The Verbose Rambler).",
      },
      {
        title: "Running a Multi-Turn Simulation",
        description:
          "Click 'Run Simulation'. The system simulates an authentic phone conversation between your configured voice interviewer and the synthetic candidate persona across multiple back-and-forth dialogue turns.",
      },
      {
        title: "Reviewing Resilience & Readiness Scores",
        description:
          "Evaluate how your interviewer performed across 4 critical dimensions: Interview Readiness, Behavioral Resilience, Clarity & Conversational Flow, and Information Capture.",
      },
      {
        title: "Generating Custom Personas with AI",
        description:
          "In the 'Persona Studio' tab, type any candidate personality you want to test in plain English. The system builds a custom testing persona instantly.",
      },
      {
        title: "1-Click Prompt Improvement Recommendations",
        description:
          "The system analyzes conversational weaknesses and recommends targeted prompt enhancements. Click 'Apply Prompt Update' to immediately upgrade your live voice recruiter.",
      },
    ],
    keyBenefits: [
      "Find conversational gaps and edge cases before calling real candidates",
      "Benchmark interviewer tenacity against evasive and aggressive candidates",
      "Continuously improve interview quality with 1-click prompt patches",
    ],
    recommendedAction: {
      label: "Open Digital Twin Lab",
      to: "/digital-twin",
    },
  },
  {
    id: "settings",
    tabLabel: "Settings & Rules",
    title: "Workspace Settings & Calling Rules",
    shortDesc: "Configure company identity, calling time windows, automatic redial logic, and default interview questions.",
    icon: Settings,
    steps: [
      {
        title: "Company Identity & Branding",
        description:
          "Set your Company Name and default interviewer identity so that every automated call introduces itself accurately on behalf of your organization.",
      },
      {
        title: "Calling Hours & Timezone Rules",
        description:
          "Define your approved calling hours (for example, 09:00 to 18:00). Calls will only be initiated during these approved business hours to ensure candidate respect.",
      },
      {
        title: "Automated Redial & Retry Settings",
        description:
          "Enable or disable automatic redials for unanswered calls. Set the maximum number of retries and the minimum waiting period between attempts.",
        tip: "Cancel any scheduled retry at any time directly from the candidate page or call logs table.",
      },
      {
        title: "Default Organizational Questions",
        description:
          "Configure standard qualifying questions (such as relocation willingness, work authorization, or notice period) that automatically apply to all new job roles created by your team.",
      },
    ],
    keyBenefits: [
      "Consistent organization-wide interview standards",
      "Respectful calling hours protect your employer brand",
      "Automated follow-ups maximize candidate connection rates",
    ],
    recommendedAction: {
      label: "Open Settings",
      to: "/settings",
    },
  },
];

export default function UserManual() {
  const [activeTab, setActiveTab] = useState<string>("quick-start");
  const [search, setSearch] = useState("");

  const filteredSections = SECTIONS.filter((sec) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      sec.title.toLowerCase().includes(q) ||
      sec.tabLabel.toLowerCase().includes(q) ||
      sec.shortDesc.toLowerCase().includes(q) ||
      sec.steps.some(
        (s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      )
    );
  });

  const activeSection =
    filteredSections.find((s) => s.id === activeTab) || filteredSections[0] || SECTIONS[0];

  return (
    <div className="space-y-5 pb-16">
      {/* 1. Header (Matching Dashboard, Roles, Candidates, Digital Twin Lab) */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#FAFAFA]">
              User Manual
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comprehensive guide to setting up job roles, conducting automated voice interviews, evaluating candidate scorecards, and testing personas.
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search guide topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-8 bg-white dark:bg-[#121215] border-[#E5E7EB] dark:border-[#27272A]"
            />
          </div>
        </div>

        {/* 2. Persistent Segmented Tab Bar (Matching RoleDetail, CandidateDetail & DigitalTwinLab) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-b border-slate-200 dark:border-[#27272A] pb-2.5">
          {filteredSections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection.id === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveTab(sec.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs transition-all cursor-pointer",
                  isActive
                    ? "bg-slate-100 text-slate-900 font-semibold border border-slate-200 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                    : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 border border-transparent font-medium"
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    isActive
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                />
                <span>{sec.tabLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Content: Matching 2-Col Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Step-by-Step Procedure */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-[#E5E7EB] dark:border-[#27272A] pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    {activeSection.title}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {activeSection.shortDesc}
                  </CardDescription>
                </div>

                {activeSection.recommendedAction && (
                  <Button asChild size="sm" className="h-8 shrink-0 text-xs font-medium">
                    <Link to={activeSection.recommendedAction.to}>
                      {activeSection.recommendedAction.label}
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {activeSection.steps.map((step, idx) => (
                <div key={idx} className="flex gap-4 items-start">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 mt-0.5">
                    {idx + 1}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {step.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {step.description}
                    </p>

                    {step.tip && (
                      <div className="rounded-md bg-amber-50/70 p-2.5 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 flex items-start gap-2 mt-2">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                          <span className="font-semibold">Tip:</span> {step.tip}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Key Benefits & Action Summary */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b border-[#E5E7EB] dark:border-[#27272A] pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Key Advantages
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                {activeSection.keyBenefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {activeSection.recommendedAction && (
            <Card className="border-dashed bg-slate-50/60 dark:bg-[#18181B]/40">
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Ready to test this feature?
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Head over to the corresponding module to configure or review your live data.
                </p>
                <div className="pt-1">
                  <Button asChild variant="outline" size="sm" className="w-full text-xs h-8">
                    <Link to={activeSection.recommendedAction.to}>
                      {activeSection.recommendedAction.label}
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
