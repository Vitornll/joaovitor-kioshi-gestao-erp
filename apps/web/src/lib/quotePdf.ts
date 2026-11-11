import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { KIOSHI_LOGO_BASE64 } from '../assets/logoBase64';
import { ISO_SEAL_BASE64 } from '../assets/isoSealBase64';
import { money, formatDate } from '../components/ui';
import type { Quote, QuoteItem, Client, ClientAddress, CompanySettings, Profile } from './types';

// pdfmake embute as fontes padrão (Roboto) via esse pacote de "vfs".
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs;

const STATE_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará',
  PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

export interface QuotePdfData {
  quote: Quote;
  items: QuoteItem[];
  client: Client | null;
  address: ClientAddress | null;
  company: CompanySettings | null;
  responsible: Profile | null;
}

function section(title: string, brand: string, body: any[]): any {
  return {
    margin: [0, 14, 0, 0],
    stack: [
      {
        columns: [
          { width: 3, canvas: [{ type: 'rect', x: 0, y: 1, w: 3, h: 11, color: brand }] },
          { width: '*', text: title.toUpperCase(), bold: true, fontSize: 9.5, color: brand, margin: [6, 0, 0, 0] },
        ],
      },
      { margin: [9, 4, 0, 0], fontSize: 10, stack: body },
    ],
  };
}

export function buildQuoteDocDefinition(data: QuotePdfData): any {
  const { quote, items, client, address, company, responsible } = data;
  const brand = company?.primary_color || '#ab1431';
  const stateName = (company?.state && STATE_NAMES[company.state]) || company?.state || '';

  const clientLines: any[] = [{ text: client?.name || '—', bold: true, fontSize: 11 }];
  if (client?.cpf || client?.cnpj) {
    clientLines.push({ text: `CPF / CNPJ: ${client?.cpf || client?.cnpj}`, margin: [0, 2, 0, 0] });
  }
  if (address?.street) {
    const complemento = address.complement ? `, ${address.complement}` : '';
    clientLines.push({ text: `Endereço: ${address.street}${address.number ? ', ' + address.number : ''}${complemento}`, margin: [0, 2, 0, 0] });
  }
  if (address?.neighborhood || address?.city) {
    clientLines.push({
      text: `Bairro: ${address?.neighborhood || '—'}${address?.city ? ' · ' + address.city + (address.state ? '/' + address.state : '') : ''}`,
      margin: [0, 2, 0, 0],
    });
  }
  if (address?.reference) {
    clientLines.push({ text: `Referência: ${address.reference}`, margin: [0, 2, 0, 0] });
  }
  if (client?.contact_name || client?.phone || client?.email) {
    const parts = [client?.contact_name, client?.phone, client?.email].filter(Boolean);
    clientLines.push({ text: `Contato: ${parts.join(' · ')}`, margin: [0, 2, 0, 0] });
  }
  if (quote.site_contact_name || quote.site_contact_phone) {
    const parts = [quote.site_contact_name, quote.site_contact_phone].filter(Boolean);
    clientLines.push({ text: `Contato no local: ${parts.join(' · ')}`, margin: [0, 2, 0, 0] });
  }

  const itemRows = items.map((it) => [
    { text: it.service_name, fontSize: 9.5 },
    { text: it.assistance_days != null ? String(it.assistance_days) : '—', alignment: 'center', fontSize: 9.5 },
    { text: String(it.qty), alignment: 'center', fontSize: 9.5 },
    { text: money(it.unit_price), alignment: 'right', fontSize: 9.5 },
    { text: money(it.qty * it.unit_price), alignment: 'right', bold: true, fontSize: 9.5 },
  ]);
  const total = items.reduce((sum, it) => sum + it.qty * it.unit_price, 0);

  const optionalSections: any[] = [];
  if (quote.nature_of_services) optionalSections.push(section('Natureza dos serviços', brand, [{ text: quote.nature_of_services }]));
  if (quote.application_locations || quote.application_notes) {
    const body: any[] = [];
    if (quote.application_locations) body.push({ text: quote.application_locations });
    if (quote.application_notes) body.push({ text: `Observações sobre a assistência: ${quote.application_notes}`, margin: [0, 2, 0, 0] });
    optionalSections.push(section('Locais de aplicação', brand, body));
  }
  if (quote.pests_combated) optionalSections.push(section('Pragas combatidas', brand, [{ text: quote.pests_combated }]));

  const validityDays = quote.validity_days ?? 60;

  return {
    pageSize: 'A4',
    pageMargins: [40, 70, 40, 60],
    header: {
      canvas: [{ type: 'rect', x: 0, y: 0, w: 595.28, h: 6, color: brand }],
    },
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 10, 40, 0],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515.28, y2: 0, lineWidth: 0.5, lineColor: '#dddddd' }] },
        {
          margin: [0, 6, 0, 0],
          columns: [
            {
              width: '*',
              fontSize: 8,
              color: '#666666',
              stack: [
                { text: `${company?.legal_name || company?.name || 'Kioshi Controle de Pragas'}${company?.phone ? ' | ' + company.phone : ''}` },
                {
                  text: [
                    company?.email ? company.email : '',
                    company?.website ? ' | ' + company.website : '',
                    company?.city ? ' | ' + company.city + (stateName ? ' - ' + stateName : '') : '',
                  ].join(''),
                },
              ],
            },
            { width: 'auto', fontSize: 8, color: '#666666', text: `Página ${currentPage} de ${pageCount}` },
          ],
        },
      ],
    }),
    content: [
      {
        columns: [
          { width: 100, image: KIOSHI_LOGO_BASE64, fit: [95, 95] },
          {
            width: '*',
            alignment: 'center',
            margin: [0, 24, 0, 0],
            stack: [
              { text: 'ORÇAMENTO', bold: true, fontSize: 20, color: '#222222' },
              { text: 'PROPOSTA COMERCIAL | CONTROLE DE PRAGAS', fontSize: 8.5, color: '#888888', margin: [0, 2, 0, 0] },
            ],
          },
          { width: 115, image: ISO_SEAL_BASE64, fit: [108, 108], alignment: 'right' },
        ],
      },
      { margin: [0, 10, 0, 0], canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515.28, y2: 0, lineWidth: 0.5, lineColor: '#dddddd' }] },
      {
        margin: [0, 12, 0, 0],
        columns: [
          { width: '*', text: `ORÇAMENTO Nº ${quote.number}`, bold: true, fontSize: 10.5 },
          {
            width: 'auto',
            text: `${quote.city || company?.city || ''}${quote.state || company?.state ? '/' + (quote.state || company?.state) : ''} | Emissão: ${formatDate(quote.issue_date)}`,
            fontSize: 9.5,
            color: '#555555',
          },
        ],
      },
      section('Ao / À', brand, clientLines),
      {
        margin: [0, 12, 0, 0],
        fontSize: 10,
        text: 'Prezado(a) Senhor(a), conforme solicitado, apresentamos o orçamento dos serviços requisitados:',
      },
      ...optionalSections,
      section('Serviços e valores', brand, [
        {
          margin: [0, 2, 0, 0],
          table: {
            headerRows: 1,
            widths: ['*', 55, 35, 65, 70],
            body: [
              [
                { text: 'SERVIÇO', bold: true, fontSize: 8, color: '#777777' },
                { text: 'ASSISTÊNCIA', bold: true, fontSize: 8, color: '#777777', alignment: 'center' },
                { text: 'QTD.', bold: true, fontSize: 8, color: '#777777', alignment: 'center' },
                { text: 'UNITÁRIO', bold: true, fontSize: 8, color: '#777777', alignment: 'right' },
                { text: 'TOTAL', bold: true, fontSize: 8, color: '#777777', alignment: 'right' },
              ],
              ...itemRows,
            ],
          },
          layout: {
            hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
            vLineWidth: () => 0,
            hLineColor: () => '#e5e5e5',
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
        },
        {
          margin: [0, 8, 0, 0],
          columns: [
            { width: '*', text: '' },
            {
              width: 220,
              table: {
                widths: ['*', 'auto'],
                body: [[
                  { text: 'TOTAL DO ORÇAMENTO', bold: true, fontSize: 9, fillColor: '#f6d9de' },
                  { text: money(total), bold: true, fontSize: 11, color: brand, alignment: 'right', fillColor: '#f6d9de' },
                ]],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 6, paddingBottom: () => 6, paddingLeft: () => 8, paddingRight: () => 8 },
            },
          ],
        },
      ]),
      section('Condições de pagamento', brand, [{ text: quote.payment_terms || 'A combinar.' }]),
      section('Validade da proposta', brand, [
        { text: `${validityDays} dia(s) · Válida até ${formatDate(quote.validity_date)}` },
      ]),
      ...(quote.observations ? [section('Observações', brand, [{ text: quote.observations }])] : []),
      {
        margin: [0, 16, 0, 0],
        fontSize: 9.5,
        stack: [
          { text: `Responsável pela proposta: ${responsible?.full_name || '—'}`, bold: true },
          {
            margin: [0, 8, 0, 0],
            color: '#666666',
            fontSize: 8.5,
            text: 'Os dados pessoais informados serão utilizados para elaboração e execução desta proposta, observada a legislação aplicável de proteção de dados.',
          },
          {
            margin: [0, 4, 0, 0],
            color: '#666666',
            fontSize: 8.5,
            text: 'Colocamo-nos à disposição para quaisquer esclarecimentos e esperamos concretizar o pedido em breve.',
          },
        ],
      },
    ],
    defaultStyle: { font: 'Roboto', color: '#333333' },
  };
}

export function downloadQuotePdf(data: QuotePdfData) {
  const doc = buildQuoteDocDefinition(data);
  (pdfMake as any).createPdf(doc).download(`orcamento-${data.quote.number}.pdf`);
}

export function openQuotePdf(data: QuotePdfData) {
  const doc = buildQuoteDocDefinition(data);
  (pdfMake as any).createPdf(doc).open();
}
