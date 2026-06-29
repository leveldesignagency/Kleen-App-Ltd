"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Briefcase,
  ChevronDown,
  Loader2,
  MessageSquare,
  Search,
  Settings,
  User,
  UserSearch,
  Users,
  X,
} from "lucide-react";
import { useAdminNotifications } from "@/lib/admin-notifications";
import { useAdminStaff, roleLabel } from "@/components/admin/AdminStaffProvider";
import { staffInitials } from "@/lib/admin-staff";
import type { SearchResultItem } from "@/app/api/admin/search/route";

const TYPE_ICON = {
  job: Briefcase,
  customer: UserSearch,
  contractor: Users,
  dispute: MessageSquare,
};

const TYPE_LABEL = {
  job: "Jobs",
  customer: "Customers",
  contractor: "Contractors",
  dispute: "Disputes",
};

export default function AdminTopHeader() {
  const router = useRouter();
  const { profile, preferences, isSuperadmin } = useAdminStaff();
  const { toasts, dismiss } = useAdminNotifications();
  const alertCount = toasts.filter((t) => t.type === "alert" || t.persistent).length;

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { results?: SearchResultItem[] };
      setResults(json.results || []);
    } catch {
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        searchRef.current?.querySelector("input")?.focus();
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pickResult = (item: SearchResultItem) => {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
    router.push(item.href);
  };

  const initials = profile ? staffInitials(profile.full_name, profile.email) : "?";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Search */}
        <div ref={searchRef} className="relative min-w-0 flex-1 max-w-xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search jobs, customers, contractors…"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-16 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">
              ⌘K
            </kbd>
          </div>

          {searchOpen && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
              {searchLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              ) : results.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No results for &ldquo;{query}&rdquo;</p>
              ) : (
                <ul className="py-1">
                  {results.map((item) => {
                    const Icon = TYPE_ICON[item.type];
                    return (
                      <li key={`${item.type}-${item.id}`}>
                        <button
                          type="button"
                          onClick={() => pickResult(item)}
                          className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-white/5"
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{item.title}</p>
                            <p className="truncate text-xs text-slate-500">
                              {TYPE_LABEL[item.type]} · {item.subtitle}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                setProfileOpen(false);
                setSettingsOpen(false);
              }}
              className="relative rounded-xl p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {alertCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-bold text-slate-950">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Notifications</p>
                  {toasts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toasts.forEach((t) => dismiss(t.id))}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <ul className="max-h-72 overflow-y-auto py-1">
                  {toasts.length === 0 ? (
                    <li className="px-4 py-8 text-center text-sm text-slate-500">No notifications</li>
                  ) : (
                    toasts.map((t) => (
                      <li key={t.id} className="border-b border-white/5 last:border-0">
                        <div className="flex gap-2 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">{t.title}</p>
                            {t.message && <p className="mt-0.5 text-xs text-slate-500">{t.message}</p>}
                            {t.href && (
                              <Link
                                href={t.href}
                                onClick={() => {
                                  dismiss(t.id);
                                  setNotifOpen(false);
                                }}
                                className="mt-1 inline-block text-xs font-semibold text-brand-400 hover:underline"
                              >
                                View →
                              </Link>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => dismiss(t.id)}
                            className="shrink-0 text-slate-500 hover:text-white"
                            aria-label="Dismiss"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Display settings quick menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSettingsOpen((v) => !v);
                setNotifOpen(false);
                setProfileOpen(false);
              }}
              className="rounded-xl p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Display settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
                <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Display
                </p>
                <Link
                  href="/settings?tab=display"
                  onClick={() => setSettingsOpen(false)}
                  className="block rounded-lg px-2 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                  All display settings
                </Link>
                <p className="mt-2 px-2 text-[11px] text-slate-600">
                  Sounds: {preferences.alertSounds ? "On" : "Off"}
                </p>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => !v);
                setNotifOpen(false);
                setSettingsOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-2.5 transition hover:bg-white/10"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                {initials}
              </span>
              <span className="hidden max-w-[8rem] truncate text-sm font-medium text-slate-200 sm:block">
                {profile?.full_name?.trim() || profile?.email || "Staff"}
              </span>
              <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
            </button>

            {profileOpen && profile && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">
                    {profile.full_name?.trim() || "Staff member"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{profile.email}</p>
                  <span className="mt-2 inline-flex rounded-md bg-brand-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-400">
                    {roleLabel(profile.admin_role)}
                  </span>
                </div>
                <div className="p-1">
                  <Link
                    href="/settings?tab=profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                  >
                    <User className="h-4 w-4" />
                    My profile
                  </Link>
                  <Link
                    href="/settings?tab=display"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                  >
                    <Settings className="h-4 w-4" />
                    Display settings
                  </Link>
                  {isSuperadmin && (
                    <Link
                      href="/settings?tab=team"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                    >
                      <Users className="h-4 w-4" />
                      Manage team
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click-away overlay for dropdowns */}
      {(searchOpen || notifOpen || profileOpen || settingsOpen) && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default"
          aria-label="Close menus"
          onClick={() => {
            setSearchOpen(false);
            setNotifOpen(false);
            setProfileOpen(false);
            setSettingsOpen(false);
          }}
        />
      )}
    </header>
  );
}
