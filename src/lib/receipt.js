import jsPDF from 'jspdf'

export function generateReceipt({ reference, montant, commission, montantNet, offreTitle, influenceurNom, clientNom, date }) {
  const doc = new jsPDF()

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Influo', 20, 25)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120)
  doc.text('Reçu de paiement', 20, 33)

  doc.setDrawColor(220)
  doc.line(20, 40, 190, 40)

  doc.setTextColor(0)
  doc.setFontSize(10)
  let y = 52

  const row = (label, value) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text(label, 20, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(String(value), 190, y, { align: 'right' })
    y += 9
  }

  row('Référence', reference)
  row('Date', date)
  row('Offre', offreTitle || '—')
  row('Influenceur', influenceurNom)
  row('Client', clientNom)

  doc.line(20, y, 190, y)
  y += 10

  row('Montant total', `${montant} €`)
  row('Commission plateforme (10%)', `${commission} €`)
  row('Montant net influenceur', `${montantNet} €`)

  doc.line(20, y, 190, y)
  y += 15

  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text('Ce reçu confirme le paiement effectué sur la plateforme Influo.', 20, y)

  doc.save(`recu-influo-${reference}.pdf`)
}
