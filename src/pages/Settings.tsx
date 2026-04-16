import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase, UserPermissions } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Settings as SettingsIcon, Users, Shield, ShieldCheck, ShieldAlert, X, Check, Crown, UserCheck, Trash2 } from 'lucide-react';

interface TeamMember {
    id: string;
    full_name: string;
    email?: string;
    role: string;
    permissions: UserPermissions;
    created_at: string;
}

const PERMISSION_LABELS: { key: keyof UserPermissions; label: string; desc: string; color: string }[] = [
    { key: 'dashboard', label: 'Painel', desc: 'Visualizar o painel de controle', color: '#3b82f6' },
    { key: 'crm', label: 'Quadro de Projetos', desc: 'Acessar oportunidades e quadro de projetos', color: '#8b5cf6' },
    { key: 'clients', label: 'Clientes', desc: 'Ver e gerenciar a base de clientes', color: '#10b981' },
    { key: 'operations', label: 'Operações', desc: 'Gestão operacional e projetos', color: '#f59e0b' },
    { key: 'finance', label: 'Financeiro', desc: 'Entradas, despesas e relatórios', color: '#ef4444' },
    { key: 'chat', label: 'Comunicação', desc: 'Chat interno e mensagens diretas', color: '#06b6d4' },
    { key: 'nps', label: 'Pós-Venda', desc: 'Pesquisas de satisfação e NPS', color: '#ec4899' },
    { key: 'settings', label: 'Configurações', desc: 'Acessar esta página de configurações', color: '#64748b' },
];

export function Settings() {
    const { user, profile } = useAuth();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [editPerms, setEditPerms] = useState<UserPermissions>({});
    const [editRole, setEditRole] = useState('');
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        setLoading(true);
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
        setMembers((data || []).map((m: any) => ({
            ...m,
            permissions: m.permissions || {},
        })));
        setLoading(false);
    };

    const openMember = (member: TeamMember) => {
        setSelectedMember(member);
        setEditPerms(member.permissions || {});
        setEditRole(member.role);
    };

    const togglePerm = (key: keyof UserPermissions) => {
        setEditPerms(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const grantAll = () => {
        const all: UserPermissions = {};
        PERMISSION_LABELS.forEach(p => { all[p.key] = true; });
        setEditPerms(all);
    };

    const revokeAll = () => setEditPerms({});

    const savePermissions = async () => {
        if (!selectedMember) return;
        setSaving(true);
        const { error } = await supabase.from('profiles').update({
            role: editRole,
            permissions: editPerms,
        }).eq('id', selectedMember.id);
        setSaving(false);
        if (error) {
            alert('Erro ao salvar permissões: ' + error.message);
            console.error('Save permissions error:', error);
            return;
        }
        setSelectedMember(null);
        fetchMembers();
    };

    const deleteMember = async () => {
        if (!selectedMember) return;
        if (selectedMember.id === user?.id) {
            alert('Você não pode excluir a si mesmo.');
            return;
        }
        setDeleting(true);
        const { error } = await supabase.from('profiles').delete().eq('id', selectedMember.id);
        setDeleting(false);
        if (error) {
            alert('Erro ao excluir membro: ' + error.message);
            console.error('Delete member error:', error);
            return;
        }
        setShowDeleteConfirm(false);
        setSelectedMember(null);
        fetchMembers();
    };

    const getRoleBadge = (role: string) => {
        const map: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
            admin: { label: 'Administrador', bg: '#fef3c7', color: '#b45309', icon: <Crown size={12} /> },
            membro: { label: 'Membro', bg: '#f1f5f9', color: '#64748b', icon: <UserCheck size={12} /> },
            reception_sales: { label: 'Recepção/Vendas', bg: '#eff6ff', color: '#3b82f6', icon: <UserCheck size={12} /> },
            finance: { label: 'Financeiro', bg: '#ecfdf5', color: '#065f46', icon: <UserCheck size={12} /> },
        };
        const m = map[role] || map.membro;
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', background: m.bg, color: m.color, fontSize: '0.7rem', fontWeight: 700 }}>
                {m.icon} {m.label}
            </span>
        );
    };

    const getPermCount = (perms: UserPermissions) => Object.values(perms).filter(Boolean).length;

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>;

    if (!isAdmin) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
                <ShieldAlert size={64} style={{ color: '#ef4444', marginBottom: '16px', opacity: 0.4 }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>Acesso Restrito</h2>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Apenas administradores podem acessar as configurações.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Configurações</h1>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0' }}>Gerencie permissões e acessos do sistema</p>
            </div>

            {/* How it works */}
            <Card className="modern-card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <Shield size={18} style={{ color: '#3b82f6' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>Como funciona o sistema de permissões?</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.6 }}>
                    • <strong>Administrador</strong>: Tem acesso total a tudo, sem restrições.<br />
                    • <strong>Membro</strong>: Novo usuário registrado não tem acesso a nada por padrão.<br />
                    • Você pode <strong>personalizar</strong> as permissões de cada membro individualmente.<br />
                    • Clique em um membro abaixo para gerenciar as permissões dele.
                </div>
            </Card>

            {/* Team Members Table */}
            <Card className="modern-card border-none" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Users size={18} style={{ color: '#3b82f6' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Membros da Equipe</span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>({members.length})</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="table-base" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Membro</th>
                                <th>Cargo</th>
                                <th>Permissões</th>
                                <th>Desde</th>
                                <th className="text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(member => (
                                <tr key={member.id} style={{ cursor: 'pointer' }} onClick={() => openMember(member)}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: member.role === 'admin' ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.7rem', flexShrink: 0 }}>
                                                {member.full_name?.substring(0, 2).toUpperCase() || '??'}
                                            </div>
                                            <div>
                                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{member.full_name}</span>
                                                {member.id === user?.id && <span style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: 700, marginLeft: '6px' }}>(Você)</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td>{getRoleBadge(member.role)}</td>
                                    <td>
                                        {member.role === 'admin' ? (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>Acesso Total</span>
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                                                {getPermCount(member.permissions)}/{PERMISSION_LABELS.length} módulos
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(member.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button onClick={e => { e.stopPropagation(); openMember(member); }} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <SettingsIcon size={12} /> Gerenciar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Edit Permissions Modal */}
            {selectedMember && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', padding: '1.5rem' }} onClick={() => setSelectedMember(null)}>
                    <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: selectedMember.role === 'admin' ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>
                                    {selectedMember.full_name?.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{selectedMember.full_name}</h2>
                                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Gerenciar permissões</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedMember(null)} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
                        </div>

                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Role Selector */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Cargo</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[
                                        { value: 'admin', label: 'Administrador', color: '#f59e0b', bg: '#fffbeb' },
                                        { value: 'membro', label: 'Membro', color: '#64748b', bg: '#f8fafc' },
                                    ].map(r => (
                                        <button key={r.value} onClick={() => {
                                            setEditRole(r.value);
                                            if (r.value === 'admin') grantAll();
                                        }} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: editRole === r.value ? `2px solid ${r.color}` : '1px solid #e2e8f0', background: editRole === r.value ? r.bg : '#fff', color: editRole === r.value ? r.color : '#64748b', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                                            {r.value === 'admin' && <Crown size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Permissions Grid */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Permissões de Acesso</label>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button onClick={grantAll} style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #d1fae5', background: '#ecfdf5', color: '#065f46', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>Marcar Todos</button>
                                        <button onClick={revokeAll} style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#991b1b', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>Desmarcar Todos</button>
                                    </div>
                                </div>

                                {editRole === 'admin' ? (
                                    <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '14px', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <ShieldCheck size={20} style={{ color: '#f59e0b' }} />
                                        <span style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 600 }}>
                                            Administradores têm acesso total automaticamente. Todas as permissões estão ativas.
                                        </span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {PERMISSION_LABELS.map(perm => {
                                            const isActive = editPerms[perm.key] === true;
                                            return (
                                                <button key={perm.key} onClick={() => togglePerm(perm.key)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', border: isActive ? `2px solid ${perm.color}` : '1px solid #e2e8f0', background: isActive ? `${perm.color}08` : '#fff', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: isActive ? perm.color : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                                                        {isActive ? <Check size={16} style={{ color: '#fff' }} /> : <X size={14} style={{ color: '#94a3b8' }} />}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isActive ? '#1e293b' : '#94a3b8', display: 'block' }}>{perm.label}</span>
                                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{perm.desc}</span>
                                                    </div>
                                                    <div style={{ width: '38px', height: '22px', borderRadius: '11px', background: isActive ? perm.color : '#e2e8f0', padding: '2px', transition: 'background 0.2s', flexShrink: 0 }}>
                                                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'transform 0.2s', transform: isActive ? 'translateX(16px)' : 'translateX(0)' }}></div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            {selectedMember.id !== user?.id ? (
                                <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s' }}>
                                    <Trash2 size={13} /> Excluir Membro
                                </button>
                            ) : <div />}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Button variant="outline" onClick={() => setSelectedMember(null)}>Cancelar</Button>
                                <Button onClick={savePermissions} isLoading={saving}>Salvar Permissões</Button>
                            </div>
                        </div>

                        {/* Delete Confirmation */}
                        {showDeleteConfirm && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '380px', width: '90%', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                        <Trash2 size={22} style={{ color: '#dc2626' }} />
                                    </div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 6px' }}>Excluir Membro?</h3>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 18px', lineHeight: 1.5 }}>
                                        Tem certeza que deseja excluir <strong>{selectedMember.full_name}</strong>? Esta ação não pode ser desfeita.
                                    </p>
                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                        <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
                                        <button onClick={deleteMember} disabled={deleting} style={{ padding: '8px 20px', borderRadius: '10px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>{deleting ? 'Excluindo...' : 'Sim, Excluir'}</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                , document.body)}
        </div>
    );
}
