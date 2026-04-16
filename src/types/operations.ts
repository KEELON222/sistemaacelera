import { Client } from './crm';

export type ProjectStatus = 'nao_iniciado' | 'em_andamento' | 'aguardando_cliente' | 'concluido' | 'bloqueado';

export interface Project {
    id: string;
    client_id: string;
    deal_id?: string;
    title: string;
    description?: string;
    stage_id: number; // 1 to 6
    status: ProjectStatus;
    priority_tags?: string[];
    assigned_to?: string;
    start_date?: string;
    deadline?: string;
    created_at: string;
    updated_at: string;
    client?: Client;
}

export const PROJECT_STAGES = [
    { id: 1, title: '1. Entrada', color: '#6366f1', description: 'Novo cliente ou demanda' },
    { id: 2, title: '2. Validação Estratégica', color: '#f59e0b', description: 'Alinhamento & Aprovação' },
    { id: 3, title: '3. Execução Operacional', color: '#3b82f6', description: 'Implementação das ações' },
    { id: 4, title: '4. Implementação', color: '#8b5cf6', description: 'Publicação & Ativação' },
    { id: 5, title: '5. Monitoramento', color: '#10b981', description: 'Acompanhamento de resultados' },
    { id: 6, title: '6. Ajustes / Upgrade', color: '#ec4899', description: 'Otimização contínua' }
];

export const PRIORITY_TAGS = [
    { id: 'critico', label: 'Ponto Crítico', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    { id: 'financeiro', label: 'Financeiro', color: 'bg-green-100 text-green-800 border-green-200' },
    { id: 'bloqueio', label: 'Bloqueio Potencial', color: 'bg-red-100 text-red-800 border-red-200' },
    { id: 'dependencia', label: 'Aguardando Cliente', color: 'bg-gray-100 text-gray-800 border-gray-200' }
];
