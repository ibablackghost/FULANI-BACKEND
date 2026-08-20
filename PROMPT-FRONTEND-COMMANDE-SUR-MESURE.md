# Prompt Front — Formulaire commande sur mesure (Fulani)

Copie-colle ce fichier / ce prompt dans le projet **frontend** pour brancher le formulaire de commande sur mesure + mesures tailleur.

Le **backend Strapi gère déjà** l’enregistrement et l’envoi d’emails via Brevo.  
Le front doit seulement afficher le formulaire et appeler l’API.

---

## Prompt à coller

```text
Tu travailles sur le frontend Fulani Official (Next.js / React).

Intègre un formulaire « Commande sur mesure » branché sur Strapi.
Ne simule pas : appelle vraiment l’API. Devise XOF.

## Backend
- Base URL : NEXT_PUBLIC_STRAPI_URL (ex. http://localhost:1337 ou URL Railway)
- Endpoint :
  POST {STRAPI_URL}/api/custom-orders/submit
- Auth : aucune (public)
- Content-Type : application/json

## UX à construire

Page ou section « Sur mesure » / « Prendre mes mesures » :

### Bloc 1 — Identité (obligatoire)
- Nom (lastName)
- Prénom (firstName)
- Téléphone (phone)
- Adresse (address)
- Email (email)

### Bloc 2 — Commande (optionnel mais utile)
- Modèle / produit (productName) — préremplir si on vient d’une fiche produit
- Couleur (selectedColor) — depuis product.colors si dispo
- Format (selectedFormat) — Top / Ensemble
- Montant total (totalAmount) en XOF entier
- Avance (advanceAmount)
- Afficher le reste = total - avance (ne pas forcément envoyer remainingAmount, le backend le calcule)

### Bloc 3 — Mesures en cm (à côté / sous les tailles catalogue)
Champs numériques (décimaux OK) :
- epaule (Épaule)
- manche (Manche)
- poitrine (Poitrine)
- taille (Taille / tour de taille)
- longueurRobe (Longueur robe)
- tourDeFesse (Tour de fesse)
- ceinture (Ceinture)
- cou (Cou)
- longueurJupe (Longueur jupe)
- longueurPantalon (Longueur pantalon)
- largeurGrandBoubou (Largeur grand boubou)
- longueurBlouse (Longueur blouse)
- tourDeBras (Tour de bras)
- cuisse (Cuisse)
- poignet (Poignet)

Tous les champs mesures sont optionnels, mais affiche clairement le formulaire type fiche tailleur.

### Actions
- Bouton « Envoyer ma commande »
- Loading pendant le POST
- Succès : message « Demande bien reçue, un email de confirmation vous a été envoyé »
- Erreur : afficher error du JSON backend
- Reset du form après succès

## Payload exact (camelCase)

POST /api/custom-orders/submit

{
  "firstName": "Mouhammed Fadel",
  "lastName": "BA",
  "phone": "771234567",
  "email": "client@example.com",
  "address": "Dakar Plateau",
  "orderDate": "2026-08-20",
  "productName": "ROSHI",
  "selectedColor": "Noir",
  "selectedFormat": "Ensemble",
  "totalAmount": 45500,
  "advanceAmount": 20000,
  "epaule": 49,
  "manche": 63,
  "poitrine": 98,
  "taille": null,
  "longueurRobe": 92,
  "tourDeFesse": null,
  "ceinture": 88,
  "cou": 39,
  "longueurJupe": null,
  "longueurPantalon": 102,
  "largeurGrandBoubou": null,
  "longueurBlouse": null,
  "tourDeBras": 39,
  "cuisse": 72,
  "poignet": null,
  "notes": ""
}

Règles :
- firstName, lastName, phone, email, address = REQUIRED
- Ne pas envoyer de string vide pour les mesures : omit ou null
- Prix = entiers XOF (pas de décimales, pas de « FCFA » dans le JSON)
- email valide côté client avant submit

## Réponses API

Succès 201 :
{
  "ok": true,
  "message": "Commande sur mesure enregistrée.",
  "order": {
    "id": "string",
    "orderDate": "YYYY-MM-DD",
    "firstName": "...",
    "lastName": "...",
    "email": "...",
    "phone": "...",
    "status": "new",
    "emailStatus": "sent" | "failed" | "skipped" | "pending",
    "totalAmount": 45500,
    "advanceAmount": 20000,
    "remainingAmount": 25500
  }
}

Erreur 400 :
{
  "ok": false,
  "error": "firstName (prénom) est requis."
}

## Exemple fetch

async function submitCustomOrder(payload: CustomOrderPayload) {
  const base = process.env.NEXT_PUBLIC_STRAPI_URL;
  const res = await fetch(`${base}/api/custom-orders/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Échec envoi commande");
  }
  return data.order;
}

## Types TypeScript suggérés

type CustomOrderPayload = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  orderDate?: string;
  productName?: string;
  selectedColor?: string;
  selectedFormat?: string;
  totalAmount?: number;
  advanceAmount?: number;
  remainingAmount?: number;
  notes?: string;
  epaule?: number;
  manche?: number;
  poitrine?: number;
  taille?: number;
  longueurRobe?: number;
  tourDeFesse?: number;
  ceinture?: number;
  cou?: number;
  longueurJupe?: number;
  longueurPantalon?: number;
  largeurGrandBoubou?: number;
  longueurBlouse?: number;
  tourDeBras?: number;
  cuisse?: number;
  poignet?: number;
};

## Intégration fiche produit (bonus)

Sur la page produit :
1. Sélecteur couleur / format comme aujourd’hui
2. CTA « Commander sur mesure » qui ouvre le formulaire
3. Préremplir productName, selectedColor, selectedFormat, totalAmount (prix variante)
4. Si product.imagesByColor[couleur] existe, afficher cette photo à côté du form

## Hors scope front
- Ne pas appeler Brevo depuis le front
- Ne pas stocker les secrets Brevo côté client
- L’email confirmation / notif atelier est 100% backend

## Critères de done
- Formulaire UI complet (identité + mesures)
- POST réel vers /api/custom-orders/submit
- Gestion loading / succès / erreur
- Validation des 5 champs obligatoires + email
- Prix en XOF entiers
```

---

## Rappel backend (déjà prêt)

| Élément | Valeur |
|---------|--------|
| Endpoint | `POST /api/custom-orders/submit` |
| Auth | Public |
| Emails | Brevo (confirmation client + notif atelier) |
| Admin | Content Manager → **Commande sur mesure** |

Doc technique backend : `docs/commande-sur-mesure-brevo.md`
