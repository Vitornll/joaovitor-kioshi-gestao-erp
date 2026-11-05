import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal, StatCard, Badge, EmptyState, money, formatDate } from '../components/ui';
import type { Client, CommercialStage, Quote } from '../lib/types';

const STAGES: { key: CommercialStage; label: string }[] = [
  { key: 'prospeccao', label: 'Prospecção' },
  { key: 'proposta', label: 'Propostas' },
  { key: 'contrato', label: 'Contratos' },
  { key: 'cliente_spot', label: 'Clientes spot' },
  { key: 'ex_cliente', label: 'Ex-clientes' },
];

const QUOTE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  aguardando: 'warning',
  aprovado: 'success',
  nao_aprovado: 'danger',
  vencido: 'danger',
};

export default function CRM() {
  const [clients, setClients] = useState<Client[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: '',
    number: `${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
    city: '',
    state: '',
    validity_date: '',
    service_description: '',
    value: '',
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [c, q] = await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('quotes').select('*, clients(name)').order('issue_date', { ascending: false }),
    ]);
    setClients(c.data ?? []);
    setQuotes((q.data as any) ?? []);
    setLoading(false);
  }

  async function saveQuote(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('quotes').insert({
      client_id: form.client_id || null,
      number: form.number,
      city: form.city || null,
      state: form.state || null,
      validity_date: form.validity_date || null,
      service_description: form.service_description || null,
      value: form.value ? Number(form.value) : null,
    });
    setSaving(false);
    setShowModal(false);
    load();
  }

  return (
    <div>
      <div className="section-row">
        <p className="content-subtitle" style={{ margin: 0 }}>
          Prospecção, propostas, contratos e relacionamento em uma única visão comercial.
        </p>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Registrar orçamento
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {STAGES.map((s) => (
          <StatCard key={s.key} label={s.label} value={clients.filter((c) => c.commercial_stage === s.key).length} hint="Clientes nesta etapa" />
        ))}
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="modal-eyebrow">Desempenho comercial</div>
          <h3>Orçamentos e propostas</h3>
        </div>
        {loading ? (
          <EmptyState>Carregando…</EmptyState>
        ) : quotes.length === 0 ? (
          <EmptyState>Nenhum orçamento registrado ainda.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente / serviço</th>
                <th>Emissão</th>
                <th>Validade</th>
                <th>Valor</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q: any) => (
                <tr key={q.id}>
                  <td>{q.number}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{q.clients?.name ?? '—'}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{q.service_description}</div>
                  </td>
                  <td>{formatDate(q.issue_date)}</td>
                  <td>{formatDate(q.validity_date)}</td>
                  <td>{money(q.value)}</td>
                  <td>
                    <Badge tone={QUOTE_TONE[q.status]}>{q.status.replace('_', ' ')}</Badge>
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
          title="Registrar orçamento"
          description="A ficha reúne os dados necessários para emitir a proposta. A validade também alimenta os avisos de vencimento."
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" form="quote-form" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar orçamento'}
              </button>
            </>
          }
        >
          <form id="quote-form" onSubmit={saveQuote}>
            <div className="field-row">
              <div className="field">
                <label>Número do orçamento</label>
                <input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </div>
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
            </div>
            <div className="field-row">
              <div className="field">
                <label>Cidade</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="field">
                <label>UF</label>
                <input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="field">
              <label>Serviço / descrição da proposta</label>
              <textarea rows={2} value={form.service_description} onChange={(e) => setForm({ ...form, service_description: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Validade da proposta</label>
                <input type="date" value={form.validity_date} onChange={(e) => setForm({ ...form, validity_date: e.target.value })} />
              </div>
              <div className="field">
                <label>Valor (R$)</label>
                <input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
