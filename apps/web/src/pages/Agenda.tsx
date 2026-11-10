import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Badge, EmptyState } from '../components/ui';
import ScheduleModal from '../components/ScheduleModal';
import type { ServiceOrder } from '../lib/types';

type View = 'dia' | 'semana' | 'mes';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  pendente: 'warning',
  confirmado: 'info',
  em_rota: 'info',
  em_execucao: 'info',
  concluido: 'success',
  cancelado: 'danger',
};
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}
function startOfMonthGrid(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return startOfWeek(first);
}

export default function Agenda() {
  const [view, setView] = useState<View>('mes');
  const [cursor, setCursor] = useState(new Date());
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const rangeStart = useMemo(() => {
    if (view === 'dia') {
      const d = new Date(cursor);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (view === 'semana') return startOfWeek(cursor);
    return startOfMonthGrid(cursor);
  }, [view, cursor]);

  const rangeEnd = useMemo(() => {
    const d = new Date(rangeStart);
    if (view === 'dia') d.setDate(d.getDate() + 1);
    else if (view === 'semana') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 42);
    return d;
  }, [rangeStart, view]);

  useEffect(() => {
    loadOrders();
  }, [rangeStart, rangeEnd]);

  async function loadOrders() {
    setLoading(true);
    const { data } = await supabase
      .from('service_orders')
      .select('*, clients(*), client_addresses(*), service_types(*)')
      .gte('scheduled_at', rangeStart.toISOString())
      .lt('scheduled_at', rangeEnd.toISOString())
      .order('scheduled_at');
    setOrders((data as ServiceOrder[]) ?? []);
    setLoading(false);
  }

  function shift(delta: number) {
    const d = new Date(cursor);
    if (view === 'dia') d.setDate(d.getDate() + delta);
    else if (view === 'semana') d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    setCursor(d);
  }

  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const dayLabel = cursor.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const days: Date[] = [];
  for (let d = new Date(rangeStart); d < rangeEnd; d.setDate(d.getDate() + 1)) days.push(new Date(d));

  const ordersByDay = (day: Date) =>
    orders.filter((o) => {
      const d = new Date(o.scheduled_at);
      return d.toDateString() === day.toDateString();
    });

  return (
    <div>
      <div className="section-row">
        <p className="content-subtitle" style={{ margin: 0 }}>
          {view === 'mes' ? `${orders.length} serviços no período` : view === 'semana' ? `Semana de ${days[0].toLocaleDateString('pt-BR')} a ${days[6].toLocaleDateString('pt-BR')}` : dayLabel}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="card" style={{ display: 'flex', padding: 3 }}>
            <button className="btn btn-sm" style={{ background: 'transparent' }} onClick={() => shift(-1)}>
              ←
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => setCursor(new Date())}>
              Hoje
            </button>
            <button className="btn btn-sm" style={{ background: 'transparent' }} onClick={() => shift(1)}>
              →
            </button>
          </div>
          {(['dia', 'semana', 'mes'] as View[]).map((v) => (
            <button key={v} className={'btn btn-sm ' + (view === v ? 'btn-primary' : 'btn-secondary')} onClick={() => setView(v)}>
              {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Agendar serviço
          </button>
        </div>
      </div>

      <div className="content-eyebrow" style={{ marginBottom: 2 }}>
        Planejamento
      </div>
      <h2 style={{ marginBottom: 18, textTransform: 'capitalize' }}>{view === 'mes' ? monthLabel : view === 'semana' ? `Semana · ${monthLabel}` : dayLabel}</h2>

      {loading ? (
        <EmptyState>Carregando agenda…</EmptyState>
      ) : view === 'mes' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg)' }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {w}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {days.map((day, idx) => {
              const dayOrders = ordersByDay(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              return (
                <div
                  key={idx}
                  style={{
                    minHeight: 96,
                    borderTop: '1px solid var(--border)',
                    borderLeft: idx % 7 !== 0 ? '1px solid var(--border)' : undefined,
                    padding: 8,
                    opacity: inMonth ? 1 : 0.4,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{day.getDate()}</div>
                  {dayOrders.slice(0, 3).map((o) => (
                    <div key={o.id} style={{ fontSize: 11, background: 'var(--brand-light)', color: 'var(--brand-dark)', borderRadius: 5, padding: '2px 5px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {new Date(o.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {o.clients?.name}
                    </div>
                  ))}
                  {dayOrders.length > 3 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{dayOrders.length - 3} mais</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : view === 'semana' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {days.map((day, idx) => (
              <div key={idx} style={{ borderLeft: idx !== 0 ? '1px solid var(--border)' : undefined, minHeight: 320, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{WEEKDAYS[day.getDay()]}</div>
                <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 8 }}>{day.getDate()}</div>
                {ordersByDay(day).map((o) => (
                  <div key={o.id} className="card" style={{ padding: 8, marginBottom: 6, borderLeft: '3px solid var(--brand)', fontSize: 12.5 }}>
                    <div style={{ fontWeight: 700 }}>{new Date(o.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div>{o.clients?.name}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          {orders.length === 0 ? (
            <EmptyState>Nenhum serviço agendado para este dia.</EmptyState>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Cliente / serviço</th>
                  <th>Endereço</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700 }}>{new Date(o.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.clients?.name}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{o.service_types?.name}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{o.client_addresses?.street ?? 'A definir'}</td>
                    <td>
                      <Badge tone={STATUS_TONE[o.status]}>{o.status.replace('_', ' ')}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && (
        <ScheduleModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            loadOrders();
          }}
        />
      )}
    </div>
  );
}
