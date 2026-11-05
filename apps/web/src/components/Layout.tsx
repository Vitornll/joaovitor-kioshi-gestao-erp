import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import logo from '../assets/kioshi-logo.jpg';
import { initials } from './ui';

const NAV = [
  {
    section: 'Operação',
    items: [
      { to: '/', label: 'Visão geral', icon: '◧', end: true },
      { to: '/agenda', label: 'Agenda', icon: '🗓' },
      { to: '/clientes', label: 'Clientes', icon: '◍' },
      { to: '/frota', label: 'Frota', icon: '🚐' },
      { to: '/estoque', label: 'Estoque & produtos', icon: '◳' },
      { to: '/rh', label: 'Recursos Humanos', icon: '◎' },
      { to: '/conformidade', label: 'Conformidade', icon: '✓' },
    ],
  },
  {
    section: 'Negócio',
    items: [
      { to: '/crm', label: 'CRM & contratos', icon: '◱' },
      { to: '/financeiro', label: 'Financeiro', icon: '$' },
      { to: '/relatorios', label: 'Relatórios', icon: '▤' },
      { to: '/app-operacional', label: 'App operacional', icon: '📱' },
    ],
  },
  {
    section: 'Administração',
    items: [{ to: '/configuracoes', label: 'Configurações', icon: '⚙' }],
  },
];

const TITLES: Record<string, { eyebrow: string; title: string }> = {
  '/': { eyebrow: 'Gestão', title: 'Painel de gestão' },
  '/agenda': { eyebrow: 'Planejamento', title: 'Agenda operacional' },
  '/clientes': { eyebrow: 'Cadastros e contratos', title: 'Clientes' },
  '/frota': { eyebrow: 'Logística', title: 'Frota e equipamentos' },
  '/estoque': { eyebrow: 'Atenção aos lotes', title: 'Estoque & produtos' },
  '/rh': { eyebrow: 'Equipe', title: 'Recursos Humanos' },
  '/conformidade': { eyebrow: 'Segurança e governança', title: 'Conformidade' },
  '/crm': { eyebrow: 'Vendas e relacionamento', title: 'CRM & contratos' },
  '/financeiro': { eyebrow: 'Contas e cobrança', title: 'Financeiro' },
  '/relatorios': { eyebrow: 'Inteligência do negócio', title: 'Relatórios gerenciais' },
  '/app-operacional': { eyebrow: 'Operação', title: 'App operacional' },
  '/configuracoes': { eyebrow: 'Administração', title: 'Configurações e acessos' },
};

export default function Layout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const titleInfo = TITLES[location.pathname] ?? { eyebrow: 'Kioshi', title: 'Kioshi Gestão' };

  const nav = profile?.role === 'tecnico' ? [{ section: 'Operação', items: [{ to: '/app-operacional', label: 'Meu dia', icon: '📱', end: true }] }] : NAV;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={logo} alt="Kioshi" />
        </div>
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {nav.map((group) => (
            <div key={group.section}>
              <div className="sidebar-section">{group.section}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-avatar">{initials(profile?.full_name ?? '?')}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--sidebar-fg-muted)', textTransform: 'capitalize' }}>{profile?.role}</div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--sidebar-fg-muted)' }} onClick={signOut} title="Sair">
            ⏻
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title-group">
            <div>
              <div className="topbar-eyebrow">{titleInfo.eyebrow}</div>
              <div className="topbar-title">{titleInfo.title}</div>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="pill">
              <span className="pill-dot" /> Online
            </span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
