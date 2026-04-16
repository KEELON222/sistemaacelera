import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Project, ProjectStatus, PROJECT_STAGES, PRIORITY_TAGS } from '../types/operations';
import { Client } from '../types/crm';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, X, Search, Clock, User, AlignLeft, Calendar, Tag, AlertTriangle, CheckCircle2, PauseCircle, Info, BarChart3, ArrowLeft } from 'lucide-react';
import './Operations.css';

export function Operations() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [profiles, setProfiles] = useState<{ id: string, full_name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [clientDeals, setClientDeals] = useState<any[]>([]);

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [allDeals, setAllDeals] = useState<any[]>([]);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        client_id: '',
        description: '',
        stage_id: 1,
        status: 'nao_iniciado' as ProjectStatus,
        priority_tags: [] as string[],
        assigned_to: '',
        start_date: '',
        deadline: ''
    });

    useEffect(() => {
        fetchMetadata();
        fetchProjects().then(() => syncProjectStages());

        // Realtime subscription
        const channel = supabase.channel('operations-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                fetchProjects();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
                syncProjectStages();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchMetadata = async () => {
        try {
            const [clientsRes, profilesRes] = await Promise.all([
                supabase.from('clients').select('*').order('name'),
                supabase.from('profiles').select('id, full_name')
            ]);
            if (clientsRes.data) setClients(clientsRes.data);
            if (profilesRes.data) setProfiles(profilesRes.data);
        } catch (err) {
            console.error('Error fetching metadata:', err);
        }
    };

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('projects').select('*, client:clients(*)');
            if (error) throw error;
            setProjects(data as Project[] || []);
        } catch (err) {
            console.error('Error fetching projects:', err);
        } finally {
            setLoading(false);
        }
    };

    // =============== SYNC AUTOMATION ===============
    const syncProjectStages = async () => {
        try {
            // 1. Fetch all projects and all deals
            const [projectsRes, dealsRes] = await Promise.all([
                supabase.from('projects').select('id, client_id, stage_id'),
                supabase.from('deals').select('client_id, subtasks')
            ]);
            const allProjects = projectsRes.data || [];
            const allDeals = dealsRes.data || [];

            // 2. Build a map: client_id -> best calculated stage
            const clientStageMap: Record<string, number> = {};

            // Rule 2: If client has ANY deal -> at least stage 2
            for (const deal of allDeals) {
                if (!deal.client_id) continue;
                const current = clientStageMap[deal.client_id] || 1;
                if (current < 2) clientStageMap[deal.client_id] = 2;

                // Rules 4, 5, 6: based on subtask completion
                const subtasks = deal.subtasks as any[];
                if (subtasks && Array.isArray(subtasks) && subtasks.length > 0) {
                    const total = subtasks.length;
                    const completed = subtasks.filter((t: any) => t.status === 'concluida' || t.completed === true).length;
                    const percent = (completed / total) * 100;

                    let calcStage = 2;
                    if (percent >= 100) {
                        calcStage = 6;
                    } else if (percent >= 75) {
                        calcStage = 5;
                    } else if (completed > 0) {
                        calcStage = 4;
                    }

                    if (calcStage > (clientStageMap[deal.client_id] || 1)) {
                        clientStageMap[deal.client_id] = calcStage;
                    }
                }
            }

            // 3. Update projects that need stage changes
            const updates: any[] = [];
            for (const proj of allProjects) {
                const targetStage = clientStageMap[proj.client_id];
                if (targetStage && targetStage > proj.stage_id) {
                    updates.push(
                        supabase.from('projects').update({
                            stage_id: targetStage,
                            updated_at: new Date().toISOString()
                        }).eq('id', proj.id).then()
                    );
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates);
                await fetchProjects();
            }
        } catch (err) {
            console.error('Sync error:', err);
        }
    };

    // Drag & Drop
    const handleDragStart = (e: React.DragEvent, projectId: string) => {
        e.dataTransfer.setData('projectId', projectId);
    };

    const handleDrop = async (e: React.DragEvent, stageId: number) => {
        e.preventDefault();
        const projectId = e.dataTransfer.getData('projectId');
        if (!projectId) return;

        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, stage_id: stageId } : p));

        const { error } = await supabase.from('projects').update({ stage_id: stageId, updated_at: new Date().toISOString() }).eq('id', projectId);
        if (error) {
            console.error('Error updating project stage:', error);
            fetchProjects();
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    // Modal Logic
    const openModal = async (project?: Project) => {
        if (project) {
            setEditingProject(project);
            setFormData({
                title: project.title,
                client_id: project.client_id,
                description: project.description || '',
                stage_id: project.stage_id,
                status: project.status,
                priority_tags: project.priority_tags || [],
                assigned_to: project.assigned_to || '',
                start_date: project.start_date || '',
                deadline: project.deadline || ''
            });
            // Fetch deals for this client
            const { data } = await supabase.from('deals').select('*').eq('client_id', project.client_id);
            setClientDeals(data || []);
        } else {
            setEditingProject(null);
            setFormData({
                title: '',
                client_id: clients[0]?.id || '',
                description: '',
                stage_id: 3, // Regra Automática: Projetos manuais vão direto para Execução Operacional
                status: 'nao_iniciado',
                priority_tags: [],
                assigned_to: profiles[0]?.id || '',
                start_date: new Date().toISOString().split('T')[0],
                deadline: ''
            });
            setClientDeals([]);
        }
        setIsModalOpen(true);
    };

    const handleSaveProject = async () => {
        try {
            const dataToSave = {
                title: formData.title,
                client_id: formData.client_id,
                description: formData.description,
                stage_id: formData.stage_id,
                status: formData.status,
                priority_tags: formData.priority_tags,
                assigned_to: formData.assigned_to || null,
                start_date: formData.start_date || null,
                deadline: formData.deadline || null,
                updated_at: new Date().toISOString()
            };

            if (editingProject) {
                await supabase.from('projects').update(dataToSave).eq('id', editingProject.id);
            } else {
                await supabase.from('projects').insert([{ ...dataToSave, created_at: new Date().toISOString() }]);
            }

            setIsModalOpen(false);
            fetchProjects();
        } catch (error) {
            console.error('Error saving project:', error);
        }
    };

    const toggleTag = (tagId: string) => {
        setFormData(prev => {
            if (prev.priority_tags.includes(tagId)) {
                return { ...prev, priority_tags: prev.priority_tags.filter(t => t !== tagId) };
            }
            return { ...prev, priority_tags: [...prev.priority_tags, tagId] };
        });
    };

    const getStatusConfig = (status: ProjectStatus) => {
        switch (status) {
            case 'em_andamento': return { icon: <Clock size={12} />, color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Em Andamento' };
            case 'aguardando_cliente': return { icon: <PauseCircle size={12} />, color: 'text-orange-600 bg-orange-50 border-orange-200', label: 'Aguardando Cliente' };
            case 'bloqueado': return { icon: <AlertTriangle size={12} />, color: 'text-red-600 bg-red-50 border-red-200', label: 'Bloqueado' };
            case 'concluido': return { icon: <CheckCircle2 size={12} />, color: 'text-green-600 bg-green-50 border-green-200', label: 'Concluído' };
            default: return { icon: <Clock size={12} />, color: 'text-gray-500 bg-gray-50 border-gray-200', label: 'Não Iniciado' };
        }
    };

    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' };
    const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', outline: 'none', color: '#1e293b', background: '#fff' };

    if (loading && projects.length === 0) return <div className="p-8 text-center text-muted animate-pulse">Carregando Operações...</div>;

    return (
        <div className="operations-container flex flex-col h-full relative">
            <div className="operations-header flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-main">Gestão Operacional</h1>
                    <p className="text-muted text-sm mt-1">Acompanhe a jornada completa do projeto (Aceleraí Marketing & Vendas)</p>
                </div>
                <div className="flex gap-3">
                    <Button size="sm" className="flex items-center gap-2" variant="outline" onClick={async () => {
                        const { data } = await supabase.from('deals').select('*');
                        setAllDeals(data || []);
                        setShowReport(!showReport);
                    }}>
                        {showReport ? <><ArrowLeft size={16} /> Voltar</> : <><BarChart3 size={16} /> Relatório</>}
                    </Button>
                    <Button size="sm" className="flex items-center gap-2" variant="outline" onClick={() => setIsInfoModalOpen(true)} title="Como funciona a automação">
                        <Info size={16} className="text-blue-500" /> Regras
                    </Button>
                    <Button size="sm" className="flex items-center gap-2" variant="outline" onClick={async () => { await syncProjectStages(); await fetchProjects(); }}>
                        Atualizar
                    </Button>
                    <Button size="sm" className="flex items-center gap-2" onClick={() => openModal()}>
                        <Plus size={16} /> Nova Demanda
                    </Button>
                </div>
            </div>

            {/* Report Dashboard */}
            {showReport ? (() => {
                const totalProjects = projects.length;
                const stageData = PROJECT_STAGES.map(stage => {
                    const count = projects.filter(p => p.stage_id === stage.id).length;
                    const pct = totalProjects > 0 ? Math.round((count / totalProjects) * 100) : 0;
                    return { ...stage, count, pct };
                });
                const maxCount = Math.max(...stageData.map(s => s.count), 1);

                // Deal/subtask stats
                const totalDeals = allDeals.length;
                const totalSubtasks = allDeals.reduce((s: number, d: any) => s + (Array.isArray(d.subtasks) ? d.subtasks.length : 0), 0);
                const completedSubtasks = allDeals.reduce((s: number, d: any) => s + (Array.isArray(d.subtasks) ? d.subtasks.filter((t: any) => t.status === 'concluida' || t.completed).length : 0), 0);
                const globalPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
                        {/* KPI Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                            {[
                                { label: 'Total de Clientes', value: totalProjects, color: '#3b82f6', bg: '#eff6ff' },
                                { label: 'Oportunidades (CRM)', value: totalDeals, color: '#8b5cf6', bg: '#f5f3ff' },
                                { label: 'Tarefas Concluídas', value: `${completedSubtasks}/${totalSubtasks}`, color: '#10b981', bg: '#ecfdf5' },
                                { label: 'Conclusão Global', value: `${globalPercent}%`, color: globalPercent >= 75 ? '#10b981' : '#f59e0b', bg: globalPercent >= 75 ? '#ecfdf5' : '#fffbeb' }
                            ].map((kpi, i) => (
                                <div key={i} style={{ background: kpi.bg, border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</span>
                                    <span style={{ fontSize: '1.8rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Stage Distribution */}
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Distribuição por Etapa</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {stageData.map(stage => (
                                    <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '180px', flexShrink: 0 }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{stage.title}</span>
                                        </div>
                                        <div style={{ flex: 1, height: '28px', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                                            <div style={{ width: `${(stage.count / maxCount) * 100}%`, height: '100%', background: stage.color, borderRadius: '8px', transition: 'width 0.5s ease', minWidth: stage.count > 0 ? '30px' : '0' }}></div>
                                        </div>
                                        <div style={{ width: '80px', textAlign: 'right', flexShrink: 0 }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>{stage.count}</span>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '4px' }}>({stage.pct}%)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Client List Table */}
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Clientes por Etapa</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {PROJECT_STAGES.map(stage => {
                                    const stgProjects = projects.filter(p => p.stage_id === stage.id);
                                    if (stgProjects.length === 0) return null;
                                    return (
                                        <div key={stage.id}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
                                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: stage.color, flexShrink: 0 }}></div>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{stage.title}</span>
                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({stgProjects.length})</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingLeft: '18px', marginBottom: '8px' }}>
                                                {stgProjects.map(p => (
                                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }} onClick={() => { setShowReport(false); openModal(p); }}>
                                                        <User size={12} style={{ color: '#94a3b8' }} />
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b' }}>{p.client?.name || p.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })() : (
                <div className="kanban-board flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
                    {PROJECT_STAGES.map((stage) => {
                        const stageProjects = projects.filter(p => p.stage_id === stage.id);

                        return (
                            <div
                                key={stage.id}
                                className="kanban-column flex flex-col flex-shrink-0 w-[300px] bg-gray-50/80 rounded-xl border border-gray-200 p-2"
                            >
                                <div className="kanban-column-header mb-3 relative overflow-hidden bg-white px-3 py-2.5 rounded-lg shadow-sm">
                                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: stage.color }}></div>
                                    <div className="flex justify-between items-center w-full pl-2">
                                        <span className="font-bold text-sm text-main">{stage.title}</span>
                                        <span className="text-xs font-semibold bg-gray-100 text-muted px-2 py-0.5 rounded-full">
                                            {stageProjects.length}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-muted mt-1 pl-2 uppercase tracking-wide font-medium">
                                        {stage.description}
                                    </div>
                                </div>

                                <div className="kanban-column-content flex flex-col gap-2.5 flex-1 overflow-y-auto">
                                    {stageProjects.map(project => {
                                        const statusConfig = getStatusConfig(project.status);

                                        return (
                                            <Card
                                                key={project.id}
                                                onClick={() => openModal(project)}
                                                className={`kanban-card cursor-pointer modern-card border transition-all group ${project.status === 'bloqueado' ? 'border-red-300 shadow-sm shadow-red-100' : 'border-gray-200 hover:border-primary/40'
                                                    }`}
                                            >
                                                <CardContent className="p-3.5 flex flex-col gap-2.5">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusConfig.color}`}>
                                                            {statusConfig.icon} {statusConfig.label}
                                                        </span>
                                                        {project.priority_tags?.map(tagId => {
                                                            const tagDef = PRIORITY_TAGS.find(t => t.id === tagId);
                                                            return tagDef ? (
                                                                <span key={tagId} className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${tagDef.color}`}>
                                                                    {tagDef.label}
                                                                </span>
                                                            ) : null;
                                                        })}
                                                    </div>

                                                    <div className="font-bold text-[13px] text-main leading-tight group-hover:text-primary transition-colors">
                                                        {project.title}
                                                    </div>

                                                    <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
                                                        <User size={12} /> {project.client?.name || 'Cliente Sem Nome'}
                                                    </div>

                                                    <div className="flex justify-between items-center text-[10px] border-t border-gray-100 pt-2 mt-0.5">
                                                        <div className="flex items-center gap-1 text-muted">
                                                            <AlignLeft size={10} />
                                                            {project.description ? 'Com detalhes' : 'Sem detalhes'}
                                                        </div>
                                                        {project.deadline && (
                                                            <div className={`flex items-center gap-1 font-medium ${new Date(project.deadline) < new Date() && project.status !== 'concluido' ? 'text-red-500' : 'text-muted'}`}>
                                                                <Calendar size={10} />
                                                                {new Date(project.deadline).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal de Projeto Operacional */}
            {isModalOpen && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', padding: '1.5rem' }} onClick={() => setIsModalOpen(false)}>
                    <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', margin: 0 }}>
                                <AlignLeft size={20} style={{ color: '#3b82f6' }} />
                                {editingProject ? 'Detalhes da Demanda' : 'Nova Demanda Operacional'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

                            {/* Client Journey Status */}
                            {editingProject && (() => {
                                const currentStage = PROJECT_STAGES.find(s => s.id === formData.stage_id);
                                const totalSubtasks = clientDeals.reduce((sum: number, d: any) => sum + (Array.isArray(d.subtasks) ? d.subtasks.length : 0), 0);
                                const completedSubtasks = clientDeals.reduce((sum: number, d: any) => sum + (Array.isArray(d.subtasks) ? d.subtasks.filter((t: any) => t.status === 'concluida' || t.completed).length : 0), 0);
                                const percent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

                                return (
                                    <div style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #eff6ff 100%)', border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '16px' }}>
                                        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Jornada do Cliente</p>
                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: '140px', background: '#fff', borderRadius: '10px', padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '0 0 4px', fontWeight: 600 }}>Etapa Atual</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 800, color: currentStage?.color || '#1e293b', margin: 0 }}>{currentStage?.title || '-'}</p>
                                            </div>
                                            <div style={{ flex: 1, minWidth: '120px', background: '#fff', borderRadius: '10px', padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '0 0 4px', fontWeight: 600 }}>Oportunidades (CRM)</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 800, color: clientDeals.length > 0 ? '#10b981' : '#ef4444', margin: 0 }}>{clientDeals.length > 0 ? `${clientDeals.length} vinculada(s)` : 'Nenhuma'}</p>
                                            </div>
                                            <div style={{ flex: 1, minWidth: '150px', background: '#fff', borderRadius: '10px', padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '0 0 4px', fontWeight: 600 }}>Tarefas Concluídas</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <p style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{completedSubtasks}/{totalSubtasks}</p>
                                                    <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#e2e8f0' }}>
                                                        <div style={{ width: `${percent}%`, height: '100%', borderRadius: '3px', background: percent >= 100 ? '#10b981' : percent >= 75 ? '#3b82f6' : '#f59e0b', transition: 'width 0.3s' }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>{percent}%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {clientDeals.length > 0 && (
                                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', margin: '0', textTransform: 'uppercase' }}>Deals vinculadas ao cliente:</p>
                                                {clientDeals.map((deal: any) => {
                                                    const dt = Array.isArray(deal.subtasks) ? deal.subtasks.length : 0;
                                                    const dc = Array.isArray(deal.subtasks) ? deal.subtasks.filter((t: any) => t.status === 'concluida' || t.completed).length : 0;
                                                    return (
                                                        <div key={deal.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', borderRadius: '8px', padding: '8px 12px', border: '1px solid #f1f5f9' }}>
                                                            <CheckCircle2 size={14} style={{ color: dc === dt && dt > 0 ? '#10b981' : '#94a3b8', flexShrink: 0 }} />
                                                            <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{deal.title}</span>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>{dc}/{dt} tarefas</span>
                                                            {deal.value > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>R$ {Number(deal.value).toLocaleString('pt-BR')}</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Form Fields */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={labelStyle}>Título da Demanda / Projeto</label>
                                    <input type="text" style={inputStyle} placeholder="Ex: Lançamento de Campanha..." value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Cliente Relacionado</label>
                                    <select style={inputStyle} value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}>
                                        <option value="" disabled>Selecione um cliente...</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Etapa Atual do Fluxo</label>
                                    <select style={{ ...inputStyle, color: '#3b82f6', fontWeight: 600 }} value={formData.stage_id} onChange={(e) => setFormData({ ...formData, stage_id: parseInt(e.target.value) })}>
                                        {PROJECT_STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.title}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Status Operacional</label>
                                    <select style={inputStyle} value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}>
                                        <option value="nao_iniciado">Não Iniciado</option>
                                        <option value="em_andamento">Em Andamento</option>
                                        <option value="aguardando_cliente">Aguardando Cliente</option>
                                        <option value="concluido">Concluído</option>
                                        <option value="bloqueado">Bloqueado (Impedimento)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Responsável Interno</label>
                                    <select style={inputStyle} value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}>
                                        <option value="">Sem responsável</option>
                                        {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Data de Início</label>
                                    <input type="date" style={inputStyle} value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Prazo / Deadline</label>
                                    <input type="date" style={inputStyle} value={formData.deadline} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={labelStyle}>Escopo e Notas</label>
                                    <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} placeholder="Detalhe o que precisa ser feito..." rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}></textarea>
                                </div>
                            </div>

                            {/* Tags */}
                            <div>
                                <label style={labelStyle}>Tags e Alertas</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {PRIORITY_TAGS.map(tag => {
                                        const isSelected = formData.priority_tags.includes(tag.id);
                                        return (
                                            <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                                                style={{ fontSize: '0.75rem', fontWeight: 700, padding: '6px 14px', borderRadius: '8px', border: isSelected ? '2px solid' : '1px solid #d1d5db', background: isSelected ? '#f0f9ff' : '#fff', color: isSelected ? '#2563eb' : '#6b7280', cursor: 'pointer', transition: 'all 0.15s' }}>
                                                {tag.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSaveProject}>Salvar Operação</Button>
                        </div>
                    </div>
                </div>
                , document.body)}

            {/* Modal de Informação sobre Automação */}
            {isInfoModalOpen && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', padding: '1.5rem' }} onClick={() => setIsInfoModalOpen(false)}>
                    <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', color: '#1d4ed8', margin: 0 }}>
                                <Info size={22} />
                                Como funciona a Automação
                            </h2>
                            <button onClick={() => setIsInfoModalOpen(false)} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px', lineHeight: 1.6, marginTop: 0 }}>
                                O quadro operacional movimenta o card do cliente <strong>automaticamente</strong> conforme as ações realizadas no sistema:
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {[
                                    { n: '1', t: 'Entrada', d: 'Quando um novo cliente é cadastrado no sistema.', bg: '#eef2ff', c: '#4338ca' },
                                    { n: '2', t: 'Validação Estratégica', d: 'Quando o cliente é vinculado a uma Oportunidade no CRM.', bg: '#fef3c7', c: '#d97706' },
                                    { n: '3', t: 'Execução Operacional', d: 'Quando o cliente é vinculado a um Projeto Operacional.', bg: '#dbeafe', c: '#2563eb' },
                                    { n: '4', t: 'Implementação', d: 'Quando o projeto tem as primeiras subtarefas concluídas.', bg: '#ede9fe', c: '#7c3aed' },
                                    { n: '5', t: 'Monitoramento', d: 'Quando o projeto atinge 75% das tarefas concluídas.', bg: '#d1fae5', c: '#059669' },
                                    { n: '6', t: 'Ajustes / Upgrade', d: 'Quando o projeto atinge 100% das tarefas concluídas.', bg: '#fce7f3', c: '#db2777' }
                                ].map(item => (
                                    <div key={item.n} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', background: item.bg }}>
                                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: item.c, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>
                                            {item.n}
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', margin: 0 }}>{item.t}</p>
                                            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '2px 0 0' }}>{item.d}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '16px', padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', textAlign: 'center', fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 600 }}>
                                💡 Cards movidos manualmente desativam a automação para aquele projeto.
                            </div>
                        </div>
                    </div>
                </div>
                , document.body)}
        </div>
    );
}
