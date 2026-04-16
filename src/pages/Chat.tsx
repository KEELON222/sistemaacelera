import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, Users, User, Hash, MessageSquare } from 'lucide-react';

interface ChatMessage {
    id: string;
    sender_id: string;
    sender_name: string;
    channel: string;
    content: string;
    created_at: string;
    read_by?: string[];
}

// WhatsApp-style check marks
const CheckSingle = () => (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><path d="M11.5 1L5.5 8.5L2 5.5" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const CheckDouble = ({ read }: { read: boolean }) => (
    <svg width="20" height="11" viewBox="0 0 20 11" fill="none">
        <path d="M11.5 1L5.5 8.5L2 5.5" stroke={read ? '#3b82f6' : '#94a3b8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 1L9.5 8.5L7 6.5" stroke={read ? '#3b82f6' : '#94a3b8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export function Chat() {
    const { user, profile } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [activeChannel, setActiveChannel] = useState('geral');
    const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const getDmChannel = (recipientId: string) => {
        if (!user) return '';
        const ids = [user.id, recipientId].sort();
        return `dm_${ids[0]}_${ids[1]}`;
    };

    const getActiveDbChannel = () => activeChannel === 'geral' ? 'geral' : getDmChannel(activeChannel);

    useEffect(() => {
        const loadTeam = async () => {
            const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
            setTeamMembers(data?.filter(m => m.id !== user?.id) || []);
        };
        loadTeam();
    }, [user?.id]);

    useEffect(() => {
        fetchMessages();
        const ch = getActiveDbChannel();
        const sub = supabase.channel(`chat-page-${ch}-${Date.now()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `channel=eq.${ch}` }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const msg = payload.new as ChatMessage;
                    // Skip own messages (already added optimistically)
                    if (msg.sender_id === user?.id) return;
                    setMessages(prev => [...prev, msg]);
                } else if (payload.eventType === 'UPDATE') {
                    const updated = payload.new as ChatMessage;
                    setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, read_by: updated.read_by } : m));
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [activeChannel, user?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Mark messages as read when viewing
    useEffect(() => {
        if (!user || messages.length === 0) return;
        const unreadIds = messages
            .filter(m => m.sender_id !== user.id && !(m.read_by || []).includes(user.id) && !m.id.startsWith('temp-'))
            .map(m => m.id);
        if (unreadIds.length === 0) return;

        const markRead = async () => {
            for (const id of unreadIds) {
                const msg = messages.find(m => m.id === id);
                const currentReadBy = msg?.read_by || [];
                if (!currentReadBy.includes(user.id)) {
                    await supabase.from('chat_messages').update({
                        read_by: [...currentReadBy, user.id]
                    }).eq('id', id);
                }
            }
        };
        markRead();
    }, [messages, user?.id]);

    const fetchMessages = async () => {
        setLoading(true);
        const ch = getActiveDbChannel();
        const { data } = await supabase.from('chat_messages').select('*').eq('channel', ch).order('created_at', { ascending: true }).limit(100);
        setMessages(data || []);
        setLoading(false);
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !user) return;
        const ch = getActiveDbChannel();
        const content = newMessage.trim();

        // Optimistic update
        const optimisticMsg: ChatMessage = {
            id: `temp-${Date.now()}`,
            sender_id: user.id,
            sender_name: profile?.full_name || 'Usuário',
            channel: ch, content,
            created_at: new Date().toISOString(),
            read_by: [],
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');
        inputRef.current?.focus();

        const { data } = await supabase.from('chat_messages').insert([{
            sender_id: user.id, sender_name: profile?.full_name || 'Usuário',
            channel: ch, content,
        }]).select().single();

        // Replace temp with real message
        if (data) {
            setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const getInitials = (name: string) => name?.substring(0, 2).toUpperCase() || '??';
    const activeChannelName = activeChannel === 'geral' ? 'Chat Geral' : teamMembers.find(m => m.id === activeChannel)?.full_name || 'Conversa';

    const renderReadStatus = (msg: ChatMessage) => {
        if (msg.sender_id !== user?.id) return null;
        const isTemp = msg.id.startsWith('temp-');
        const readBy = (msg.read_by || []).filter(id => id !== user?.id);
        if (isTemp) return <CheckSingle />;
        if (readBy.length > 0) return <CheckDouble read={true} />;
        return <CheckDouble read={false} />;
    };

    return (
        <div style={{ display: 'flex', height: '100%', gap: '0', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#fff' }}>
            {/* Sidebar */}
            <div style={{ width: '260px', background: '#f8fafc', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={18} style={{ color: '#3b82f6' }} /> Comunicação
                    </h2>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                    <p style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 8px', margin: '0 0 2px' }}>Canais</p>
                    <button onClick={() => setActiveChannel('geral')}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeChannel === 'geral' ? '#eff6ff' : 'transparent', color: activeChannel === 'geral' ? '#3b82f6' : '#475569', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', marginBottom: '4px' }}>
                        <Hash size={16} /> Chat Geral
                    </button>
                    <p style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 8px', margin: '10px 0 2px' }}>Mensagens Diretas</p>
                    {teamMembers.map(member => (
                        <button key={member.id} onClick={() => setActiveChannel(member.id)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', border: 'none', background: activeChannel === member.id ? '#eff6ff' : 'transparent', color: activeChannel === member.id ? '#3b82f6' : '#475569', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', marginBottom: '2px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: activeChannel === member.id ? '#3b82f6' : '#e2e8f0', color: activeChannel === member.id ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, flexShrink: 0 }}>
                                {getInitials(member.full_name)}
                            </div>
                            {member.full_name}
                        </button>
                    ))}
                    {teamMembers.length === 0 && <p style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '8px 12px', fontStyle: 'italic' }}>Nenhum colega encontrado.</p>}
                </div>
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {activeChannel === 'geral' ? <Users size={18} style={{ color: '#3b82f6' }} /> : <User size={18} style={{ color: '#8b5cf6' }} />}
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>{activeChannelName}</span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fafbfc' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.85rem' }}>Carregando mensagens...</div>
                    ) : messages.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                            <MessageSquare size={40} style={{ opacity: 0.2, marginBottom: '10px' }} />
                            <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Nenhuma mensagem ainda</p>
                            <p style={{ fontSize: '0.75rem' }}>Envie a primeira mensagem!</p>
                        </div>
                    ) : (
                        messages.map(msg => {
                            const isMe = msg.sender_id === user?.id;
                            return (
                                <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: '8px' }}>
                                    {!isMe && (
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.6rem', fontWeight: 800, flexShrink: 0, marginTop: '2px' }}>
                                            {getInitials(msg.sender_name)}
                                        </div>
                                    )}
                                    <div style={{ maxWidth: '65%' }}>
                                        {!isMe && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', marginBottom: '2px', display: 'block' }}>{msg.sender_name}</span>}
                                        <div style={{ padding: '10px 14px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: isMe ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#fff', color: isMe ? '#fff' : '#1e293b', fontSize: '0.85rem', lineHeight: 1.4, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: isMe ? 'none' : '1px solid #f1f5f9' }}>
                                            {msg.content}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                            <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                                                {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {renderReadStatus(msg)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px', background: '#fff' }}>
                    <input ref={inputRef} value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder="Digite sua mensagem..."
                        style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 16px', fontSize: '0.85rem', outline: 'none', color: '#1e293b', background: '#f8fafc' }} />
                    <button onClick={sendMessage}
                        style={{ width: '42px', height: '42px', borderRadius: '12px', border: 'none', background: newMessage.trim() ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#e2e8f0', color: newMessage.trim() ? '#fff' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
