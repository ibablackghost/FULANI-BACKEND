# Prompt — Backend Strapi Fulani Official (Architecture validée)

Copie-colle ce prompt tel quel à un agent / développeur backend.  
**Ne génère pas de frontend.** Backend uniquement.

> **Contraintes actuelles (local)** : pas de Docker, pas de Redis/BullMQ, pas de Cloudinary pour l’instant.  
> Médias = `imageUrl` / upload local Strapi. Jobs async = synchrones ou à brancher plus tard.  
> PostgreSQL local déjà configuré.

---

## Prompt à coller

```text
# ROLE

Tu es Lead Backend Engineer + Soft Architect, expert Strapi v5, PostgreSQL, Redis, e-commerce headless et intégrations marketing server-side.

Tu construis **fulani-api** : le cerveau de Fulani Official (marque de mode africaine contemporaine / tenues traditionnelles revisitée).

Le frontend Next.js consomme UNIQUEMENT ton API. Aucune logique métier côté front. Devise exclusive : **XOF (F CFA)**, prix entiers.

Architecture CTO VALIDÉE — respecte-la strictement.

================================================
STACK OBLIGATOIRE
================================================

- Strapi v5 (TypeScript)
- PostgreSQL
- Redis + BullMQ (ou équivalent) pour jobs async
- Cloudinary (médias)
- Docker + docker-compose (app, postgres, redis)
- JWT + Refresh Token
- Plugin Documentation (OpenAPI / Swagger)
- Cron Strapi + workers queue

================================================
PRINCIPES
================================================

1. Strapi = source de vérité commerce + intégrations.
2. Secrets JAMAIS exposés au front (Meta, Ads, Cloudinary, payment keys).
3. Toute intégration externe vit dans `src/integrations/<provider>/` et est indépendante.
4. Controllers fins → Services → Repositories. Pas de logique métier dans les controllers.
5. Pipeline OrderPaid 100% async, idempotent (clé = orderId).
6. Support de DEUX modes variantes :
   - Mode A (actuel live) : variants = format (Top/Ensemble) + price ; couleur/taille = options produit (métadonnées ligne commande).
   - Mode B (cible) : matrice Variant = format × color × size + stock + sku.
7. Prix toujours en XOF integer (ex. 25250, 125000). Jamais EUR.

================================================
MVP SCOPE (À IMPLÉMENTER MAINTENANT)
================================================

INCLUS MVP :
- Catalog (Product, Category, Collection, Color, Size, Variant, Stock)
- Customer / Auth (JWT + refresh)
- Address
- Cart + CartItem
- Checkout session
- Order + OrderLine
- Payment (Wave + Orange Money) + webhooks signés
- Email transactionnel (confirmation commande)
- AppSetting + MarketingConnection (config)
- Public marketing-config (pixel IDs only)
- GA4 : stockage Measurement ID / config (pas de collecte serveur des pageviews)
- Meta : config Pixel + Conversions API **Purchase** uniquement
- Swagger / OpenAPI
- Seed démo catalogue
- Docker compose

EXCLUS MVP (préparer stubs / interfaces vides seulement) :
- TikTok Events
- Google Ads ROI
- Google Merchant sync
- Meta Catalog sync
- Wishlist, Reviews, Coupons, Returns, Blog
- Dashboard analytics avancé

================================================
ARBORESCENCE CIBLE
================================================

fulani-api/
  config/
  database/
  docker/
  src/
    api/                      # content-types Strapi
    components/
    middlewares/              # rate-limit, correlation-id
    policies/
    services/                 # domain
      catalog/
      cart/
      checkout/
      order/
      inventory/
      payment/
      customer/
      marketing/
      notification/
    repositories/
    jobs/
      workers/
      queues.ts
    integrations/
      google/                 # ga4 config (+ stubs ads/merchant)
      meta/                   # pixel config + capi purchase
      tiktok/                 # stub
      cloudinary/
      email/
      payment/
        wave/
        orange-money/
      shipping/               # stub zones
    admin/                    # pages custom plus tard
    utils/
      money.ts                # XOF helpers
      idempotency.ts
      crypto.ts               # encrypt secrets at rest

================================================
CONTENT-TYPES MVP
================================================

### Referentials
- category : name, slug, description?, meta*
- collection : title, slug, eyebrow?, description?, heroImage?, products M2M
- color : name, slug, hex
- size : name, slug, sortOrder

### Catalog
- product :
  - name, slug, shortDescription, description (richtext/HTML)
  - category M2O, collections M2M, tags M2M (optionnel)
  - basePrice (integer XOF) = min variant price
  - compareAtPrice?
  - isNew, isFeatured, publishedAt
  - availableColors (json string[] OR relation) — pour mode A
  - availableSizes (json string[])
  - availableFormats (json string[]) — ["Top","Ensemble"]
  - variants : component repeatable OR relation 1:N variant
  - seo : metaTitle, metaDescription, canonicalPath?
  - media : image + gallery (Cloudinary)

- variant (collection type recommandé) :
  - product M2O
  - sku (unique)
  - format (enum/string: Top | Ensemble | Standard | …)
  - label
  - color (M2O Color?) nullable  — mode B
  - size (M2O Size?) nullable    — mode B
  - colorName, colorHex nullable — fallback mode A/import
  - price (integer XOF) required
  - compareAtPrice?
  - stock / stockQty (integer)
  - inStock (computed or boolean)
  - isDefault, isActive, position
  - image (media)?

### Commerce
- customer : email unique, password (Strapi users-permissions étendu OU collection custom liée), phone?, firstName, lastName
- address : customer M2O, label, line1, line2?, city, region, country (SN…), postalCode?, phone, isDefault
- cart : token (guest), customer?, currency=XOF, items
- cart-item : cart, variant, quantity, selectedColor?, selectedSize?, selectedFormat?, unitPrice snapshot
- order :
  - number (unique), status (pending|awaiting_payment|paid|fulfilled|cancelled|refunded)
  - customer?, email, phone
  - currency=XOF, subtotal, shippingFee, discount, total (integers)
  - shippingAddress (component), billingAddress?
  - paymentProvider, paymentStatus
  - lines 1:N
  - meta: idempotencyKey, utm*, clientIds (fbp, fbc, gclid) pour CAPI
- order-line : order, variant, sku, name, format?, color?, size?, qty, unitPrice, lineTotal
- payment :
  - order, provider (wave|orange_money), status, amount XOF
  - providerRef, rawWebhook (json encrypted/restricted), paidAt?
- inventory-movement : variant, delta, reason (order|manual|restock), order?, createdBy?
- app-setting : key unique, value json, group (general|shipping|marketing|payment)
- marketing-connection : provider (ga4|meta|…), status, config json (non-secret), secrets encrypted
- marketing-event-log : provider, eventName, order?, payload hash, status (pending|sent|failed), attempts, lastError?

================================================
APIs REST PUBLIQUES / APP
================================================

Préférer des controllers custom “BFF-like” pour le front :

### Catalog (déjà partiellement existant — aligner / compléter)
- GET /api/catalog/products
  query: page, pageSize, q, category, tag, format, sort (popular|price-low|price-high|rating|newest), priceMin, priceMax
  response shape PublicProduct[] + categories + tags + pagination + filtersApplied
- GET /api/products/slug/:slug
  → { product: PublicProduct, similarProducts: PublicProduct[] }
- Alias OK : /api/products/catalog

### PublicProduct (contrat front — NE PAS CASSER)
Respecter le shape documenté côté front (id=documentId, price min, currency XOF, availableColors/Sizes/Formats, variants[], imageUrl absolue ou résolvable, analytics.item_*).

### Auth / Customer
- POST /api/auth/local/register
- POST /api/auth/local
- POST /api/auth/refresh
- POST /api/auth/logout
- GET  /api/me
- PATCH /api/me
- CRUD /api/me/addresses

### Cart
- POST /api/cart                    → crée panier guest (token)
- GET  /api/cart/:token
- POST /api/cart/:token/items       body: variantId, qty, color?, size?, format?
- PATCH /api/cart/:token/items/:id
- DELETE /api/cart/:token/items/:id
- POST /api/cart/:token/attach      → lie au customer JWT

### Checkout & Payments
- POST /api/checkout/session
  body: cartToken, email, shippingAddress, shippingMethodId?
  → calcule totaux XOF, réserve stock soft (TTL), crée order awaiting_payment
- POST /api/payments/init
  body: orderId, provider (wave|orange_money), returnUrl, cancelUrl
  → URL redirect / deep link provider
- POST /api/payments/webhooks/wave
- POST /api/payments/webhooks/orange-money
  → vérif signature, mark paid, enqueue OrderPaid job (idempotent)
- GET  /api/orders/:id (owner only)
- GET  /api/me/orders

### Marketing public
- GET /api/public/marketing-config
  → { ga4MeasurementId?, metaPixelId?, tiktokPixelId?: null, enabled: {...} }
  JAMAIS de access tokens.

### Admin (RBAC)
- POST /api/admin/sync/meta-capi/test
- GET  /api/admin/orders
- PATCH /api/admin/orders/:id/status
- POST /api/admin/inventory/adjust

Permissions Public : find catalog only + marketing-config + cart/checkout guest flows.
Authenticated : me, orders, cart attach.
Admin : tout le reste.

================================================
JOB OrderPaid (BullMQ)
================================================

Trigger : payment webhook → status paid (une seule fois).

Steps (idempotents, retry exponential, DLQ) :
1. Lock order paid
2. Commit stock (décrément) + InventoryMovement
3. Email confirmation
4. Meta Conversions API event Purchase (event_id = order.number)
5. (stubs no-op) TikTok / Ads / Merchant
6. Notify admin (log + optional email)
7. marketing-event-log success/fail

================================================
INTEGRATIONS MVP
================================================

### Cloudinary
Upload provider Strapi. URLs HTTPS. Transforms thumb/large.

### Email
Provider : Resend ou SMTP. Templates : order_confirmed, payment_failed.

### Payment Wave
Adapter : createCheckout(order) → redirectUrl ; parseWebhook → { orderId, paid, ref }

### Payment Orange Money
Même interface PaymentProvider.

Interface commune :
  createPaymentIntent(order, urls): Promise<{ redirectUrl, providerRef }>
  verifyWebhook(req): Promise<{ ok, orderId, amount, providerRef }>

### Meta CAPI
- sendPurchase({ order, userData, customData })
- event_name=Purchase, event_id=order.number, currency=XOF, value=order.total
- user_data : em (hashed), ph hashed, fbp/fbc si fournis

### GA4
- Stocker measurementId dans AppSetting / MarketingConnection
- Exposer via marketing-config
- Pas d’ingestion hit-level côté serveur en MVP

================================================
SÉCURITÉ
================================================

- Chiffrer secrets marketing/payment at rest (AES-GCM, clé MASTER_KEY env)
- Rate limit auth + webhooks + checkout
- CORS : FRONTEND_URL only
- Webhook signature verification obligatoire
- Validation Zod (ou yup) sur tous body custom
- RBAC Strapi
- Logs sans PII claire (hash emails dans logs)

================================================
DOCKER
================================================

docker-compose :
- strapi
- postgres:16
- redis:7

.env.example avec :
HOST, PORT, APP_KEYS, JWT secrets, DATABASE_*, REDIS_URL,
CLOUDINARY_*, FRONTEND_URL, MASTER_KEY,
WAVE_*, ORANGE_MONEY_*, META_PIXEL_ID, META_CAPI_TOKEN, GA4_MEASUREMENT_ID

================================================
SEED
================================================

1. Colors + Sizes (S M L XL XXL + X si besoin)
2. Category mode
3. 5–10 products type ROSHI/CHIRO avec variants Top/Ensemble et prix XOF
4. availableColors / availableSizes listes
5. Admin user
6. AppSettings shipping fee sample (Dakar / régions)

================================================
DOCUMENTATION
================================================

- @strapi/plugin-documentation actif → /documentation
- README : install, migrate, seed, run workers, tester webhooks (ngrok)
- Exemples curl catalog + checkout (sandbox)

================================================
LIVRABLES
================================================

1. Repo fulani-api initialisé Strapi 5 TS
2. Content-types + services + routes custom listés
3. docker-compose up OK
4. Swagger à jour
5. Queue worker documenté
6. Webhooks payment stub/sandbox testables
7. Meta CAPI Purchase test mode
8. Seed catalogue
9. Contrats PublicProduct stables (compat front actuel)

================================================
ORDRE D’EXÉCUTION
================================================

1. Scaffold Strapi + Docker (PG + Redis)
2. Content-types referentials + product/variant
3. Catalog endpoints (compat PublicProduct)
4. Auth customer + addresses
5. Cart + checkout session + stock soft-reserve
6. Payments Wave/OM + webhooks + OrderPaid queue
7. Email + Meta CAPI Purchase
8. marketing-config public
9. Seed + Swagger + README
10. Stop. Ne pas implémenter TikTok/Merchant/Ads/Dashboard avancé.

Commence maintenant par le scaffold + docker-compose + content-types catalogue, puis les endpoints /api/catalog/products et /api/products/slug/:slug compatibles avec le front existant.
```

---

## Rappel décisions validées

| Décision | Valeur |
|----------|--------|
| Paiements MVP | Wave + Orange Money |
| Queue | Redis + jobs async |
| Marketing MVP | GA4 config + Meta CAPI Purchase |
| Devise | XOF exclusive |
| Front | Hors scope de ce prompt |
