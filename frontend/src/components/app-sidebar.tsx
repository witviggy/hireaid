import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { BookOpen, FlaskConical, LayoutGrid, Megaphone, Moon, PhoneCall, Settings, Sun, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyTheme, getStoredTheme } from "@/lib/theme";

const items = [
  { to: "/", icon: LayoutGrid, label: "Dashboard", end: true },
  { to: "/roles", icon: Megaphone, label: "Roles" },
  { to: "/candidates", icon: Users, label: "Candidates" },
  { to: "/calls", icon: PhoneCall, label: "Call Logs" },
  { to: "/digital-twin", icon: FlaskConical, label: "Digital Twin Lab" },
  { to: "/user-manual", icon: BookOpen, label: "User Manual" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function AppSidebar() {
  const [expanded, setExpanded] = useState(() => localStorage.getItem("sidebar-expanded") === "true");
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    localStorage.setItem("sidebar-expanded", String(expanded));
  }, [expanded]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <aside className={cn(
      "sticky top-0 z-20 flex h-screen shrink-0 flex-col border-r border-[#E5E7EB] bg-white py-4 transition-[width] duration-150 ease-out dark:border-[#27272A] dark:bg-[#121215]",
      expanded ? "w-56 px-3" : "w-14 items-center"
    )}>
      <div className={cn("mb-4 flex w-full items-center border-b border-[#E5E7EB] pb-3.5 dark:border-[#27272A]", expanded ? "px-3" : "justify-center")}>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            "flex items-center transition-opacity hover:opacity-85",
            expanded ? "gap-2.5" : "justify-center"
          )}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <img
            src="/hunar-logo.png"
            alt="HireAId"
            className="h-[28px] w-[28px] object-contain logo-invert shrink-0"
          />
          {expanded && (
            <div className="flex flex-col items-start text-left">
              <span className="text-[16px] font-bold leading-tight tracking-tight text-[#111827] dark:text-[#FAFAFA]">
                HireAId
              </span>
              <span className="text-[9.5px] font-medium leading-tight text-slate-400 dark:text-slate-500">
                powered by Hunar AI
              </span>
            </div>
          )}
        </button>
      </div>
      <nav className="flex w-full flex-1 flex-col gap-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                "flex h-10 items-center border-l-[3px] text-[13px] text-[#6B7280] transition-colors duration-150 hover:bg-[#F9FAFB] hover:text-[#111827] dark:text-[#9CA3AF] dark:hover:bg-[#18181B] dark:hover:text-[#FAFAFA]",
                expanded ? "gap-3 px-3" : "w-full justify-center",
                isActive
                  ? "border-slate-900 bg-[#F3F4F6] text-[#111827] dark:border-white dark:bg-[#18181B] dark:text-[#FAFAFA]"
                  : "border-transparent"
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0 stroke-[2]" />
            {expanded && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Quick theme toggle */}
      <div className={cn("mb-2 flex w-full items-center", expanded ? "px-2" : "justify-center")}>
        <button
          type="button"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className={cn(
            "flex h-8 items-center rounded-md border border-[#E5E7EB] text-xs text-slate-600 transition-colors hover:bg-slate-100 dark:border-[#27272A] dark:text-slate-400 dark:hover:bg-[#18181B] dark:hover:text-slate-200",
            expanded ? "w-full gap-2 px-2.5" : "w-8 justify-center"
          )}
        >
          {theme === "dark" ? (
            <>
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              {expanded && <span>Light Mode</span>}
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-indigo-500" />
              {expanded && <span>Dark Mode</span>}
            </>
          )}
        </button>
      </div>

      <div className={cn("flex items-center gap-3 border-t border-[#E5E7EB] px-2 pt-4 dark:border-[#27272A]", expanded ? "w-full" : "justify-center")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-900" title="Vignesh M">V</div>
        {expanded && (
          <div>
            <div className="text-xs font-medium text-[#111827] dark:text-[#FAFAFA]">Vignesh M</div>
            <div className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">Workspace owner</div>
          </div>
        )}
      </div>
    </aside>
  );
}
