import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal, Badge, EmptyState } from '../components/ui';
import type { Client, ClientAddress, Profile, ServiceOrder, ServiceType } from '../lib/types';

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
  const [clients, setClients] = useState<Client[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    loadRefs();
  }, []);

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

  async function loadRefs() {
    const [c, s, p] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('service_types').select('*').eq('active', true).order('name'),
      supabase.from('profiles').select('*').eq('role', 'tecnico').eq('active', true),
    ]);
    setClients(c.data ?? []);
    setServiceTypes(s.data ?? []);
    setTechnicians(p.data ?? []);
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
          clients={clients}
          serviceTypes={serviceTypes}
          technicians={technicians}
          saving={saving}
          setSaving={setSaving}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            loadOrders();
            loadRefs();
          }}
        />
      )}
    </div>
  );
}

function ScheduleModal({
  clients,
  serviceTypes,
  technicians,
  saving,
  setSaving,
  onClose,
  onSaved,
}: {
  clients: Client[];
  serviceTypes: ServiceType[];
  technicians: Profile[];
  saving: boolean;
  setSaving: (v: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientQuery, setClientQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [selectedAddressIds, setSelectedAddressIds] = useState<string[]>([]);
  const [newAddressStreet, setNewAddressStreet] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [datetime, setDatetime] = useState('');
  const [duration, setDuration] = useState(60);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ServiceOrder['status']>('confirmado');
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);

  const matches = clientQuery.length > 0 ? clients.filter((c) => c.name.toLowerCase().includes(clientQuery.toLowerCase())).slice(0, 6) : [];
  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  useEffect(() => {
    if (!selectedClientId) {
      setAddresses([]);
      return;
    }
    supabase
      .from('client_addresses')
      .select('*')
      .eq('client_id', selectedClientId)
      .then(({ data }) => {
        setAddresses(data ?? []);
        setSelectedAddressIds(data && data.length ? [data[0].id] : []);
      });
  }, [selectedClientId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!datetime) return;
    setSaving(true);

    let clientId = selectedClientId;
    let addressIds = selectedAddressIds;

    if (!clientId) {
      const { data: newClient } = await supabase
        .from('clients')
        .insert({ name: clientQuery, phone: phone || null, email: email || null, commercial_stage: 'cliente_spot' })
        .select()
        .single();
      if (newClient) {
        clientId = newClient.id;
        if (newAddressStreet) {
          const { data: addr } = await supabase
            .from('client_addresses')
            .insert({ client_id: clientId, street: newAddressStreet, is_primary: true })
            .select()
            .single();
          addressIds = addr ? [addr.id] : [];
        } else {
          addressIds = [];
        }
      }
    }

    if (!clientId) {
      setSaving(false);
      return;
    }

    const targets = addressIds.length ? addressIds : [null];
    for (const addressId of targets) {
      const { data: order } = await supabase
        .from('service_orders')
        .insert({
          client_id: clientId,
          address_id: addressId,
          service_type_id: serviceTypeId || null,
          scheduled_at: new Date(datetime).toISOString(),
          duration_minutes: duration,
          status,
          notes: notes || null,
        })
        .select()
        .single();
      if (order && selectedTechs.length) {
        await supabase.from('service_order_assignees').insert(selectedTechs.map((employee_id) => ({ service_order_id: order.id, employee_id })));
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      eyebrow="Agendamento"
      title="Agendar serviço"
      description="Clientes já cadastrados serão identificados pelo nome. O atendimento entra no mesmo histórico, sem duplicar o cadastro."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" form="schedule-form" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar agendamento'}
          </button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={handleSave}>
        <div className="field" style={{ position: 'relative' }}>
          <label>Cliente cadastrado</label>
          <input
            placeholder="Pesquise por nome"
            value={selectedClient ? selectedClient.name : clientQuery}
            onChange={(e) => {
              setSelectedClientId('');
              setClientQuery(e.target.value);
            }}
          />
          {!selectedClient && matches.length > 0 && (
            <div className="card" style={{ position: 'absolute', zIndex: 5, width: '100%', marginTop: 4 }}>
              {matches.map((c) => (
                <div
                  key={c.id}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13.5 }}
                  onClick={() => {
                    setSelectedClientId(c.id);
                    setClientQuery('');
                  }}
                >
                  {c.name}
                </div>
              ))}
            </div>
          )}
          {!selectedClient && clientQuery && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Nenhum cadastro encontrado — ao salvar, um novo cliente será criado automaticamente com esse nome.
            </p>
          )}
        </div>

        <div className="field">
          <label>Serviço solicitado</label>
          <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)}>
            <option value="">Selecione</option>
            {serviceTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Data e horário</label>
            <input type="datetime-local" required value={datetime} onChange={(e) => setDatetime(e.target.value)} />
          </div>
          <div className="field">
            <label>Duração estimada (min)</label>
            <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
        </div>

        {selectedClient ? (
          <div className="field">
            <label>Endereços de atendimento</label>
            {addresses.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Este cliente não possui endereço cadastrado.</p>}
            {addresses.map((a) => (
              <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, textTransform: 'none', fontSize: 13.5, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={selectedAddressIds.includes(a.id)}
                  onChange={(e) =>
                    setSelectedAddressIds(e.target.checked ? [...selectedAddressIds, a.id] : selectedAddressIds.filter((id) => id !== a.id))
                  }
                />
                {a.label || a.street || 'Endereço'}
              </label>
            ))}
          </div>
        ) : (
          <div className="field">
            <label>Endereço de atendimento</label>
            <input placeholder="Rua, número, bairro" value={newAddressStreet} onChange={(e) => setNewAddressStreet(e.target.value)} />
          </div>
        )}

        <div className="field-row">
          <div className="field">
            <label>Telefone do contato</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>E-mail para documentos</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Observações do agendamento</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="field">
          <label>Operador(es) que atenderá(ão)</label>
          {technicians.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Cadastre técnicos em Recursos Humanos.</p>}
          {technicians.map((t) => (
            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, textTransform: 'none', fontSize: 13.5, marginBottom: 6 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={selectedTechs.includes(t.id)}
                onChange={(e) => setSelectedTechs(e.target.checked ? [...selectedTechs, t.id] : selectedTechs.filter((id) => id !== t.id))}
              />
              {t.full_name}
            </label>
          ))}
        </div>

        <div className="field">
          <label>Situação do serviço</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ServiceOrder['status'])}>
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
            <option value="em_rota">Em rota</option>
            <option value="em_execucao">Em execução</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
