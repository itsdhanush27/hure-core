import React, { useState, useEffect } from 'react';

export default function LeaveTypesManager({ clinicId, token }) {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [isPaid, setIsPaid] = useState(true);
    const [days, setDays] = useState(21);
    const [saving, setSaving] = useState(false);

    // Edit State
    const [editing, setEditing] = useState(null);
    const [editName, setEditName] = useState('');
    const [editIsPaid, setEditIsPaid] = useState(true);
    const [editDays, setEditDays] = useState(21);

    useEffect(() => {
        fetchTypes();
    }, [clinicId]);

    const fetchTypes = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/clinics/${clinicId}/leave/types`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTypes(data.data || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`/api/clinics/${clinicId}/leave/types`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, isPaid, days: Number(days) })
            });
            if (res.ok) {
                setName('');
                setDays(21);
                fetchTypes();
            } else {
                alert('Failed to add type');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (type) => {
        setEditing(type);
        setEditName(type.name);
        setEditIsPaid(type.is_paid);
        setEditDays(type.allowance_days || 21);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`/api/clinics/${clinicId}/leave/types/${editing.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: editName, isPaid: editIsPaid, days: Number(editDays) })
            });
            if (res.ok) {
                setEditing(null);
                fetchTypes();
            } else {
                alert('Failed to update type');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this leave type? Existing requests will remain but linking might break.')) return;
        try {
            await fetch(`/api/clinics/${clinicId}/leave/types/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchTypes();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Leave Types Configuration</h3>

            <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-4 mb-8 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input
                        required
                        value={name} onChange={e => setName(e.target.value)}
                        className="rounded border px-3 py-2 w-48"
                        placeholder="e.g. Study Leave"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select
                        value={isPaid} onChange={e => setIsPaid(e.target.value === 'true')}
                        className="rounded border px-3 py-2 w-32"
                    >
                        <option value="true">Paid</option>
                        <option value="false">Unpaid</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Annual Days</label>
                    <input
                        type="number"
                        value={days} onChange={e => setDays(e.target.value)}
                        className="rounded border px-3 py-2 w-24"
                    />
                </div>
                <button
                    type="submit" disabled={saving}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                    {saving ? 'Adding...' : 'Add Type'}
                </button>
            </form>

            <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-700 font-semibold">
                        <tr>
                            <th className="p-3">Name</th>
                            <th className="p-3">Paid Status</th>
                            <th className="p-3">Allowance</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="4" className="p-6 text-center text-slate-500">Loading...</td></tr>
                        ) : types.length === 0 ? (
                            <tr><td colSpan="4" className="p-6 text-center text-slate-500">No custom leave types defined.</td></tr>
                        ) : (
                            types.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50">
                                    <td className="p-3 font-medium">{t.name}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.is_paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {t.is_paid ? 'Paid' : 'Unpaid'}
                                        </span>
                                    </td>
                                    <td className="p-3">{t.allowance_days || 0} days / year</td>
                                    <td className="p-3 text-right space-x-3">
                                        <button onClick={() => handleEdit(t)} className="text-primary-600 hover:text-primary-800 font-medium text-xs">
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-800 font-medium text-xs">
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                        <h2 className="text-lg font-bold mb-4">Edit Leave Type</h2>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input
                                    required
                                    value={editName} onChange={e => setEditName(e.target.value)}
                                    className="w-full rounded border px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                <select
                                    value={editIsPaid} onChange={e => setEditIsPaid(e.target.value === 'true')}
                                    className="w-full rounded border px-3 py-2"
                                >
                                    <option value="true">Paid</option>
                                    <option value="false">Unpaid</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Annual Days</label>
                                <input
                                    type="number"
                                    value={editDays} onChange={e => setEditDays(e.target.value)}
                                    className="w-full rounded border px-3 py-2"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditing(null)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium">
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

