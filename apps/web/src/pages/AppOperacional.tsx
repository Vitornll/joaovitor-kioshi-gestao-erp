import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Modal, Badge, EmptyState, formatDateTime } from '../components/ui';
import type { ServiceOrder } from '../lib/types';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  pendente: 'warning',
  confirmado: 'info',
  em_rota: 'info',
  em_execucao: 'info',
  concluido: 'success',
  cancelado: 'danger',
};

export default function AppOperacional() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ServiceOrder | null>(null);
  const [ppe, setPpe] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  async function load() {
    setLoading(true);
    const { data: assignments } = await supabase.from('service_order_assignees').select('service_order_id').eq('employee_id', profile!.id);
    const ids = (assignments ?? []).map((a) => a.service_order_id);
    if (!ids.length) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('service_orders')
      .select('*, clients(*), client_addresses(*), service_types(*)')
      .in('id', ids)
      .order('scheduled_at');
    setOrders((data as ServiceOrder[]) ?? []);
    setLoading(false);
  }

  async function checkIn(order: ServiceOrder) {
    await supabase.from('service_order_execution').upsert({ service_order_id: order.id, checked_in_at: new Date().toISOString() });
    await supabase.from('service_orders').update({ status: 'em_execucao' }).eq('id', order.id);
    load();
  }

  async function finish() {
    if (!active) return;
    setSaving(true);
    await supabase.from('service_order_execution').upsert({
      service_order_id: active.id,
      checked_out_at: new Date().toISOString(),
      ppe_confirmed: ppe,
      execution_notes: notes || null,
    });
    await supabase.from('service_orders').update({ status: 'concluido' }).eq('id', active.id);
    setSaving(false);
    setActive(null);
    setPpe(false);
    setNotes('');
    load();
  }

  const today = orders.filter((o) => new Date(o.scheduled_at).toDateString() === new Date().toDateString());
  const upcoming = orders.filter((o) => new Date(o.scheduled_at).toDateString() !== new Date().toDateString());

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="content-eyebrow">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }).toUpperCase()}</div>
      <h1 className="content-title">Olá, {profile?.full_name?.split(' ')[0]}</h1>
      <div className="card" style={{ background: 'var(--brand)', color: '#fff', padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{today.length} serviço(s) para hoje</strong>
        <span>↗</span>
      </div>

      {loading ? (
        <EmptyState>Carregando…</EmptyState>
      ) : orders.length === 0 ? (
        <EmptyState>Nenhum serviço designado para você no momento.</EmptyState>
      ) : (
        <>
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Próximo serviço</h3>
          {today.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Nenhum serviço hoje.</p>}
          {today.map((o) => (
            <div key={o.id} className="card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Badge tone={STATUS_TONE[o.status]}>
                  {new Date(o.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {o.status.replace('_', ' ')}
                </Badge>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{o.duration_minutes} min</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)' }}>{o.clients?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                {o.client_addresses ? [o.client_addresses.street, o.client_addresses.city].filter(Boolean).join(', ') : 'Endereço a definir'}
              </div>
              <div style={{ fontSize: 13, marginBottom: 12 }}>{o.service_types?.name}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {o.status !== 'concluido' && o.status !== 'em_execucao' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => checkIn(o)}>
                    + Fazer check-in
                  </button>
                )}
                {o.status !== 'concluido' && (
                  <button className="btn btn-primary btn-sm" onClick={() => setActive(o)}>
                    Abrir OS →
                  </button>
                )}
              </div>
            </div>
          ))}

          {upcoming.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, margin: '20px 0 10px' }}>Depois</h3>
              {upcoming.slice(0, 5).map((o) => (
                <div key={o.id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{o.clients?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.service_types?.name}</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{formatDateTime(o.scheduled_at)}</div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {active && (
        <Modal
          eyebrow="Execução do serviço"
          title={active.clients?.name ?? 'Ordem de serviço'}
          description="Confirme os EPIs obrigatórios e finalize registrando o que foi executado."
          onClose={() => setActive(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setActive(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={finish} disabled={saving}>
                {saving ? 'Enviando…' : 'Finalizar e enviar'}
              </button>
            </>
          }
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, textTransform: 'none', fontSize: 14, marginBottom: 16 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={ppe} onChange={(e) => setPpe(e.target.checked)} />
            Confirmo o uso dos EPIs obrigatórios
          </label>
          <div className="field">
            <label>Relato da execução</label>
            <textarea rows={4} placeholder="Produtos aplicados, pontos de atenção, recomendações ao cliente…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fotos e assinatura do cliente ficam disponíveis assim que o aplicativo estiver instalado no celular.</p>
        </Modal>
      )}
    </div>
  );
}
