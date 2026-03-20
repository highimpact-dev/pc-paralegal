import { useState, useEffect } from "react";

const API = "http://localhost:3101/api";

interface ActivityEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorType: string;
  actorId: string | null;
  details: string | null;
  createdAt: string;
}

interface Props {
  companyId: string;
}

export default function ActivityTab({ companyId }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, 10000);
    return () => clearInterval(interval);
  }, [companyId]);

  async function loadActivity() {
    const res = await fetch(`${API}/companies/${companyId}/activity`);
    const data = await res.json();
    const items: ActivityEvent[] = data.activity || data.events || [];
    setEvents(items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }

  return (
    <section className="border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface overflow-hidden">
      <div className="px-5 py-3 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card flex items-center justify-between">
        <h3 className="font-semibold text-sm">Activity</h3>
        <span className="text-xs text-gray-400">auto-refreshes every 10s</span>
      </div>

      {events.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          No activity yet.
        </div>
      ) : (
        <div className="divide-y dark:divide-dark-border">
          {events.map((event) => (
            <div key={event.id} className="px-5 py-3 flex gap-4">
              <div className="w-1.5 shrink-0 mt-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent/60" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {event.action}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {event.entityType}
                    <span className="font-mono ml-1 text-gray-400 dark:text-gray-500">
                      {event.entityId.slice(0, 8)}
                    </span>
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    via {event.actorType}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {relativeTime(event.createdAt)}
                  </span>
                </div>
                {event.details && <DetailBlock raw={event.details} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DetailBlock({ raw }: { raw: string }) {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{raw}</p>;
  }

  if (!parsed || typeof parsed !== "object") return null;

  const entries = Object.entries(parsed).slice(0, 5);
  if (entries.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
      {entries.map(([key, val]) => (
        <span key={key} className="text-[10px] text-gray-500 dark:text-gray-400">
          <span className="text-gray-400 dark:text-gray-500">{key}:</span>{" "}
          {String(val)}
        </span>
      ))}
    </div>
  );
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeTime(iso: string): string {
  try {
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const absDiff = Math.abs(diff);

    if (absDiff < 60) return rtf.format(Math.round(diff), "second");
    if (absDiff < 3600) return rtf.format(Math.round(diff / 60), "minute");
    if (absDiff < 86400) return rtf.format(Math.round(diff / 3600), "hour");
    return rtf.format(Math.round(diff / 86400), "day");
  } catch {
    return iso;
  }
}
