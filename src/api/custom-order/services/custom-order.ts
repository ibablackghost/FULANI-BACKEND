import { factories } from '@strapi/strapi';
import {
  getBrevoNotifyEmails,
  isBrevoConfigured,
  sendBrevoEmail,
} from '../../../integrations/brevo/mail';

type AnyRecord = Record<string, any>;

const MEASUREMENT_FIELDS = [
  'epaule',
  'manche',
  'poitrine',
  'taille',
  'longueurRobe',
  'tourDeFesse',
  'ceinture',
  'cou',
  'longueurJupe',
  'longueurPantalon',
  'largeurGrandBoubou',
  'longueurBlouse',
  'tourDeBras',
  'cuisse',
  'poignet',
] as const;

const MEASUREMENT_LABELS: Record<(typeof MEASUREMENT_FIELDS)[number], string> = {
  epaule: 'Épaule',
  manche: 'Manche',
  poitrine: 'Poitrine',
  taille: 'Taille',
  longueurRobe: 'Longueur robe',
  tourDeFesse: 'Tour de fesse',
  ceinture: 'Ceinture',
  cou: 'Cou',
  longueurJupe: 'Longueur jupe',
  longueurPantalon: 'Longueur pantalon',
  largeurGrandBoubou: 'Largeur grand boubou',
  longueurBlouse: 'Longueur blouse',
  tourDeBras: 'Tour de bras',
  cuisse: 'Cuisse',
  poignet: 'Poignet',
};

const toOptionalInt = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
};

const toOptionalDecimal = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
};

const requiredString = (value: unknown, field: string) => {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${field} est requis.`);
  return text;
};

const requiredEmail = (value: unknown) => {
  const email = requiredString(value, 'email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('email invalide.');
  }
  return email.toLowerCase();
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatXof = (value?: number | null) => {
  if (value === undefined || value === null) return '—';
  return `${Math.round(value).toLocaleString('fr-FR')} XOF`;
};

const formatCm = (value?: number | null) => {
  if (value === undefined || value === null) return '—';
  return `${value} cm`;
};

export default factories.createCoreService('api::custom-order.custom-order' as any, ({ strapi }) => ({
  normalizePayload(body: AnyRecord) {
    const lastName = requiredString(body.lastName ?? body.nom, 'lastName (nom)');
    const firstName = requiredString(body.firstName ?? body.prenom, 'firstName (prénom)');
    const phone = requiredString(body.phone ?? body.tel ?? body.telephone, 'phone');
    const email = requiredEmail(body.email ?? body.mail);
    const address = requiredString(body.address ?? body.adresse, 'address');

    const totalAmount = toOptionalInt(body.totalAmount ?? body.montantTotal);
    const advanceAmount = toOptionalInt(body.advanceAmount ?? body.avance) ?? 0;
    let remainingAmount = toOptionalInt(body.remainingAmount ?? body.reste);
    if (remainingAmount === undefined && totalAmount !== undefined) {
      remainingAmount = Math.max(totalAmount - advanceAmount, 0);
    }

    const measurements: AnyRecord = {};
    for (const key of MEASUREMENT_FIELDS) {
      const aliases: Record<string, unknown> = {
        epaule: body.epaule,
        manche: body.manche,
        poitrine: body.poitrine,
        taille: body.taille,
        longueurRobe: body.longueurRobe ?? body.longueur_robe,
        tourDeFesse: body.tourDeFesse ?? body.tour_de_fesse,
        ceinture: body.ceinture,
        cou: body.cou,
        longueurJupe: body.longueurJupe ?? body.longueur_jupe,
        longueurPantalon: body.longueurPantalon ?? body.longueur_pantalon,
        largeurGrandBoubou: body.largeurGrandBoubou ?? body.largeur_grand_boubou,
        longueurBlouse: body.longueurBlouse ?? body.longueur_blouse,
        tourDeBras: body.tourDeBras ?? body.tour_de_bras,
        cuisse: body.cuisse,
        poignet: body.poignet,
      };
      const parsed = toOptionalDecimal(aliases[key]);
      if (parsed !== undefined) measurements[key] = parsed;
    }

    const orderDateRaw = body.orderDate ?? body.date;
    const orderDate =
      orderDateRaw && String(orderDateRaw).trim()
        ? String(orderDateRaw).slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    return {
      orderDate,
      lastName,
      firstName,
      phone,
      email,
      address,
      totalAmount,
      advanceAmount,
      remainingAmount,
      notes: body.notes ? String(body.notes).trim() : undefined,
      productName: body.productName ? String(body.productName).trim() : undefined,
      selectedColor: body.selectedColor ?? body.couleur ?? undefined,
      selectedFormat: body.selectedFormat ?? body.format ?? undefined,
      status: 'new' as const,
      emailStatus: 'pending' as const,
      ...measurements,
    };
  },

  buildCustomerEmailHtml(order: AnyRecord) {
    const rows = MEASUREMENT_FIELDS.map(
      (key) =>
        `<tr><td style="padding:4px 12px 4px 0">${MEASUREMENT_LABELS[key]}</td><td>${formatCm(order[key])}</td></tr>`
    ).join('');

    return `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2>Merci ${escapeHtml(order.firstName)} !</h2>
        <p>Nous avons bien reçu votre demande de <strong>commande sur mesure</strong> Fulani Official.</p>
        <h3>Vos informations</h3>
        <ul>
          <li>Nom : ${escapeHtml(order.lastName)}</li>
          <li>Prénom : ${escapeHtml(order.firstName)}</li>
          <li>Téléphone : ${escapeHtml(order.phone)}</li>
          <li>Email : ${escapeHtml(order.email)}</li>
          <li>Adresse : ${escapeHtml(order.address)}</li>
        </ul>
        <h3>Commande</h3>
        <ul>
          <li>Date : ${escapeHtml(order.orderDate)}</li>
          <li>Modèle : ${escapeHtml(order.productName || '—')}</li>
          <li>Couleur : ${escapeHtml(order.selectedColor || '—')}</li>
          <li>Format : ${escapeHtml(order.selectedFormat || '—')}</li>
          <li>Montant total : ${formatXof(order.totalAmount)}</li>
          <li>Avance : ${formatXof(order.advanceAmount)}</li>
          <li>Reste : ${formatXof(order.remainingAmount)}</li>
        </ul>
        <h3>Mesures (cm)</h3>
        <table>${rows}</table>
        <p style="margin-top:24px">Notre atelier vous recontacte rapidement pour confirmer.</p>
        <p>— L’équipe Fulani Official</p>
      </div>
    `;
  },

  buildNotifyEmailHtml(order: AnyRecord) {
    const rows = MEASUREMENT_FIELDS.map(
      (key) =>
        `<tr><td style="padding:4px 12px 4px 0">${MEASUREMENT_LABELS[key]}</td><td>${formatCm(order[key])}</td></tr>`
    ).join('');

    return `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2>Nouvelle commande sur mesure #${escapeHtml(order.id ?? order.documentId)}</h2>
        <p><strong>${escapeHtml(order.firstName)} ${escapeHtml(order.lastName)}</strong> — ${escapeHtml(order.phone)} — ${escapeHtml(order.email)}</p>
        <p>${escapeHtml(order.address)}</p>
        <ul>
          <li>Modèle : ${escapeHtml(order.productName || '—')}</li>
          <li>Couleur : ${escapeHtml(order.selectedColor || '—')}</li>
          <li>Format : ${escapeHtml(order.selectedFormat || '—')}</li>
          <li>Total : ${formatXof(order.totalAmount)} | Avance : ${formatXof(order.advanceAmount)} | Reste : ${formatXof(order.remainingAmount)}</li>
        </ul>
        <h3>Mesures</h3>
        <table>${rows}</table>
        ${order.notes ? `<p><strong>Notes :</strong> ${escapeHtml(order.notes)}</p>` : ''}
      </div>
    `;
  },

  async sendOrderEmails(order: AnyRecord) {
    if (!isBrevoConfigured()) {
      return { emailStatus: 'skipped' as const, emailError: 'Brevo non configuré' };
    }

    const notifyEmails = getBrevoNotifyEmails();

    const customer = await sendBrevoEmail({
      to: [{ email: order.email, name: `${order.firstName} ${order.lastName}` }],
      subject: 'Fulani Official — confirmation commande sur mesure',
      htmlContent: this.buildCustomerEmailHtml(order),
      replyTo: notifyEmails[0] ? { email: notifyEmails[0] } : undefined,
    });

    let notifyOk = true;
    let notifyError = '';

    if (notifyEmails.length > 0) {
      const notify = await sendBrevoEmail({
        to: notifyEmails.map((email) => ({ email, name: 'Atelier Fulani' })),
        subject: `[Sur mesure] ${order.firstName} ${order.lastName} — ${order.productName || 'commande'}`,
        htmlContent: this.buildNotifyEmailHtml(order),
        replyTo: { email: order.email, name: `${order.firstName} ${order.lastName}` },
      });
      notifyOk = notify.ok;
      if (!notify.ok) notifyError = notify.error;
    }

    if (customer.ok && notifyOk) {
      return { emailStatus: 'sent' as const, emailError: null };
    }

    const errors = [
      !customer.ok ? `client: ${customer.error}` : null,
      !notifyOk ? `atelier: ${notifyError}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    return { emailStatus: 'failed' as const, emailError: errors };
  },

  async submitPublic(body: AnyRecord) {
    const data = this.normalizePayload(body);

    const created = await strapi.db.query('api::custom-order.custom-order').create({
      data,
    });

    try {
      const emailResult = await this.sendOrderEmails(created);
      const updated = await strapi.db.query('api::custom-order.custom-order').update({
        where: { id: created.id },
        data: {
          emailStatus: emailResult.emailStatus,
          emailError: emailResult.emailError,
        },
      });
      return updated;
    } catch (error: any) {
      strapi.log.error('[custom-order] Envoi Brevo échoué', error);
      return strapi.db.query('api::custom-order.custom-order').update({
        where: { id: created.id },
        data: {
          emailStatus: 'failed',
          emailError: error?.message || 'Erreur email',
        },
      });
    }
  },
}));
