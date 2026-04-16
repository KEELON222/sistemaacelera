export type DealStatus = 'contato' | 'avaliacao' | 'fechado' | 'perdido';

export interface Client {
    id: string;
    name: string;
    description?: string;
    email: string | null;
    phone: string;
    origin: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface ClientComment {
    id: string;
    client_id: string;
    author_id: string | null;
    content: string;
    created_at: string;
    author?: {
        full_name: string;
        avatar_url: string | null;
    };
}

export interface ClientAttachment {
    id: string;
    client_id: string;
    author_id: string | null;
    file_url: string;
    file_name: string;
    niche: string;
    created_at: string;
    author?: {
        full_name: string;
        avatar_url: string | null;
    };
}

export interface Board {
    id: string;
    title: string;
    client_id?: string;
    created_at: string;
    client?: { name: string };
    archived?: boolean;
}

export interface BoardStage {
    id: string;
    board_id: string;
    title: string;
    color: string;
    position_order: number;
    created_at: string;
}

export interface BoardCustomTemplate {
    id: string;
    name: string;
    description?: string;
    icon: string;
    stages: { id: string; title: string; color: string }[];
    tags?: { id?: string; name: string; color: string; type: 'priority' | 'niche' }[];
    created_at: string;
}

export type CrmTagType = 'priority' | 'niche';

export interface CrmTag {
    id: string;
    name: string;
    color: string;
    type: CrmTagType;
    created_at: string;
}

export type SubtaskStatus = 'pendente' | 'em_desenvolvimento' | 'concluida';

export interface Subtask {
    id: string;
    title: string;
    completed: boolean;
    due_date?: string;
    assigned_to?: string;
    status: SubtaskStatus;
    description?: string;
    files?: { name: string; url: string; size: number }[];
}

export interface Deal {
    id: string;
    client_id: string;
    title: string;
    value: number;
    // Legacy support
    status: DealStatus;

    // New dynamic fields
    board_id?: string;
    stage_id?: string;
    description?: string;
    subtasks?: Subtask[];
    archived?: boolean;
    priority_tags?: string[];
    niche_tags?: string[];

    assigned_to: string | null;
    expected_close_date: string | null;
    created_at: string;
    updated_at: string;

    // Joined relation placeholder
    client?: Client;
}

export interface DocumentFolder {
    id: string;
    name: string;
    color: string;
    created_at: string;
}

export interface Document {
    id: string;
    folder_id: string;
    name: string;
    file_url: string;
    size_bytes: number;
    created_at: string;
}
