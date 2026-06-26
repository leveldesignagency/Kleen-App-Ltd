"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminNotifications } from "@/lib/admin-notifications";

type JobRow = {
  id?: string;
  reference?: string;
  status?: string;
};

type OperativeRow = {
  id?: string;
  full_name?: string;
  email?: string;
  is_verified?: boolean;
  submitted_for_review_at?: string | null;
  user_id?: string | null;
};

/** Realtime admin alerts: new customer jobs + contractor sign-ups / review submissions. */
export default function AdminRealtimeAlerts() {
  const push = useAdminNotifications((s) => s.push);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    const seen = seenRef.current;

    const alertJob = (row: JobRow) => {
      const id = row.id;
      if (!id || seen.has(`job:${id}`)) return;
      seen.add(`job:${id}`);
      push({
        type: "alert",
        title: "New job submitted",
        message: row.reference
          ? `${row.reference} is waiting in the queue.`
          : "A customer has submitted a new booking.",
        href: `/jobs/${id}`,
        persistent: true,
        playSound: true,
      });
    };

    const alertContractorReview = (row: OperativeRow, subtitle: string) => {
      const id = row.id;
      if (!id || seen.has(`contractor:${id}:${subtitle}`)) return;
      seen.add(`contractor:${id}:${subtitle}`);
      const name = row.full_name?.trim() || row.email || "Contractor";
      push({
        type: "alert",
        title: subtitle,
        message: `${name} — review in Contractors.`,
        href: `/contractors/${id}`,
        persistent: true,
        playSound: true,
      });
    };

    const channel = supabase
      .channel("admin-realtime-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs" },
        (payload) => {
          alertJob(payload.new as JobRow);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "operatives" },
        (payload) => {
          const row = payload.new as OperativeRow;
          if (row.is_verified) return;
          if (row.submitted_for_review_at) {
            alertContractorReview(row, "Contractor submitted for review");
          } else if (row.user_id) {
            alertContractorReview(row, "New contractor signed up");
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "operatives" },
        (payload) => {
          const newRow = payload.new as OperativeRow;
          if (newRow.is_verified || !newRow.submitted_for_review_at || !newRow.id) return;
          const key = `review:${newRow.id}:${newRow.submitted_for_review_at}`;
          if (seen.has(key)) return;
          seen.add(key);
          alertContractorReview(newRow, "Contractor submitted for review");
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [push]);

  return null;
}
