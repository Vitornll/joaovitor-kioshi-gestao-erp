import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal, StatCard, Badge, EmptyState, money, formatDate } from '../components/ui';
import type { Charge, Client, ServiceOrder } from '../lib/types';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  a_receber: 'warning',
  recebido: 'success',
  vencido: 'danger',
  cancelado: 'neutral',
};
const STATUS_LABEL: Record<string, string> = {
  a_receber: 'A receber',
  recebido: 'Recebido',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

export default function Financeiro() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('todas');

  const [form, setForm] = useState({
    client_id: '',
    service_order_id: '',
    description: '',
    value: '',
    payment_method: '',
    due_date: new Date().toISOString().slice(0, 10),
    status: 'a_receber' as Charge['status'],
    reference: '',
    notes: '',
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [chargesRes, clientsRes, ordersRes] = await Promise.all([
      supabase.from('charges').select('*, clients(*)').order('due_date', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('service_orders').select('*, clients(*), service_types(*)').order('scheduled_at', { ascending: false }).limit(100),
    ]);
    setCharges((chargesRes.data as Charge[]) ?? []);
    setClients(clientsRes.data ?? []);
    setOrders((ordersRes.data as ServiceOrder[]) ?? []);
    setLoading(false);
  }

  const receivedThisMonth = charges
    .filter((c) => c.status === 'recebido' && c.received_date && new Date(c.received_date).getMonth() === new Date().getMonth())
    .reduce((s, c) => s + Number(c.value), 0);
  const toReceive = charges.filter((c) => c.status === 'a_receber').reduce((s, c) => s + Number(c.value), 0);
  const overdue = charges.filter((c) => c.status === 'vencido').reduce((s, c) => s + Number(c.value), 0);

  const filtered = statusFilter === 'todas' ? charges : charges.filter((c) => c.status === statusFilter);

  async function saveCharge(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('charges').insert({
      client_id: form.client_id || null,
      service_order_id: form.service_order_id || null,
      description: form.description || null,
      value: Number(form.value) || 0,
      payment_method: form.payment_method || null,
      due_date: form.due_date || null,
      received_date: form.status === 'recebido' ? new Date().toISOString().slice(0, 10) : null,
      status: form.status,
      reference: form.reference || null,
      notes: form.notes || null,
    });
    setSaving(false);
    setShowModal(false);
    load();
  }

  async function markReceived(charge: Charge) {
    await supabase
      .from('charges')
      .update({ status: 'recebido', received_date: new Date().toISOString().slice(0, 10) })
      .eq('id', charge.id);
    load();
  }

  return (
    <div>
      <div className="section-row">
        <p className="content-subtitle" style={{ margin: 0 }}>
          Cobranças por serviço, meios de pagamento e documentos financeiros.
        </p>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Nova cobrança
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Recebido este mês" value={money(receivedThisMonth)} accent="success" />
        <StatCard label="A receber" value={money(toReceive)} accent="warning" />
        <StatCard label="Vencido" value={money(overdue)} accent="danger" />
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="modal-eyebrow">Controle por atendimento</div>
            <h3>Serviços e cobranças</h3>
          </div>
          <select style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="todas">Todas as situações</option>
            <option value="a_receber">A receber</option>
            <option value="recebido">Recebido</option>
            <option value="vencido">Vencido</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        {loading ? (
          <EmptyState>Carregando…</EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState>Nenhuma cobrança registrada ainda.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Cliente / serviço</th>
                <th>Forma de pagamento</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.clients?.name ?? 'Cliente avulso'}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{c.description}</div>
                  </td>
                  <td>{c.payment_method || 'Não selecionada'}</td>
                  <td>{formatDate(c.due_date)}</td>
                  <td style={{ fontWeight: 600 }}>{money(c.value)}</td>
                  <td>
                    <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                  </td>
                  <td>
                    {c.status === 'a_receber' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => markReceived(c)}>
                        Registrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal
          eyebrow="Controle comercial"
          title="Nova cobrança"
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" form="charge-form" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar cobrança'}
              </button>
            </>
          }
        >
          <form id="charge-form" onSubmit={saveCharge}>
            <div className="field">
              <label>Serviço (opcional)</label>
              <select value={form.service_order_id} onChange={(e) => setForm({ ...form, service_order_id: e.target.value })}>
                <option value="">Serviço avulso / sem agendamento</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.clients?.name} · {new Date(o.scheduled_at).toLocaleDateString('pt-BR')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Cliente</label>
                <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">Selecione</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Serviço realizado/contratado</label>
                <input placeholder="Ex.: controle integrado de pragas" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Valor (R$)</label>
                <input type="number" step="0.01" required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="field">
                <label>Forma de pagamento</label>
                <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  <option value="">Não selecionada</option>
                  <option value="PIX">PIX</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Cartão de crédito">Cartão de crédito</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Transferência">Transferência</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Vencimento</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="field">
                <label>Situação</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Charge['status'] })}>
                  <option value="a_receber">A receber</option>
                  <option value="recebido">Recebido</option>
                  <option value="vencido">Vencido</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Referência / identificação da transação (opcional)</label>
              <input placeholder="Ex.: identificador PIX, nosso número" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div className="field">
              <label>Observações</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
