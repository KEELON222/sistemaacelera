import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { DollarSign, Users, Briefcase, FileText, ArrowUpRight, ArrowDownRight, TrendingUp, Calendar, Filter, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import './Dashboard.css';

// Date helpers
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function subDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() - n); return startOfDay(r); }
function startOfWeek(d: Date) { const r = new Date(d); const day = r.getDay(); const diff = r.getDate() - day + (day === 0 ? -6 : 1); r.setDate(diff); return startOfDay(r); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

type FilterPreset = 'all' | 'today' | '7d' | '15d' | '30d' | '60d' | 'week' | 'month' | 'custom';
const FILTER_PRESETS: { id: FilterPreset; label: string }[] = [
    { id: 'all', label: 'Todos' }, { id: 'today', label: 'Hoje' }, { id: 'week', label: 'Esta Semana' },
    { id: 'month', label: 'Este Mês' }, { id: '7d', label: '7 dias' }, { id: '15d', label: '15 dias' },
    { id: '30d', label: '30 dias' }, { id: '60d', label: '60 dias' }, { id: 'custom', label: 'Personalizado' },
];

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [deals, setDeals] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);

    const [filterPreset, setFilterPreset] = useState<FilterPreset>('30d');
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [eRes, cRes, dRes, pRes] = await Promise.all([
                supabase.from('financial_entries').select('*, category:financial_categories(name, color)').order('date', { ascending: false }),
                supabase.from('clients').select('*').order('created_at', { ascending: false }),
                supabase.from('deals').select('*').order('created_at', { ascending: false }),
                supabase.from('projects').select('*').order('created_at', { ascending: false }),
            ]);
            setEntries(eRes.data || []);
            setClients(cRes.data || []);
            setDeals(dRes.data || []);
            setProjects(pRes.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    // Date filter logic
    const filterByDate = (items: any[], dateField: string) => {
        if (filterPreset === 'all') return items;
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
            default: return items;
        }
        return items.filter(i => { const d = new Date(i[dateField]); return d >= from && d <= to; });
    };

    const fEntries = useMemo(() => filterByDate(entries, 'date'), [entries, filterPreset, customDateFrom, customDateTo]);
    const fClients = useMemo(() => filterByDate(clients, 'created_at'), [clients, filterPreset, customDateFrom, customDateTo]);
    const fDeals = useMemo(() => filterByDate(deals, 'created_at'), [deals, filterPreset, customDateFrom, customDateTo]);
    const fProjects = useMemo(() => filterByDate(projects, 'created_at'), [projects, filterPreset, customDateFrom, customDateTo]);

    // KPIs
    const totalEntrada = fEntries.filter((e: any) => e.type === 'entrada').reduce((s: number, e: any) => s + Number(e.amount), 0);
    const totalDespesa = fEntries.filter((e: any) => e.type === 'despesa').reduce((s: number, e: any) => s + Number(e.amount), 0);
    const saldo = totalEntrada - totalDespesa;
    const totalDealsValue = fDeals.reduce((s: number, d: any) => s + Number(d.value || 0), 0);

    // Subtask stats from all deals
    const allSubtasks = deals.flatMap((d: any) => Array.isArray(d.subtasks) ? d.subtasks : []);
    const completedSubtasks = allSubtasks.filter((t: any) => t.status === 'concluida' || t.completed).length;
    const pendingSubtasks = allSubtasks.length - completedSubtasks;

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Chart: Financial evolution (last 6 months, always full data)
    const financeChartData = useMemo(() => {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const now = new Date();
        const result = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const m = d.getMonth(); const y = d.getFullYear();
            const me = entries.filter((e: any) => { const ed = new Date(e.date); return ed.getMonth() === m && ed.getFullYear() === y; });
            result.push({
                name: months[m],
                entradas: me.filter((e: any) => e.type === 'entrada').reduce((s: number, e: any) => s + Number(e.amount), 0),
                despesas: me.filter((e: any) => e.type === 'despesa').reduce((s: number, e: any) => s + Number(e.amount), 0)
            });
        }
        return result;
    }, [entries]);

    // Chart: Clients per month
    const clientsChartData = useMemo(() => {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const now = new Date();
        const result = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const m = d.getMonth(); const y = d.getFullYear();
            const count = clients.filter((c: any) => { const cd = new Date(c.created_at); return cd.getMonth() === m && cd.getFullYear() === y; }).length;
            result.push({ name: months[m], clientes: count });
        }
        return result;
    }, [clients]);

    // Pie: categories distribution (filtered entries)
    const categoryPieData = useMemo(() => {
        const catMap: Record<string, { name: string; value: number; color: string }> = {};
        fEntries.forEach((e: any) => {
            const catName = e.category?.name || 'Sem Categoria';
            const catColor = e.category?.color || '#64748b';
            if (!catMap[catName]) catMap[catName] = { name: catName, value: 0, color: catColor };
            catMap[catName].value += Number(e.amount);
        });
        return Object.values(catMap).sort((a, b) => b.value - a.value).slice(0, 6);
    }, [fEntries]);

    // Project stage distribution
    const stageNames: Record<number, string> = { 1: 'Entrada', 2: 'Validação', 3: 'Execução', 4: 'Implementação', 5: 'Monitoramento', 6: 'Ajustes' };
    const stageColors: Record<number, string> = { 1: '#6366f1', 2: '#f59e0b', 3: '#3b82f6', 4: '#8b5cf6', 5: '#10b981', 6: '#ec4899' };

    // Recent clients (latest 5)
    const recentClients = clients.slice(0, 5);

    const activeFilterLabel = FILTER_PRESETS.find(f => f.id === filterPreset)?.label || 'Todos';

    if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Carregando painel...</div>;

    return (
        <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Painel de Controle</h1>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0' }}>Visão geral do sistema — {activeFilterLabel}</p>
                </div>
            </div>

            {/* Date Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Filter size={14} /> Período:
                </div>
                {FILTER_PRESETS.map(preset => (
                    <button key={preset.id} onClick={() => setFilterPreset(preset.id)}
                        style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', border: filterPreset === preset.id ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: filterPreset === preset.id ? '#eff6ff' : '#fff', color: filterPreset === preset.id ? '#3b82f6' : '#64748b' }}
                    >{preset.label}</button>
                ))}
                {filterPreset === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                        <Calendar size={14} style={{ color: '#94a3b8' }} />
                        <input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 10px', fontSize: '0.8rem', color: '#1e293b', outline: 'none' }} />
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>até</span>
                        <input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 10px', fontSize: '0.8rem', color: '#1e293b', outline: 'none' }} />
                    </div>
                )}
            </div>

            {/* KPI Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
                {[
                    { label: 'Saldo', value: formatCurrency(saldo), color: saldo >= 0 ? '#10b981' : '#ef4444', bg: saldo >= 0 ? '#ecfdf5' : '#fef2f2', icon: <DollarSign size={18} /> },
                    { label: 'Entradas', value: formatCurrency(totalEntrada), color: '#10b981', bg: '#ecfdf5', icon: <ArrowUpRight size={18} /> },
                    { label: 'Despesas', value: formatCurrency(totalDespesa), color: '#ef4444', bg: '#fef2f2', icon: <ArrowDownRight size={18} /> },
                    { label: 'Clientes Novos', value: fClients.length.toString(), color: '#3b82f6', bg: '#eff6ff', icon: <Users size={18} /> },
                    { label: 'Oportunidades', value: fDeals.length.toString(), color: '#8b5cf6', bg: '#f5f3ff', icon: <Briefcase size={18} /> },
                    { label: 'Projetos', value: fProjects.length.toString(), color: '#f59e0b', bg: '#fffbeb', icon: <FileText size={18} /> },
                ].map((kpi, i) => (
                    <div key={i} style={{ background: kpi.bg, borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f050', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ color: kpi.color }}>{kpi.icon}</div>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</span>
                        </div>
                        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</span>
                    </div>
                ))}
            </div>

            {/* Charts Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                {/* Financial Evolution Chart */}
                <Card className="modern-card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Evolução Financeira</h3>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span> Entradas</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span> Despesas</div>
                        </div>
                    </div>
                    <div style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={financeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradEntrada" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                                    <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `R$${v / 1000}k`} />
                                <RechartsTooltip formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, '']} />
                                <Area type="monotone" dataKey="entradas" stroke="#10b981" strokeWidth={2.5} fill="url(#gradEntrada)" dot={{ r: 4, fill: '#10b981' }} />
                                <Area type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2.5} fill="url(#gradDespesa)" dot={{ r: 4, fill: '#ef4444' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Category Pie */}
                <Card className="modern-card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>Distribuição por Categoria</h3>
                    {categoryPieData.length === 0 ? (
                        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Sem dados no período</div>
                    ) : (
                        <>
                            <div style={{ height: '180px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                                            {categoryPieData.map((entry, idx) => <Cell key={idx} fill={entry.color || PIE_COLORS[idx % PIE_COLORS.length]} />)}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, '']} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                {categoryPieData.map((cat, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '3px', background: cat.color || PIE_COLORS[idx % PIE_COLORS.length] }}></span>
                                        {cat.name}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </Card>
            </div>

            {/* Charts Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* New Clients Chart */}
                <Card className="modern-card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>Novos Clientes</h3>
                    <div style={{ height: '160px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={clientsChartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                                <RechartsTooltip />
                                <Bar dataKey="clientes" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Task Stats */}
                <Card className="modern-card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Status de Tarefas</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}><CheckCircle2 size={20} /></div>
                            <div>
                                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{completedSubtasks}</span>
                                <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Concluídas</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}><Clock size={20} /></div>
                            <div>
                                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>{pendingSubtasks}</span>
                                <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Pendentes</p>
                            </div>
                        </div>
                        {allSubtasks.length > 0 && (
                            <div style={{ marginTop: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>Progresso Geral</span>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1e293b' }}>{Math.round((completedSubtasks / allSubtasks.length) * 100)}%</span>
                                </div>
                                <div style={{ height: '6px', borderRadius: '3px', background: '#f1f5f9' }}>
                                    <div style={{ width: `${(completedSubtasks / allSubtasks.length) * 100}%`, height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, #10b981, #3b82f6)', transition: 'width 0.5s' }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Project Stages */}
                <Card className="modern-card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>Projetos por Etapa</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[1, 2, 3, 4, 5, 6].map(stageId => {
                            const count = projects.filter((p: any) => p.stage_id === stageId).length;
                            const maxCount = Math.max(...[1, 2, 3, 4, 5, 6].map(s => projects.filter((p: any) => p.stage_id === s).length), 1);
                            return (
                                <div key={stageId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', width: '85px', flexShrink: 0 }}>{stageNames[stageId]}</span>
                                    <div style={{ flex: 1, height: '16px', borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden' }}>
                                        <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', borderRadius: '4px', background: stageColors[stageId], transition: 'width 0.3s', minWidth: count > 0 ? '18px' : '0' }}></div>
                                    </div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', width: '20px', textAlign: 'right' }}>{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {/* Bottom Row: Recent Clients + Deal Value */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Recent Clients */}
                <Card className="modern-card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>Clientes Recentes</h3>
                    {recentClients.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum cliente cadastrado.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {recentClients.map((client: any) => (
                                <div key={client.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 10px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
                                        {client.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{client.name}</span>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{client.phone || client.email || '-'}</div>
                                    </div>
                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{new Date(client.created_at).toLocaleDateString('pt-BR')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Deal Value Summary */}
                <Card className="modern-card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>Resumo de Vendas (CRM)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ background: '#f5f3ff', borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Valor Total (Deals)</span>
                                <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 800, color: '#8b5cf6' }}>{formatCurrency(totalDealsValue)}</span>
                            </div>
                            <TrendingUp size={28} style={{ color: '#8b5cf6' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#3b82f6' }}>{fDeals.length}</span>
                                <p style={{ fontSize: '0.6rem', color: '#94a3b8', margin: '2px 0 0', fontWeight: 600, textTransform: 'uppercase' }}>Oportunidades</p>
                            </div>
                            <div style={{ background: '#ecfdf5', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981' }}>{fDeals.length > 0 ? formatCurrency(totalDealsValue / fDeals.length) : 'R$ 0'}</span>
                                <p style={{ fontSize: '0.6rem', color: '#94a3b8', margin: '2px 0 0', fontWeight: 600, textTransform: 'uppercase' }}>Ticket Médio</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
