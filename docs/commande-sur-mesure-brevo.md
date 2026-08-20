# Commande sur mesure + mesures + Brevo

Formulaire public pour enregistrer une commande tailleur (identité + mesures) et envoyer les emails via **Brevo**.

---

## Endpoint

```http
POST /api/custom-orders/submit
Content-Type: application/json
```

Auth : **aucune** (public).

---

## Body JSON (front)

### Obligatoires
| Champ | Alias FR acceptés | Exemple |
|--------|-------------------|---------|
| `firstName` | `prenom` | `"Mouhammed Fadel"` |
| `lastName` | `nom` | `"BA"` |
| `phone` | `tel`, `telephone` | `"771234567"` |
| `email` | `mail` | `"client@mail.com"` |
| `address` | `adresse` | `"Dakar, …"` |

### Optionnels — commande
| Champ | Alias | Description |
|--------|--------|-------------|
| `orderDate` | `date` | `YYYY-MM-DD` (défaut = aujourd’hui) |
| `totalAmount` | `montantTotal` | XOF entier |
| `advanceAmount` | `avance` | XOF (défaut 0) |
| `remainingAmount` | `reste` | calculé si total fourni |
| `productName` | | modèle demandé |
| `selectedColor` | `couleur` | |
| `selectedFormat` | `format` | Top / Ensemble |
| `notes` | | |

### Optionnels — mesures (cm)
`epaule`, `manche`, `poitrine`, `taille`, `longueurRobe`, `tourDeFesse`, `ceinture`, `cou`, `longueurJupe`, `longueurPantalon`, `largeurGrandBoubou`, `longueurBlouse`, `tourDeBras`, `cuisse`, `poignet`

---

## Exemple

```json
{
  "firstName": "Mouhammed Fadel",
  "lastName": "BA",
  "phone": "771234567",
  "email": "client@example.com",
  "address": "Dakar Plateau",
  "productName": "ROSHI",
  "selectedColor": "Noir",
  "selectedFormat": "Ensemble",
  "totalAmount": 45500,
  "advanceAmount": 20000,
  "epaule": 49,
  "manche": 63,
  "poitrine": 98,
  "longueurRobe": 92,
  "ceinture": 88,
  "cou": 39,
  "longueurPantalon": 102,
  "tourDeBras": 39,
  "cuisse": 72
}
```

Réponse `201` :

```json
{
  "ok": true,
  "message": "Commande sur mesure enregistrée.",
  "order": {
    "id": "…",
    "status": "new",
    "emailStatus": "sent"
  }
}
```

---

## Admin Strapi

Content Manager → **Commande sur mesure**  
Toutes les fiches reçues (client, montants, mesures, statut email).

---

## Brevo (variables d’environnement)

```bash
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=noreply@fulaniofficial.com
BREVO_SENDER_NAME=Fulani Official
BREVO_NOTIFY_EMAIL=atelier@fulaniofficial.com
```

Au submit :
1. Email **confirmation** → client  
2. Email **notification** → `BREVO_NOTIFY_EMAIL` (atelier)

Si Brevo n’est pas configuré, la commande est quand même sauvée (`emailStatus: skipped`).

---

## Front — UX suggérée

1. Formulaire identité (nom, prénom, tel, adresse, mail)  
2. Bloc **Mesures** à côté / en dessous des tailles catalogue  
3. `POST` vers `/api/custom-orders/submit`  
4. Message de succès + éventuellement reset du form
