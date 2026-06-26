export type AppErrorKind =
  | "service_down"
  | "auth"
  | "network"
  | "validation"
  | "server"
  | "unknown";

export type AppErrorPresentation = {
  kind: AppErrorKind;
  title: string;
  message: string;
  detail?: string;
  reportId: string;
  canRetry: boolean;
  showContact: boolean;
};

export function createReportId(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KL-${t}-${r}`;
}

function isNetworkMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("load failed") ||
    m.includes("timeout") ||
    m.includes("connection")
  );
}

export function buildErrorPresentation(
  input: {
    message?: string;
    code?: string;
    httpStatus?: number;
  },
  reportId?: string,
): AppErrorPresentation {
  const id = reportId || createReportId();
  const message = input.message?.trim() || "Something went wrong. Please try again.";
  const code = input.code || "";
  const status = input.httpStatus;

  if (status === 503 || status === 502 || status === 504) {
    return {
      kind: "service_down",
      title: "Kleen is temporarily unavailable",
      message: "Our booking service isn't responding right now. Your details haven't been lost — try again in a moment or contact the team.",
      detail: message,
      reportId: id,
      canRetry: true,
      showContact: true,
    };
  }

  if (isNetworkMessage(message)) {
    return {
      kind: "network",
      title: "Connection problem",
      message: "We couldn't reach Kleen's servers. Check your internet connection and try again.",
      detail: message,
      reportId: id,
      canRetry: true,
      showContact: true,
    };
  }

  if (code === "42501" || message.toLowerCase().includes("row-level security")) {
    return {
      kind: "auth",
      title: "Sign-in required",
      message: "Your session may have expired. Sign out and sign in again, then retry your booking.",
      detail: message,
      reportId: id,
      canRetry: false,
      showContact: true,
    };
  }

  if (
    code === "23503" ||
    message.toLowerCase().includes("foreign key") ||
    message.toLowerCase().includes("service")
  ) {
    return {
      kind: "validation",
      title: "This service isn't available right now",
      message: "We couldn't save your booking for this service. The Kleen team can help — send a report or email us with your reference code.",
      detail: message,
      reportId: id,
      canRetry: true,
      showContact: true,
    };
  }

  if (status && status >= 500) {
    return {
      kind: "server",
      title: "Something went wrong on our side",
      message: "We couldn't complete your booking. Please try again — if it keeps failing, send a report so our team can fix it.",
      detail: message,
      reportId: id,
      canRetry: true,
      showContact: true,
    };
  }

  return {
    kind: "unknown",
    title: "Couldn't submit your job",
    message: "Please try again. If the problem continues, contact the Kleen team with your reference code below.",
    detail: message,
    reportId: id,
    canRetry: true,
    showContact: true,
  };
}
