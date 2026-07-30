# Prompt — Connecter le frontend React à Fulani Strapi

Copie-colle ce prompt dans Cursor (côté frontend React) pour brancher réellement le catalogue sur le backend.

---

## Prompt à coller

```text
Tu travailles sur le frontend React de Fulani Official (e-commerce mode / tenues africaines).

Connecte-le RÉELLEMENT au backend Strapi déjà prêt. Ne simule pas les données. Remplace mocks / JSON locaux par les appels API ci-dessous.

## Backend
- Base URL locale : http://localhost:1337
- Variable d’env frontend : VITE_STRAPI_URL ou NEXT_PUBLIC_STRAPI_URL = http://localhost:1337
- Auth publique : les endpoints catalogue sont ouverts (pas de token requis en lecture)
- Devise : XOF (FCFA), prix en entiers (ex. 25250)

## Endpoints à utiliser (prioritaires)

### 1) Liste catalogue + filtres
GET {STRAPI_URL}/api/catalog/products

Query params supportés :
- page (défaut 1)
- pageSize (défaut 12, max 48)
- q (recherche texte)
- category (slug, ex. mode)
- tag (slug, ex. fulani)
- format (ex. Top, Ensemble)
- sort : popular | price-low | price-high | rating | newest
- priceMin, priceMax (entiers XOF)

Réponse :
{
  products: PublicProduct[],
  categories: [{ id, slug, name, ... }],
  tags: [{ id, slug, name }],
  pagination: { page, pageSize, total, pageCount, totalItems, totalPages },
  filtersApplied: { q, category, tag, format, sort, priceMin, priceMax }
}

Alias équivalent : GET /api/products/catalog

### 2) Fiche produit par slug
GET {STRAPI_URL}/api/products/slug/:slug
ou
GET {STRAPI_URL}/api/catalog/products/:slug

Réponse :
{
  product: PublicProduct,
  similarProducts: PublicProduct[]
}

### 3) (optionnel) REST Strapi brut
GET /api/products?filters[slug][$eq]=roshi&populate[variants]=true&populate[category]=true&populate[tags]=true
Préférer les endpoints /catalog/* ci-dessus (payload déjà prêt pour le front).

## Shape PublicProduct (à typer en TypeScript)

{
  id: string;                 // documentId Strapi
  slug: string;               // ex. "roshi"
  name: string;               // ex. "ROSHI"
  shortDescription: string | null;
  description: string | null; // HTML possible
  price: number;              // prix min des variantes
  currency: "XOF";
  compareAtPrice: number | null;
  rating: number;
  reviews: number;
  imageUrl: string | null;    // URL HTTPS externe (souvent fulaniofficial.com)
  imageAlt: string | null;
  galleryUrls: string[];
  availableColors: string[];  // ex. ["Noir","Blanc","Blue","Rouge",...]
  availableSizes: string[];   // ex. ["S","M","L","XL","XXL","X"]
  availableFormats: string[]; // ex. ["Top","Ensemble"]
  colors: string[];           // alias de availableColors
  sizes: string[];            // alias de availableSizes
  formats: string[];          // alias de availableFormats
  category: { id, slug, name } | null;
  tags: { id, slug, name }[];
  variants: PublicVariant[];
  inStock: boolean;
  stockQty: number;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalPath: string | null;
  analytics: { item_id, item_name, item_category, price, currency };
}

## Shape PublicVariant

{
  id: string;
  name: string;
  sku: string;                // ex. "mode-roshi-top"
  format: string;             // "Top" | "Ensemble" | "Standard" | ...
  label: string;
  size: string | null;        // rempli si import matrice
  colorName: string | null;   // rempli si import matrice
  colorHex: string | null;
  price: number | null;       // prix de CETTE variante (Top 25250, Ensemble 45500, etc.)
  compareAtPrice: number | null;
  stock: number;
  stockQty: number;
  inStock: boolean;
  isDefault: boolean;
  isActive: boolean;
  position: number;
  imageUrl: string | null;
}

## UX produit attendue (mode Fulani)

Sur la fiche produit :
1. Afficher imageUrl / galleryUrls
2. Sélecteur de FORMAT (Top / Ensemble) → met à jour le prix via variants[].price où variant.format === format choisi
3. Sélecteur de COULEUR depuis product.colors (ou availableColors)
4. Sélecteur de TAILLE depuis product.sizes (ou availableSizes)
5. Prix affiché = variante format sélectionnée (pas seulement product.price)
6. Bouton panier désactivé si !inStock

Si colorName/size sont null sur les variants (import sans matrice) :
- les variants ne portent que le format + prix
- couleur/taille sont des options produit (à envoyer au panier / checkout comme métadonnées ligne)

Si colorName/size sont remplis (import matrice) :
- trouver la variant exacte : format + colorName + size
- utiliser son sku / price / stock

## Ce que tu dois implémenter

1. Client API typé (fetch/axios) avec baseURL env
2. Hooks ou loaders : useCatalog(filters), useProduct(slug)
3. Page catalogue : grille produits, filtres category/sort/q, pagination
4. Page produit : slug dynamique, sélecteurs format/couleur/taille, prix live, similaires
5. Gestion erreurs / loading / empty states
6. Images : utiliser imageUrl tel quel (URL absolue). Si URL relative /uploads/…, préfixer STRAPI_URL
7. CORS : si besoin, configurer le front pour appeler localhost:1337 ; le backend Strapi autorise en général le dev local — si CORS bloque, documente la fix côté Strapi config/middlewares

## Contraintes
- Pas de données fake une fois branché
- Ne casse pas le design existant : branche les données sur les composants déjà là
- Prix formatés en fr-FR + « F CFA » ou « XOF » (ex. 25 250 F CFA)
- description peut contenir du HTML → dangerouslySetInnerHTML seulement si déjà le pattern du projet, sinon sanitize

## Vérification
- Backend tourne : npm run develop dans fulani-backend → http://localhost:1337
- Test manuel :
  - GET http://localhost:1337/api/catalog/products?category=mode
  - GET http://localhost:1337/api/products/slug/roshi
- Le front doit afficher ROSHI, CHIRO, etc. avec prix et options

Commence par inspecter la structure du frontend (pages boutique / produit / panier), puis branche catalogue + fiche produit en premier.
```

---

## Endpoints rapides (rappel)

| Usage | URL |
|---|---|
| Catalogue | `GET http://localhost:1337/api/catalog/products?category=mode` |
| Produit | `GET http://localhost:1337/api/products/slug/roshi` |
| Admin Strapi | `http://localhost:1337/admin` |
