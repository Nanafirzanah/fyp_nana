import { useState, useEffect, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import type { EmployeeProfile, FullProfile } from "../types";
import { getProfile, updateProfile } from "../api/profileApi";
import Skeleton from "../components/ui/Skeleton";

interface ProfilePageProps {
  idToken: string;
  profile: EmployeeProfile;
}

interface ProfileRowProps {
  label: string;
  value: string | null | undefined;
}

function ProfileRow({ label, value }: ProfileRowProps) {
  return (
    <div className="flex py-3">
      <dt className="w-44 shrink-0 text-sm font-medium text-slate-600">
        {label}
      </dt>
      <dd className="text-sm text-slate-800">
        {value ? value : <span className="text-slate-400">Not set</span>}
      </dd>
    </div>
  );
}

export default function ProfilePage({ idToken, profile }: ProfilePageProps) {
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getProfile(idToken);
        setFullProfile(data);
        setAddress(data.address ?? "");
        setPhone(data.phone ?? "");
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load profile",
        );
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [idToken]);

  function startEditing() {
    setAddress(fullProfile?.address ?? "");
    setPhone(fullProfile?.phone ?? "");
    setSaveError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setSaveError(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setIsSaving(true);
    try {
      await updateProfile(idToken, address, phone);
      setFullProfile((prev) =>
        prev
          ? { ...prev, address: address || null, phone: phone || null }
          : prev,
      );
      setIsEditing(false);
      toast.success("Profile updated");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to update profile",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <Skeleton className="h-3 w-20" />
          </div>
          <dl className="divide-y divide-slate-50 px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <Skeleton className="h-3.5 w-32 shrink-0" />
                <Skeleton className="h-3.5 flex-1 max-w-[10rem]" />
              </div>
            ))}
          </dl>
          <div className="border-t border-slate-100 px-6 py-4">
            <Skeleton className="h-3 w-28" />
          </div>
          <dl className="divide-y divide-slate-50 px-6 pb-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <Skeleton className="h-3.5 w-32 shrink-0" />
                <Skeleton className="h-3.5 flex-1 max-w-[10rem]" />
              </div>
            ))}
          </dl>
        </div>
      </div>
    );
  }

  if (loadError || !fullProfile) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError ?? "Profile not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          View and update your profile information.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Account — read-only */}
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Account
          </p>
        </div>
        <dl className="divide-y divide-slate-50 px-6">
          <ProfileRow label="Full Name" value={fullProfile.name} />
          <ProfileRow label="Work Email" value={profile.email} />
          <ProfileRow label="Department" value={fullProfile.department} />
          <ProfileRow label="Role" value={fullProfile.role} />
          <ProfileRow
            label="Personal Email"
            value={fullProfile.personal_email}
          />
        </dl>

        {/* Contact details — editable */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Contact Details
          </p>
          {!isEditing && (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <Pencil size={13} aria-hidden="true" />
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4 px-6 pb-6">
            <div>
              <label
                htmlFor="address"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Address
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                placeholder="123 Main St, Kuala Lumpur"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                placeholder="60123456789"
                maxLength={15}
              />
            </div>
            {saveError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="divide-y divide-slate-50 px-6 pb-2">
            <ProfileRow label="Address" value={fullProfile.address} />
            <ProfileRow label="Phone" value={fullProfile.phone} />
          </dl>
        )}
      </div>
    </div>
  );
}
