import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Client, ClientComment, ClientAttachment } from '../types/crm';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, X, User, Eye, DollarSign, Briefcase, CheckCircle2, Clock, FileText, ArrowUpRight, ArrowDownRight, Edit2, Trash2, MessageSquare, Paperclip, Upload, Download, Save, KanbanSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import './Clients.css';

const labelStyle: React.CSSProperties = { fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' };

export function Clients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', origin: '' });

    // Detail modal
    const [detailClient, setDetailClient] = useState<Client | null>(null);
    const [activeTab, setActiveTab] = useState<'principal' | 'comments' | 'attachments'>('principal');
    const [clientDeals, setClientDeals] = useState<any[]>([]);
    const [clientProjects, setClientProjects] = useState<any[]>([]);
    const [clientEntries, setClientEntries] = useState<any[]>([]);
    const [clientComments, setClientComments] = useState<ClientComment[]>([]);
    const [clientAttachments, setClientAttachments] = useState<ClientAttachment[]>([]);
    const [clientBoards, setClientBoards] = useState<any[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    // Comments & Attachments specific state
    const [newComment, setNewComment] = useState('');
    const [savingComment, setSavingComment] = useState(false);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [attachmentNiche, setAttachmentNiche] = useState('Guias');

    // Save description
    const [editingDescription, setEditingDescription] = useState(false);
    const [descValue, setDescValue] = useState('');
    const [savingDesc, setSavingDesc] = useState(false);

    useEffect(() => {
        fetchClients();
        const channel = supabase.channel('clients-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => fetchClients())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchClients = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setClients(data as Client[] || []);
        } catch (err) {
            console.error('Error fetching clients:', err);
        } finally {
            setLoading(false);
        }
    };

    const openDetail = async (client: Client) => {
        setDetailClient(client);
        setActiveTab('principal');
        setDescValue(client.description || '');
        setEditingDescription(false);
        setDetailLoading(true);
        try {
            const [dealsRes, projectsRes, entriesRes, commentsRes, attachmentsRes, boardsRes] = await Promise.all([
                supabase.from('deals').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
                supabase.from('projects').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
                supabase.from('financial_entries').select('*, category:financial_categories(name, color)').eq('client_id', client.id).order('date', { ascending: false }),
                supabase.from('client_comments').select('*, author:profiles(full_name, avatar_url)').eq('client_id', client.id).order('created_at', { ascending: true }),
                supabase.from('client_attachments').select('*, author:profiles(full_name, avatar_url)').eq('client_id', client.id).order('created_at', { ascending: false }),
                supabase.from('boards').select('*').eq('client_id', client.id).order('created_at', { ascending: false })
            ]);
            setClientDeals(dealsRes.data || []);
            setClientProjects(projectsRes.data || []);
            setClientEntries(entriesRes.data || []);
            setClientComments(commentsRes.data || []);
            setClientAttachments(attachmentsRes.data || []);
            setClientBoards(boardsRes.data || []);
        } catch (err) {
            console.error('Error fetching client details:', err);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            const dataToSave: any = {
                name: formData.name, email: formData.email || null,
                phone: formData.phone, origin: formData.origin || null,
                updated_at: new Date().toISOString()
            };

            if (editingClient) {
                const { error } = await supabase.from('clients').update(dataToSave).eq('id', editingClient.id);
                if (error) throw error;
            } else {
                dataToSave.created_at = new Date().toISOString();
                const { error } = await supabase.from('clients').insert([dataToSave]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingClient(null);
            setFormData({ name: '', email: '', phone: '', origin: '' });
            fetchClients();
        } catch (error) {
            console.error('Error saving client:', error);
            alert('Erro ao salvar cliente.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClient = async (e: React.MouseEvent, client: Client) => {
        e.stopPropagation();
        if (window.confirm(`Tem certeza que deseja EXCLUIR o cliente "${client.name}"?\nAVISO: Esta ação é permanente e também excluirá TODOS os negócios, projetos operacionais e informações financeiras associados a este cliente!`)) {
            try {
                const { error } = await supabase.from('clients').delete().eq('id', client.id);
                if (error) throw error;
                fetchClients();
            } catch (err) {
                console.error('Erro ao excluir cliente:', err);
                alert('Ocorreu um erro ao excluir o cliente.');
            }
        }
    };

    const openEditModal = (e: React.MouseEvent, client: Client) => {
        e.stopPropagation();
        setEditingClient(client);
        setFormData({
            name: client.name,
            email: client.email || '',
            phone: client.phone,
            origin: client.origin || ''
        });
        setIsModalOpen(true);
    };

    const handleOpenNewModal = () => {
        setEditingClient(null);
        setFormData({ name: '', email: '', phone: '', origin: '' });
        setIsModalOpen(true);
    };

    const handleSaveDescription = async () => {
        if (!detailClient) return;
        setSavingDesc(true);
        try {
            const { error } = await supabase.from('clients').update({ description: descValue }).eq('id', detailClient.id);
            if (error) throw error;
            setDetailClient({ ...detailClient, description: descValue });
            setEditingDescription(false);
            fetchClients();
        } catch (err) {
            console.error('Error saving desc:', err);
            alert('Erro ao salvar descrição.');
        } finally {
            setSavingDesc(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!detailClient || !newComment.trim()) return;
        setSavingComment(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            const author_id = userData.user?.id;
            const commentData = {
                client_id: detailClient.id,
                author_id,
                content: newComment.trim()
            };
            const { error, data } = await supabase.from('client_comments').insert([commentData]).select('*, author:profiles(full_name, avatar_url)').single();
            if (error) throw error;
            if (data) setClientComments([...clientComments, data]);
            setNewComment('');
        } catch (err) {
            console.error('Error adding comment:', err);
            alert('Erro ao adicionar comentário.');
        } finally {
            setSavingComment(false);
        }
    };

    const sanitizeFileName = (name: string) => {
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w.-]/g, '_')
            .replace(/_{2,}/g, '_');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!detailClient || !e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        setUploadingAttachment(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            const author_id = userData.user?.id;
            
            const sanitizedName = sanitizeFileName(file.name);
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}_${sanitizedName}`;
            const filePath = `${detailClient.id}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage.from('client_files').upload(filePath, file);
            if (uploadError) throw uploadError;
            
            const { data: publicUrlData } = supabase.storage.from('client_files').getPublicUrl(filePath);
            
            const attachmentData = {
                client_id: detailClient.id,
                author_id,
                file_name: file.name,
                file_url: publicUrlData.publicUrl,
                niche: attachmentNiche
            };
            
            const { error: dbError, data: dbData } = await supabase.from('client_attachments').insert([attachmentData]).select('*, author:profiles(full_name, avatar_url)').single();
            if (dbError) throw dbError;
            
            if (dbData) setClientAttachments([dbData, ...clientAttachments]);
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Erro ao fazer upload do arquivo.');
        } finally {
            setUploadingAttachment(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!window.confirm('Tem certeza que deseja apagar este comentário?')) return;
        try {
            const { error } = await supabase.from('client_comments').delete().eq('id', commentId);
            if (error) throw error;
            setClientComments(clientComments.filter(c => c.id !== commentId));
        } catch (err) {
            console.error('Erro ao excluir comentário:', err);
            alert('Não foi possível excluir o comentário. Verifique se você é o autor ou se tem permissão de administrador.');
        }
    };

    const handleDeleteAttachment = async (attachmentId: string, filePathBase: string) => {
        if (!window.confirm('Tem certeza que deseja apagar este anexo? Ele será excluído permanentemente.')) return;
        try {
            // First get the attachment to get the file path
            const attachment = clientAttachments.find(a => a.id === attachmentId);
            if (!attachment) return;

            // Delete from database
            const { error: dbError } = await supabase.from('client_attachments').delete().eq('id', attachmentId);
            if (dbError) throw dbError;

            // Delete from storage
            // The file_url is a public URL, we need to extract the path.
            // A simple way since we know the folder structure is detailClient.id
            // Or we can just extract everything after /client_files/
            const urlParts = attachment.file_url.split('/client_files/');
            if (urlParts.length > 1) {
                const storagePath = urlParts[1];
                await supabase.storage.from('client_files').remove([storagePath]);
            }

            setClientAttachments(clientAttachments.filter(a => a.id !== attachmentId));
        } catch (err) {
            console.error('Erro ao excluir anexo:', err);
            alert('Não foi possível excluir o anexo. Verifique se você é o autor ou se tem permissão de administrador.');
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Carregando Clientes...</div>;

    return (
        <div className="clients-page">
            <div className="clients-header">
                <div>
                    <h1 className="clients-title">Clientes</h1>
                    <p className="clients-subtitle">Gestão de carteira e onboarding</p>
                </div>
                <Button size="sm" className="flex items-center gap-2" onClick={handleOpenNewModal}>
                    <Plus size={16} /> Novo Cliente
                </Button>
            </div>

            <Card className="modern-card border-none" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                <CardContent className="p-0" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                    <div className="table-responsive" style={{ margin: 0 }}>
                        <table className="table-base" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Contato</th>
                                    <th>Origem</th>
                                    <th>Data de Cadastro</th>
                                    <th className="text-right" style={{ width: '220px' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Nenhum cliente cadastrado.</td></tr>
                                ) : (
                                    clients.map(client => (
                                        <tr key={client.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(client)}>
                                            <td style={{ fontWeight: 600 }}>{client.name}</td>
                                            <td>
                                                <div style={{ fontSize: '0.875rem' }}>{client.phone}</div>
                                                {client.email && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{client.email}</div>}
                                            </td>
                                            <td>{client.origin ? <span className="badge badge-muted">{client.origin}</span> : '-'}</td>
                                            <td>{format(parseISO(client.created_at), 'dd/MM/yyyy')}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                    <button onClick={(e) => { e.stopPropagation(); openDetail(client); }} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6' }}>
                                                        <Eye size={14} /> Ver
                                                    </button>
                                                    <button onClick={(e) => openEditModal(e, client)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b' }}>
                                                        <Edit2 size={14} /> Editar
                                                    </button>
                                                    <button onClick={(e) => handleDeleteClient(e, client)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fef2f2', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>
                                                        <Trash2 size={14} /> Excluir
                                                    </button>
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

            {/* ============= CREATE CLIENT MODAL ============= */}
            {isModalOpen && createPortal(
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-left">
                                <div className="modal-icon-wrap"><User size={20} /></div>
                                <div>
                                    <h2 className="modal-title">{editingClient ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h2>
                                    <p className="modal-desc">{editingClient ? 'Atualize os dados do cliente.' : 'Preencha os dados abaixo para adicionar à sua base.'}</p>
                                </div>
                            </div>
                            <button className="modal-close-btn" onClick={() => { setIsModalOpen(false); setEditingClient(null); }}><X size={20} /></button>
                        </div>
                        <form id="client-form" onSubmit={handleSaveClient} className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nome ou Empresa <span className="required">*</span></label>
                                <input type="text" required className="form-input" placeholder="Nome completo ou Razão Social" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">WhatsApp / Telefone <span className="required">*</span></label>
                                    <input type="tel" required className="form-input" placeholder="(00) 00000-0000" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Origem / Canal</label>
                                    <input type="text" className="form-input" placeholder="Ex: Instagram, Indicação..." value={formData.origin} onChange={(e) => setFormData({ ...formData, origin: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">E-mail Principal</label>
                                <input type="email" className="form-input" placeholder="contato@empresa.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                        </form>
                        <div className="modal-footer">
                            <Button variant="outline" onClick={() => { setIsModalOpen(false); setEditingClient(null); }}>Cancelar</Button>
                            <Button type="submit" form="client-form" isLoading={saving}>{editingClient ? 'Salvar Alterações' : 'Salvar Cliente'}</Button>
                        </div>
                    </div>
                </div>
                , document.body)}

            {/* ============= CLIENT DETAIL MODAL ============= */}
            {detailClient && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', padding: '1.5rem' }} onClick={() => setDetailClient(null)}>
                    <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.2rem' }}>
                                    {detailClient.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{detailClient.name}</h2>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>
                                        {detailClient.phone}{detailClient.email ? ` · ${detailClient.email}` : ''}
                                        {detailClient.origin ? ` · ${detailClient.origin}` : ''}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setDetailClient(null)} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>

                        {/* Tabs Navigation */}
                        <div style={{ padding: '0 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '20px', background: '#f8fafc' }}>
                            <button onClick={() => setActiveTab('principal')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'principal' ? '2px solid #3b82f6' : '2px solid transparent', padding: '12px 4px', fontSize: '0.9rem', fontWeight: 600, color: activeTab === 'principal' ? '#3b82f6' : '#64748b', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}><User size={16} /> Principal</button>
                            <button onClick={() => setActiveTab('comments')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'comments' ? '2px solid #3b82f6' : '2px solid transparent', padding: '12px 4px', fontSize: '0.9rem', fontWeight: 600, color: activeTab === 'comments' ? '#3b82f6' : '#64748b', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}><MessageSquare size={16} /> Comentários</button>
                            <button onClick={() => setActiveTab('attachments')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'attachments' ? '2px solid #3b82f6' : '2px solid transparent', padding: '12px 4px', fontSize: '0.9rem', fontWeight: 600, color: activeTab === 'attachments' ? '#3b82f6' : '#64748b', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}><Paperclip size={16} /> Anexos</button>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            {detailLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.85rem' }}>Carregando informações...</div>
                            ) : (
                                <>
                                    {activeTab === 'principal' && (
                                        <>
                                            {/* Description Section */}
                                            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <FileText size={16} style={{ color: '#64748b' }} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>Descrição do Cliente</span>
                                                    </div>
                                                    {!editingDescription && (
                                                        <button onClick={() => setEditingDescription(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Edit2 size={12} /> Editar
                                                        </button>
                                                    )}
                                                </div>
                                                {editingDescription ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        <textarea 
                                                            value={descValue} 
                                                            onChange={(e) => setDescValue(e.target.value)} 
                                                            style={{ width: '100%', minHeight: '100px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', resize: 'vertical' }}
                                                            placeholder="Escreva detalhes sobre o cliente aqui..."
                                                        />
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                            <Button variant="outline" size="sm" onClick={() => { setEditingDescription(false); setDescValue(detailClient.description || ''); }}>Cancelar</Button>
                                                            <Button size="sm" onClick={handleSaveDescription} isLoading={savingDesc}>Salvar</Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                                        {detailClient.description || <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Nenhuma descrição informada. Clique em Editar para adicionar.</span>}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Linked Boards Section */}
                                            {clientBoards.length > 0 && (
                                                <div style={{ background: '#f5f3ff', borderRadius: '14px', padding: '16px', border: '1px solid #e9e5f5' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                        <KanbanSquare size={16} style={{ color: '#8b5cf6' }} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>Quadros de Projetos Vinculados</span>
                                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({clientBoards.length})</span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {clientBoards.map((board: any) => (
                                                            <div key={board.id} style={{ background: '#fff', borderRadius: '10px', padding: '10px 14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                                                                    <KanbanSquare size={16} />
                                                                </div>
                                                                <div style={{ flex: 1 }}>
                                                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{board.title}</p>
                                                                    <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
                                                                        Criado em {format(parseISO(board.created_at), 'dd/MM/yyyy')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* KPI Row */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                                {[
                                                    { label: 'Oportunidades', value: clientDeals.length, color: '#3b82f6', bg: '#eff6ff', icon: <Briefcase size={16} /> },
                                                    { label: 'Projetos', value: clientProjects.length, color: '#8b5cf6', bg: '#f5f3ff', icon: <FileText size={16} /> },
                                                    { label: 'Entradas', value: formatCurrency(clientEntries.filter(e => e.type === 'entrada').reduce((s: number, e: any) => s + Number(e.amount), 0)), color: '#10b981', bg: '#ecfdf5', icon: <ArrowUpRight size={16} /> },
                                                    { label: 'Despesas', value: formatCurrency(clientEntries.filter(e => e.type === 'despesa').reduce((s: number, e: any) => s + Number(e.amount), 0)), color: '#ef4444', bg: '#fef2f2', icon: <ArrowDownRight size={16} /> }
                                                ].map((kpi, i) => (
                                                    <div key={i} style={{ background: kpi.bg, borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px', color: kpi.color }}>{kpi.icon}</div>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                                                        <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{kpi.label}</div>
                                                    </div>
                                                ))}
                                            </div>
        
                                            {/* Deals Section */}
                                            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                    <Briefcase size={16} style={{ color: '#3b82f6' }} />
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>Oportunidades (CRM)</span>
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({clientDeals.length})</span>
                                                </div>
                                                {clientDeals.length === 0 ? (
                                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma oportunidade vinculada.</p>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {clientDeals.map((deal: any) => {
                                                            const subtasks = Array.isArray(deal.subtasks) ? deal.subtasks : [];
                                                            const completed = subtasks.filter((t: any) => t.status === 'concluida' || t.completed).length;
                                                            const total = subtasks.length;
                                                            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                                                            return (
                                                                <div key={deal.id} style={{ background: '#fff', borderRadius: '10px', padding: '10px 14px', border: '1px solid #f1f5f9' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{deal.title}</span>
                                                                        {deal.value > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>{formatCurrency(Number(deal.value))}</span>}
                                                                    </div>
                                                                    {total > 0 && (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                                                            <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: '#e2e8f0' }}>
                                                                                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: pct >= 100 ? '#10b981' : pct >= 75 ? '#3b82f6' : '#f59e0b', transition: 'width 0.3s' }}></div>
                                                                            </div>
                                                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>{completed}/{total} tarefas ({pct}%)</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
        
                                            {/* Projects Section */}
                                            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                    <FileText size={16} style={{ color: '#8b5cf6' }} />
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>Projetos Operacionais</span>
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({clientProjects.length})</span>
                                                </div>
                                                {clientProjects.length === 0 ? (
                                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum projeto vinculado.</p>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {clientProjects.map((proj: any) => {
                                                            const stageNames: Record<number, string> = { 1: 'Entrada', 2: 'Validação', 3: 'Execução', 4: 'Implementação', 5: 'Monitoramento', 6: 'Ajustes/Upgrade' };
                                                            const stageColors: Record<number, string> = { 1: '#6366f1', 2: '#f59e0b', 3: '#3b82f6', 4: '#8b5cf6', 5: '#10b981', 6: '#ec4899' };
                                                            return (
                                                                <div key={proj.id} style={{ background: '#fff', borderRadius: '10px', padding: '10px 14px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{proj.title}</span>
                                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: `${stageColors[proj.stage_id] || '#64748b'}15`, color: stageColors[proj.stage_id] || '#64748b' }}>
                                                                        {stageNames[proj.stage_id] || `Etapa ${proj.stage_id}`}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
        
                                            {/* Financial Entries Section */}
                                            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                    <DollarSign size={16} style={{ color: '#10b981' }} />
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>Financeiro</span>
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({clientEntries.length})</span>
                                                </div>
                                                {clientEntries.length === 0 ? (
                                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma movimentação financeira.</p>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {clientEntries.map((entry: any) => (
                                                            <div key={entry.id} style={{ background: '#fff', borderRadius: '8px', padding: '8px 12px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: entry.type === 'entrada' ? '#ecfdf5' : '#fef2f2', color: entry.type === 'entrada' ? '#10b981' : '#ef4444', flexShrink: 0 }}>
                                                                    {entry.type === 'entrada' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                                </div>
                                                                <div style={{ flex: 1 }}>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{entry.description}</span>
                                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                                                                        {entry.category?.name && <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{entry.category.name}</span>}
                                                                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{new Date(entry.date).toLocaleDateString('pt-BR')}</span>
                                                                    </div>
                                                                </div>
                                                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: entry.type === 'entrada' ? '#10b981' : '#ef4444' }}>{formatCurrency(Number(entry.amount))}</span>
                                                                <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: entry.status === 'pago' ? '#d1fae5' : '#fef3c7', color: entry.status === 'pago' ? '#065f46' : '#b45309' }}>{entry.status === 'pago' ? 'Pago' : 'Pendente'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
        
                                            {/* Client Info */}
                                            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                    <User size={16} style={{ color: '#64748b' }} />
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>Dados do Cliente</span>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                    <div><p style={labelStyle}>Telefone</p><p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{detailClient.phone || '-'}</p></div>
                                                    <div><p style={labelStyle}>E-mail</p><p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{detailClient.email || '-'}</p></div>
                                                    <div><p style={labelStyle}>Origem</p><p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{detailClient.origin || '-'}</p></div>
                                                    <div><p style={labelStyle}>Cadastrado em</p><p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{format(parseISO(detailClient.created_at), 'dd/MM/yyyy')}</p></div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {activeTab === 'comments' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingBottom: '20px' }}>
                                                {clientComments.length === 0 ? (
                                                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>Nenhum comentário adicionado ainda.</div>
                                                ) : (
                                                    clientComments.map(comment => (
                                                        <div key={comment.id} style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px', border: '1px solid #e2e8f0' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#fff' }}>
                                                                    {comment.author?.avatar_url ? <img src={comment.author.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : comment.author?.full_name?.charAt(0) || 'U'}
                                                                </div>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>{comment.author?.full_name || 'Usuário Desconhecido'}</span>
                                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 'auto' }}>
                                                                    {format(parseISO(comment.created_at), "dd/MM/yyyy 'às' HH:mm")}
                                                                </span>
                                                                <button onClick={() => handleDeleteComment(comment.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex' }} title="Excluir Comentário">
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                            <div style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.4', paddingLeft: '32px' }}>
                                                                {comment.content}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <form onSubmit={handleAddComment} style={{ marginTop: 'auto', display: 'flex', gap: '10px', background: '#f1f5f9', padding: '12px', borderRadius: '12px' }}>
                                                <input 
                                                    type="text" 
                                                    placeholder="Escreva um comentário..." 
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem' }}
                                                />
                                                <Button type="submit" size="sm" isLoading={savingComment} disabled={!newComment.trim()}>
                                                    <MessageSquare size={16} style={{ marginRight: '6px' }} /> Enviar
                                                </Button>
                                            </form>
                                        </div>
                                    )}

                                    {activeTab === 'attachments' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '16px', border: '1px dashed #cbd5e1' }}>
                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Nicho do Arquivo</label>
                                                        <select value={attachmentNiche} onChange={e => setAttachmentNiche(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                                                            <option value="Guias">Guias</option>
                                                            <option value="Reuniões">Reuniões</option>
                                                            <option value="Auditorias">Auditorias</option>
                                                            <option value="Alinhamentos">Alinhamentos</option>
                                                        </select>
                                                    </div>
                                                    <div style={{ flex: 2 }}>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Selecionar Arquivo</label>
                                                        <div style={{ display: 'flex', gap: '10px' }}>
                                                            <input type="file" onChange={handleFileUpload} disabled={uploadingAttachment} style={{ flex: 1, padding: '7px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem' }} />
                                                            {uploadingAttachment && <div style={{ fontSize: '0.8rem', color: '#3b82f6', display: 'flex', alignItems: 'center' }}>Fazendo upload...</div>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {clientAttachments.length === 0 ? (
                                                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>Nenhum anexo salvo.</div>
                                                ) : (
                                                    clientAttachments.map(attachment => (
                                                        <div key={attachment.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <FileText size={18} />
                                                                </div>
                                                                <div>
                                                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{attachment.file_name}</p>
                                                                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                                                        <span style={{ fontWeight: 600, color: '#8b5cf6' }}>{attachment.niche}</span>
                                                                        <span>•</span>
                                                                        <span>{format(parseISO(attachment.created_at), 'dd/MM/yyyy')}</span>
                                                                        <span>•</span>
                                                                        <span>por {attachment.author?.full_name || 'Desconhecido'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                                <a href={attachment.file_url} target="_blank" rel="noreferrer" style={{ padding: '8px', borderRadius: '6px', background: '#f1f5f9', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} title="Baixar Arquivo">
                                                                    <Download size={16} />
                                                                </a>
                                                                <button onClick={() => handleDeleteAttachment(attachment.id, detailClient.id)} style={{ padding: '8px', borderRadius: '6px', background: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Excluir Anexo">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
                , document.body)}
        </div>
    );
}
