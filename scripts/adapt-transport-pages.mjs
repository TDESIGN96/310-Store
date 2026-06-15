import fs from 'node:fs'
import path from 'node:path'

function adaptInvoicePage(src, dest) {
  let s = fs.readFileSync(src, 'utf8')
  const reps = [
    [/invoices_page\./g, 'transport_invoices_page.'],
    [
      /validateInvoiceDraft\(draft\.value, selectedRowsCount, t\)/g,
      "validateInvoiceDraft(draft.value, selectedRowsCount, t, 'transport_invoices_page')",
    ],
    [/'\/invoices'/g, "'/transport-invoices'"],
    [/`\/invoices\//g, '`/transport-invoices/'],
    [/to="\/invoices\//g, 'to="/transport-invoices/'],
    [/navigateTo\('\/invoices/g, "navigateTo('/transport-invoices"],
    [/navigateTo\(`\/invoices/g, 'navigateTo(`/transport-invoices'],
  ]
  for (const [from, to] of reps) s = s.replace(from, to)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, s)
}

adaptInvoicePage('app/pages/invoices/create.vue', 'app/pages/transport-invoices/create.vue')
adaptInvoicePage('app/pages/invoices/edit/[id].vue', 'app/pages/transport-invoices/edit/[id].vue')
adaptInvoicePage('app/pages/invoices/return/[id].vue', 'app/pages/transport-invoices/return/[id].vue')
console.log('done')
