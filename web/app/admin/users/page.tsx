'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../_components/AdminShell';
import { apiFetch } from '../../../lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', role: 'technician', password: '' });

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
          <div key={u.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{u.name} <span className="text-xs uppercase text-gray-500">{u.role}</span></div>
              <div className="text-sm text-gray-500">{u.phone || u.email}</div>
            </div>
            <button
              onClick={() => toggleActive(u.id, !u.is_active)}
              className={`px-3 py-1 rounded text-sm text-white ${u.is_active ? 'bg-red-600' : 'bg-green-600'}`}
            >
              {u.is_active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
