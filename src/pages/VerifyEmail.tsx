import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { MailCheck, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './VerifyEmail.css';

export function VerifyEmail() {
    const { user, profile, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Fallback code from navigation state right after signup
    const fallbackCode = location.state?.fallbackCode;

    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                navigate('/login');
            } else if (profile?.is_verified) {
                navigate('/dashboard');
            }
        }
    }, [user, profile, authLoading, navigate]);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Check against profile or fallback code
            const validCode = profile?.verification_code || fallbackCode;

            if (!validCode) {
                // If profile hasn't loaded properly yet, retry fetching it first
                const { data } = await supabase.from('profiles').select('verification_code').eq('id', user?.id).single();
                if (!data?.verification_code) {
                    throw new Error("Perfil não encontrado ou código não gerado.");
                }

                if (code !== data.verification_code) {
                    throw new Error("Código incorreto. Tente novamente.");
                }
            } else if (code !== validCode) {
                throw new Error("Código incorreto. Tente novamente.");
            }

            // Update user to verified
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ is_verified: true, verification_code: null })
                .eq('id', user?.id);

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => {
                navigate('/dashboard');
                // Force a reload so auth context re-fetches profile properly
                window.location.reload();
            }, 1500);

        } catch (err: any) {
            setError(err.message || 'Erro ao verificar o código.');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || success) {
        return (
            <div className="verify-container">
                <div className="verify-wrapper">
                    <Card className="verify-card">
                        <CardContent className="flex flex-col items-center justify-center p-8">
                            {success ? (
                                <>
                                    <MailCheck size={48} className="text-green-500 mb-4" />
                                    <h2 className="text-xl font-semibold">Email verificado com sucesso!</h2>
                                    <p className="text-sm text-gray-500 mt-2">Redirecionando para o painel...</p>
                                </>
                            ) : (
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="verify-container">
            <div className="verify-wrapper">
                <div className="verify-header text-center mb-6 relative">
                    <button
                        onClick={async () => { await signOut(); navigate('/login'); }}
                        className="absolute left-0 top-0 p-2 text-gray-500 hover:text-gray-800 transition-colors"
                        title="Sair e voltar ao Login"
                    >
                        <LogOut size={24} />
                    </button>
                    <MailCheck size={48} className="text-primary mx-auto mb-4" />
                    <h1 className="text-2xl font-bold">Verifique seu Email</h1>
                </div>

                <Card className="verify-card">
                    <CardHeader>
                        <CardTitle>Código de Verificação</CardTitle>
                        <CardDescription>
                            Enviamos um código de 6 dígitos para <strong>{user?.email}</strong>.
                            Por favor, insira o código abaixo para acessar o sistema.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleVerify} className="verify-form">
                            {error && <div className="verify-error p-3 mb-4 rounded-md bg-red-50 text-red-600 text-sm border border-red-200">{error}</div>}

                            <div className="form-group mb-4">
                                <Input
                                    label="Código de 6 dígitos"
                                    type="text"
                                    placeholder="000000"
                                    maxLength={6}
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    required
                                    className="text-center text-xl tracking-widest font-mono"
                                />
                            </div>

                            <Button type="submit" className="w-full" isLoading={loading}>
                                Verificar
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
