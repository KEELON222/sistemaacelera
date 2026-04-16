-- ==============================================================================
-- AUTOMAÇÃO DE KANBAN OPERACIONAL (CLIENTES -> DEALS -> PROJECTS)
-- ==============================================================================

-- 1️⃣ REGRA 1: ENTRADA (ESTÁGIO 1)
-- Quando um cliente é gerado/cadastrado, criar automaticamente um Card (Projeto) no Kanban Operacional
CREATE OR REPLACE FUNCTION trg_auto_create_project_for_new_client()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.projects (title, client_id, stage_id, status, created_at, updated_at)
    VALUES ('Onboarding - ' || NEW.name, NEW.id, 1, 'nao_iniciado', NOW(), NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_client_to_project ON public.clients;
CREATE TRIGGER trigger_client_to_project
AFTER INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION trg_auto_create_project_for_new_client();


-- 2️⃣ REGRA 2: VALIDAÇÃO ESTRATÉGICA (ESTÁGIO 2)
-- Quando uma Oportunidade (Venda/Deal) é criada para um cliente, move o projeto dele para o Estágio 2
CREATE OR REPLACE FUNCTION trg_move_project_to_stage2_on_deal()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.client_id IS NOT NULL THEN
        -- Move os projetos vinculados a este cliente para etapa 2, desde que estejam na etapa 1
        UPDATE public.projects 
        SET stage_id = 2, updated_at = NOW()
        WHERE client_id = NEW.client_id AND stage_id < 2;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deal_to_project_stage2 ON public.deals;
CREATE TRIGGER trigger_deal_to_project_stage2
AFTER INSERT ON public.deals
FOR EACH ROW
EXECUTE FUNCTION trg_move_project_to_stage2_on_deal();


-- 3️⃣ REGRAS 4, 5 e 6: IMPLEMENTAÇÃO, MONITORAMENTO E UPGRADE
-- Baseado na porcentagem de conclusão das "Subtarefas" (JSONB) dentro da Oportunidade (Deal)
CREATE OR REPLACE FUNCTION trg_update_project_stage_by_tasks()
RETURNS TRIGGER AS $$
DECLARE
    total_tasks INT;
    completed_tasks INT;
    calc_percent NUMERIC;
    new_stage INT;
BEGIN
    IF NEW.client_id IS NOT NULL AND NEW.subtasks IS NOT NULL THEN
        -- Conta o total de tarefas e quantas estão "concluida"
        SELECT 
            jsonb_array_length(NEW.subtasks),
            (SELECT count(*) FROM jsonb_array_elements(NEW.subtasks) as elem WHERE elem->>'status' = 'concluida')
        INTO total_tasks, completed_tasks;

        IF total_tasks > 0 THEN
            calc_percent := (completed_tasks::numeric / total_tasks::numeric) * 100.0;
            
            -- Aplica as Regras de Stage:
            IF calc_percent = 100.0 THEN
                new_stage := 6; -- Ajustes / Upgrade (100%)
            ELSIF calc_percent >= 75.0 THEN
                new_stage := 5; -- Monitoramento (>= 75%)
            ELSIF completed_tasks > 0 THEN
                new_stage := 4; -- Implementação (Pelo menos 1 concluída)
            ELSE
                new_stage := 2; -- Se voltou a ter 0 (Volta pra Validação caso não tenha projeto manual)
            END IF;

            -- Atualiza o projeto do cliente correspondente
            UPDATE public.projects 
            SET stage_id = GREATEST(stage_id, new_stage), updated_at = NOW()
            WHERE client_id = NEW.client_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deal_tasks_update_project ON public.deals;
CREATE TRIGGER trigger_deal_tasks_update_project
AFTER UPDATE OF subtasks ON public.deals
FOR EACH ROW
WHEN (OLD.subtasks IS DISTINCT FROM NEW.subtasks)
EXECUTE FUNCTION trg_update_project_stage_by_tasks();
