import { useState } from 'react';
import { useAuth } from '../lib/auth';
import logo from '../assets/kioshi-logo.jpg';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) setError('E-mail ou senha inválidos.');
    setLoading(false);
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src={logo} alt="Kioshi Controle de Pragas" />
        <h2 style={{ marginBottom: 4 }}>Entrar</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 22 }}>Acesse o painel de gestão</p>
        <div className="field" style={{ textAlign: 'left' }}>
          <label>E-mail</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@kioshi.com.br" />
        </div>
        <div className="field" style={{ textAlign: 'left' }}>
          <label>Senha</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 14, textAlign: 'left' }}>{error}</div>
        )}
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
