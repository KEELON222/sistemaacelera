import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
    Menu, X, Search, Moon, Sun, Bell, Camera,
    LayoutDashboard, Users, KanbanSquare,
    MessageSquare, Wallet, Star, LogOut, Plus, Layers,
    Send, Hash, User, ChevronLeft, Settings, Check, FolderArchive
} from 'lucide-react';
import { Button } from '../ui/Button';
import './DashboardLayout.css';

interface FloatingMessage {
    id: string;
    sender_id: string;
    sender_name: string;
    channel: string;
    content: string;
    created_at: string;
}

interface Notification {
    id: string; user_id: string; title: string; message: string;
    type: string; is_read: boolean; link?: string; created_at: string;
}

export function DashboardLayout() {
    const { user, profile, signOut } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Dark Mode
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

    // Profile Popup
    const [showProfile, setShowProfile] = useState(false);
    const [editName, setEditName] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    // Notifications
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifs, setShowNotifs] = useState(false);

    // Floating Chat
    const [chatOpen, setChatOpen] = useState(false);
    const [chatChannel, setChatChannel] = useState('geral');
    const [chatView, setChatView] = useState<'list' | 'chat'>('list');
    const [chatMessages, setChatMessages] = useState<FloatingMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string }[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    // Dark mode effect
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    // Fetch notifications
    useEffect(() => {
        if (!user) return;
        const loadNotifs = async () => {
            const { data } = await supabase.from('notifications').select('*')
                .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
            setNotifications(data || []);
        };
        loadNotifs();
        const sub = supabase.channel('notif-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
                const n = payload.new as Notification;
                if (n.user_id === user.id) setNotifications(prev => [n, ...prev]);
            }).subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [user?.id]);

    const unreadNotifs = notifications.filter(n => !n.is_read).length;

    const markAllRead = async () => {
        if (!user) return;
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const timeAgo = (date: string) => {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Agora';
        if (mins < 60) return `${mins}min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    };

    // Profile save
    const saveProfile = async () => {
        if (!user || !editName.trim()) return;
        setSavingProfile(true);
        await supabase.from('profiles').update({ full_name: editName.trim() }).eq('id', user.id);
        setSavingProfile(false);
        setShowProfile(false);
        window.location.reload();
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        const ext = file.name.split('.').pop();
        const path = `avatars/${user.id}.${ext}`;
        await supabase.storage.from('avatars').upload(path, file, { upsert: true });
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
        window.location.reload();
    };

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (profile && !profile.is_verified) {
        return <Navigate to="/verify-email" replace />;
    }

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const closeSidebar = () => setSidebarOpen(false);

    const allNavItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Painel', permKey: 'dashboard' },
        { to: '/crm', icon: KanbanSquare, label: 'Quadro de Projetos', permKey: 'crm' },
        { to: '/clients', icon: Users, label: 'Clientes', permKey: 'clients' },
        { to: '/operacoes', icon: Layers, label: 'Operações', permKey: 'operations' },
        { to: '/finance', icon: Wallet, label: 'Financeiro', permKey: 'finance' },
        { to: '/chat', icon: MessageSquare, label: 'Comunicação', permKey: 'chat' },
        { to: '/documents', icon: FolderArchive, label: 'Documentos', permKey: 'documents' },
        { to: '/nps', icon: Star, label: 'Pós-Venda', permKey: 'nps' },
    ];

    const isAdmin = profile?.role === 'admin';
    const userPerms = profile?.permissions || {} as any;

    const navItems = isAdmin ? allNavItems : allNavItems.filter(item => userPerms[item.permKey] === true);
    const canSeeSettings = isAdmin || userPerms.settings === true;

    const getDmChannel = (recipientId: string) => {
        if (!user) return '';
        const ids = [user.id, recipientId].sort();
        return `dm_${ids[0]}_${ids[1]}`;
    };

    const getInitials = (name: string) => name?.substring(0, 2).toUpperCase() || '??';

    // Fetch team members for floating chat
    useEffect(() => {
        const loadTeam = async () => {
            const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
            setTeamMembers(data?.filter(m => m.id !== user?.id) || []);
        };
        loadTeam();
    }, [user?.id]);

    // Fetch messages when channel changes or chat opens
    useEffect(() => {
        if (!chatOpen || chatView !== 'chat') return;

        const ch = chatChannel === 'geral' ? 'geral' : getDmChannel(chatChannel);

        const loadMessages = async () => {
            const { data } = await supabase.from('chat_messages').select('*').eq('channel', ch).order('created_at', { ascending: true }).limit(50);
            setChatMessages(data || []);
        };
        loadMessages();

        const sub = supabase.channel(`float-chat-${ch}-${Date.now()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `channel=eq.${ch}` }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const msg = payload.new as FloatingMessage;
                    // Skip own messages (already added optimistically)
                    if (msg.sender_id === user?.id) return;
                    setChatMessages(prev => [...prev, msg]);
                } else if (payload.eventType === 'UPDATE') {
                    const updated = payload.new as FloatingMessage;
                    setChatMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(sub); };
    }, [chatOpen, chatView, chatChannel, user?.id]);

    // Listen for new messages globally (for unread count)
    useEffect(() => {
        const sub = supabase.channel('float-chat-unread')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
                const msg = payload.new as FloatingMessage;
                if (msg.sender_id !== user?.id && !chatOpen) {
                    setUnreadCount(prev => prev + 1);
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [chatOpen, user?.id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const sendFloatingMessage = async () => {
        if (!chatInput.trim() || !user) return;
        const ch = chatChannel === 'geral' ? 'geral' : getDmChannel(chatChannel);
        const content = chatInput.trim();

        const optimisticMsg: FloatingMessage = {
            id: `temp-${Date.now()}`, sender_id: user.id,
            sender_name: profile?.full_name || 'Usuário',
            channel: ch, content, created_at: new Date().toISOString(),
        };
        setChatMessages(prev => [...prev, optimisticMsg]);
        setChatInput('');
        chatInputRef.current?.focus();

        const { data } = await supabase.from('chat_messages').insert([{
            sender_id: user.id, sender_name: profile?.full_name || 'Usuário',
            channel: ch, content,
        }]).select().single();

        if (data) setChatMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
    };

    const openChat = () => {
        setChatOpen(true);
        setUnreadCount(0);
    };

    const openChannel = (ch: string) => {
        setChatChannel(ch);
        setChatView('chat');
    };

    const activeChannelName = chatChannel === 'geral' ? 'Chat Geral' : teamMembers.find(m => m.id === chatChannel)?.full_name || 'Conversa';

    return (
        <div className="layout-container">
            {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo"><div className="logo-icon"></div></div>
                </div>
                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink key={item.to} title={item.to} to={item.to} onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <item.icon size={22} strokeWidth={1.5} />
                        </NavLink>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    {canSeeSettings && (
                        <NavLink to="/settings" onClick={closeSidebar} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Configurações">
                            <Settings size={22} strokeWidth={1.5} />
                        </NavLink>
                    )}
                    <button onClick={signOut} className="nav-item logout" title="Sair"><LogOut size={22} strokeWidth={1.5} /></button>
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <div className="topbar-left">
                        <button className="mobile-menu-btn" onClick={toggleSidebar}><Menu size={24} /></button>
                        <div className="brand-name hide-on-mobile">Acelerai</div>
                        <div className="search-container hide-on-mobile">
                            <Search size={18} className="search-icon" />
                            <input type="text" placeholder="Buscar leads, cotações, clientes..." className="search-input" />
                        </div>
                        <button className="btn-circle-primary ml-2"><Plus size={18} /></button>
                    </div>
                    <div className="topbar-right">
                        {/* Dark Mode Toggle */}
                        <button className="icon-btn" onClick={() => setDarkMode(!darkMode)} title={darkMode ? 'Modo Claro' : 'Modo Escuro'}>
                            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        {/* Notifications */}
                        <div style={{ position: 'relative' }}>
                            <button className="icon-btn position-relative" onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }}>
                                <Bell size={20} />
                                {unreadNotifs > 0 && <span className="notification-dot"></span>}
                            </button>
                            {showNotifs && (
                                <div style={{ position: 'absolute', right: 0, top: '48px', width: '360px', maxHeight: '420px', background: 'var(--color-surface)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid var(--color-border)', zIndex: 9999, overflow: 'hidden', animation: 'dropdownFadeIn 0.2s ease-out' }}>
                                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>Notificações</span>
                                        {unreadNotifs > 0 && (
                                            <button onClick={markAllRead} style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Check size={12} /> Marcar todas como lidas
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Nenhuma notificação</div>
                                        ) : notifications.map(n => (
                                            <div key={n.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '10px', alignItems: 'flex-start', background: n.is_read ? 'transparent' : 'var(--color-primary-light)', cursor: 'pointer', transition: 'background 0.1s' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: n.is_read ? 'transparent' : '#3b82f6', flexShrink: 0, marginTop: '6px' }}></div>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: n.is_read ? 500 : 700, color: 'var(--color-text-main)', display: 'block' }}>{n.title}</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>{n.message}</span>
                                                </div>
                                                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600, flexShrink: 0 }}>{timeAgo(n.created_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Avatar / Profile */}
                        <div style={{ position: 'relative' }}>
                            <div className="user-avatar ms-2" style={{ cursor: 'pointer', backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', color: profile?.avatar_url ? 'transparent' : 'white' }} onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); setEditName(profile?.full_name || ''); }}>
                                {profile?.full_name?.substring(0, 2).toUpperCase() || 'US'}
                            </div>
                            {showProfile && (
                                <div style={{ position: 'absolute', right: 0, top: '52px', width: '300px', background: 'var(--color-surface)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid var(--color-border)', zIndex: 9999, overflow: 'hidden', animation: 'dropdownFadeIn 0.2s ease-out' }}>
                                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)', background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-surface))' }}>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : '#FF71A4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: profile?.avatar_url ? 'transparent' : 'white', fontWeight: 800, fontSize: '1.2rem', border: '3px solid var(--color-surface)' }}>
                                                {profile?.full_name?.substring(0, 2).toUpperCase() || 'US'}
                                            </div>
                                            <label style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '24px', height: '24px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--color-surface)' }}>
                                                <Camera size={12} style={{ color: '#fff' }} />
                                                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                                            </label>
                                        </div>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{profile?.full_name}</span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{user?.email}</span>
                                    </div>
                                    <div style={{ padding: '14px' }}>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Nome</label>
                                        <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.85rem', color: 'var(--color-text-main)', background: 'var(--color-surface-hover)', outline: 'none' }} />
                                        <button onClick={saveProfile} disabled={savingProfile} style={{ width: '100%', marginTop: '10px', padding: '8px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', border: 'none' }}>
                                            {savingProfile ? 'Salvando...' : 'Salvar Nome'}
                                        </button>
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px' }}>
                                        <button onClick={signOut} style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                                            <LogOut size={16} /> Sair da Conta
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="content-area">
                    <div className="content-card">
                        <Outlet />
                    </div>
                </div>
            </main>

            {/* =================== FLOATING CHAT WIDGET =================== */}
            {/* FAB Button */}
            {!chatOpen && (
                <button onClick={openChat} style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 99990,
                    width: '56px', height: '56px', borderRadius: '50%', border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff',
                    cursor: 'pointer', boxShadow: '0 8px 30px rgba(59,130,246,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.1)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                >
                    <MessageSquare size={24} />
                    {unreadCount > 0 && (
                        <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '22px', height: '22px', borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Chat Window */}
            {chatOpen && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 99990,
                    width: '380px', height: '520px', borderRadius: '20px',
                    background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    animation: 'chatSlideUp 0.25s ease-out'
                }}>
                    {/* Header */}
                    <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {chatView === 'chat' && (
                                <button onClick={() => setChatView('list')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '4px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
                                    <ChevronLeft size={18} />
                                </button>
                            )}
                            <MessageSquare size={18} />
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{chatView === 'list' ? 'Comunicação' : activeChannelName}</span>
                        </div>
                        <button onClick={() => setChatOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '4px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
                            <X size={18} />
                        </button>
                    </div>

                    {chatView === 'list' ? (
                        /* Channel List */
                        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', padding: '6px 8px', margin: 0 }}>Canais</p>
                            <button onClick={() => openChannel('geral')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: '#eff6ff', color: '#3b82f6', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', marginBottom: '6px' }}>
                                <Hash size={16} /> Chat Geral
                            </button>

                            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', padding: '6px 8px', margin: '8px 0 0' }}>Equipe</p>
                            {teamMembers.map(m => (
                                <button key={m.id} onClick={() => openChannel(m.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#475569', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', marginBottom: '2px', transition: 'background 0.1s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, flexShrink: 0 }}>
                                        {getInitials(m.full_name)}
                                    </div>
                                    {m.full_name}
                                </button>
                            ))}
                        </div>
                    ) : (
                        /* Chat Messages */
                        <>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px', background: '#fafbfc' }}>
                                {chatMessages.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8', fontSize: '0.8rem' }}>Envie a primeira mensagem! 💬</div>
                                ) : chatMessages.map(msg => {
                                    const isMe = msg.sender_id === user?.id;
                                    const isTemp = msg.id.startsWith('temp-');
                                    const readBy = ((msg as any).read_by || []).filter((id: string) => id !== user?.id);
                                    return (
                                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: '6px' }}>
                                            {!isMe && (
                                                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.5rem', fontWeight: 800, flexShrink: 0, marginTop: '2px' }}>
                                                    {getInitials(msg.sender_name)}
                                                </div>
                                            )}
                                            <div style={{ maxWidth: '70%' }}>
                                                {!isMe && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '1px' }}>{msg.sender_name}</span>}
                                                <div style={{ padding: '8px 12px', borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: isMe ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#fff', color: isMe ? '#fff' : '#1e293b', fontSize: '0.8rem', lineHeight: 1.35, border: isMe ? 'none' : '1px solid #f1f5f9' }}>
                                                    {msg.content}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                                    <span style={{ fontSize: '0.5rem', color: '#94a3b8' }}>
                                                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {isMe && (
                                                        isTemp ? (
                                                            <svg width="14" height="9" viewBox="0 0 16 11" fill="none"><path d="M11.5 1L5.5 8.5L2 5.5" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                        ) : readBy.length > 0 ? (
                                                            <svg width="16" height="9" viewBox="0 0 20 11" fill="none"><path d="M11.5 1L5.5 8.5L2 5.5" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M15.5 1L9.5 8.5L7 6.5" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                        ) : (
                                                            <svg width="16" height="9" viewBox="0 0 20 11" fill="none"><path d="M11.5 1L5.5 8.5L2 5.5" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M15.5 1L9.5 8.5L7 6.5" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>

                            <div style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
                                <input ref={chatInputRef} value={chatInput} onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFloatingMessage(); } }}
                                    placeholder="Mensagem..." style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 14px', fontSize: '0.8rem', outline: 'none', color: '#1e293b', background: '#f8fafc' }} />
                                <button onClick={sendFloatingMessage} style={{ width: '36px', height: '36px', borderRadius: '10px', border: 'none', background: chatInput.trim() ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#e2e8f0', color: chatInput.trim() ? '#fff' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Send size={16} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            <style>{`
                @keyframes chatSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
