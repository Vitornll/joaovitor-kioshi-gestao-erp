import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal, StatCard, Badge, EmptyState, formatDate } from '../components/ui';
import type { Vehicle } from '../lib/types';

export default function Frota() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ plate: '', model: '', odometer_km: '', next_maintenance_date: '', licensing_due_date: '' });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('vehicles').select('*').order('plate');
    setVehicles(data ?? []);
    setLoading(false);
  }

  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const maintenanceSoon = vehicles.filter((v) => v.next_maintenance_date && new Date(v.next_maintenance_date) <= in30).length;
  const docsSoon = vehicles.filter((v) => v.licensing_due_date && new Date(v.licensing_due_date) <= in30).length;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('vehicles').insert({
      plate: form.plate.toUpperCase(),
      model: form.model || null,
      odometer_km: Number(form.odometer_km) || 0,
      next_maintenance_date: form.next_maintenance_date || null,
      licensing_due_date: form.licensing_due_date || null,
    });
    setSaving(false);
    setShowModal(false);
    setForm({ plate: '', model: '', odometer_km: '', next_maintenance_date: '', licensing_due_date: '' });
    load();
  }

  return (
    <div>
      <div className="section-row">
        <p className="content-subtitle" style={{ margin: 0 }}>
          Documentação, manutenção e registros de ocorrência da frota.
        </p>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Adicionar veículo
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Veículos ativos" value={vehicles.length} accent="brand" />
        <StatCard label="Manutenção próxima" value={maintenanceSoon} hint="Dentro de 30 dias" accent="warning" />
        <StatCard label="Documentos a vencer" value={docsSoon} hint="Licenciamento" accent="danger" />
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="modal-eyebrow">Logística</div>
          <h3>Veículos cadastrados</h3>
        </div>
        {loading ? (
          <EmptyState>Carregando…</EmptyState>
        ) : vehicles.length === 0 ? (
          <EmptyState>Nenhum veículo cadastrado. Use "Adicionar veículo" para iniciar a frota.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Veículo</th>
                <th>Placa</th>
                <th>Odômetro</th>
                <th>Próxima ação</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.model || '—'}</td>
                  <td>{v.plate}</td>
                  <td>{v.odometer_km} km</td>
                  <td>{v.next_maintenance_date ? `Manutenção em ${formatDate(v.next_maintenance_date)}` : '—'}</td>
                  <td>
                    <Badge tone="success">{v.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal
          eyebrow="Frota"
          title="Adicionar veículo"
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" form="vehicle-form" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar veículo'}
              </button>
            </>
          }
        >
          <form id="vehicle-form" onSubmit={save}>
            <div className="field-row">
              <div className="field">
                <label>Placa</label>
                <input required value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
              </div>
              <div className="field">
                <label>Modelo</label>
                <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Odômetro atual (km)</label>
              <input type="number" value={form.odometer_km} onChange={(e) => setForm({ ...form, odometer_km: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Próxima manutenção</label>
                <input type="date" value={form.next_maintenance_date} onChange={(e) => setForm({ ...form, next_maintenance_date: e.target.value })} />
              </div>
              <div className="field">
                <label>Vencimento do licenciamento</label>
                <input type="date" value={form.licensing_due_date} onChange={(e) => setForm({ ...form, licensing_due_date: e.target.value })} />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
