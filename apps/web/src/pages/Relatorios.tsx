import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { EmptyState, formatDateTime, money } from '../components/ui';

type ReportType = 'atendimentos' | 'cobrancas';

export default function Relatorios() {
  const [type, setType] = useState<ReportType>('atendimentos');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  async function generate() {
    setLoading(true);
    setRan(true);
    if (type === 'atendimentos') {
      const { data } = await supabase
        .from('service_orders')
        .select('*, clients(name), service_types(name)')
        .gte('scheduled_at', startDate)
        .lte('scheduled_at', endDate + 'T23:59:59')
        .order('scheduled_at');
      setRows(data ?? []);
    } else {
      const { data } = await supabase
        .from('charges')
        .select('*, clients(name)')
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .order('due_date');
      setRows(data ?? []);
    }
    setLoading(false);
  }

  function exportCsv() {
    if (!rows.length) return;
    let csv = '';
    if (type === 'atendimentos') {
      csv = 'Data,Cliente,Serviço,Situação\n';
      rows.forEach((r) => {
        csv += `${new Date(r.scheduled_at).toLocaleString('pt-BR')},${r.clients?.name ?? ''},${r.service_types?.name ?? ''},${r.status}\n`;
      });
    } else {
      csv = 'Vencimento,Cliente,Descrição,Valor,Situação\n';
      rows.forEach((r) => {
        csv += `${r.due_date},${r.clients?.name ?? ''},${r.description ?? ''},${r.value},${r.status}\n`;
      });
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${type}-${startDate}-a-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalConcluidos = rows.filter((r) => r.status === 'concluido').length;

  return (
    <div>
      <p className="content-subtitle">Consulte atendimentos, clientes e cobranças em um só lugar.</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="modal-eyebrow">Central de consultas</div>
          <h3>Monte seu relatório</h3>
        </div>
        <div style={{ padding: 20 }}>
          <div className="field-row">
            <div className="field">
              <label>Tipo de relatório</label>
              <select value={type} onChange={(e) => setType(e.target.value as ReportType)}>
                <option value="atendimentos">Atendimentos por período</option>
                <option value="cobrancas">Cobranças por período</option>
              </select>
            </div>
            <div className="field" />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Data inicial</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Data final</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-primary" onClick={generate} disabled={loading}>
              {loading ? 'Gerando…' : 'Gerar relatório →'}
            </button>
          </div>
        </div>
      </div>

      {ran && (
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="modal-eyebrow">Resultado</div>
              <h3>{rows.length} registro(s)</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={!rows.length}>
              Exportar CSV
            </button>
          </div>
          {rows.length === 0 ? (
            <EmptyState>Nenhum dado encontrado para o período.</EmptyState>
          ) : type === 'atendimentos' ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.scheduled_at)}</td>
                    <td>{r.clients?.name}</td>
                    <td>{r.service_types?.name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Cliente</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.due_date}</td>
                    <td>{r.clients?.name}</td>
                    <td>{r.description}</td>
                    <td>{money(r.value)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
