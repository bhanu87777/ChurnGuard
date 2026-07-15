import { timeAgo } from "@/lib/utils";

export const eventLabels: Record<string, string> = {
  LOGIN: "🔓 Logged in",
  FEATURE_USE: "🧩 Used a feature",
  SUPPORT_TICKET: "🎫 Opened a support ticket",
  PAYMENT: "💳 Payment succeeded",
  PAYMENT_FAILED: "⚠️ Payment failed",
  NPS_RESPONSE: "📊 Left an NPS response",
};

export interface TimelineEvent {
  id: string;
  type: string;
  metadata: unknown;
  occurredAt: string;
}

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-3 text-sm">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          <div className="flex-1">
            <span>{eventLabels[e.type] ?? e.type}</span>
            {e.metadata != null && (
              <span className="ml-2 text-xs text-muted">
                {JSON.stringify(e.metadata)}
              </span>
            )}
          </div>
          <span className="text-xs text-muted">{timeAgo(e.occurredAt)}</span>
        </li>
      ))}
      {events.length === 0 && (
        <li className="text-sm text-muted">No activity recorded.</li>
      )}
    </ol>
  );
}
