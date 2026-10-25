import { useState, useEffect, type FormEvent } from "react";
import { RefreshCw, Lock, Unlock, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Employee, RegisterEmployeePayload } from "../types";
import Skeleton from "../components/ui/Skeleton";
import {
  getEmployees,
  registerEmployee,
  updateEmployeeDepartment,
  lockEmployee,
  unlockEmployee,
} from "../api/adminApi";
import AuditLogTab from "../components/admin/AuditLogTab";

const ROLES = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "system_admin", label: "System Administrator" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  employee: "Employee",
  manager: "Manager",
  system_admin: "System Administrator",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status === "locked" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
    >
      {status}
    </span>
  );
}

function OnboardingBadge({ complete }: { complete?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${complete ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"}`}
    >
      {complete ? "Complete" : "Pending"}
    </span>
  );
}

function generateTempPassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;

  const rand = (max: number) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  };

  const required = [
    upper[rand(upper.length)],
    lower[rand(lower.length)],
    digits[rand(digits.length)],
    symbols[rand(symbols.length)],
  ];
  const rest = Array.from({ length: 8 }, () => all[rand(all.length)]);
  const chars = [...required, ...rest];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const EMPTY_FORM: RegisterEmployeePayload = {
  email: "",
  name: "",
  department: "",
  role: "employee",
  personal_email: "",
  temp_password: "",
};

interface AdminDashboardProps {
  idToken: string;
}

export default function AdminDashboard({ idToken }: AdminDashboardProps) {
  const [form, setForm] = useState<RegisterEmployeePayload>(EMPTY_FORM);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editDept, setEditDept] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"employees" | "audit-log">(
    "employees",
  );

  function setField<K extends keyof RegisterEmployeePayload>(
    key: K,
    value: RegisterEmployeePayload[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function loadEmployees() {
    setIsLoadingEmployees(true);
    setLoadError(null);
    try {
      const data = await getEmployees(idToken);
      setEmployees(data);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load employees",
      );
    } finally {
      setIsLoadingEmployees(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEmployees();
  }, [idToken]);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setRegisterError(null);
    setIsRegistering(true);
    try {
      await registerEmployee(idToken, form);
      toast.success(
        `${form.name} registered. Welcome email sent to ${form.personal_email}.`,
      );
      setForm(EMPTY_FORM);
      await loadEmployees();
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : "Failed to register employee",
      );
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleSaveDept(email: string) {
    const trimmed = editDept.trim().toLowerCase();
    if (!trimmed) return;
    setPendingEmail(email);
    try {
      await updateEmployeeDepartment(idToken, email, trimmed);
      setEmployees((prev) =>
        prev.map((e) =>
          e.email === email ? { ...e, department: trimmed } : e,
        ),
      );
      setEditingEmail(null);
      toast.success("Department updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update department",
      );
    } finally {
      setPendingEmail(null);
    }
  }

  async function handleToggleLock(emp: Employee) {
    const locking = emp.status !== "locked";
    setPendingEmail(emp.email);
    try {
      if (locking) {
        await lockEmployee(idToken, emp.email);
        setEmployees((prev) =>
          prev.map((e) =>
            e.email === emp.email ? { ...e, status: "locked" } : e,
          ),
        );
        toast.success(`${emp.name} locked`);
      } else {
        await unlockEmployee(idToken, emp.email);
        setEmployees((prev) =>
          prev.map((e) =>
            e.email === emp.email ? { ...e, status: "active" } : e,
          ),
        );
        toast.success(`${emp.name} unlocked`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPendingEmail(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage employees and system access.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("employees")}
          className={`px-4 py-2 text-sm font-medium ${activeTab === "employees" ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500 hover:text-slate-700"}`}
        >
          Employees
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("audit-log")}
          className={`px-4 py-2 text-sm font-medium ${activeTab === "audit-log" ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500 hover:text-slate-700"}`}
        >
          Audit Log
        </button>
      </div>

      {activeTab === "employees" && (
        <>
          {/* Register Employee */}
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-800">
              Register Employee
            </h2>
            <form
              onSubmit={handleRegister}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <div>
                <label
                  htmlFor="reg-name"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="Muhd Ridwan"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Work Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="user@yourcompany.com"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-dept"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Department
                </label>
                <input
                  id="reg-dept"
                  type="text"
                  required
                  value={form.department}
                  onChange={(e) => setField("department", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="IT"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-role"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Role
                </label>
                <select
                  id="reg-role"
                  required
                  value={form.role}
                  onChange={(e) => setField("role", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="reg-personal-email"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Personal Email
                </label>
                <input
                  id="reg-personal-email"
                  type="email"
                  required
                  value={form.personal_email}
                  onChange={(e) => setField("personal_email", e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="user@gmail.com"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-temp-password"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Temporary Password
                </label>
                <div className="flex gap-2">
                  <input
                    id="reg-temp-password"
                    type="text"
                    readOnly
                    value={form.temp_password}
                    placeholder="Click Generate →"
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm tracking-wider text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setField("temp_password", generateTempPassword())
                    }
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Generate
                  </button>
                </div>
              </div>

              {registerError && (
                <div className="sm:col-span-2">
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {registerError}
                  </p>
                </div>
              )}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={isRegistering || !form.temp_password}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRegistering ? "Registering..." : "Register Employee"}
                </button>
              </div>
            </form>
          </section>

          {/* Employee Table */}
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-slate-800">
                Employees
              </h2>
              <button
                type="button"
                onClick={loadEmployees}
                disabled={isLoadingEmployees}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoadingEmployees ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {loadError ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-red-600">{loadError}</p>
                <button
                  type="button"
                  onClick={loadEmployees}
                  className="mt-3 text-sm font-medium text-slate-700 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : isLoadingEmployees ? (
              <div className="divide-y divide-slate-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2 px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3.5 w-36" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3.5 w-16" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : employees.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-400">
                No employees yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                <div className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-12 lg:gap-4">
                  <div className="col-span-2">Name</div>
                  <div className="col-span-3">Work Email</div>
                  <div className="col-span-2">Department</div>
                  <div className="col-span-2">Role</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Onboarding</div>
                  <div className="col-span-1">Actions</div>
                </div>

                {employees.map((emp) => (
                  <div key={emp.email} className="group hover:bg-slate-50">
                    <div className="space-y-2 px-4 py-3 lg:hidden">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">
                            {emp.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {emp.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={pendingEmail === emp.email}
                          onClick={() => handleToggleLock(emp)}
                          className={`inline-flex flex-shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                            emp.status === "locked"
                              ? "border-green-200 text-green-700 hover:bg-green-50"
                              : "border-red-200 text-red-600 hover:bg-red-50"
                          }`}
                        >
                          {pendingEmail === emp.email ? (
                            "…"
                          ) : emp.status === "locked" ? (
                            <>
                              <Unlock size={10} aria-hidden="true" /> Unlock
                            </>
                          ) : (
                            <>
                              <Lock size={10} aria-hidden="true" /> Lock
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {editingEmail === emp.email ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editDept}
                              onChange={(e) => setEditDept(e.target.value)}
                              className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveDept(emp.email)}
                              disabled={pendingEmail === emp.email}
                              className="inline-flex items-center rounded-md border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingEmail(null)}
                              className="inline-flex items-center rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEmail(emp.email);
                              setEditDept(
                                emp.department.replace(/\b\w/g, (c) =>
                                  c.toUpperCase(),
                                ),
                              );
                            }}
                            className="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-600 transition-colors hover:bg-slate-100"
                          >
                            {emp.department.replace(/\b\w/g, (c) =>
                              c.toUpperCase(),
                            )}
                            <Pencil
                              size={10}
                              className="opacity-50"
                              aria-hidden="true"
                            />
                          </button>
                        )}
                        <span className="text-xs text-slate-500">
                          {ROLE_LABELS[emp.role] ?? emp.role}
                        </span>
                        <StatusBadge status={emp.status} />
                        <OnboardingBadge complete={emp.onboarding_complete} />
                      </div>
                    </div>

                    {/* Grid row layout - lg breakpoint and up */}
                    <div className="hidden px-6 py-3 lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
                      <div className="col-span-2 truncate font-medium text-slate-800">
                        {emp.name}
                      </div>
                      <div className="col-span-3 truncate text-slate-600">
                        {emp.email}
                      </div>
                      <div className="col-span-2">
                        {editingEmail === emp.email ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editDept}
                              onChange={(e) => setEditDept(e.target.value)}
                              className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveDept(emp.email)}
                              disabled={pendingEmail === emp.email}
                              className="inline-flex items-center rounded-md border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingEmail(null)}
                              className="inline-flex items-center rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEmail(emp.email);
                              setEditDept(
                                emp.department.replace(/\b\w/g, (c) =>
                                  c.toUpperCase(),
                                ),
                              );
                            }}
                            className="-mx-2 inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-left text-slate-600 transition-colors hover:bg-slate-100"
                            title="Click to edit"
                          >
                            {emp.department.replace(/\b\w/g, (c) =>
                              c.toUpperCase(),
                            )}
                            <Pencil
                              size={11}
                              className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-50"
                              aria-hidden="true"
                            />
                          </button>
                        )}
                      </div>
                      <div className="col-span-2 truncate text-slate-600">
                        {ROLE_LABELS[emp.role] ?? emp.role}
                      </div>
                      <div className="col-span-1">
                        <StatusBadge status={emp.status} />
                      </div>
                      <div className="col-span-1">
                        <OnboardingBadge complete={emp.onboarding_complete} />
                      </div>
                      <div className="col-span-1">
                        <button
                          type="button"
                          disabled={pendingEmail === emp.email}
                          onClick={() => handleToggleLock(emp)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                            emp.status === "locked"
                              ? "border-green-200 text-green-700 hover:bg-green-50"
                              : "border-red-200 text-red-600 hover:bg-red-50"
                          }`}
                        >
                          {pendingEmail === emp.email ? (
                            "…"
                          ) : emp.status === "locked" ? (
                            <>
                              <Unlock size={10} aria-hidden="true" /> Unlock
                            </>
                          ) : (
                            <>
                              <Lock size={10} aria-hidden="true" /> Lock
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "audit-log" && (
        <AuditLogTab idToken={idToken} employees={employees} />
      )}
    </div>
  );
}
