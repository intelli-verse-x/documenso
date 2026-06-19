// Documenso MCP tool catalog. Wraps the Documenso public API v1.
// Docs: https://docs.documenso.com/developers/public-api
export const SERVER = {
  name: 'documenso-mcp',
  version: '0.1.0',
  baseUrlEnv: 'DOCUMENSO_BASE_URL',
  defaultBaseUrl: 'https://contracts.intelli-verse-x.ai',
  instructions:
    'E-signature tools for Documenso. Authenticate with a Documenso API token via the Authorization: Bearer header. ' +
    'Each token is scoped to one Documenso account (one app-id tenant).',
};

const q = (params) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const TOOLS = [
  {
    name: 'documenso_list_documents',
    description: 'List documents in the Documenso account (paginated). Returns id, title, status, recipients.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (1-based).' },
        perPage: { type: 'number', description: 'Items per page (default 10).' },
      },
    },
    handler: (a, ctx) => ctx.api(`/api/v1/documents${q({ page: a.page, perPage: a.perPage })}`),
  },
  {
    name: 'documenso_get_document',
    description: 'Get a single document by id, including recipients and signing status.',
    inputSchema: {
      type: 'object',
      required: ['documentId'],
      properties: { documentId: { type: 'number', description: 'Documenso document id.' } },
    },
    handler: (a, ctx) => ctx.api(`/api/v1/documents/${encodeURIComponent(a.documentId)}`),
  },
  {
    name: 'documenso_list_templates',
    description: 'List reusable signing templates available in the account.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        perPage: { type: 'number' },
      },
    },
    handler: (a, ctx) => ctx.api(`/api/v1/templates${q({ page: a.page, perPage: a.perPage })}`),
  },
  {
    name: 'documenso_create_document_from_template',
    description:
      'Generate a new document from a template and assign recipients (name + email + optional role). Returns the created document.',
    inputSchema: {
      type: 'object',
      required: ['templateId', 'recipients'],
      properties: {
        templateId: { type: 'number', description: 'Template id to instantiate.' },
        title: { type: 'string', description: 'Optional title override for the new document.' },
        recipients: {
          type: 'array',
          description: 'Signers/approvers to assign.',
          items: {
            type: 'object',
            required: ['name', 'email'],
            properties: {
              id: { type: 'number', description: 'Template recipient id to map to (optional).' },
              name: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string', enum: ['SIGNER', 'APPROVER', 'CC', 'VIEWER'] },
            },
          },
        },
      },
    },
    handler: (a, ctx) =>
      ctx.api(`/api/v1/templates/${encodeURIComponent(a.templateId)}/generate-document`, {
        method: 'POST',
        body: { title: a.title, recipients: a.recipients },
      }),
  },
  {
    name: 'documenso_send_document',
    description: 'Send a draft document to its recipients to start the signing flow.',
    inputSchema: {
      type: 'object',
      required: ['documentId'],
      properties: {
        documentId: { type: 'number' },
        sendEmail: { type: 'boolean', description: 'Whether to email recipients (default true).' },
      },
    },
    handler: (a, ctx) =>
      ctx.api(`/api/v1/documents/${encodeURIComponent(a.documentId)}/send`, {
        method: 'POST',
        body: { sendEmail: a.sendEmail !== false },
      }),
  },
  {
    name: 'documenso_delete_document',
    description: 'Delete a document by id.',
    inputSchema: {
      type: 'object',
      required: ['documentId'],
      properties: { documentId: { type: 'number' } },
    },
    handler: (a, ctx) =>
      ctx.api(`/api/v1/documents/${encodeURIComponent(a.documentId)}`, { method: 'DELETE' }),
  },
];
