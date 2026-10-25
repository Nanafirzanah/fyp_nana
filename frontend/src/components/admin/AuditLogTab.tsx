import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { AuditLogEntry, Employee } from "../../types";
import Skeleton from "../ui/Skeleton";
import { getAuditLog } from "../../api/adminApi";

const ACTIONS = [
  { value: "", label: "All Actions" },
  { value: "upload", label: "Upload" },
  { value: "rename", label: "Rename" },
  { value: "delete", label: "Delete" },
  { value: "move", label: "Move" },
  { value: "download", label: "Download" },
  { value: "login", label: "Login" },
  { value: "create_folder", label: "Create Folder" },
  { value: "rename_folder", label: "Rename Folder" },
  { value: "delete_folder", label: "Delete Folder" },
] as const;

const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  ACTIONS.filter((a) => a.value).map((a) => [a.value, a.label]),
);

const ACTION_COLORS: Record<string, string> = {
  upload: "bg-green-100 text-green-700",
  create_folder: "bg-green-100 text-green-700",
  rename: "bg-blue-100 text-blue-700",
  rename_folder: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  delete_folder: "bg-red-100 text-red-700",
  move: "bg-amber-100 text-amber-700",
  download: "bg-slate-100 text-slate-700",
  login: "bg-blue-100 text-blue-700",
};

interface AuditLogTabProps {
  idToken: string;
  employees: Employee[];
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        ACTION_COLORS[action] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AuditLogTab({ idToken, employees }: AuditLogTabProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [department, setDepartment] = useState("");
  const [action, setAction] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");

  const departments = useMemo(() => {
    const set = new Set(employees.map((e) => e.department));
    return Array.from(set).sort();
  }, [employees]);

  const employeeNameByEmail = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => map.set(e.email, e.name));
    return map;
  }, [employees]);

  async function loadLogs() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getAuditLog(idToken, {
        department: department || undefined,
        action: action || undefined,
      });
      setLogs(data.logs);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load audit log",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken, department, action]);

  const filteredLogs = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const name = employeeNameByEmail.get(log.actor_email) ?? "";
      return (
        log.actor_email.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    });
  }, [logs, employeeQuery, employeeNameByEmail]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
        <h2 className="text-base font-semibold text-slate-800">Audit Log</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 sm:w-auto"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d.replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 sm:w-auto"
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={employeeQuery}
            onChange={(e) => setEmployeeQuery(e.target.value)}
            placeholder="Search employee..."
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 sm:w-40"
          />
          <button
            type="button"
            onClick={loadLogs}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-red-600">{loadError}</p>
          <button
            type="button"
            onClick={loadLogs}
            className="mt-3 text-sm font-medium text-slate-700 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          <div className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-12 sm:gap-4">
            <div className="col-span-2">Time</div>
            <div className="col-span-3">Employee</div>
            <div className="col-span-2">Action</div>
            <div className="col-span-3">Target</div>
            <div className="col-span-2">Details</div>
          </div>

          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2 px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))
          ) : filteredLogs.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              No audit log entries found.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.log_id} className="hover:bg-slate-50">
                <div className="space-y-1.5 px-4 py-3 sm:hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-xs text-slate-400"
                      title={new Date(log.timestamp).toLocaleString()}
                    >
                      {formatLogTime(log.timestamp)}
                    </span>
                    <ActionBadge action={log.action} />
                  </div>
                  <div className="text-sm font-medium text-slate-800">
                    {employeeNameByEmail.get(log.actor_email) ??
                      log.actor_email}
                  </div>
                  {employeeNameByEmail.has(log.actor_email) && (
                    <div className="text-xs text-slate-400">
                      {log.actor_email}
                    </div>
                  )}
                  <div className="text-sm text-slate-600">
                    {log.target_name ?? log.target_id ?? "—"}
                    {log.target_type && (
                      <span className="ml-1.5 text-xs text-slate-400">
                        ({log.target_type})
                      </span>
                    )}
                  </div>
                  {log.details && (
                    <div className="text-xs text-slate-500">{log.details}</div>
                  )}
                </div>

                <div className="hidden px-6 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
                  <div
                    className="col-span-2 truncate text-slate-600"
                    title={new Date(log.timestamp).toLocaleString()}
                  >
                    {formatLogTime(log.timestamp)}
                  </div>
                  <div className="col-span-3 min-w-0">
                    <div className="truncate font-medium text-slate-800">
                      {employeeNameByEmail.get(log.actor_email) ??
                        log.actor_email}
                    </div>
                    {employeeNameByEmail.has(log.actor_email) && (
                      <div className="truncate text-xs text-slate-400">
                        {log.actor_email}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <ActionBadge action={log.action} />
                  </div>
                  <div className="col-span-3 truncate text-slate-600">
                    {log.target_name ?? log.target_id ?? "—"}
                    {log.target_type && (
                      <span className="ml-1.5 text-xs text-slate-400">
                        ({log.target_type})
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 truncate text-slate-500">
                    {log.details ?? "—"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
