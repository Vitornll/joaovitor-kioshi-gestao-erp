import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { StatCard, Badge, money, formatDateTime } from '../components/ui';
import type { ServiceOrder } from '../lib/types';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  pendente: 'warning',
  confirmado: 'info',
  em_rota: 'info',
  em_execucao: 'info',
  concluido: 'success',
  cancelado: 'danger',
};

interface Alert {
  id: string;
  label: string;
  detail: string;
  tone: 'warning' | 'danger';
}

export default function Dashboard() {
  const [today, setToday] = useState<ServiceOrder[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [awaitingCount, setAwaitingCount] = useState(0);
  const [toReceive, setToReceive] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [todayRes, pendingRes, awaitingRes, chargesRes, licensesRes, employeesRes, vehiclesRes] = await Promise.all([
      supabase
        .from('service_orders')
        .select('*, clients(*), service_types(*)')
        .gte('scheduled_at', startOfDay.toISOString())
        .lte('scheduled_at', endOfDay.toISOString())
        .order('scheduled_at'),
      supabase.from('service_orders').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
      supabase.from('service_orders').select('id', { count: 'exact', head: true }).eq('status', 'confirmado'),
      supabase.from('charges').select('value, status'),
      supabase.from('compliance_licenses').select('*').not('expiry_date', 'is', null),
      supabase.from('employees').select('*').not('aso_validity', 'is', null),
      supabase.from('vehicles').select('*').not('next_maintenance_date', 'is', null),
    ]);

    setToday((todayRes.data as ServiceOrder[]) ?? []);
    setPendingCount(pendingRes.count ?? 0);
    setAwaitingCount(awaitingRes.count ?? 0);

    const charges = chargesRes.data ?? [];
    setToReceive(charges.filter((c) => c.status === 'a_receber').reduce((s, c) => s + Number(c.value), 0));
    setMonthRevenue(charges.filter((c) => c.status === 'recebido').reduce((s, c) => s + Number(c.value), 0));

    const nextAlerts: Alert[] = [];
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);

    (licensesRes.data ?? []).forEach((l) => {
      if (l.expiry_date && new Date(l.expiry_date) <= in30) {
        nextAlerts.push({
          id: `lic-${l.id}`,
          label: `Licença "${l.name}" vence em breve`,
          detail: new Date(l.expiry_date).toLocaleDateString('pt-BR'),
          tone: new Date(l.expiry_date) < new Date() ? 'danger' : 'warning',
        });
      }
    });
    (employeesRes.data ?? []).forEach((e) => {
      if (e.aso_validity && new Date(e.aso_validity) <= in30) {
        nextAlerts.push({
          id: `aso-${e.id}`,
          label: `ASO de ${e.full_name} vence em breve`,
          detail: new Date(e.aso_validity).toLocaleDateString('pt-BR'),
          tone: new Date(e.aso_validity) < new Date() ? 'danger' : 'warning',
        });
      }
    });
    (vehiclesRes.data ?? []).forEach((v) => {
      if (v.next_maintenance_date && new Date(v.next_maintenance_date) <= in30) {
        nextAlerts.push({
          id: `veh-${v.id}`,
          label: `Manutenção prevista — ${v.plate}`,
          detail: new Date(v.next_maintenance_date).toLocaleDateString('pt-BR'),
          tone: new Date(v.next_maintenance_date) < new Date() ? 'danger' : 'warning',
        });
      }
    });
    setAlerts(nextAlerts.slice(0, 6));
    setLoading(false);
  }

  const dateLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div>
      <div className="content-eyebrow">{dateLabel.toUpperCase()}</div>
      <h1 className="content-title">Seu dia está sob controle.</h1>
      <p className="content-subtitle">{today.length} atendimento(s) na agenda de hoje.</p>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard label="Atividades para realizar" value={pendingCount} hint="Atendimentos pendentes" accent="danger" />
        <StatCard label="Em agendamento" value={awaitingCount} hint="Confirmados, aguardando execução" accent="warning" />
        <StatCard label="A receber" value={money(toReceive)} hint="Cobranças em aberto" accent="brand" />
        <StatCard label="Recebido (histórico)" value={money(monthRevenue)} hint="Total de cobranças recebidas" accent="success" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div className="card">
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="modal-eyebrow">Hoje</div>
              <h3>Agenda operacional</h3>
            </div>
            <Link to="/agenda" className="btn btn-secondary btn-sm">
              Ver agenda →
            </Link>
          </div>
          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : today.length === 0 ? (
            <div className="empty-state">Nenhum atendimento agendado para hoje.</div>
          ) : (
            <table className="table">
              <tbody>
                {today.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600, width: 70 }}>
                      {new Date(o.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.clients?.name ?? 'Cliente'}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{o.service_types?.name ?? 'Serviço'}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Badge tone={STATUS_TONE[o.status]}>{o.status.replace('_', ' ')}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="modal-eyebrow">Atenção necessária</div>
            <h3>Alertas da operação</h3>
          </div>
          {alerts.length === 0 ? (
            <div className="empty-state">Nenhum alerta no momento.</div>
          ) : (
            <div>
              {alerts.map((a) => (
                <div key={a.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.label}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{a.detail}</div>
                  </div>
                  <Badge tone={a.tone}>{a.tone === 'danger' ? 'Vencido' : 'Atenção'}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
