import React, { useState, useEffect, useMemo } from 'react';

// --- Helper Functions ---
const formatKsh = (n) => {
    const num = Number(n || 0);
    try { return num.toLocaleString("en-KE"); }
    catch { return String(num); }
};

const getStartOfMonth = () => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
};

const getToday = () => {
    return new Date().toISOString().split('T')[0];
};

// --- Sub-components ---
const Badge = ({ kind }) => {
    const isFixed = kind === "fixed";
    const isProrated = kind === "prorated";
    const isDaily = kind === "daily";

    let colors = "bg-gray-100 text-gray-800";
    if (isFixed) colors = "bg-sky-100 text-sky-700";
    if (isProrated) colors = "bg-amber-100 text-amber-800";
    if (isDaily) colors = "bg-purple-100 text-purple-800";

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${colors}`}>
            {kind}
        </span>
    );
};

// --- Main Component ---
export default function PayrollView({ clinicId, token, locationId }) {
    const [startDate, setStartDate] = useState(getStartOfMonth());
    const [endDate, setEndDate] = useState(getToday());

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [run, setRun] = useState(null);
    const [items, setItems] = useState([]);
    const [expandedRows, setExpandedRows] = useState({});

    const finalized = run?.status === 'finalized';

    useEffect(() => {
        fetchPayroll();
    }, [clinicId, startDate, endDate, locationId]);

    const fetchPayroll = async () => {
        if (!startDate || !endDate) return;
        setLoading(true);
        setError(null);
        try {
            const locQuery = locationId && locationId !== 'all' ? `&locationId=${locationId}` : '';
            const res = await fetch(`/api/clinics/${clinicId}/payroll?startDate=${startDate}&endDate=${endDate}${locQuery}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch payroll');
            const data = await res.json();

            setRun(data.run);
            setItems(data.items || []);
            setExpandedRows({});
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const computedItems = useMemo(() => {
        return items.map(item => {
            const allowances = item.allowances || [];
            const allowanceTotal = allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
            const totalGross = Math.round((parseFloat(item.payable_base) || 0) + allowanceTotal);

            return {
                ...item,
                allowanceTotal,
                totalGross,
                paidUnits: (parseFloat(item.worked_units) || 0) + (parseFloat(item.paid_leave_units) || 0)
            };
        });
    }, [items]);

    const updateRunSettings = async (field, value) => {
        if (finalized || !run) return;
        setRun(prev => ({ ...prev, [field]: value }));
        try {
            const body = { [field]: value };
            await fetch(`/api/clinics/${clinicId}/payroll/runs/${run.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            if (field === 'month_units') fetchPayroll();
        } catch (err) {
            fetchPayroll();
        }
    };

    const updateAllowance = (itemId, listIdx, field, value) => {
        if (finalized) return;
        const newItems = items.map(it => {
            if (it.id !== itemId) return it;
            const newAllowances = [...(it.allowances || [])];
            if (newAllowances[listIdx]) {
                newAllowances[listIdx] = { ...newAllowances[listIdx], [field]: value };
            }
            return { ...it, allowances: newAllowances };
        });
        setItems(newItems);
    };

    const saveItem = async (itemId, newAllowances) => {
        try {
            await fetch(`/api/clinics/${clinicId}/payroll/items/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ allowances: newAllowances })
            });
        } catch (err) { console.error(err); }
    };

    const addAllowance = (itemId) => {
        if (finalized) return;
        const it = items.find(i => i.id === itemId);
        if (!it) return;
        const newAllowances = [...(it.allowances || []), { amount: 0, notes: "" }];
        setItems(items.map(i => i.id === itemId ? { ...i, allowances: newAllowances } : i));
        setExpandedRows(prev => ({ ...prev, [itemId]: true }));
        saveItem(itemId, newAllowances);
    };

    const togglePaid = async (itemId, isPaid) => {
        if (finalized) return;
        const who = run?.marked_by_name || "Admin";
        setItems(items.map(i => i.id === itemId ? {
            ...i,
            is_paid: isPaid,
            paid_at: isPaid ? new Date().toISOString() : null,
            paid_by: isPaid ? who : null
        } : i));

        try {
            await fetch(`http://localhost:3000/api/clinics/${clinicId}/payroll/items/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ is_paid: isPaid, paid_by: who })
            });
        } catch (err) { console.error(err); }
    };

    const finalizeRun = async () => {
        if (!run || finalized) return;
        if (!window.confirm("Mark everyone as paid and Finalize run?")) return;

        try {
            const who = run?.marked_by_name || "Admin";
            await Promise.all(items.map(i => {
                if (!i.is_paid) {
                    return fetch(`http://localhost:3000/api/clinics/${clinicId}/payroll/items/${i.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ is_paid: true, paid_by: who })
                    });
                }
                return Promise.resolve();
            }));

            await fetch(`http://localhost:3000/api/clinics/${clinicId}/payroll/runs/${run.id}/finalize`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchPayroll();
        } catch (err) {
            alert("Error finalizing: " + err.message);
        }
    };

    const downloadCSV = () => {
        if (!run || !finalized) return;
        const header = [
            "Staff", "Role", "DaysWorked", "PaidUnits", "MonthUnits", "MonthlySalary", "PayMethod", "BaseGross",
            "AllowancesTotal", "TotalGross", "Status", "PaidDate", "MarkedPaidBy"
        ];
        const csvRows = [header, ...computedItems.map(c => [
            c.name, c.role,
            c.worked_units, c.paidUnits, c.period_units,
            c.salary, c.pay_method, c.payable_base,
            c.allowanceTotal, c.totalGross,
            c.is_paid ? "Paid" : "Unpaid", c.paid_at ? new Date(c.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "-", c.paid_by || "-"
        ])].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));

        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll-${startDate}-${endDate}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    if (loading && !run) return <div className="p-12 text-center text-gray-500">Loading payroll data...</div>;
    if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

    return (
        <div className="bg-slate-50 rounded-xl p-6 min-h-[500px]">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Payroll Run</h2>
                    <p className="text-sm text-slate-500">
                        {locationId && locationId !== 'all' ? 'Location Filter Active' : 'All Locations'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm text-slate-600 flex items-center gap-2">
                        From: <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded border px-2 py-1" />
                    </label>
                    <label className="text-sm text-slate-600 flex items-center gap-2">
                        To: <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded border px-2 py-1" />
                    </label>
                </div>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-4 bg-white p-3 rounded-lg border border-slate-200">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                    <span>Marked by:</span>
                    <input
                        className="w-32 rounded border px-2 py-1 text-slate-900"
                        value={run?.marked_by_name || ""}
                        onChange={(e) => updateRunSettings('marked_by_name', e.target.value)}
                        disabled={finalized}
                        placeholder="Name"
                    />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                    <span>Month Units:</span>
                    <input
                        type="number" className="w-16 rounded border px-2 py-1 text-slate-900"
                        value={run?.month_units || 30}
                        onChange={(e) => updateRunSettings('month_units', e.target.value)}
                        disabled={finalized}
                    />
                </label>
                <div className="ml-auto flex gap-2">
                    <button
                        onClick={finalizeRun}
                        disabled={finalized}
                        className={`rounded-full px-4 py-2 text-sm font-bold text-white shadow-sm transition ${finalized ? "bg-emerald-600/70" : "bg-emerald-600 hover:bg-emerald-500"}`}
                    >
                        {finalized ? "Finalized" : "Mark All as Paid"}
                    </button>
                    {finalized && (
                        <button onClick={downloadCSV} className="rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500">
                            CSV
                        </button>
                    )}
                </div>
            </div>

            {finalized && (
                <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <strong>Payroll Finalized.</strong> Changes are locked.
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                        <tr>
                            <th className="w-10 border-b p-3"></th>
                            <th className="border-b p-3">Staff</th>
                            <th className="border-b p-3">Units</th>
                            <th className="border-b p-3">Rate</th>
                            <th className="border-b p-3">Method</th>
                            <th className="border-b p-3">Base</th>
                            <th className="border-b p-3">Allowances</th>
                            <th className="border-b p-3">Gross</th>
                            <th className="border-b p-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {computedItems.map(item => (
                            <React.Fragment key={item.id}>
                                <tr className="hover:bg-slate-50/50">
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => setExpandedRows(p => ({ ...p, [item.id]: !p[item.id] }))}
                                            className="font-bold text-teal-600"
                                        >
                                            {expandedRows[item.id] ? "–" : "+"}
                                        </button>
                                    </td>
                                    <td className="p-3 font-medium">
                                        {item.name}
                                        <div className="text-xs text-slate-500">{item.role}</div>
                                    </td>
                                    <td className="p-3">
                                        <span className="font-semibold">{item.paidUnits}</span>
                                        <span className="text-slate-400 text-xs"> / {item.period_units}</span>
                                    </td>
                                    <td className="p-3">{formatKsh(item.salary || item.rate)}</td>
                                    <td className="p-3"><Badge kind={item.pay_method} /></td>
                                    <td className="p-3">{formatKsh(item.payable_base)}</td>
                                    <td className="p-3">{formatKsh(item.allowanceTotal)}</td>
                                    <td className="p-3 font-bold">{formatKsh(item.totalGross)}</td>
                                    <td className="p-3">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={item.is_paid || false}
                                                disabled={finalized}
                                                onChange={(e) => togglePaid(item.id, e.target.checked)}
                                                className="rounded text-emerald-600"
                                            />
                                            <span className={item.is_paid ? "text-emerald-700" : "text-slate-400"}>
                                                {item.is_paid ? "Paid" : "Pending"}
                                            </span>
                                        </label>
                                    </td>
                                </tr>
                                {expandedRows[item.id] && (
                                    <tr className="bg-slate-50/80">
                                        <td colSpan="9" className="p-4">
                                            <div className="grid gap-6 md:grid-cols-3">
                                                <div className="rounded-lg border bg-white p-3 shadow-sm">
                                                    <h4 className="mb-2 font-semibold">Breakdown</h4>
                                                    <div className="text-xs space-y-1 text-slate-600">
                                                        <div className="flex justify-between"><span>Worked:</span> <b>{item.worked_units}</b></div>
                                                        <div className="flex justify-between"><span>Paid Leave:</span> <b>{item.paid_leave_units}</b></div>
                                                        {item.breakdown && Object.entries(item.breakdown).map(([t, v]) => (
                                                            <div key={t} className="flex justify-between pl-3 italic text-slate-500 text-[11px]">
                                                                <span>{t}:</span> <span>{v}</span>
                                                            </div>
                                                        ))}
                                                        <div className="flex justify-between"><span>Unpaid:</span> <b>{item.unpaid_leave_units}</b></div>
                                                        <div className="flex justify-between"><span>Absent:</span> <b>{item.absent_units}</b></div>
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border bg-white p-3 shadow-sm">
                                                    <h4 className="mb-2 font-semibold">Allowances</h4>
                                                    <div className="space-y-2">
                                                        {(item.allowances || []).map((allow, idx) => (
                                                            <div key={idx} className="flex gap-2 text-xs">
                                                                <input
                                                                    type="number" disabled={finalized}
                                                                    className="w-16 rounded border px-1"
                                                                    value={allow.amount}
                                                                    onChange={(e) => updateAllowance(item.id, idx, 'amount', e.target.value)}
                                                                    onBlur={() => saveItem(item.id, item.allowances)}
                                                                />
                                                                <input
                                                                    type="text" disabled={finalized}
                                                                    className="flex-1 rounded border px-1"
                                                                    value={allow.notes}
                                                                    onChange={(e) => updateAllowance(item.id, idx, 'notes', e.target.value)}
                                                                    onBlur={() => saveItem(item.id, item.allowances)}
                                                                />
                                                            </div>
                                                        ))}
                                                        {!finalized && <button onClick={() => addAllowance(item.id)} className="text-xs text-teal-600 font-bold">+ Add</button>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
                {computedItems.length === 0 && !loading && (
                    <div className="p-8 text-center text-slate-500">No data found.</div>
                )}
            </div>

            {/* External Staff Section */}
            <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-bold text-slate-800 mb-2">External Staff (Locums)</h3>
                <p className="text-sm text-slate-500 mb-4">Daily workers paid on the day of shift. For record-keeping only - not processed through payroll.</p>
                {computedItems.filter(i => i.pay_method === 'daily').length > 0 ? (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-3 py-2 text-left">Staff</th>
                                <th className="px-3 py-2 text-left">Role</th>
                                <th className="px-3 py-2 text-center">Status</th>
                                <th className="px-3 py-2 text-right">Daily Rate</th>
                                <th className="px-3 py-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {computedItems.filter(i => i.pay_method === 'daily').map(item => (
                                <tr key={item.id} className="border-b hover:bg-slate-50">
                                    <td className="px-3 py-2 font-medium">{item.name}</td>
                                    <td className="px-3 py-2 text-slate-600">{item.role || '-'}</td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs ${item.worked_units > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.worked_units > 0 ? 'Worked' : 'No-Show'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right">{formatKsh(item.rate)}</td>
                                    <td className="px-3 py-2 text-right font-medium">{formatKsh(item.totalGross)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-6 text-center text-slate-400 border border-dashed rounded-lg">
                        No external staff found for this period. Add locums via Schedule → Manage coverage.
                    </div>
                )}
            </div>
        </div>
    );
}
