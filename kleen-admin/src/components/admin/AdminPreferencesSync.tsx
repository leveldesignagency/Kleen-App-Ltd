"use client";

import { useEffect } from "react";
import { useAdminStaff } from "@/components/admin/AdminStaffProvider";
import { useAdminNotifications } from "@/lib/admin-notifications";

/** Keeps notification sound flag in sync with staff profile preferences. */
export default function AdminPreferencesSync() {
  const { preferences } = useAdminStaff();
  const setSoundEnabled = useAdminNotifications((s) => s.setSoundEnabled);

  useEffect(() => {
    setSoundEnabled(preferences.alertSounds);
    document.documentElement.dataset.adminCompact = preferences.compactTables ? "true" : "false";
  }, [preferences.alertSounds, preferences.compactTables, setSoundEnabled]);

  return null;
}
