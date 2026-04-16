import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { DocumentFolder, Document as CrmDocument } from '../types/crm';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { 
    Folder, File, Plus, Search, MoreVertical, 
    Trash2, Download, ChevronRight, Upload, X,
    FolderPlus, FileText, Image, FileArchive, ArrowLeft
} from 'lucide-react';
import './Documents.css';

export function Documents() {
    const [folders, setFolders] = useState<DocumentFolder[]>([]);
    const [files, setFiles] = useState<CrmDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentFolder, setCurrentFolder] = useState<DocumentFolder | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchFolders();
        fetchFiles();
    }, [currentFolder]);

    const fetchFolders = async () => {
        try {
            const { data, error } = await supabase
                .from('document_folders')
                .select('*')
                .order('name');
            if (error) throw error;
            setFolders(data || []);
        } catch (error) {
            console.error('Error fetching folders:', error);
        }
    };

    const fetchFiles = async () => {
        try {
            setLoading(true);
            let query = supabase.from('documents').select('*');
            
            if (currentFolder) {
                query = query.eq('folder_id', currentFolder.id);
            } else {
                query = query.is('folder_id', null);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setFiles(data || []);
        } catch (error) {
            console.error('Error fetching files:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            const { error } = await supabase
                .from('document_folders')
                .insert([{ name: newFolderName.trim() }]);
            if (error) throw error;
            setNewFolderName('');
            setIsFolderModalOpen(false);
            fetchFolders();
        } catch (error) {
            console.error('Error creating folder:', error);
        }
    };

    const handleDeleteFolder = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm('Tem certeza que deseja excluir esta pasta e todos os seus arquivos?')) return;
        try {
            const { error } = await supabase
                .from('document_folders')
                .delete()
                .eq('id', id);
            if (error) throw error;
            fetchFolders();
        } catch (error) {
            console.error('Error deleting folder:', error);
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
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const sanitizedName = sanitizeFileName(file.name);
            const fileName = `${Date.now()}_${sanitizedName}`;
            const filePath = `documents/${fileName}`;

            // Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('deal-files') // Reusing existing bucket for consistency or use 'documents' if exists
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: urlData } = supabase.storage
                .from('deal-files')
                .getPublicUrl(filePath);

            // Save to DB
            const { error: dbError } = await supabase
                .from('documents')
                .insert([{
                    name: file.name,
                    file_url: urlData.publicUrl,
                    folder_id: currentFolder?.id || null,
                    size_bytes: file.size
                }]);

            if (dbError) throw dbError;
            fetchFiles();
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Erro ao fazer upload do arquivo.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteFile = async (id: string, url: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este documento?')) return;
        try {
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', id);
            if (error) throw error;
            fetchFiles();
        } catch (error) {
            console.error('Error deleting file:', error);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (name: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext || '')) return <Image size={20} />;
        if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return <FileText size={20} />;
        if (['zip', 'rar', '7z'].includes(ext || '')) return <FileArchive size={20} />;
        return <File size={20} />;
    };

    const filteredFiles = files.filter(f => 
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="documents-container">
            <div className="documents-header">
                <div>
                    <h1 className="documents-title">Documentos</h1>
                    <p className="documents-subtitle">Gerencie suas pastas e arquivos corporativos</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Button variant="outline" onClick={() => setIsFolderModalOpen(true)}>
                        <FolderPlus size={18} /> Nova Pasta
                    </Button>
                    <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        <Upload size={18} /> {uploading ? 'Enviando...' : 'Fazer Upload'}
                    </Button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleFileUpload}
                    />
                </div>
            </div>

            <div className="breadcrumb">
                <span className="breadcrumb-item" onClick={() => setCurrentFolder(null)}>Documentos</span>
                {currentFolder && (
                    <>
                        <ChevronRight size={16} className="breadcrumb-separator" />
                        <span className="breadcrumb-item">{currentFolder.name}</span>
                    </>
                )}
            </div>

            {/* Folder Grid - Only show in root or if we want nested folders later */}
            {!currentFolder && (
                <div className="grid-section">
                    <h2 className="section-title"><Folder size={18} /> Pastas</h2>
                    <div className="folders-grid">
                        {folders.map(folder => (
                            <div key={folder.id} className="folder-card" onClick={() => setCurrentFolder(folder)}>
                                <div className="folder-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                                    <Folder size={24} fill="#3b82f6" />
                                </div>
                                <div className="folder-info">
                                    <div className="folder-name">{folder.name}</div>
                                </div>
                                <button className="action-btn delete" onClick={(e) => handleDeleteFolder(e, folder.id)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    {folders.length === 0 && (
                        <div className="empty-state">
                            <Folder size={48} className="empty-icon" />
                            <p>Nenhuma pasta criada ainda.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Files Section */}
            <div className="grid-section">
                <h2 className="section-title">
                    {currentFolder ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button className="action-btn" onClick={() => setCurrentFolder(null)} style={{ padding: '4px' }}>
                                <ArrowLeft size={18} />
                            </button>
                            <span>Arquivos em "{currentFolder.name}"</span>
                        </div>
                    ) : (
                        <><FileText size={18} /> Arquivos Recentes</>
                    )}
                </h2>
                
                <div className="files-list">
                    <div className="file-row-header">
                        <span>Nome</span>
                        <span>Tamanho</span>
                        <span>Data</span>
                        <span style={{ textAlign: 'right' }}>Ações</span>
                    </div>
                    
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
                    ) : filteredFiles.length === 0 ? (
                        <div className="empty-state">
                            <File size={48} className="empty-icon" />
                            <p>Nenhum arquivo encontrado.</p>
                        </div>
                    ) : filteredFiles.map(file => (
                        <div key={file.id} className="file-row">
                            <div className="file-name-cell">
                                <div className="file-icon">
                                    {getFileIcon(file.name)}
                                </div>
                                <span title={file.name} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {file.name}
                                </span>
                            </div>
                            <div style={{ color: '#64748b' }}>{formatSize(file.size_bytes)}</div>
                            <div style={{ color: '#64748b' }}>{new Date(file.created_at).toLocaleDateString()}</div>
                            <div className="file-actions">
                                <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="action-btn">
                                    <Download size={16} />
                                </a>
                                <button className="action-btn delete" onClick={() => handleDeleteFile(file.id, file.file_url)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* New Folder Modal */}
            {isFolderModalOpen && createPortal(
                <div className="modal-overlay" onClick={() => setIsFolderModalOpen(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <div className="modal-header-left">
                                <div className="modal-icon-wrap" style={{ background: '#3b82f6' }}><FolderPlus size={20} /></div>
                                <div>
                                    <h2 className="modal-title">Nova Pasta</h2>
                                    <p className="modal-desc">Crie uma pasta para organizar arquivos</p>
                                </div>
                            </div>
                            <button className="modal-close-btn" onClick={() => setIsFolderModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nome da Pasta</label>
                                <input 
                                    className="form-input" 
                                    placeholder="Ex: Contratos, Design..." 
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <Button variant="outline" onClick={() => setIsFolderModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleCreateFolder}>Criar Pasta</Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

