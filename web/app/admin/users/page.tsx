'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../_components/AdminShell';
import { apiFetch } from '../../../lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', role: 'technician', password: '' });

  // id of the user currently being edited / having their password reset (or null)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '' });
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');

  function load() {
    apiFetch('/admin/users').then((d) => setUsers(d.users)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(form) });
      setNotice(`${form.role} account created for ${form.name}`);
      setForm({ name: '', phone: '', email: '', role: 'technician', password: '' });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggleActive(id: number, isActive: boolean) {
    try {
      await apiFetch(`/admin/users/${id}/active`, { method: 'PUT', body: JSON.stringify({ isActive }) });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function startEdit(u: any) {
    setEditingId(u.id);
    setResettingId(null);
    setEditForm({ name: u.name || '', phone: u.phone || '', email: u.email || '' });
  }

  async function saveEdit(id: number) {
    setError('');
    setNotice('');
    try {
      await apiFetch(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
      setNotice('User details updated');
      setEditingId(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function startReset(id: number) {
    setResettingId(id);
    setEditingId(null);
    setNewPassword('');
  }

  async function saveReset(id: number) {
    setError('');
    setNotice('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      await apiFetch(`/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      });
      setNotice('Password reset successfully');
      setResettingId(null);
      setNewPassword('');
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      {notice && <p className="text-green-700 mb-2">{notice}</p>}

      <form onSubmit={createUser} className="bg-white rounded shadow p-4 mb-6 grid gap-2 sm:grid-cols-2">
        <input
          className="border rounded p-2"
          placeholder="Full name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select
          className="border rounded p-2"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="technician">Technician</option>
          <option value="customer">Customer</option>
          <option value="admin">Admin</option>
        </select>
        <input
          className="border rounded p-2"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          className="border rounded p-2"
          placeholder="Email (optional)"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="border rounded p-2 sm:col-span-2"
          placeholder="Temporary password (min 8 chars)"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button className="sm:col-span-2 bg-blue-600 text-white rounded p-2">Create User</button>
      </form>

      <div className="bg-white rounded shadow divide-y">
        {users.map((u) => (
          <div key={u.id} className="p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-medium">
                  {u.name} <span className="text-xs uppercase text-gray-500">{u.role}</span>
                </div>
                <div className="text-sm text-gray-500">{u.phone || u.email}</div>
              </div>
              <div className="flex gap-2 text-sm">
                <button onClick={() => startEdit(u)} className="px-3 py-1 bg-gray-700 text-white rounded">
                  Edit
                </button>
                <button onClick={() => startReset(u.id)} className="px-3 py-1 bg-amber-600 text-white rounded">
                  Reset Password
                </button>
                <button
                  onClick={() => toggleActive(u.id, !u.is_active)}
                  className={`px-3 py-1 rounded text-white ${u.is_active ? 'bg-red-600' : 'bg-green-600'}`}
                >
                  {u.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            {editingId === u.id && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3 bg-gray-50 p-3 rounded">
                <input
                  className="border rounded p-2"
                  placeholder="Name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
                <input
                  className="border rounded p-2"
                  placeholder="Phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
                <input
                  className="border rounded p-2"
                  placeholder="Email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
                <div className="sm:col-span-3 flex gap-2">
                  <button onClick={() => saveEdit(u.id)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-gray-300 rounded text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {resettingId === u.id && (
              <div className="mt-3 flex gap-2 items-center bg-gray-50 p-3 rounded">
                <input
                  className="border rounded p-2 flex-1"
                  placeholder="New password (min 8 chars)"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button onClick={() => saveReset(u.id)} className="px-3 py-1 bg-amber-600 text-white rounded text-sm">
                  Set Password
                </button>
                <button onClick={() => setResettingId(null)} className="px-3 py-1 bg-gray-300 rounded text-sm">
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
