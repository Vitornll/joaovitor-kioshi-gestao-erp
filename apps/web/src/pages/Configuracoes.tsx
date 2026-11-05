import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Badge, EmptyState } from '../components/ui';
import type { Profile, UserRole } from '../lib/types';

const ROLE_INFO: Record<UserRole, { title: string; description: string }> = {
  diretoria: { title: 'Diretoria', description: 'Visão completa, financeiro e configurações.' },
  supervisor: { title: 'Supervisor operacional', description: 'Agenda da equipe, acompanhamento da execução e tratamento operacional.' },
  tecnico: { title: 'Técnico operacional', description: 'Apenas os serviços designados, pelo aplicativo móvel.' },
};

export default function Configuracoes() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'tecnico' as UserRole });
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    setProfiles(data ?? []);
    setLoading(false);
  }

  async function createAccess(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, role: form.role } },
    });
    if (error) {
      setMessage('Erro: ' + error.message);
    } else {
      setMessage('Acesso criado! Por segurança, o Supabase pode ter aberto a sessão do novo usuário — saia e entre novamente com sua conta de diretoria.');
      setForm({ full_name: '', email: '', password: '', role: 'tecnico' });
      load();
    }
    setCreating(false);
  }

  const isDiretoria = profile?.role === 'diretoria';

  return (
    <div>
      <p className="content-subtitle">Defina o que cada pessoa pode consultar e executar.</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3>Perfis de acesso</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Controle centralizado das áreas do ERP, computador e aplicativo operacional.</p>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          {(Object.keys(ROLE_INFO) as UserRole[]).map((r) => (
            <div key={r} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div>
                <strong>{ROLE_INFO[r].title}</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{ROLE_INFO[r].description}</div>
              </div>
              <Badge tone="info">{profiles.filter((p) => p.role === r).length} pessoa(s)</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3>Usuários</h3>
        </div>
        {loading ? (
          <EmptyState>Carregando…</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Perfil</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.full_name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.role}</td>
                  <td>
                    <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? 'Ativo' : 'Inativo'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isDiretoria && (
        <div className="card">
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3>Criar novo acesso</h3>
          </div>
          <form style={{ padding: 20 }} onSubmit={createAccess}>
            <div className="field-row">
              <div className="field">
                <label>Nome completo</label>
                <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="field">
                <label>Perfil</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                  <option value="tecnico">Técnico operacional</option>
                  <option value="supervisor">Supervisor operacional</option>
                  <option value="diretoria">Diretoria</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>E-mail</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="field">
                <label>Senha provisória</label>
                <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
            {message && <p style={{ fontSize: 13, color: message.startsWith('Erro') ? 'var(--danger)' : 'var(--success)' }}>{message}</p>}
            <button className="btn btn-primary" disabled={creating}>
              {creating ? 'Criando…' : 'Criar acesso'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
