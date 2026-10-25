import { useState, useEffect, lazy, Suspense } from "react";
import { FileText, Folder, Database, Clock } from "lucide-react";
import type { EmployeeProfile, OverviewResponse } from "../types";
import { getOverview } from "../api/overviewApi";

const FileTypeChart = lazy(
  () => import("../components/overview/FileTypeChart"),
);

interface OverviewPageProps {
  profile: EmployeeProfile;
  idToken: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

export default function OverviewPage({ profile, idToken }: OverviewPageProps) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOverview(idToken)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load overview",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Loading overview...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-red-600">
        {error ?? "Failed to load overview"}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-1">Overview</p>
        <h1 className="text-lg font-semibold text-slate-900">
          {profile.department.toUpperCase()} Department
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
            <FileText
              size={15}
              className="text-blue-600"
              aria-hidden="true"
            />
          </div>
          <p className="text-xl font-semibold text-slate-900">
            {data.total_documents}
          </p>
          <p className="text-xs text-slate-400">
            Documents · {data.total_folders} folders
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
            <Database
              size={15}
              className="text-emerald-700"
              aria-hidden="true"
            />
          </div>
          <p className="text-xl font-semibold text-slate-900">
            {formatBytes(data.total_storage_bytes)}
          </p>
          <p className="text-xs text-slate-400">Storage used</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center mb-2">
            <Clock size={15} className="text-amber-700" aria-hidden="true" />
          </div>
          <p className="text-xl font-semibold text-slate-900">
            {data.uploaded_this_week}
          </p>
          <p className="text-xs text-slate-400">Uploaded this week</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-3">
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-700 mb-3">File types</p>
          <Suspense
            fallback={
              <p className="text-sm text-slate-400 text-center py-8">
                Loading chart...
              </p>
            }
          >
            <FileTypeChart fileTypes={data.file_types} />
          </Suspense>
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-700 mb-3">
            Busiest folders
          </p>
          {data.busiest_folders.length === 0 ? (
            <p className="text-sm text-slate-400">No folders with files yet.</p>
          ) : (
            <div className="space-y-2">
              {data.busiest_folders.map((f) => (
                <div
                  key={f.folder_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-1.5 text-slate-600 truncate">
                    <Folder
                      size={13}
                      className="text-slate-400 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{f.name}</span>
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {f.file_count} files
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-700 mb-3">
            Recently uploaded
          </p>
          {data.recent_uploads.length === 0 ? (
            <p className="text-sm text-slate-400">No documents yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recent_uploads.map((d) => (
                <div
                  key={d.file_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-1.5 text-slate-600 truncate">
                    <FileText
                      size={13}
                      className="text-slate-400 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{d.display_name}</span>
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {timeAgo(d.uploaded_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-700 mb-3">
            Largest files
          </p>
          {data.largest_files.length === 0 ? (
            <p className="text-sm text-slate-400">No documents yet.</p>
          ) : (
            <div className="space-y-2">
              {data.largest_files.map((d) => (
                <div
                  key={d.file_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-1.5 text-slate-600 truncate">
                    <FileText
                      size={13}
                      className="text-slate-400 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{d.display_name}</span>
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {formatBytes(d.file_size)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
