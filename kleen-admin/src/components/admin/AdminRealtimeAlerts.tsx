"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminNotifications } from "@/lib/admin-notifications";
import type { AdminFeedItem } from "@/app/api/admin/notifications/feed/route";

const POLL_MS = 45_000;

type JobRow = { id?: string; reference?: string };
type OperativeRow = {
  id?: string;
  full_name?: string;
  email?: string;
  is_verified?: boolean;
  submitted_for_review_at?: string | null;
  user_id?: string | null;
};
type DisputeRow = { id?: string; job_id?: string };

/** Realtime + polling admin alerts: jobs, contractors, disputes. */
export default function AdminRealtimeAlerts() {
  const push = useAdminNotifications((s) => s.push);
  const alertsEnabled = useAdminNotifications((s) => s.alertsEnabled);
  const seenRef = useRef<Set<string>>(new Set());
  const watermarkRef = useRef<string>(new Date().toISOString());

  const emitFeedItem = useCallback(
    (item: AdminFeedItem, playSound: boolean) => {
      if (seenRef.current.has(item.id)) return;
      seenRef.current.add(item.id);
      push({
        type: "alert",
        title: item.title,
        message: item.message,
        href: item.href,
        persistent: true,
        playSound,
      });
    },
    [push],
  );

  const pollFeed = useCallback(
    async (playSound: boolean) => {
      if (!alertsEnabled) return;
      try {
        const since = watermarkRef.current;
        const res = await fetch(`/api/admin/notifications/feed?since=${encodeURIComponent(since)}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { items?: AdminFeedItem[] };
        const items = json.items ?? [];
        for (const item of items) {
          emitFeedItem(item, playSound);
        }
        if (items.length > 0) {
          watermarkRef.current = new Date().toISOString();
        }
      } catch {
        /* network blip */
      }
    },
    [alertsEnabled, emitFeedItem],
  );

  useEffect(() => {
    if (!alertsEnabled) return;

    // Catch-up on load (no sound — avoids blasting on refresh)
    void pollFeed(false);

    const interval = window.setInterval(() => void pollFeed(true), POLL_MS);
    return () => window.clearInterval(interval);
  }, [alertsEnabled, pollFeed]);

  useEffect(() => {
    if (!alertsEnabled) return;

    const supabase = createClient();
    const seen = seenRef.current;

    const alertJob = (row: JobRow) => {
      const id = row.id;
      if (!id) return;
      const key = `job:${id}`;
      if (seen.has(key)) return;
      emitFeedItem(
        {
          id: key,
          kind: "job",
          title: "New job submitted",
          message: row.reference
            ? `${row.reference} is waiting in the queue.`
            : "A customer has submitted a new booking.",
          href: `/jobs/${id}`,
          createdAt: new Date().toISOString(),
        },
        true,
      );
    };

    const alertContractor = (row: OperativeRow, subtitle: string, key: string) => {
      if (!row.id || seen.has(key)) return;
      const name = row.full_name?.trim() || row.email || "Contractor";
      emitFeedItem(
        {
          id: key,
          kind: subtitle.includes("review") ? "contractor_review" : "contractor_signup",
          title: subtitle,
          message: `${name} — review in Contractors.`,
          href: `/contractors/${row.id}`,
          createdAt: new Date().toISOString(),
        },
        true,
      );
    };

    const alertDispute = (row: DisputeRow) => {
      if (!row.id) return;
      const key = `dispute:${row.id}`;
      if (seen.has(key)) return;
      emitFeedItem(
        {
          id: key,
          kind: "dispute",
          title: "New dispute opened",
          message: "A customer opened a dispute — review in Disputes.",
          href: "/disputes",
          createdAt: new Date().toISOString(),
        },
        true,
      );
    };

    const channel = supabase
      .channel("admin-realtime-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "jobs" }, (payload) => {
        alertJob(payload.new as JobRow);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "operatives" }, (payload) => {
        const row = payload.new as OperativeRow;
        if (row.is_verified) return;
        if (row.submitted_for_review_at) {
          alertContractor(row, "Contractor submitted for review", `contractor-review:${row.id}:${row.submitted_for_review_at}`);
        } else if (row.user_id) {
          alertContractor(row, "New contractor signed up", `contractor-signup:${row.id}`);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "operatives" }, (payload) => {
        const row = payload.new as OperativeRow;
        if (row.is_verified || !row.submitted_for_review_at || !row.id) return;
        alertContractor(
          row,
          "Contractor submitted for review",
          `contractor-review:${row.id}:${row.submitted_for_review_at}`,
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "disputes" }, (payload) => {
        alertDispute(payload.new as DisputeRow);
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void pollFeed(true);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [alertsEnabled, emitFeedItem, pollFeed]);

  return null;
}
