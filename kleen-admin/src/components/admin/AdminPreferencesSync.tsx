"use client";

import { useEffect } from "react";
import { useAdminStaff } from "@/components/admin/AdminStaffProvider";
import { useAdminNotifications } from "@/lib/admin-notifications";

/** Keeps notification sound flag in sync with staff profile preferences. */
export default function AdminPreferencesSync() {
  const { preferences } = useAdminStaff();
  const setSoundEnabled = useAdminNotifications((s) => s.setSoundEnabled);
  const setAlertsEnabled = useAdminNotifications((s) => s.setAlertsEnabled);

  useEffect(() => {
    setSoundEnabled(preferences.alertSounds);
    setAlertsEnabled(preferences.showToastAlerts);
    document.documentElement.dataset.adminCompact = preferences.compactTables ? "true" : "false";
  }, [preferences.alertSounds, preferences.showToastAlerts, preferences.compactTables, setSoundEnabled, setAlertsEnabled]);

  return null;
}
