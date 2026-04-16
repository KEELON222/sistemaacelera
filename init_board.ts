import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function initDefaultBoard() {
    console.log('Verificando se já existem boards...');
    const { data: boards, error: fetchError } = await supabase.from('boards').select('*');

    if (fetchError) {
        console.error('Erro ao buscar boards. O script SQL foi executado corretamente?', fetchError);
        return;
    }

    if (boards && boards.length > 0) {
        console.log('Já existe pelo menos um quadro (Board). Nenhuma ação necessária.');
        return;
    }

    console.log('Nenhum Board encontrado. Inserindo "Funil Comercial Principal"...');

    // Create Main Board
    const { data: newBoard, error: boardError } = await supabase
        .from('boards')
        .insert([{ title: 'Funil Comercial Principal' }])
        .select()
        .single();

    if (boardError || !newBoard) {
        console.error('Erro ao criar o board', boardError);
        return;
    }

    const boardId = newBoard.id;
    console.log(`Board criado! ID: ${boardId}. Inserindo estágios padrão...`);

    // Create Standard Stages mapped to legacy positions
    const stages = [
        { board_id: boardId, title: 'Contato Inicial', color: '#F59E0B', position_order: 1 },
        { board_id: boardId, title: 'Em Avaliação', color: '#2563EB', position_order: 2 },
        { board_id: boardId, title: 'Fechado/Ganho', color: '#10B981', position_order: 3 },
        { board_id: boardId, title: 'Perdido', color: '#EF4444', position_order: 4 },
    ];

    const { error: stagesError } = await supabase.from('board_stages').insert(stages);

    if (stagesError) {
        console.error('Erro ao criar colunas (stages)', stagesError);
        return;
    }

    console.log('✅ Estágios Padrões Criados com Sucesso!');

    // Migrate legacy deals to this board if they exist
    console.log('Migrando negócios antigos (Legacy) para o novo quadro...');

    // Buscar os deals que não tem stage_id
    const { data: legacyDeals } = await supabase.from('deals').select('*').is('stage_id', null);

    if (legacyDeals && legacyDeals.length > 0) {
        // Buscar os novos IDs dos stages baseados no título (mapeando a logica legado)
        const { data: newStages } = await supabase.from('board_stages').select('*').eq('board_id', boardId);

        const getStageIdByLegacyStatus = (status: string) => {
            if (!newStages) return null;
            if (status === 'contato') return newStages.find(s => s.title === 'Contato Inicial')?.id;
            if (status === 'avaliacao') return newStages.find(s => s.title === 'Em Avaliação')?.id;
            if (status === 'fechado') return newStages.find(s => s.title === 'Fechado/Ganho')?.id;
            if (status === 'perdido') return newStages.find(s => s.title === 'Perdido')?.id;
            return newStages[0]?.id; // Fallback to first
        };

        for (const deal of legacyDeals) {
            await supabase.from('deals').update({
                board_id: boardId,
                stage_id: getStageIdByLegacyStatus(deal.status)
            }).eq('id', deal.id);
        }
        console.log(`✅ ${legacyDeals.length} negócios migrados para os novos estágios!`);
    } else {
        console.log('Nenhum negócio de legado encontrado para mapear.');
    }

    console.log('🚀 Configuração inicial do Kanban V2 Concluída!');
}

initDefaultBoard();
