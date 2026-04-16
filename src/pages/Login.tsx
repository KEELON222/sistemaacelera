import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { LayoutDashboard } from 'lucide-react';
import './Login.css';

export function Login() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            role: 'reception_sales', // Default role for testing
                        },
                    },
                });
                if (error) throw error;

                // If successful registration, wait a small moment for trigger to create profile
                // Then generate code, set it, and send email.
                if (data.user) {
                    const code = Math.floor(100000 + Math.random() * 900000).toString();

                    // Add delay to ensure profile is created via DB trigger
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    const { error: profileError } = await supabase
                        .from('profiles')
                        .update({ verification_code: code, is_verified: false })
                        .eq('id', data.user.id);

                    if (profileError) console.error("Could not set verification code", profileError);

                    // Try calling Vercel Serverless Function to send email
                    try {
                        await fetch('/api/send-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ to: email, code })
                        });
                    } catch (emailErr) {
                        console.error("Failed to send email via proxy. Continuing to allow manual entry if code is known.", emailErr);
                    }

                    setIsSignUp(false);
                    // Force auth context to reload profile to capture code if possible
                    // And navigate directly to verify-email, passing code in state as backup
                    navigate('/verify-email', { state: { fallbackCode: code } });
                } else {
                    setError('Conta criada! Faça login agora.');
                    setIsSignUp(false);
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                navigate('/dashboard');
            }
        } catch (err: any) {
            let msg = err.message || 'Ocorreu um erro.';
            if (msg.toLowerCase().includes('invalid login credentials')) {
                msg = 'email ou senha incorreto';
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-wrapper">
                <div className="login-logo">
                    <LayoutDashboard size={40} className="text-primary" />
                    <h1>Acelerai</h1>
                </div>

                <Card className="login-card">
                    <CardHeader>
                        <CardTitle>{isSignUp ? 'Criar Conta' : 'Bem-vindo de volta'}</CardTitle>
                        <CardDescription>
                            {isSignUp ? 'Preencha os dados para registrar' : 'Insira suas credenciais para acessar o painel'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAuth} className="login-form">
                            {error && <div className="login-error">{error}</div>}

                            {isSignUp && (
                                <div className="form-group">
                                    <Input
                                        label="Nome Completo"
                                        type="text"
                                        placeholder="João Silva"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        required
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <Input
                                    label="Email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <Input
                                    label="Senha"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <Button type="submit" className="w-full mt-4" isLoading={loading}>
                                {isSignUp ? 'Registrar' : 'Entrar'}
                            </Button>

                            <div className="text-center mt-4">
                                <button
                                    type="button"
                                    className="login-toggle-btn"
                                    onClick={() => setIsSignUp(!isSignUp)}
                                >
                                    {isSignUp ? 'Já tem uma conta? Faça Login' : 'Não tem conta? Cadastre-se'}
                                </button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
