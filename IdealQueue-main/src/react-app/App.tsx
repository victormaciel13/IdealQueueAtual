import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import LoginPage from '@/react-app/pages/Login';
import ReceptionPage from '@/react-app/pages/Reception';
import GuichePage from '@/react-app/pages/Guiche';
import DisplayPage from '@/react-app/pages/Display';
import DashboardPage from '@/react-app/pages/Dashboard';
import DPPage from '@/react-app/pages/DP';
import ReportsPage from '@/react-app/pages/Reports';
import ReportsLoginPage from '@/react-app/pages/ReportsLogin';
import IndicadoresLoginPage from '@/react-app/pages/IndicadoresLogin';
import IndicadoresPage from '@/react-app/pages/Indicadores';
import IndicadoresImportPage from '@/react-app/pages/IndicadoresImport';
import { supabaseQueueApi } from '@/react-app/lib/supabaseQueue';

function ProtectedRoute({
  children,
  allowed,
}: {
  children: React.ReactNode;
  allowed: string[];
}) {
  const currentUser = supabaseQueueApi.getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (!allowed.includes(currentUser.role)) {
    if (currentUser.role === 'admin') {
      return <Navigate to="/dashboard" />;
    }
    if (currentUser.role.startsWith('guiche')) {
      return <Navigate to="/guiche" />;
    }
    if (currentUser.role.startsWith('dp')) {
      return <Navigate to="/dp" />;
    }
    return <Navigate to="/" />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route path="/login" element={<LoginPage />} />

        {/* RECEPÇÃO */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowed={['reception']}>
              <ReceptionPage />
            </ProtectedRoute>
          }
        />

        {/* GUICHÊ */}
        <Route
          path="/guiche"
          element={
            <ProtectedRoute
              allowed={[
                'guiche1','guiche2','guiche3',
                'guiche4','guiche5','guiche6',
                'guiche7','guiche8','guiche9',
              ]}
            >
              <GuichePage />
            </ProtectedRoute>
          }
        />

        {/* TELA DE EXIBIÇÃO (TV) — admin */}
        <Route
          path="/display"
          element={
            <ProtectedRoute allowed={['admin']}>
              <DisplayPage />
            </ProtectedRoute>
          }
        />

        {/* DASHBOARD ADMIN */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowed={['admin']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* LOGIN RELATÓRIOS */}
        <Route path="/reports-login" element={<ReportsLoginPage />} />

        {/* RELATÓRIOS */}
        <Route path="/reports" element={<ReportsPage />} />

        {/* LOGIN INDICADORES (Turnover & Absenteísmo) */}
        <Route path="/indicadores-login" element={<IndicadoresLoginPage />} />

        {/* PAINEL DE INDICADORES */}
        <Route path="/indicadores" element={<IndicadoresPage />} />

        {/* IMPORTAÇÃO DE DADOS (Excel) */}
        <Route path="/indicadores/importar" element={<IndicadoresImportPage />} />

        {/* DP */}
        <Route
          path="/dp"
          element={
            <ProtectedRoute allowed={['dp1','dp2','dp3','dp4','dp5','dp6']}>
              <DPPage />
            </ProtectedRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}