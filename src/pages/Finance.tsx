import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, X, Check, DollarSign, ArrowUpRight, ArrowDownRight, Settings, Trash2, Edit3, Calendar, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import './Finance.css';

interface FinCategory {
    id: string;
    name: string;
    type: 'entrada' | 'despesa';
    color: string;
}

interface FinEntry {
    id: string;
    type: 'entrada' | 'despesa';
    category_id: string;
    description: string;
    amount: number;
    date: string;
    status: string;
    client_id: string | null;
    notes: string | null;
    created_at: string;
    category?: FinCategory;
    client?: { name: string };
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' };
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', outline: 'none', color: '#1e293b', background: '#fff' };

// Date filter helpers
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function subDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() - n); return startOfDay(r); }
function startOfWeek(d: Date) { const r = new Date(d); const day = r.getDay(); const diff = r.getDate() - day + (day === 0 ? -6 : 1); r.setDate(diff); return startOfDay(r); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

type FilterPreset = 'all' | 'today' | '7d' | '15d' | '30d' | '60d' | 'week' | 'month' | 'custom';

const FILTER_PRESETS: { id: FilterPreset; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'today', label: 'Hoje' },
    { id: 'week', label: 'Esta Semana' },
    { id: 'month', label: 'Este Mês' },
    { id: '7d', label: '7 dias' },
    { id: '15d', label: '15 dias' },
    { id: '30d', label: '30 dias' },
    { id: '60d', label: '60 dias' },
    { id: 'custom', label: 'Personalizado' },
];

export function Finance() {
    const [entries, setEntries] = useState<FinEntry[]>([]);
    const [categories, setCategories] = useState<FinCategory[]>([]);
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState<FinEntry | null>(null);

    // Date filter
    const [filterPreset, setFilterPreset] = useState<FilterPreset>('all');
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    // New entry form
    const [entryForm, setEntryForm] = useState({
        type: 'entrada' as 'entrada' | 'despesa',
        category_id: '',
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        status: 'pendente',
        client_id: '',
        notes: ''
    });

    // Category form
    const [catForm, setCatForm] = useState({ name: '', type: 'entrada' as 'entrada' | 'despesa', color: '#3b82f6' });

    useEffect(() => {
        fetchAll();

        const channel = supabase.channel('finance-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_entries' }, () => fetchAll())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [entriesRes, catRes, clientsRes] = await Promise.all([
                supabase.from('financial_entries').select('*, category:financial_categories(*), client:clients(name)').order('date', { ascending: false }),
                supabase.from('financial_categories').select('*').order('name'),
                supabase.from('clients').select('id, name').order('name')
            ]);
            setEntries(entriesRes.data as FinEntry[] || []);
            setCategories(catRes.data as FinCategory[] || []);
            setClients(clientsRes.data || []);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filtered entries by date
    const filteredEntries = useMemo(() => {
        if (filterPreset === 'all') return entries;

        const now = new Date();
        let from: Date;
        let to: Date = endOfDay(now);

        switch (filterPreset) {
            case 'today': from = startOfDay(now); break;
            case 'week': from = startOfWeek(now); break;
            case 'month': from = startOfMonth(now); break;
            case '7d': from = subDays(now, 7); break;
            case '15d': from = subDays(now, 15); break;
            case '30d': from = subDays(now, 30); break;
            case '60d': from = subDays(now, 60); break;
            case 'custom':
                from = customDateFrom ? new Date(customDateFrom) : new Date(0);
                to = customDateTo ? endOfDay(new Date(customDateTo)) : endOfDay(now);
                break;
            default: return entries;
        }

        return entries.filter(e => {
            const d = new Date(e.date);
            return d >= from && d <= to;
        });
    }, [entries, filterPreset, customDateFrom, customDateTo]);

    const openNewEntry = () => {
        setEditingEntry(null);
        setEntryForm({
            type: 'entrada', category_id: categories.find(c => c.type === 'entrada')?.id || '',
            description: '', amount: 0, date: new Date().toISOString().split('T')[0],
            status: 'pendente', client_id: '', notes: ''
        });
        setShowEntryModal(true);
    };

    const openEditEntry = (entry: FinEntry) => {
        setEditingEntry(entry);
        setEntryForm({
            type: entry.type, category_id: entry.category_id, description: entry.description,
            amount: entry.amount, date: entry.date, status: entry.status,
            client_id: entry.client_id || '', notes: entry.notes || ''
        });
        setShowEntryModal(true);
    };

    const saveEntry = async () => {
        try {
            const data = {
                type: entryForm.type,
                category_id: entryForm.category_id || null,
                description: entryForm.description,
                amount: entryForm.amount,
                date: entryForm.date,
                status: entryForm.status,
                client_id: entryForm.client_id || null,
                notes: entryForm.notes || null,
                updated_at: new Date().toISOString()
            };
            if (editingEntry) {
                await supabase.from('financial_entries').update(data).eq('id', editingEntry.id);
            } else {
                await supabase.from('financial_entries').insert([{ ...data, created_at: new Date().toISOString() }]);
            }
            setShowEntryModal(false);
            await fetchAll();
        } catch (err) {
            console.error('Save error:', err);
            alert('Erro ao salvar!');
        }
    };

    const deleteEntry = async (id: string) => {
        if (!confirm('Excluir esta entrada?')) return;
        await supabase.from('financial_entries').delete().eq('id', id);
        await fetchAll();
    };

    const markAsPaid = async (id: string) => {
        await supabase.from('financial_entries').update({ status: 'pago', updated_at: new Date().toISOString() }).eq('id', id);
        await fetchAll();
    };

    // Category CRUD
    const saveCategory = async () => {
        if (!catForm.name.trim()) return;
        await supabase.from('financial_categories').insert([{ name: catForm.name, type: catForm.type, color: catForm.color }]);
        setCatForm({ name: '', type: 'entrada', color: '#3b82f6' });
        const { data } = await supabase.from('financial_categories').select('*').order('name');
        setCategories(data as FinCategory[] || []);
    };

    const deleteCategory = async (id: string) => {
        await supabase.from('financial_categories').delete().eq('id', id);
        const { data } = await supabase.from('financial_categories').select('*').order('name');
        setCategories(data as FinCategory[] || []);
    };

    // Computed stats (using FILTERED entries for all calculations)
    const totalEntrada = filteredEntries.filter(e => e.type === 'entrada').reduce((s, e) => s + Number(e.amount), 0);
    const totalDespesa = filteredEntries.filter(e => e.type === 'despesa').reduce((s, e) => s + Number(e.amount), 0);
    const saldo = totalEntrada - totalDespesa;
    const totalPagoEntrada = filteredEntries.filter(e => e.type === 'entrada' && e.status === 'pago').reduce((s, e) => s + Number(e.amount), 0);
    const totalPagoDespesa = filteredEntries.filter(e => e.type === 'despesa' && e.status === 'pago').reduce((s, e) => s + Number(e.amount), 0);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const filteredCategories2 = (type: 'entrada' | 'despesa') => categories.filter(c => c.type === type);

    const getStatusBadge = (status: string) => {
        const map: Record<string, { label: string; cls: string }> = {
            pendente: { label: 'Pendente', cls: 'badge-warning' },
            pago: { label: 'Pago', cls: 'badge-success' },
            atrasado: { label: 'Atrasado', cls: 'badge-danger' },
            cancelado: { label: 'Cancelado', cls: 'badge-muted' },
        };
        const m = map[status] || map.pendente;
        return <span className={`badge ${m.cls}`}>{m.label}</span>;
    };

    // Chart data from filtered entries (last 6 months)
    const chartData = useMemo(() => {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const now = new Date();
        const result = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const m = d.getMonth();
            const y = d.getFullYear();
            const monthEntries = entries.filter(e => {
                const ed = new Date(e.date);
                return ed.getMonth() === m && ed.getFullYear() === y;
            });
            result.push({
                name: months[m],
                faturamento: monthEntries.filter(e => e.type === 'entrada').reduce((s, e) => s + Number(e.amount), 0),
                gastos: monthEntries.filter(e => e.type === 'despesa').reduce((s, e) => s + Number(e.amount), 0)
            });
        }
        return result;
    }, [entries]);

    if (loading) return <div className="p-8 text-center text-muted animate-pulse">Carregando Financeiro...</div>;

    const activeFilterLabel = FILTER_PRESETS.find(f => f.id === filterPreset)?.label || 'Todos';

    return (
        <div className="finance-container flex flex-col h-full">
            <div className="finance-header flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Financeiro</h1>
                    <p className="text-muted text-sm">Gerencie entradas e despesas</p>
                </div>
                <div className="flex gap-3">
                    <Button size="sm" variant="outline" className="flex items-center gap-2" onClick={() => setShowCategoryModal(true)}>
                        <Settings size={16} /> Categorias
                    </Button>
                    <Button size="sm" className="flex items-center gap-2" onClick={openNewEntry}>
                        <Plus size={16} /> Nova Conta
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="flex flex-col gap-4">
                    <Card className="modern-card p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center text-primary"><DollarSign size={24} /></div>
                            <div>
                                <p className="text-sm text-muted font-medium mb-1">Saldo ({activeFilterLabel})</p>
                                <p className="text-2xl font-bold" style={{ color: saldo >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(saldo)}</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="modern-card p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#eafff3', color: '#10b981' }}><ArrowUpRight size={24} /></div>
                            <div>
                                <p className="text-sm text-muted font-medium mb-1">Entradas (Total)</p>
                                <p className="text-2xl font-bold text-success">{formatCurrency(totalEntrada)}</p>
                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>Pago: {formatCurrency(totalPagoEntrada)}</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="modern-card p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ffebeb', color: '#ef4444' }}><ArrowDownRight size={24} /></div>
                            <div>
                                <p className="text-sm text-muted font-medium mb-1">Despesas (Total)</p>
                                <p className="text-2xl font-bold text-danger">{formatCurrency(totalDespesa)}</p>
                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>Pago: {formatCurrency(totalPagoDespesa)}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                <Card className="modern-card lg:col-span-2 p-5 flex flex-col">
                    <div className="flex justify-between items-center mb-4 border-b pb-4">
                        <h3 className="font-semibold">Evolução: Entradas x Despesas</h3>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 text-sm font-medium"><span className="w-3 h-3 rounded-full bg-success"></span> Entradas</div>
                            <div className="flex items-center gap-2 text-sm font-medium"><span className="w-3 h-3 rounded-full bg-danger"></span> Despesas</div>
                        </div>
                    </div>
                    <div className="flex-1 h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAECEF" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8E9BAE', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8E9BAE', fontSize: 12 }} tickFormatter={(value) => `R$${value / 1000}k`} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, '']} />
                                <Bar dataKey="faturamento" fill="var(--color-status-success)" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="gastos" fill="var(--color-status-danger)" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* =============== DATE FILTER BAR =============== */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Filter size={14} /> Período:
                </div>
                {FILTER_PRESETS.map(preset => (
                    <button
                        key={preset.id}
                        onClick={() => {
                            setFilterPreset(preset.id);
                            if (preset.id !== 'custom') setShowFilterPanel(false);
                            else setShowFilterPanel(true);
                        }}
                        style={{
                            padding: '5px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                            border: filterPreset === preset.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                            background: filterPreset === preset.id ? '#eff6ff' : '#fff',
                            color: filterPreset === preset.id ? '#3b82f6' : '#64748b'
                        }}
                    >
                        {preset.label}
                    </button>
                ))}

                {/* Custom date range inputs */}
                {filterPreset === 'custom' && showFilterPanel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={14} style={{ color: '#94a3b8' }} />
                            <input
                                type="date"
                                value={customDateFrom}
                                onChange={e => setCustomDateFrom(e.target.value)}
                                style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 10px', fontSize: '0.8rem', color: '#1e293b', outline: 'none' }}
                            />
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>até</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={14} style={{ color: '#94a3b8' }} />
                            <input
                                type="date"
                                value={customDateTo}
                                onChange={e => setCustomDateTo(e.target.value)}
                                style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 10px', fontSize: '0.8rem', color: '#1e293b', outline: 'none' }}
                            />
                        </div>
                    </div>
                )}

                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                    {filteredEntries.length} registro(s)
                </span>
            </div>

            {/* Entries Table */}
            <Card className="finance-table-card flex-1 modern-card border-none">
                <CardContent className="p-0">
                    <div className="table-responsive">
                        <table className="table-base w-full">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Tipo</th>
                                    <th>Categoria</th>
                                    <th>Descrição</th>
                                    <th>Cliente</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                    <th className="text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center p-4 text-muted">Nenhuma entrada encontrada para o período selecionado.</td></tr>
                                ) : (
                                    filteredEntries.map(entry => (
                                        <tr key={entry.id}>
                                            <td>{new Date(entry.date).toLocaleDateString('pt-BR')}</td>
                                            <td>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: '20px', background: entry.type === 'entrada' ? '#d1fae5' : '#fee2e2', color: entry.type === 'entrada' ? '#065f46' : '#991b1b' }}>
                                                    {entry.type === 'entrada' ? '↑ Entrada' : '↓ Despesa'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.8rem' }}>{entry.category?.name || '-'}</td>
                                            <td className="font-medium">{entry.description}</td>
                                            <td>{entry.client?.name || '-'}</td>
                                            <td style={{ fontWeight: 700, color: entry.type === 'entrada' ? '#10b981' : '#ef4444' }}>{formatCurrency(Number(entry.amount))}</td>
                                            <td>{getStatusBadge(entry.status)}</td>
                                            <td className="text-right">
                                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                    {entry.status === 'pendente' && (
                                                        <button onClick={() => markAsPaid(entry.id)} title="Marcar como Pago" style={{ padding: '4px', borderRadius: '6px', border: 'none', background: '#d1fae5', color: '#065f46', cursor: 'pointer' }}><Check size={14} /></button>
                                                    )}
                                                    <button onClick={() => openEditEntry(entry)} title="Editar" style={{ padding: '4px', borderRadius: '6px', border: 'none', background: '#eff6ff', color: '#3b82f6', cursor: 'pointer' }}><Edit3 size={14} /></button>
                                                    <button onClick={() => deleteEntry(entry.id)} title="Excluir" style={{ padding: '4px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* =============== NEW ENTRY MODAL =============== */}
            {showEntryModal && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', padding: '1.5rem' }} onClick={() => setShowEntryModal(false)}>
                    <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', margin: 0 }}>
                                <DollarSign size={20} style={{ color: '#3b82f6' }} />
                                {editingEntry ? 'Editar Conta' : 'Nova Conta'}
                            </h2>
                            <button onClick={() => setShowEntryModal(false)} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
                        </div>

                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Type selector */}
                            <div>
                                <label style={labelStyle}>Tipo</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {(['entrada', 'despesa'] as const).map(t => (
                                        <button key={t} onClick={() => {
                                            setEntryForm({ ...entryForm, type: t, category_id: categories.find(c => c.type === t)?.id || '' });
                                        }} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: entryForm.type === t ? '2px solid' : '1px solid #e2e8f0', borderColor: entryForm.type === t ? (t === 'entrada' ? '#10b981' : '#ef4444') : '#e2e8f0', background: entryForm.type === t ? (t === 'entrada' ? '#ecfdf5' : '#fef2f2') : '#fff', color: entryForm.type === t ? (t === 'entrada' ? '#065f46' : '#991b1b') : '#64748b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                                            {t === 'entrada' ? '↑ Entrada' : '↓ Despesa'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={labelStyle}>Descrição *</label>
                                    <input style={inputStyle} placeholder="Ex: Pagamento do serviço X..." value={entryForm.description} onChange={e => setEntryForm({ ...entryForm, description: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Valor (R$) *</label>
                                    <input type="number" step="0.01" style={inputStyle} placeholder="0.00" value={entryForm.amount || ''} onChange={e => setEntryForm({ ...entryForm, amount: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Data *</label>
                                    <input type="date" style={inputStyle} value={entryForm.date} onChange={e => setEntryForm({ ...entryForm, date: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Categoria</label>
                                    <select style={inputStyle} value={entryForm.category_id} onChange={e => setEntryForm({ ...entryForm, category_id: e.target.value })}>
                                        <option value="">Sem categoria</option>
                                        {filteredCategories2(entryForm.type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Status</label>
                                    <select style={inputStyle} value={entryForm.status} onChange={e => setEntryForm({ ...entryForm, status: e.target.value })}>
                                        <option value="pendente">Pendente</option>
                                        <option value="pago">Pago</option>
                                        <option value="atrasado">Atrasado</option>
                                        <option value="cancelado">Cancelado</option>
                                    </select>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={labelStyle}>Cliente (opcional)</label>
                                    <select style={inputStyle} value={entryForm.client_id} onChange={e => setEntryForm({ ...entryForm, client_id: e.target.value })}>
                                        <option value="">Nenhum cliente</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={labelStyle}>Observações</label>
                                    <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} placeholder="Notas adicionais..." value={entryForm.notes} onChange={e => setEntryForm({ ...entryForm, notes: e.target.value })}></textarea>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
                            <Button variant="outline" onClick={() => setShowEntryModal(false)}>Cancelar</Button>
                            <Button onClick={saveEntry}>{editingEntry ? 'Salvar Alterações' : 'Criar Conta'}</Button>
                        </div>
                    </div>
                </div>
                , document.body)}

            {/* =============== CATEGORY MANAGEMENT MODAL =============== */}
            {showCategoryModal && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', padding: '1.5rem' }} onClick={() => setShowCategoryModal(false)}>
                    <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '550px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', margin: 0 }}>
                                <Settings size={20} style={{ color: '#8b5cf6' }} />
                                Gerenciar Categorias
                            </h2>
                            <button onClick={() => setShowCategoryModal(false)} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
                        </div>

                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Add new category */}
                            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0' }}>
                                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>Adicionar Nova Categoria</p>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                    <div style={{ flex: 1 }}>
                                        <input style={inputStyle} placeholder="Nome da categoria..." value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} />
                                    </div>
                                    <select style={{ ...inputStyle, width: '130px' }} value={catForm.type} onChange={e => setCatForm({ ...catForm, type: e.target.value as any })}>
                                        <option value="entrada">Entrada</option>
                                        <option value="despesa">Despesa</option>
                                    </select>
                                    <input type="color" value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })} style={{ width: '38px', height: '38px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', padding: '2px' }} />
                                    <button onClick={saveCategory} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Entradas */}
                            <div>
                                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: '8px' }}>↑ Categorias de Entrada</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {filteredCategories2('entrada').map(cat => (
                                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: '#fff', border: '1px solid #f1f5f9' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: cat.color, flexShrink: 0 }}></div>
                                            <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{cat.name}</span>
                                            <button onClick={() => deleteCategory(cat.id)} style={{ padding: '4px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                    {filteredCategories2('entrada').length === 0 && <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma categoria de entrada.</p>}
                                </div>
                            </div>

                            {/* Despesas */}
                            <div>
                                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: '8px' }}>↓ Categorias de Despesa</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {filteredCategories2('despesa').map(cat => (
                                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: '#fff', border: '1px solid #f1f5f9' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: cat.color, flexShrink: 0 }}></div>
                                            <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{cat.name}</span>
                                            <button onClick={() => deleteCategory(cat.id)} style={{ padding: '4px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                    {filteredCategories2('despesa').length === 0 && <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma categoria de despesa.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                , document.body)}
        </div>
    );
}
