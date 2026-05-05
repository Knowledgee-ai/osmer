/** Five seed AI Employees auto-installed for new orgs. */
export interface SeedEmployee {
  name: string;
  description: string;
  toolbelt: string[];
}

export const SEED_EMPLOYEES: SeedEmployee[] = [
  {
    name: 'Account Brief Drafter',
    description:
      'Given a prospect company name (and optional meeting context), produce a 1-2 page meeting prep brief covering: company overview, recent news, key personnel we know about, our prior history with them (from memory), and three conversation starters. Cite sources.',
    toolbelt: ['memory.query', 'web.search', 'web.fetch'],
  },
  {
    name: 'Follow-up Email Writer',
    description:
      'Given meeting notes (paste in inputs.notes) and a recipient (inputs.recipient), draft a polished follow-up email. Use memory.query to pull any preferences for that recipient (tone, format) before drafting. Output only the email draft — never sends.',
    toolbelt: ['memory.query', 'email.draft'],
  },
  {
    name: 'Proposal Drafter',
    description:
      'Given a customer (inputs.customer) and a product or scope (inputs.product), draft a tailored proposal in our standard style. Pull our closest matching proposals from memory, mirror their structure, and produce a downloadable document.',
    toolbelt: ['memory.query', 'doc.markdown_to_pdf', 'file.write'],
  },
  {
    name: 'Customer Research Brief',
    description:
      'Research a customer or prospect (inputs.target — name or URL) and synthesize a brief covering business model, recent funding, leadership changes, tech stack signals, and likely pain points. Cite sources inline.',
    toolbelt: ['memory.query', 'web.search', 'web.fetch'],
  },
  {
    name: 'Meeting Notes → Action Items',
    description:
      'Given meeting notes (inputs.notes), produce a clean action-items list (owner, action, by-when) plus key decisions captured. If the org has granted memory writeback, propose decisions to record into memory; the user approves before they land.',
    toolbelt: ['memory.query', 'memory.write'],
  },
];
