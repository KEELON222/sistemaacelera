import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Deal, DealStatus, Board, BoardStage, Client, Subtask, SubtaskStatus, CrmTag, BoardCustomTemplate } from '../types/crm';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, X, Clock, User, AlignLeft, CheckSquare, Calendar, Tag, ArrowLeft, Trash2, Lock, CheckCircle2, Upload, Download, FileText, Maximize2, Archive, Edit2 } from 'lucide-react';
import { DatePicker } from '../components/ui/DatePicker';
import './CRM.css';

const BOARD_TEMPLATES = [
    {
        name: 'Onboarding de Cliente',
        description: 'Processo de integração de novos clientes',
        icon: '🚀',
        stages: [
            { id: 't1', title: 'Briefing', color: '#F59E0B' },
            { id: 't2', title: 'Setup', color: '#3B82F6' },
            { id: 't3', title: 'Revisão', color: '#8B5CF6' },
            { id: 't4', title: 'Entrega', color: '#10B981' }
        ]
    },
    {
        name: 'Campanha de Marketing',
        description: 'Gestão de campanhas do início ao fim',
        icon: '📢',
        stages: [
            { id: 't1', title: 'Planejamento', color: '#F59E0B' },
            { id: 't2', title: 'Criação', color: '#3B82F6' },
            { id: 't3', title: 'Aprovação', color: '#8B5CF6' },
            { id: 't4', title: 'Publicação', color: '#10B981' }
        ]
    },
    {
        name: 'Desenvolvimento de Produto',
        description: 'Fluxo ágil de desenvolvimento',
        icon: '⚙️',
        stages: [
            { id: 't1', title: 'Backlog', color: '#94A3B8' },
            { id: 't2', title: 'Em Progresso', color: '#3B82F6' },
            { id: 't3', title: 'Revisão', color: '#F59E0B' },
            { id: 't4', title: 'Testes', color: '#8B5CF6' }
        ]
    },
    {
        name: 'Processo Comercial',
        description: 'Pipeline de vendas completo',
        icon: '💼',
        stages: [
            { id: 't1', title: 'Prospecção', color: '#F59E0B' },
            { id: 't2', title: 'Qualificação', color: '#3B82F6' },
            { id: 't3', title: 'Proposta', color: '#8B5CF6' },
            { id: 't4', title: 'Negociação', color: '#EF4444' }
        ]
    }
];

export function CRM() {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [boards, setBoards] = useState<Board[]>([]);
    const [stages, setStages] = useState<BoardStage[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [profiles, setProfiles] = useState<{ id: string, full_name: string }[]>([]);
    const [globalTags, setGlobalTags] = useState<CrmTag[]>([]);
    const [customTemplates, setCustomTemplates] = useState<BoardCustomTemplate[]>([]);

    const [loading, setLoading] = useState(true);
    const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
    const [allDeals, setAllDeals] = useState<Deal[]>([]);

    const [showArchivedBoards, setShowArchivedBoards] = useState(false);
    const [showArchivedDeals, setShowArchivedDeals] = useState(false);

    // Deal Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
    const [formData, setFormData] = useState({
        title: '', client_id: '', value: 0, expected_close_date: '',
        assigned_to: '', description: '', subtasks: [] as Subtask[],
        stage_id: '', status: 'contato' as DealStatus,
        files: [] as { name: string; url: string; size: number }[],
        priority_tags: [] as string[], niche_tags: [] as string[]
    });
    const [newSubtask, setNewSubtask] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Tags Modal
    const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<Partial<CrmTag> | null>(null);

    // Subtask Modal
    const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null);
    const [subtaskUploading, setSubtaskUploading] = useState(false);
    const subtaskFileInputRef = React.useRef<HTMLInputElement>(null);

    // Board Creation & Editing
    const [isBoardModalOpen, setIsBoardModalOpen] = useState(false);
    const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
    const [boardCreationMode, setBoardCreationMode] = useState<'choose' | 'custom' | 'template' | 'create_template'>('choose');
    const [newTemplateData, setNewTemplateData] = useState<Partial<BoardCustomTemplate>>({
        name: '', description: '', icon: '📋', stages: [
            { id: '1', title: 'Contato Inicial', color: '#F59E0B' },
            { id: '2', title: 'Negociação', color: '#2563EB' }
        ],
        tags: []
    });
    const [newBoardData, setNewBoardData] = useState({
        title: '',
        client_id: '',
        stages: [
            { id: '1', title: 'Contato Inicial', color: '#F59E0B' },
            { id: '2', title: 'Negociação', color: '#2563EB' },
            { id: '3', title: 'Ganhou', color: '#10B981' },
            { id: '4', title: 'Perdeu', color: '#EF4444' }
        ],
        tags: [] as { id?: string; name: string; color: string; type: 'priority' | 'niche' }[]
    });

    useEffect(() => { fetchMetadata(); }, []);
    useEffect(() => { if (!loading && activeBoardId) fetchDeals(); }, [activeBoardId]);

    // Realtime subscriptions
    useEffect(() => {
        const channel = supabase.channel('crm-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
                if (activeBoardId) fetchDeals();
                fetchMetadata();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, () => { fetchMetadata(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'board_stages' }, () => { fetchMetadata(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_tags' }, () => { fetchMetadata(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [activeBoardId]);

    const fetchMetadata = async () => {
        try {
            setLoading(true);
            const [clientsRes, profilesRes, boardsRes, tagsRes, templatesRes] = await Promise.all([
                supabase.from('clients').select('*').order('name'),
                supabase.from('profiles').select('id, full_name'),
                supabase.from('boards').select('*, client:clients(name)').order('created_at'),
                supabase.from('crm_tags').select('*').order('name'),
                supabase.from('board_custom_templates').select('*').order('created_at')
            ]);
            if (clientsRes.data) setClients(clientsRes.data);
            if (profilesRes.data) setProfiles(profilesRes.data);
            if (tagsRes.data) setGlobalTags(tagsRes.data as CrmTag[]);
            if (templatesRes.data) setCustomTemplates(templatesRes.data as BoardCustomTemplate[]);
            if (boardsRes.data) {
                setBoards(boardsRes.data);
                const [stagesRes, dealsRes] = await Promise.all([
                    supabase.from('board_stages').select('*').order('position_order'),
                    supabase.from('deals').select('id, board_id, stage_id, value')
                ]);
                if (stagesRes.data) setStages(stagesRes.data);
                if (dealsRes.data) setAllDeals(dealsRes.data as Deal[]);
            }
        } catch (err) {
            console.error('Error fetching CRM metadata:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDeals = async () => {
        if (!activeBoardId) return;
        try {
            const { data, error } = await supabase.from('deals').select('*, client:clients(*)').eq('board_id', activeBoardId);
            if (error) throw error;
            setDeals(data as Deal[] || []);
        } catch (err) { console.error('Error fetching deals:', err); }
    };

    // Drag & Drop
    const handleDragStart = (e: React.DragEvent, dealId: string) => { e.dataTransfer.setData('dealId', dealId); };
    const handleDrop = async (e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        const dealId = e.dataTransfer.getData('dealId');
        if (!dealId) return;
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_id: stageId } : d));
        const { error } = await supabase.from('deals').update({ stage_id: stageId, updated_at: new Date().toISOString() }).eq('id', dealId);
        if (error) { console.error('Drop error:', error); fetchDeals(); }
    };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

    // Deal Modal
    const openDealModal = (deal?: Deal) => {
        const boardStages = stages.filter(s => s.board_id === activeBoardId);
        if (deal) {
            setEditingDeal(deal);
            setFormData({
                title: deal.title, client_id: deal.client_id, value: deal.value,
                expected_close_date: deal.expected_close_date || '', assigned_to: deal.assigned_to || '',
                description: deal.description || '', subtasks: deal.subtasks || [],
                stage_id: deal.stage_id || boardStages[0]?.id || '', status: deal.status,
                files: (deal as any).files || [],
                priority_tags: deal.priority_tags || [], niche_tags: deal.niche_tags || []
            });
        } else {
            setEditingDeal(null);
            setFormData({
                title: '', client_id: clients[0]?.id || '', value: 0,
                expected_close_date: '', assigned_to: profiles[0]?.id || '',
                description: '', subtasks: [],
                stage_id: boardStages[0]?.id || '', status: 'contato',
                files: [], priority_tags: [], niche_tags: []
            });
        }
        setIsModalOpen(true);
    };

    const handleSaveDeal = async () => {
        try {
            const dataToSave: any = {
                title: formData.title, client_id: formData.client_id, value: formData.value,
                expected_close_date: formData.expected_close_date || null,
                assigned_to: formData.assigned_to || null, description: formData.description,
                subtasks: formData.subtasks, board_id: activeBoardId,
                stage_id: formData.stage_id, files: formData.files,
                priority_tags: formData.priority_tags, niche_tags: formData.niche_tags,
                updated_at: new Date().toISOString()
            };
            if (editingDeal) {
                await supabase.from('deals').update(dataToSave).eq('id', editingDeal.id);
            } else {
                await supabase.from('deals').insert([{ ...dataToSave, created_at: new Date().toISOString() }]);
            }
            setIsModalOpen(false);
            fetchDeals();
        } catch (error) { console.error('Error saving deal:', error); }
    };

    const sanitizeFileName = (name: string) => {
        return name
            .normalize('NFD') // Decompose accented characters
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^\w.-]/g, '_') // Replace non-alphanumeric (except . and -) with _
            .replace(/_{2,}/g, '_'); // Replace multiple underscores with one
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setUploading(true);
            const sanitizedName = sanitizeFileName(file.name);
            const filePath = `deals/${Date.now()}_${sanitizedName}`;
            const { error: uploadError } = await supabase.storage.from('deal-files').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('deal-files').getPublicUrl(filePath);
            setFormData(prev => ({
                ...prev,
                files: [...prev.files, { name: file.name, url: urlData.publicUrl, size: file.size }]
            }));
        } catch (error) {
            console.error('Upload error:', error);
            alert('Erro ao enviar arquivo. Verifique se o bucket "deal-files" existe no Supabase Storage.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeFile = (url: string) => {
        setFormData(prev => ({ ...prev, files: prev.files.filter(f => f.url !== url) }));
    };

    const downloadFile = async (url: string, fileName: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Download error:', err);
            window.open(url, '_blank');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    const addSubtask = () => {
        if (!newSubtask.trim()) return;
        setFormData({ ...formData, subtasks: [...formData.subtasks, { id: Date.now().toString(), title: newSubtask, completed: false, status: 'pendente' as SubtaskStatus, due_date: '', assigned_to: '' }] });
        setNewSubtask('');
    };
    const toggleSubtask = (id: string) => {
        setFormData({ ...formData, subtasks: formData.subtasks.map(t => t.id === id ? { ...t, completed: !t.completed, status: (!t.completed ? 'concluida' : 'pendente') as SubtaskStatus } : t) });
    };
    const deleteSubtask = (id: string) => {
        setFormData({ ...formData, subtasks: formData.subtasks.filter(t => t.id !== id) });
    };
    const updateSubtaskField = (id: string, field: string, value: any) => {
        setFormData({ ...formData, subtasks: formData.subtasks.map(t => t.id === id ? { ...t, [field]: value } : t) });
    };

    // Board Creation & Editing — always appends mandatory "Concluído" as the last stage
    const handleSaveBoard = async () => {
        if (!newBoardData.title.trim() || newBoardData.stages.length === 0) return;
        try {
            let boardId = editingBoardId;
            const payload: any = { title: newBoardData.title, client_id: newBoardData.client_id || null };

            if (editingBoardId) {
                const { error: boardUpdateError } = await supabase.from('boards').update(payload).eq('id', editingBoardId);
                if (boardUpdateError) throw boardUpdateError;

                // Sync stages
                const currentStages = stages.filter(s => s.board_id === editingBoardId);
                const mandatoryConcluido = currentStages.find(s => s.title === 'Concluído');
                
                // Stages to keep/update (those that have a UUID)
                const stagesToSync = newBoardData.stages.map((st, index) => ({
                    id: st.id.length > 10 ? st.id : undefined, // Check if it's a UUID
                    title: st.title,
                    color: st.color,
                    position_order: index + 1,
                    board_id: editingBoardId
                }));

                // Identify stages to delete
                const idsToKeep = stagesToSync.map(s => s.id).filter(Boolean);
                if (mandatoryConcluido) idsToKeep.push(mandatoryConcluido.id);
                
                const stagesToDelete = currentStages.filter(s => !idsToKeep.includes(s.id) && s.title !== 'Concluído');

                // Check if stages to delete have deals
                for (const stage of stagesToDelete) {
                    const hasDeals = allDeals.some(d => d.stage_id === stage.id);
                    if (hasDeals) {
                        alert(`A etapa "${stage.title}" contém negócios e não pode ser excluída. Mova os negócios antes de remover a etapa.`);
                        return;
                    }
                }

                // Execute deletions
                if (stagesToDelete.length > 0) {
                    await supabase.from('board_stages').delete().in('id', stagesToDelete.map(s => s.id));
                }

                // Upsert remaining stages
                for (const st of stagesToSync) {
                    if (st.id) {
                        await supabase.from('board_stages').update({ title: st.title, color: st.color, position_order: st.position_order }).eq('id', st.id);
                    } else {
                        await supabase.from('board_stages').insert([{ board_id: editingBoardId, title: st.title, color: st.color, position_order: st.position_order }]);
                    }
                }

                // Update mandatory "Concluído" position
                if (mandatoryConcluido) {
                    await supabase.from('board_stages').update({ position_order: stagesToSync.length + 1 }).eq('id', mandatoryConcluido.id);
                }

            } else {
                const { data: boardData, error: boardError } = await supabase.from('boards').insert([payload]).select().single();
                if (boardError || !boardData) throw boardError;
                boardId = boardData.id;

                // Build stages: user stages + mandatory "Concluído" at the end
                const userStages = newBoardData.stages.map((st, index) => ({
                    board_id: boardId, title: st.title, color: st.color, position_order: index + 1
                }));
                const concludedStage = {
                    board_id: boardId, title: 'Concluído', color: '#10B981', position_order: userStages.length + 1
                };
                const allStages = [...userStages, concludedStage];

                const { error: stagesError } = await supabase.from('board_stages').insert(allStages);
                if (stagesError) throw stagesError;

                if (newBoardData.tags && newBoardData.tags.length > 0) {
                    for (const tag of newBoardData.tags) {
                        const exists = globalTags.find(t => t.name.toLowerCase() === tag.name.toLowerCase() && t.type === tag.type);
                        if (!exists) {
                            await supabase.from('crm_tags').insert([{ name: tag.name, color: tag.color, type: tag.type }]);
                        }
                    }
                }
            }

            setIsBoardModalOpen(false);
            setEditingBoardId(null);
            setBoardCreationMode('choose');
            setNewBoardData({
                title: '', client_id: '', tags: [], stages: [
                    { id: '1', title: 'Contato Inicial', color: '#F59E0B' },
                    { id: '2', title: 'Negociação', color: '#2563EB' },
                    { id: '3', title: 'Ganhou', color: '#10B981' },
                    { id: '4', title: 'Perdeu', color: '#EF4444' }
                ]
            });
            fetchMetadata();
        } catch (error) { console.error('Error saving board:', error); }
    };

    const openEditBoardModal = (board: Board) => {
        const boardStages = stages.filter(s => s.board_id === board.id && s.title !== 'Concluído');
        setEditingBoardId(board.id);
        setNewBoardData({
            title: board.title,
            client_id: board.client_id || '',
            tags: [],
            stages: boardStages.map(s => ({ id: s.id, title: s.title, color: s.color }))
        });
        setBoardCreationMode('custom');
        setIsBoardModalOpen(true);
    };

    const selectTemplate = (template: { name?: string, title?: string, stages: {title: string, color: string}[], tags?: {name: string, color: string, type: 'priority'|'niche'}[] }) => {
        setNewBoardData({
            ...newBoardData,
            title: template.name || template.title || '',
            stages: template.stages.map((s, i) => ({ id: String(i + 1), title: s.title, color: s.color })),
            tags: template.tags || []
        });
        setBoardCreationMode('custom');
    };

    const openBoardModal = () => {
        setEditingBoardId(null);
        setBoardCreationMode('choose');
        setNewBoardData({
            title: '', client_id: '', tags: [], stages: [
                { id: '1', title: 'Contato Inicial', color: '#F59E0B' },
                { id: '2', title: 'Negociação', color: '#2563EB' },
                { id: '3', title: 'Ganhou', color: '#10B981' },
                { id: '4', title: 'Perdeu', color: '#EF4444' }
            ]
        });
        setIsBoardModalOpen(true);
    };

    const addBoardStage = () => {
        setNewBoardData({ ...newBoardData, stages: [...newBoardData.stages, { id: Date.now().toString(), title: '', color: '#94A3B8' }] });
    };
    const removeBoardStage = (id: string) => {
        setNewBoardData({ ...newBoardData, stages: newBoardData.stages.filter(s => s.id !== id) });
    };
    const updateBoardStage = (id: string, field: 'title' | 'color', value: string) => {
        setNewBoardData({ ...newBoardData, stages: newBoardData.stages.map(s => s.id === id ? { ...s, [field]: value } : s) });
    };

    const handleDeleteBoard = async (e: React.MouseEvent, boardId: string, boardTitle: string, dealsCount: number) => {
        e.stopPropagation();
        if (dealsCount > 0) {
            if (!window.confirm(`Este quadro possui ${dealsCount} negócio(s). Tem certeza que deseja excluí-lo e TODOS os seus negócios? Esta ação não pode ser desfeita.`)) {
                return;
            }
        } else {
            if (!window.confirm(`Tem certeza que deseja excluir o quadro "${boardTitle}"? Esta ação removerá todas as etapas e não pode ser desfeita.`)) {
                return;
            }
        }

        try {
            if (dealsCount > 0) {
                await supabase.from('deals').delete().eq('board_id', boardId);
            }
            await supabase.from('board_stages').delete().eq('board_id', boardId);
            const { error } = await supabase.from('boards').delete().eq('id', boardId);
            if (error) throw error;
            fetchMetadata();
            if (activeBoardId === boardId) {
                setActiveBoardId(null);
                setDeals([]);
            }
        } catch (err) {
            console.error('Erro ao excluir quadro:', err);
            alert('Ocorreu um erro ao excluir o quadro.');
        }
    };

    const handleArchiveBoard = async (e: React.MouseEvent, board: Board) => {
        e.stopPropagation();
        const action = board.archived ? 'desarquivar' : 'arquivar';
        if (window.confirm(`Tem certeza que deseja ${action} o quadro "${board.title}"?`)) {
            try {
                await supabase.from('boards').update({ archived: !board.archived }).eq('id', board.id);
                fetchMetadata();
                if (activeBoardId === board.id && !board.archived) {
                    setActiveBoardId(null);
                    setDeals([]);
                }
            } catch (err) {
                console.error(`Erro ao ${action} quadro:`, err);
                alert(`Ocorreu um erro ao ${action} o quadro.`);
            }
        }
    };

    const handleArchiveDeal = async (deal: Deal) => {
        const action = deal.archived ? 'desarquivar' : 'arquivar';
        if (window.confirm(`Tem certeza que deseja ${action} a oportunidade "${deal.title}"?`)) {
            try {
                await supabase.from('deals').update({ archived: !deal.archived, updated_at: new Date().toISOString() }).eq('id', deal.id);
                fetchDeals();
                if (editingDeal && editingDeal.id === deal.id) {
                    setIsModalOpen(false);
                }
            } catch (err) {
                console.error(`Erro ao ${action} oportunidade:`, err);
                alert(`Ocorreu um erro ao ${action} a oportunidade.`);
            }
        }
    };

    const handleSaveCustomTemplate = async () => {
        if (!newTemplateData.name?.trim() || (newTemplateData.stages || []).length === 0) {
            alert('Por favor, defina um nome e ao menos uma etapa para o modelo.');
            return;
        }
        try {
            const payload = {
                name: newTemplateData.name,
                description: newTemplateData.description || '',
                icon: newTemplateData.icon || '📋',
                stages: newTemplateData.stages
            };
            if (newTemplateData.id) {
                await supabase.from('board_custom_templates').update(payload).eq('id', newTemplateData.id);
            } else {
                await supabase.from('board_custom_templates').insert([payload]);
            }
            fetchMetadata();
            setBoardCreationMode('template');
        } catch (error) {
            console.error('Erro ao salvar template:', error);
            alert('Falha ao salvar modelo personalizado.');
        }
    };

    const handleDeleteCustomTemplate = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm('Tem certeza que deseja excluir este modelo personalizado?')) return;
        try {
            await supabase.from('board_custom_templates').delete().eq('id', id);
            fetchMetadata();
        } catch (error) {
            console.error('Erro ao deletar modelo:', error);
            alert('Falha ao excluir modelo.');
        }
    };

    const addTemplateStage = () => {
        setNewTemplateData({ ...newTemplateData, stages: [...(newTemplateData.stages || []), { id: Date.now().toString(), title: '', color: '#94A3B8' }] });
    };
    const removeTemplateStage = (id: string) => {
        setNewTemplateData({ ...newTemplateData, stages: (newTemplateData.stages || []).filter(s => s.id !== id) });
    };
    const updateTemplateStage = (id: string, field: 'title' | 'color', value: string) => {
        setNewTemplateData({ ...newTemplateData, stages: (newTemplateData.stages || []).map(s => s.id === id ? { ...s, [field]: value } : s) });
    };

    const addTemplateTag = (type: 'priority' | 'niche') => {
        setNewTemplateData({ ...newTemplateData, tags: [...(newTemplateData.tags || []), { id: Date.now().toString(), name: '', color: type === 'priority' ? '#EF4444' : '#3B82F6', type }] });
    };
    const removeTemplateTag = (id: string) => {
        setNewTemplateData({ ...newTemplateData, tags: (newTemplateData.tags || []).filter(t => t.id !== id) });
    };
    const updateTemplateTag = (id: string, field: 'name' | 'color', value: string) => {
        setNewTemplateData({ ...newTemplateData, tags: (newTemplateData.tags || []).map(t => t.id === id ? { ...t, [field]: value } : t) });
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Carregando CRM...</div>;

    // ============================================================
    // VIEW: LIST OF FUNNELS (no board selected)
    // ============================================================
    if (!activeBoardId) {
        const visibleBoards = boards.filter(b => showArchivedBoards ? b.archived : !b.archived);
        return (
            <div className="crm-container">
                <div className="crm-list-header">
                    <div>
                        <h1 className="crm-page-title">Quadro de Projetos</h1>
                        <p className="crm-page-subtitle">Selecione um quadro para gerenciar suas oportunidades</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button size="sm" variant={showArchivedBoards ? 'primary' : 'outline'} onClick={() => setShowArchivedBoards(!showArchivedBoards)}>
                            <Archive size={16} /> {showArchivedBoards ? 'Ocultar Arquivados' : 'Arquivados'}
                        </Button>
                        <Button size="sm" onClick={openBoardModal}>
                            <Plus size={16} /> Novo Quadro
                        </Button>
                    </div>
                </div>

                <div className="funnel-grid">
                    {visibleBoards.length === 0 ? (
                        <div className="funnel-empty">
                            <div className="funnel-empty-icon"><Tag size={32} /></div>
                            <h3>Nenhum Quadro Encontrado</h3>
                            <p>Crie o seu primeiro Quadro de Projetos para começar a organizar oportunidades.</p>
                            <Button onClick={openBoardModal}>
                                <Plus size={16} /> Criar Primeiro Quadro
                            </Button>
                        </div>
                    ) : (
                        visibleBoards.map(board => {
                            const boardStages = stages.filter(s => s.board_id === board.id);
                            const boardDeals = allDeals.filter(d => d.board_id === board.id);
                            const concludedStage = boardStages.find(s => s.title === 'Concluído');
                            const concludedDeals = concludedStage ? boardDeals.filter(d => d.stage_id === concludedStage.id).length : 0;
                            const totalValue = boardDeals.reduce((a, d) => a + (Number(d.value) || 0), 0);
                            return (
                                <div key={board.id} className="funnel-card" onClick={() => setActiveBoardId(board.id)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div className="funnel-card-colors">
                                            {boardStages.map(st => (
                                                <div key={st.id} className="funnel-color-dot" style={{ background: st.color }} title={st.title}></div>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openEditBoardModal(board); }}
                                                style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                                                title="Editar Quadro"
                                                className="hover-opacity"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => handleArchiveBoard(e, board)}
                                                style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                                                title={board.archived ? "Desarquivar Quadro" : "Arquivar Quadro"}
                                                className="hover-opacity"
                                            >
                                                <Archive size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteBoard(e, board.id, board.title, boardDeals.length)}
                                                style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                                                title="Excluir Quadro"
                                                className="hover-opacity"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <h3 className="funnel-card-title" style={{ marginTop: '0.5rem' }}>{board.title}</h3>
                                    {board.client && (
                                        <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <User size={11} /> {board.client.name}
                                        </p>
                                    )}
                                    <p className="funnel-card-info">{boardStages.length} etapas</p>

                                    {/* Mini Relatório */}
                                    <div className="funnel-stats">
                                        <div className="funnel-stat">
                                            <span className="funnel-stat-value">{boardDeals.length}</span>
                                            <span className="funnel-stat-label">Negócios</span>
                                        </div>
                                        <div className="funnel-stat-divider"></div>
                                        <div className="funnel-stat">
                                            <span className="funnel-stat-value funnel-stat-green">{concludedDeals}</span>
                                            <span className="funnel-stat-label">Concluídos</span>
                                        </div>
                                        <div className="funnel-stat-divider"></div>
                                        <div className="funnel-stat">
                                            <span className="funnel-stat-value">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(totalValue)}</span>
                                            <span className="funnel-stat-label">Pipeline</span>
                                        </div>
                                    </div>

                                    {boardDeals.length > 0 && (
                                        <div className="funnel-progress-wrap">
                                            <div className="funnel-progress-bar">
                                                <div className="funnel-progress-fill" style={{ width: boardDeals.length > 0 ? `${(concludedDeals / boardDeals.length) * 100}%` : '0%' }}></div>
                                            </div>
                                            <span className="funnel-progress-text">{boardDeals.length > 0 ? Math.round((concludedDeals / boardDeals.length) * 100) : 0}% concluído</span>
                                        </div>
                                    )}

                                    <div className="funnel-card-stages">
                                        {boardStages.map(st => (
                                            <span key={st.id} className="funnel-stage-tag" style={{ borderColor: st.color, color: st.color }}>{st.title}</span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Board Creation Modal */}
                {isBoardModalOpen && renderBoardModal()}
            </div>
        );
    }

    // ============================================================
    // VIEW: KANBAN BOARD (board selected)
    // ============================================================
    const activeStages = stages.filter(s => s.board_id === activeBoardId);
    const activeBoard = boards.find(b => b.id === activeBoardId);

    return (
        <div className="crm-container">
            <div className="crm-list-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="crm-back-btn" onClick={() => { setActiveBoardId(null); setDeals([]); }}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="crm-page-title">{activeBoard?.title || 'Quadro'}</h1>
                        <p className="crm-page-subtitle">Arraste os cards entre as colunas para atualizar o status</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Button size="sm" variant={showArchivedDeals ? 'primary' : 'outline'} onClick={() => setShowArchivedDeals(!showArchivedDeals)}>
                        <Archive size={16} /> {showArchivedDeals ? 'Ocultar Oportunidades Arquivadas' : 'Oportunidades Arquivadas'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsTagsModalOpen(true)}>
                        <Tag size={16} /> Gerenciar Tags
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => activeBoard && openEditBoardModal(activeBoard)}>
                        <Edit2 size={16} /> Editar Quadro
                    </Button>
                    <Button size="sm" onClick={() => openDealModal()}>
                        <Plus size={16} /> Novo Negócio
                    </Button>
                </div>
            </div>

            <div className="kanban-board">
                {activeStages.map(stage => {
                    const stageDeals = deals.filter(d => d.stage_id === stage.id && (showArchivedDeals ? d.archived : !d.archived));
                    return (
                        <div key={stage.id} className="kanban-column" onDrop={(e) => handleDrop(e, stage.id)} onDragOver={handleDragOver}>
                            <div className="kanban-column-header">
                                <div className="kanban-col-bar" style={{ background: stage.color }}></div>
                                <div className="kanban-col-info">
                                    <span className="kanban-col-title">{stage.title}</span>
                                    <span className="kanban-col-count">{stageDeals.length}</span>
                                </div>
                                <div className="kanban-col-total">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stageDeals.reduce((a, d) => a + (Number(d.value) || 0), 0))}
                                </div>
                            </div>

                            <div className="kanban-column-content">
                                {stageDeals.map(deal => {
                                    const done = deal.subtasks?.filter(t => t.completed).length || 0;
                                    const total = deal.subtasks?.length || 0;
                                    return (
                                        <div key={deal.id} className="kanban-card" draggable onDragStart={(e) => handleDragStart(e, deal.id)} onClick={() => openDealModal(deal)}>
                                            <div className="kcard-title">{deal.title}</div>
                                            
                                            {((deal.priority_tags && deal.priority_tags.length > 0) || (deal.niche_tags && deal.niche_tags.length > 0)) && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                                                    {deal.priority_tags?.map(tagId => {
                                                        const tag = globalTags.find(t => t.id === tagId);
                                                        if (!tag) return null;
                                                        return <span key={tag.id} title="Prioridade" style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: tag.color, color: '#fff', fontWeight: 600 }}>{tag.name}</span>
                                                    })}
                                                    {deal.niche_tags?.map(tagId => {
                                                        const tag = globalTags.find(t => t.id === tagId);
                                                        if (!tag) return null;
                                                        return <span key={tag.id} title="Nicho" style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${tag.color}`, color: tag.color, fontWeight: 600 }}>{tag.name}</span>
                                                    })}
                                                </div>
                                            )}

                                            <div className="kcard-client"><User size={12} /> {deal.client?.name || 'Cliente Removido'}</div>
                                            {total > 0 && (
                                                <div className="kcard-tasks">
                                                    <CheckSquare size={12} style={{ color: done === total ? '#10b981' : '#3b82f6' }} />
                                                    {done}/{total}
                                                </div>
                                            )}
                                            <div className="kcard-bottom">
                                                <span className="kcard-value">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
                                                </span>
                                                {deal.expected_close_date && (
                                                    <span className="kcard-date"><Calendar size={11} /> {new Date(deal.expected_close_date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Deal Modal */}
            {isModalOpen && renderDealModal()}
            {/* Tags Modal */}
            {isTagsModalOpen && renderTagsModal()}
            {/* Subtask Modal */}
            {editingSubtask && renderSubtaskModal()}
        </div>
    );

    // ============================================================
    // SUBTASK MODAL RENDER FUNCTION
    // ============================================================
    function renderSubtaskModal() {
        if (!editingSubtask) return null;

        const handleSubtaskChange = (field: keyof Subtask, value: any) => {
            setEditingSubtask({ ...editingSubtask, [field]: value });
            updateSubtaskField(editingSubtask.id, field as string, value);
        };

        const handleSubtaskFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                setSubtaskUploading(true);
                const filePath = `subtasks/${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage.from('deal-files').upload(filePath, file);
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage.from('deal-files').getPublicUrl(filePath);

                const newFiles = [...(editingSubtask.files || []), { name: file.name, url: urlData.publicUrl, size: file.size }];
                handleSubtaskChange('files', newFiles);
            } catch (error) {
                console.error('Upload error:', error);
                alert('Erro ao enviar arquivo.');
            } finally {
                setSubtaskUploading(false);
                if (subtaskFileInputRef.current) subtaskFileInputRef.current.value = '';
            }
        };

        const removeSubtaskFile = (url: string) => {
            const newFiles = (editingSubtask.files || []).filter(f => f.url !== url);
            handleSubtaskChange('files', newFiles);
        };

        return createPortal(
            <div className="modal-overlay" style={{ zIndex: 1000000 }} onClick={() => setEditingSubtask(null)}>
                <div className="modal-box modal-box-lg" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <div className="modal-header-left">
                            <div className="modal-icon-wrap" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}><CheckSquare size={20} /></div>
                            <div>
                                <h2 className="modal-title">Detalhes da Tarefa</h2>
                                <p className="modal-desc">Gerencie os detalhes desta subtarefa</p>
                            </div>
                        </div>
                        <button className="modal-close-btn" onClick={() => setEditingSubtask(null)}><X size={20} /></button>
                    </div>
                    <div className="modal-body">
                        <div className="modal-grid">
                            <div className="modal-col-main">
                                <div className="form-group">
                                    <label className="form-label">Título da Tarefa <span className="required">*</span></label>
                                    <input className="form-input" value={editingSubtask.title} onChange={(e) => handleSubtaskChange('title', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descrição</label>
                                    <textarea className="form-input form-textarea" placeholder="Adicione mais detalhes sobre essa tarefa..." rows={5} value={editingSubtask.description || ''} onChange={(e) => handleSubtaskChange('description', e.target.value)}></textarea>
                                </div>

                                {/* Subtask File Upload Section */}
                                <div className="form-group">
                                    <label className="form-label">Arquivos Anexos</label>
                                    <input type="file" ref={subtaskFileInputRef} onChange={handleSubtaskFileUpload} style={{ display: 'none' }} />
                                    {(editingSubtask.files || []).length > 0 && (
                                        <div className="file-list">
                                            {(editingSubtask.files || []).map((file, i) => (
                                                <div key={i} className="file-item">
                                                    <div className="file-item-icon"><FileText size={16} /></div>
                                                    <div className="file-item-info">
                                                        <span className="file-item-name">{file.name}</span>
                                                        <span className="file-item-size">{formatFileSize(file.size)}</span>
                                                    </div>
                                                    <button className="file-download-btn" onClick={() => downloadFile(file.url, file.name)} title="Baixar"><Download size={14} /></button>
                                                    <button className="file-remove-btn" onClick={() => removeSubtaskFile(file.url)} title="Remover"><X size={14} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <button className="file-upload-trigger" onClick={() => subtaskFileInputRef.current?.click()} disabled={subtaskUploading}>
                                        <Upload size={16} />
                                        {subtaskUploading ? 'Enviando...' : 'Anexar Arquivo na Tarefa'}
                                    </button>
                                </div>
                            </div>
                            <div className="modal-col-side">
                                <div className="form-group">
                                    <label className="form-label">Status da Tarefa</label>
                                    <select className="form-input" value={editingSubtask.status || 'pendente'} onChange={(e) => handleSubtaskChange('status', e.target.value)}>
                                        <option value="pendente">Pendente</option>
                                        <option value="em_desenvolvimento">Em Desenvolvimento</option>
                                        <option value="concluida">Concluída</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Vencimento</label>
                                    <DatePicker value={editingSubtask.due_date || ''} onChange={(date) => handleSubtaskChange('due_date', date)} placeholder="Selecionar data" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Responsável</label>
                                    <select className="form-input" value={editingSubtask.assigned_to || ''} onChange={(e) => handleSubtaskChange('assigned_to', e.target.value)}>
                                        <option value="">Sem responsável</option>
                                        {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            , document.body);
    }
    // RENDER FUNCTIONS
    // ============================================================
    function renderDealModal() {
        const boardStages = stages.filter(s => s.board_id === activeBoardId);
        return createPortal(
            <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                <div className="modal-box modal-box-xl" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <div className="modal-header-left">
                            <div className="modal-icon-wrap" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}><Tag size={20} /></div>
                            <div>
                                <h2 className="modal-title">{editingDeal ? 'Editar Oportunidade' : 'Nova Oportunidade'}</h2>
                                <p className="modal-desc">Preencha os detalhes do negócio</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {editingDeal && (
                                <button className="modal-close-btn" style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: editingDeal.archived ? '#10B981' : '#f59e0b' }} onClick={() => handleArchiveDeal(editingDeal)}>
                                    <Archive size={16} /> {editingDeal.archived ? 'Desarquivar' : 'Arquivar'}
                                </button>
                            )}
                            <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
                        </div>
                    </div>
                    <div className="modal-body">
                        <div className="modal-grid">
                            <div className="modal-col-main">
                                <div className="form-group">
                                    <label className="form-label">Título do Negócio <span className="required">*</span></label>
                                    <input className="form-input" placeholder="Ex: Campanha Premium" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Vincular Cliente</label>
                                        <select className="form-input" value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}>
                                            <option value="" disabled>Selecione um cliente...</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        {formData.client_id && (() => {
                                            const linkedClient = clients.find(c => c.id === formData.client_id);
                                            if (!linkedClient) return null;
                                            return (
                                                <div className="linked-client-card">
                                                    <div className="linked-client-avatar"><User size={16} /></div>
                                                    <div className="linked-client-info">
                                                        <span className="linked-client-name">{linkedClient.name}</span>
                                                        <span className="linked-client-detail">{linkedClient.phone}{linkedClient.email ? ` · ${linkedClient.email}` : ''}</span>
                                                    </div>
                                                    <button className="linked-client-remove" onClick={() => setFormData({ ...formData, client_id: '' })} title="Desvincular"><X size={14} /></button>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Valor (R$)</label>
                                        <input type="number" className="form-input" placeholder="0.00" value={formData.value} onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descrição</label>
                                    <textarea className="form-input form-textarea" placeholder="Notas, links de propostas..." rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}></textarea>
                                </div>

                                {/* File Upload Section */}
                                <div className="form-group">
                                    <label className="form-label">Arquivos</label>
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                                    {formData.files.length > 0 && (
                                        <div className="file-list">
                                            {formData.files.map((file, i) => (
                                                <div key={i} className="file-item">
                                                    <div className="file-item-icon"><FileText size={16} /></div>
                                                    <div className="file-item-info">
                                                        <span className="file-item-name">{file.name}</span>
                                                        <span className="file-item-size">{formatFileSize(file.size)}</span>
                                                    </div>
                                                    <button className="file-download-btn" onClick={() => downloadFile(file.url, file.name)} title="Baixar"><Download size={14} /></button>
                                                    <button className="file-remove-btn" onClick={() => removeFile(file.url)} title="Remover"><X size={14} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <button className="file-upload-trigger" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                        <Upload size={16} />
                                        {uploading ? 'Enviando...' : 'Anexar Arquivo'}
                                    </button>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Checklist / Tarefas</label>
                                    <div className="subtask-list">
                                        {formData.subtasks.map(task => {
                                            const statusColors: Record<string, string> = {
                                                pendente: '#f59e0b',
                                                em_desenvolvimento: '#3b82f6',
                                                concluida: '#10b981'
                                            };
                                            const statusLabels: Record<string, string> = {
                                                pendente: 'Pendente',
                                                em_desenvolvimento: 'Em Dev',
                                                concluida: 'Concluída'
                                            };
                                            return (
                                                <div key={task.id} className="subtask-item-enhanced">
                                                    <div className="subtask-row-top">
                                                        <input type="checkbox" checked={task.completed} onChange={() => toggleSubtask(task.id)} />
                                                        <span className="subtask-title" style={{ textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? '#94a3b8' : '#1e293b', cursor: 'pointer' }} onClick={() => setEditingSubtask(task)}>{task.title}</span>
                                                        <select className="subtask-status-select" value={task.status || 'pendente'} onChange={(e) => updateSubtaskField(task.id, 'status', e.target.value)} style={{ borderColor: statusColors[task.status || 'pendente'], color: statusColors[task.status || 'pendente'] }}>
                                                            <option value="pendente">Pendente</option>
                                                            <option value="em_desenvolvimento">Em Dev</option>
                                                            <option value="concluida">Concluída</option>
                                                        </select>
                                                        <button className="subtask-action-btn" onClick={() => setEditingSubtask(task)} title="Abrir Detalhes"><Maximize2 size={14} /></button>
                                                        <button className="subtask-delete" onClick={() => deleteSubtask(task.id)} title="Excluir Tarefa"><X size={14} /></button>
                                                    </div>
                                                    <div className="subtask-row-bottom">
                                                        <div className="subtask-meta picker-small">
                                                            <DatePicker value={task.due_date || ''} onChange={(date) => updateSubtaskField(task.id, 'due_date', date)} placeholder="Data" />
                                                        </div>
                                                        <div className="subtask-meta">
                                                            <User size={12} />
                                                            <select className="subtask-assign" value={task.assigned_to || ''} onChange={(e) => updateSubtaskField(task.id, 'assigned_to', e.target.value)}>
                                                                <option value="">Sem responsável</option>
                                                                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="subtask-add">
                                        <input className="form-input" placeholder="Adicionar item..." value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubtask()} />
                                        <Button variant="outline" size="sm" onClick={addSubtask}>Add</Button>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-col-side">
                                <div className="form-group">
                                    <label className="form-label">Tags de Prioridade</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {globalTags.filter(t => t.type === 'priority').map(t => {
                                            const isSelected = formData.priority_tags.includes(t.id);
                                            return (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const newTags = isSelected 
                                                            ? formData.priority_tags.filter(id => id !== t.id)
                                                            : [...formData.priority_tags, t.id];
                                                        setFormData({ ...formData, priority_tags: newTags });
                                                    }}
                                                    style={{
                                                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${t.color}`,
                                                        background: isSelected ? t.color : 'transparent', color: isSelected ? '#fff' : t.color, cursor: 'pointer'
                                                    }}
                                                >
                                                    {t.name}
                                                </button>
                                            );
                                        })}
                                        {globalTags.filter(t=>t.type === 'priority').length === 0 && <span style={{fontSize:'0.75rem',color:'#94a3b8'}}>Nenhuma tag de prioridade.</span>}
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label className="form-label">Tags de Nicho</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {globalTags.filter(t => t.type === 'niche').map(t => {
                                            const isSelected = formData.niche_tags.includes(t.id);
                                            return (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const newTags = isSelected 
                                                            ? formData.niche_tags.filter(id => id !== t.id)
                                                            : [...formData.niche_tags, t.id];
                                                        setFormData({ ...formData, niche_tags: newTags });
                                                    }}
                                                    style={{
                                                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${t.color}`,
                                                        background: isSelected ? t.color : 'transparent', color: isSelected ? '#fff' : t.color, cursor: 'pointer'
                                                    }}
                                                >
                                                    {t.name}
                                                </button>
                                            );
                                        })}
                                        {globalTags.filter(t=>t.type === 'niche').length === 0 && <span style={{fontSize:'0.75rem',color:'#94a3b8'}}>Nenhuma tag de nicho.</span>}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Etapa do Funil</label>
                                    <select className="form-input" value={formData.stage_id} onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}>
                                        {boardStages.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fechamento Previsto</label>
                                    <DatePicker value={formData.expected_close_date} onChange={(date) => setFormData({ ...formData, expected_close_date: date })} placeholder="Selecionar data" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Responsável</label>
                                    <select className="form-input" value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}>
                                        <option value="">Sem responsável</option>
                                        {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveDeal}>Salvar Oportunidade</Button>
                    </div>
                </div>
            </div>
            , document.body);
    }

    function renderBoardModal() {
        const closeBoardModal = () => { setIsBoardModalOpen(false); setBoardCreationMode('choose'); };

        return createPortal(
            <div className="modal-overlay" onClick={closeBoardModal}>
                <div className="modal-box" style={boardCreationMode === 'choose' ? { maxWidth: '600px' } : undefined} onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <div className="modal-header-left">
                            <div className="modal-icon-wrap"><AlignLeft size={20} /></div>
                            <div>
                                <h2 className="modal-title">
                                    {editingBoardId ? 'Editar Quadro' : boardCreationMode === 'choose' ? 'Novo Quadro de Projetos' : boardCreationMode === 'template' ? 'Escolher Modelo' : 'Personalizar Quadro'}
                                </h2>
                                <p className="modal-desc">
                                    {editingBoardId ? 'Altere o nome, cliente ou as etapas do projeto' : boardCreationMode === 'choose' ? 'Como deseja criar o seu quadro?' : boardCreationMode === 'template' ? 'Selecione um modelo pronto' : 'Configure as etapas do seu pipeline'}
                                </p>
                            </div>
                        </div>
                        <button className="modal-close-btn" onClick={closeBoardModal}><X size={20} /></button>
                    </div>
                    <div className="modal-body">
                        {boardCreationMode === 'choose' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div onClick={() => setBoardCreationMode('custom')} style={{ cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '16px', padding: '28px 20px', textAlign: 'center', transition: 'all 0.2s', background: '#fff' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🎨</div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 6px' }}>Personalizado</h3>
                                    <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>Crie do zero com etapas personalizadas</p>
                                </div>
                                <div onClick={() => setBoardCreationMode('template')} style={{ cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '16px', padding: '28px 20px', textAlign: 'center', transition: 'all 0.2s', background: '#fff' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = '#f5f3ff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📋</div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 6px' }}>Usar Modelo</h3>
                                    <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>Comece com um template pronto</p>
                                </div>
                            </div>
                        )}

                        {boardCreationMode === 'template' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {/* Botão Criar Novo Modelo */}
                                <div onClick={() => {
                                    setNewTemplateData({ name: '', description: '', icon: '📋', stages: [{ id: '1', title: 'Contato Inicial', color: '#F59E0B' }, { id: '2', title: 'Negociação', color: '#2563EB' }], tags: [] });
                                    setBoardCreationMode('create_template');
                                }} style={{ cursor: 'pointer', border: '2px dashed #10B981', borderRadius: '14px', padding: '18px', textAlign: 'center', transition: 'all 0.2s', background: '#ecfdf5', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '140px' }}
                                    className="hover-opacity">
                                    <Plus size={32} style={{ color: '#10B981', marginBottom: '8px' }} />
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10B981', margin: '0 0 4px' }}>Criar Meu Modelo</h4>
                                    <p style={{ fontSize: '0.72rem', color: '#34d399', margin: 0, lineHeight: 1.3 }}>Configure um pipeline do seu jeito</p>
                                </div>
                                {customTemplates.map((tpl) => (
                                    <div key={tpl.id} onClick={() => selectTemplate(tpl)} style={{ cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '14px', padding: '18px', transition: 'all 0.2s', background: '#fff', position: 'relative' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(16,185,129,0.12)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}>
                                        <button onClick={(e) => handleDeleteCustomTemplate(e, tpl.id)} style={{ position:'absolute', top:'10px', right:'10px', background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding: '4px' }} title="Excluir Modelo"><Trash2 size={14}/></button>
                                        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{tpl.icon || '📋'}</div>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px', paddingRight: '20px' }}>{tpl.name}</h4>
                                        {tpl.description && <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 10px', lineHeight: 1.3 }}>{tpl.description}</p>}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {tpl.stages.map(s => (
                                                <span key={s.id} style={{ fontSize: '0.6rem', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', border: `1px solid ${s.color}`, color: s.color }}>{s.title}</span>
                                            ))}
                                            <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', border: '1px solid #10B981', color: '#10B981' }}>Concluído</span>
                                        </div>
                                    </div>
                                ))}
                                {BOARD_TEMPLATES.map((tpl, i) => (
                                    <div key={'default-'+i} onClick={() => selectTemplate(tpl)} style={{ cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '14px', padding: '18px', transition: 'all 0.2s', background: '#fff' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(139,92,246,0.12)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}>
                                        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{tpl.icon}</div>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>{tpl.name}</h4>
                                        <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 10px', lineHeight: 1.3 }}>{tpl.description}</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {tpl.stages.map(s => (
                                                <span key={s.id} style={{ fontSize: '0.6rem', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', border: `1px solid ${s.color}`, color: s.color }}>{s.title}</span>
                                            ))}
                                            <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', border: '1px solid #10B981', color: '#10B981' }}>Concluído</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {boardCreationMode === 'create_template' && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Nome do Modelo <span className="required">*</span></label>
                                    <input className="form-input" placeholder="Ex: Fluxo Financeiro" value={newTemplateData.name} onChange={(e) => setNewTemplateData({ ...newTemplateData, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descrição (opcional)</label>
                                    <input className="form-input" placeholder="Ex: Processo de cobrança mensal" value={newTemplateData.description} onChange={(e) => setNewTemplateData({ ...newTemplateData, description: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Ícone (Emoji)</label>
                                    <input className="form-input" style={{ width: '80px', fontSize: '1.2rem', textAlign: 'center' }} placeholder="📋" value={newTemplateData.icon} onChange={(e) => setNewTemplateData({ ...newTemplateData, icon: e.target.value })} />
                                </div>

                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <div className="stage-editor-header">
                                        <label className="form-label">Etapas do Kanban (Padrão)</label>
                                        <Button variant="outline" size="sm" onClick={addTemplateStage}><Plus size={14} /> Etapa</Button>
                                    </div>
                                    <div className="stage-editor-list">
                                        {(newTemplateData.stages || []).map((stage, index) => (
                                            <div key={stage.id} className="stage-editor-item">
                                                <span className="stage-editor-num">{index + 1}</span>
                                                <div className="stage-color-picker">
                                                    <input type="color" value={stage.color} onChange={(e) => updateTemplateStage(stage.id, 'color', e.target.value)} />
                                                </div>
                                                <input className="form-input" placeholder="Nome da etapa" value={stage.title} onChange={(e) => updateTemplateStage(stage.id, 'title', e.target.value)} style={{ flex: 1 }} />
                                                <button className="stage-delete-btn" onClick={() => removeTemplateStage(stage.id)}><Trash2 size={14} /></button>
                                            </div>
                                        ))}
                                        {(newTemplateData.stages || []).length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>Adicione ao menos uma etapa padrão.</div>
                                        )}

                                        <div className="stage-editor-item stage-locked">
                                            <span className="stage-editor-num">{(newTemplateData.stages || []).length + 1}</span>
                                            <div className="stage-color-preview" style={{ background: '#10B981' }}></div>
                                            <div className="stage-locked-label">
                                                <CheckCircle2 size={14} style={{ color: '#10B981' }} />
                                                <span>Concluído</span>
                                            </div>
                                            <div className="stage-locked-badge">
                                                <Lock size={12} />
                                                Fixo
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <div className="stage-editor-header">
                                        <label className="form-label">Tags do Modelo (Padrão)</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <Button variant="outline" size="sm" onClick={() => addTemplateTag('priority')}><Plus size={14} /> Prioridade</Button>
                                            <Button variant="outline" size="sm" onClick={() => addTemplateTag('niche')}><Plus size={14} /> Nicho</Button>
                                        </div>
                                    </div>
                                    <div className="stage-editor-list">
                                        {(newTemplateData.tags || []).map((tag, index) => (
                                            <div key={tag.id} className="stage-editor-item" style={{ borderLeft: `3px solid ${tag.type === 'priority' ? '#EF4444' : '#3B82F6'}`, paddingLeft: '8px' }}>
                                                <div className="stage-color-picker">
                                                    <input type="color" value={tag.color} onChange={(e) => updateTemplateTag(tag.id!, 'color', e.target.value)} />
                                                </div>
                                                <span style={{ fontSize: '0.7rem', color: '#64748b', width: '50px' }}>{tag.type === 'priority' ? 'Prior.' : 'Nicho'}</span>
                                                <input className="form-input" placeholder="Nome da tag" value={tag.name} onChange={(e) => updateTemplateTag(tag.id!, 'name', e.target.value)} style={{ flex: 1 }} />
                                                <button className="stage-delete-btn" onClick={() => removeTemplateTag(tag.id!)}><Trash2 size={14} /></button>
                                            </div>
                                        ))}
                                        {(newTemplateData.tags || []).length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.85rem' }}>Nenhuma tag definida para este modelo.</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {boardCreationMode === 'custom' && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Nome do Quadro <span className="required">*</span></label>
                                    <input className="form-input" placeholder="Ex: Onboarding Clientes" value={newBoardData.title} onChange={(e) => setNewBoardData({ ...newBoardData, title: e.target.value })} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Vincular Cliente (opcional)</label>
                                    <select className="form-input" value={newBoardData.client_id} onChange={(e) => setNewBoardData({ ...newBoardData, client_id: e.target.value })}>
                                        <option value="">Nenhum cliente vinculado</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <div className="stage-editor-header">
                                        <label className="form-label">Etapas do Kanban</label>
                                        <Button variant="outline" size="sm" onClick={addBoardStage}><Plus size={14} /> Etapa</Button>
                                    </div>
                                    <div className="stage-editor-list">
                                        {newBoardData.stages.map((stage, index) => (
                                            <div key={stage.id} className="stage-editor-item">
                                                <span className="stage-editor-num">{index + 1}</span>
                                                <div className="stage-color-picker">
                                                    <input type="color" value={stage.color} onChange={(e) => updateBoardStage(stage.id, 'color', e.target.value)} />
                                                </div>
                                                <input className="form-input" placeholder="Nome da etapa" value={stage.title} onChange={(e) => updateBoardStage(stage.id, 'title', e.target.value)} style={{ flex: 1 }} />
                                                <button className="stage-delete-btn" onClick={() => removeBoardStage(stage.id)}><Trash2 size={14} /></button>
                                            </div>
                                        ))}
                                        {newBoardData.stages.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>Adicione ao menos uma etapa.</div>
                                        )}

                                        {/* Etapa Concluído obrigatória e travada */}
                                        <div className="stage-editor-item stage-locked">
                                            <span className="stage-editor-num">{newBoardData.stages.length + 1}</span>
                                            <div className="stage-color-preview" style={{ background: '#10B981' }}></div>
                                            <div className="stage-locked-label">
                                                <CheckCircle2 size={14} style={{ color: '#10B981' }} />
                                                <span>Concluído</span>
                                            </div>
                                            <div className="stage-locked-badge">
                                                <Lock size={12} />
                                                Obrigatório
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {boardCreationMode === 'custom' && (
                        <div className="modal-footer">
                            <Button variant="outline" onClick={() => editingBoardId ? setIsBoardModalOpen(false) : setBoardCreationMode('choose')}>Voltar</Button>
                            <Button onClick={handleSaveBoard} disabled={!newBoardData.title.trim() || newBoardData.stages.length === 0}>{editingBoardId ? 'Salvar Alterações' : 'Criar Quadro'}</Button>
                        </div>
                    )}
                    {boardCreationMode === 'create_template' && (
                        <div className="modal-footer">
                            <Button variant="outline" onClick={() => setBoardCreationMode('template')}>Cancelar</Button>
                            <Button onClick={handleSaveCustomTemplate} disabled={!newTemplateData.name?.trim() || (newTemplateData.stages || []).length === 0}>Salvar Modelo</Button>
                        </div>
                    )}
                    {boardCreationMode === 'template' && (
                        <div className="modal-footer">
                            <Button variant="outline" onClick={() => setBoardCreationMode('choose')}>Voltar</Button>
                        </div>
                    )}
                </div>
            </div>
            , document.body);
    }

    // ============================================================
    // TAGS MODAL
    // ============================================================
    async function handleSaveTag() {
        if (!editingTag?.name || !editingTag?.type) return;
        try {
            if (editingTag.id) {
                await supabase.from('crm_tags').update({ name: editingTag.name, color: editingTag.color || '#E2E8F0', type: editingTag.type }).eq('id', editingTag.id);
            } else {
                await supabase.from('crm_tags').insert([{ name: editingTag.name, color: editingTag.color || '#E2E8F0', type: editingTag.type }]);
            }
            setEditingTag(null);
            fetchMetadata();
        } catch (error) { console.error('Error saving tag:', error); }
    }

    async function handleDeleteTag(id: string, type: string) {
        if (!window.confirm('Tem certeza que deseja excluir esta tag? Ela será removida de todos os negócios que a utilizam.')) return;
        try {
            await supabase.from('crm_tags').delete().eq('id', id);
            
            // Also update deals that have this tag (Optional but good practice)
            // Currently relies on the array storage in deals. Removing from array requires complex SQL or fetching all deals. 
            // We'll just delete the tag and it won't be matched anymore via globalTags.
            fetchMetadata();
        } catch (error) { console.error('Error deleting tag:', error); }
    }

    function renderTagsModal() {
        return createPortal(
            <div className="modal-overlay" onClick={() => setIsTagsModalOpen(false)}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                    <div className="modal-header">
                        <div className="modal-header-left">
                            <div className="modal-icon-wrap" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}><Tag size={20} /></div>
                            <div>
                                <h2 className="modal-title">Gerenciar Tags</h2>
                                <p className="modal-desc">Crie e edite tags de Prioridade e Nicho</p>
                            </div>
                        </div>
                        <button className="modal-close-btn" onClick={() => setIsTagsModalOpen(false)}><X size={20} /></button>
                    </div>
                    
                    <div className="modal-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {/* Prioridades */}
                            <div>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '10px' }}>Prioridades</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {globalTags.filter(t => t.type === 'priority').map(t => (
                                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.color }}></div>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{t.name}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button onClick={() => setEditingTag(t)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><Tag size={14}/></button>
                                                <button onClick={() => handleDeleteTag(t.id, t.type)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    <Button variant="outline" size="sm" onClick={() => setEditingTag({ type: 'priority', color: '#EF4444', name: '' })} style={{ width: '100%', justifyContent: 'center' }}><Plus size={14} /> Adicionar Prioridade</Button>
                                </div>
                            </div>
                            
                            {/* Nichos */}
                            <div>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '10px' }}>Nichos</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {globalTags.filter(t => t.type === 'niche').map(t => (
                                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.color }}></div>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{t.name}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button onClick={() => setEditingTag(t)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><Tag size={14}/></button>
                                                <button onClick={() => handleDeleteTag(t.id, t.type)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    <Button variant="outline" size="sm" onClick={() => setEditingTag({ type: 'niche', color: '#3B82F6', name: '' })} style={{ width: '100%', justifyContent: 'center' }}><Plus size={14} /> Adicionar Nicho</Button>
                                </div>
                            </div>
                        </div>

                        {/* Edit Tag Inline Form */}
                        {editingTag && (
                            <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '12px' }}>
                                    {editingTag.id ? 'Editar' : 'Nova'} Tag de {editingTag.type === 'priority' ? 'Prioridade' : 'Nicho'}
                                </h4>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input type="color" value={editingTag.color || '#000000'} onChange={e => setEditingTag({...editingTag, color: e.target.value})} style={{ width: '36px', height: '36px', padding: '0', border: 'none', borderRadius: '6px', cursor: 'pointer' }} />
                                    <input type="text" className="form-input" placeholder="Nome da tag" value={editingTag.name || ''} onChange={e => setEditingTag({...editingTag, name: e.target.value})} style={{ flex: 1 }} />
                                    <Button onClick={handleSaveTag} disabled={!editingTag.name}>Salvar</Button>
                                    <Button variant="outline" onClick={() => setEditingTag(null)}>Cancelar</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            , document.body);
    }
}
