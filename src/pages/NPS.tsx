import { Card, CardContent } from '../components/ui/Card';
import { Star } from 'lucide-react';

export function NPS() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Pós-Venda e Retenção</h1>
                    <p className="text-muted text-sm">Pesquisas NPS e automações</p>
                </div>
            </div>

            <Card className="flex-1 flex items-center justify-center bg-surface-hover">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted">
                    <Star size={64} className="mb-4 opacity-20" />
                    <p className="font-medium text-lg text-main">Módulo NPS</p>
                    <p className="text-sm">Dashboard de pontuação NPS e disparo de pesquisas para a carteira de clientes.</p>
                </CardContent>
            </Card>
        </div>
    );
}
