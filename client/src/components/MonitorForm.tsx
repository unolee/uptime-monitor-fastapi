import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useServer } from "../context/ServerContext";

export default function MonitorForm() {
  const { api } = useServer();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", url: "", method: "GET", interval_seconds: 60, timeout_seconds: 30, expected_status: 200,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/monitors", form);
      navigate("/");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add New Monitor</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name" required>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="My Website" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" required />
        </Field>
        <Field label="URL" required>
          <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://example.com" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="HTTP Method">
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white">
              <option value="GET">GET</option><option value="HEAD">HEAD</option><option value="POST">POST</option>
            </select>
          </Field>
          <Field label="Check Interval">
            <select value={form.interval_seconds} onChange={(e) => setForm({ ...form, interval_seconds: Number(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white">
              <option value={30}>30 seconds</option><option value={60}>1 minute</option>
              <option value={300}>5 minutes</option><option value={600}>10 minutes</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Timeout (seconds)">
            <input type="number" value={form.timeout_seconds} onChange={(e) => setForm({ ...form, timeout_seconds: Number(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" min={1} max={120} />
          </Field>
          <Field label="Expected Status Code">
            <input type="number" value={form.expected_status} onChange={(e) => setForm({ ...form, expected_status: Number(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" min={100} max={599} />
          </Field>
        </div>
        <button type="submit" disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 rounded transition">
          {saving ? "Adding..." : "Add Monitor"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label} {required && <span className="text-red-400">*</span>}</label>
      {children}
    </div>
  );
}
