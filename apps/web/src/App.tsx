import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Clientes from './pages/Clientes';
import Frota from './pages/Frota';
import Estoque from './pages/Estoque';
import RH from './pages/RH';
import Conformidade from './pages/Conformidade';
import CRM from './pages/CRM';
import Financeiro from './pages/Financeiro';
import Relatorios from './pages/Relatorios';
import AppOperacional from './pages/AppOperacional';
import Configuracoes from './pages/Configuracoes';

function Private({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Carregando…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Private>
                <Layout />
              </Private>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/frota" element={<Frota />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/rh" element={<RH />} />
            <Route path="/conformidade" element={<Conformidade />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/app-operacional" element={<AppOperacional />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
