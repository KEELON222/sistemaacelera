import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { CRM } from './pages/CRM';
import { Operations } from './pages/Operations';
import { Finance } from './pages/Finance';
import { Clients } from './pages/Clients';
import { Chat } from './pages/Chat';
import { NPS } from './pages/NPS';
import { Settings } from './pages/Settings';
import { VerifyEmail } from './pages/VerifyEmail';
import { Documents } from './pages/Documents';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/operacoes" element={<Operations />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/nps" element={<NPS />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
