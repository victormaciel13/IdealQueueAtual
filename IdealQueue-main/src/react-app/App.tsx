import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import LoginPage from '@/react-app/pages/Login';
import ReceptionPage from '@/react-app/pages/Reception';
import GuichePage from '@/react-app/pages/Guiche';
import DisplayPage from '@/react-app/pages/Display';
import { useQueue } from '@/react-app/hooks/useQueue';

function ProtectedRoute({
  children,
  allowed,
}: {
  children: React.ReactNode;
  allowed: string[];
}) {
  const { currentUser, loading } = useQueue();

  if (loading) return null;

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (!allowed.includes(currentUser.role)) {
    if (currentUser.role === 'admin') {
      return <Navigate to="/display" />;
    }
    if (currentUser.role.startsWith('guiche')) {
      return <Navigate to="/guiche" />;
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
                'guiche1',
                'guiche2',
                'guiche3',
                'guiche4',
                'guiche5',
                'guiche6',
                'guiche7',
                'guiche8',
                'guiche9',
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

        {/* fallback */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
