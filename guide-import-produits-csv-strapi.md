# Importer des produits CSV dans Strapi (Fulani)

Guide pour transformer un export WooCommerce Fulani (`wc-product-export-*.csv`) en CSV compatible Strapi, puis l’insérer via le script d’import — catalogue **Mode**.

## Prérequis

Content-types catalogue déjà en place dans ce repo :

- **Category** (`/api/categories`)
- **Product** (`/api/products`) + routes publiques `/api/catalog/products` et `/api/products/slug/:slug`
- **Variant** (`/api/variants`)
- **Tag** (`/api/tags`)

Schémas : `src/api/product/.../schema.json`, `src/api/variant/.../schema.json`.

---

## Principe

Strapi n’importe **pas** le CSV WooCommerce brut. On passe par 2 fichiers :

| Fichier | Rôle |
|---|---|
| Export Woo (`wc-product-export-….csv`) | Source brute (FR, métas WP, IDs Woo) |
| CSV enrichi (`produits_mode_enrichi.csv`) | Format cible lu par `scripts/import-mode.mjs` |

Le script crée / met à jour :

- **Category** (ex. `mode`)
- **Product** (ligne `Type=variable`)
- **Variant** (lignes `Type=variation`)
- **Tag** (optionnel)

L’image est stockée en URL externe dans `product.imageUrl` (pas d’upload disque obligatoire).

---

## 1. Structure WooCommerce (export Fulani)

Exemple : `wc-product-export-29-7-2026-1785333248464.csv`  
→ produits parents (`variable`) + variations (Top / Ensemble, couleur, taille…).

### Lignes parents (`Type = variable`)

Contiennent le nom, descriptions, images, attributs possibles (type / couleur / taille).  
Le **prix** est souvent vide sur le parent.

### Lignes variations (`Type = variation`)

Contiennent le **prix** (`Tarif régulier`), l’image optionnelle, et le lien parent `Parent = id:1875`.

Colonnes utiles côté Woo (FR) :

| Colonne Woo | Exemple | Usage Strapi |
|---|---|---|
| `Type` | `variable` / `variation` | Même logique |
| `Nom` | `ROSHI` | `product.name` |
| `Description courte` | … | `shortDescription` |
| `Description` | HTML | `description` |
| `Images` | URL(s) séparées par `, ` | Première URL → `imageUrl` |
| `Tarif régulier` | `25250` | Prix variante (XOF entier) |
| `Parent` | `id:1875` | Relie variation → parent (à remplacer par SKU) |
| `Nom de l’attribut 1` | `type` | Attribut principal (Top / Ensemble) → `variant.format` |
| `Valeur(s) de l’attribut 1 ` | `Top` / `Top, Ensemble` | Valeur variante |
| `Nom de l’attribut 2` | `couleur` | → `variant.colorName` |
| `Nom de l’attribut 3` | `taille` | → `variant.size` |
| `Catégories` | `Non classé` | À remplacer par `MODE` |
| `En stock ?` / `Stock` | `1` / vide | `variant.stock` |

---

## 2. Format CSV cible (enrichi) — celui que Strapi attend

Référence : `produits_mode_enrichi.csv` (à la racine du projet ou dans `data/`).

### En-têtes obligatoires / recommandés

```csv
Name,SKU,Type,Categories,Regular price,Short description,Description,Images,Link,Parent,Attribute 1 name,Attribute 1 value(s),Attribute 1 visible,Attribute 1 global,Attribute 1 default,Attribute 2 name,Attribute 2 value(s),Attribute 3 name,Attribute 3 value(s),Strapi category,Stock,Slug,Meta title,Meta description,Status,Compare at price,Tags,Image alt text,Gallery images
```

### Règles

1. **1 ligne parent** `Type=variable` + **N lignes** `Type=variation`.
2. Le parent a un **`SKU` unique** (ex. `mode-roshi`).
3. Chaque variation a un **`SKU` unique** (ex. `mode-roshi-top`, `mode-roshi-ensemble`).
4. La variation pointe vers le parent via **`Parent = SKU du parent`** (pas `id:333`).
5. Le prix est sur les **variations** (`Regular price`), pas forcément sur le parent.
6. `Status` = `published` ou `draft`.
7. `Slug` uniquement sur le parent (uid Strapi).
8. `Images` = URL HTTPS publique (1re URL si plusieurs).
9. `Strapi category` = `MODE` (ou autre slug catalogue Fulani).

### Mapping attributs mode → Variant Strapi

| Attribut CSV | Champ Strapi |
|---|---|
| Attribute 1 (souvent `Type` : Top, Ensemble) | `variant.format` (+ `label`) |
| Attribute 2 (`couleur`) | `variant.colorName` |
| Attribute 3 (`taille`) | `variant.size` |

> Si une seule dimension change le prix (ex. Top vs Ensemble), mets-la en **Attribute 1**.  
> Couleur / taille peuvent rester en Attribute 2 / 3 même si le prix est identique.

### Exemple mode — ROSHI

À partir de `ROSHI` (parent Woo) + variations Top `25250` / Ensemble `45500` :

**Parent**

```csv
ROSHI,mode-roshi,variable,MODE,,"Cras in blandit…","<p>Le <strong>Roshi</strong>…</p>",https://fulaniofficial.com/wp-content/uploads/2024/10/A7-scaled.jpeg,,,"Type","Top, Ensemble",1,0,Top,,,,MODE,,roshi,"ROSHI | Fulani","Habit traditionnel revisitée…",published,,Mode|Fulani,,
```

**Variations**

```csv
ROSHI - Top,mode-roshi-top,variation,MODE,25250,,,,"",mode-roshi,Type,Top,1,0,,,,,,,MODE,10,,,,,published,,,
ROSHI - Ensemble,mode-roshi-ensemble,variation,MODE,45500,,,,"",mode-roshi,Type,Ensemble,1,0,,,,,,,MODE,10,,,,,published,,,
```

---

## 3. Mapping Woo → CSV enrichi → Strapi

| Woo (FR) | CSV enrichi | Champ Strapi |
|---|---|---|
| `Nom` (variable) | `Name` | `product.name` |
| *(à créer)* | `SKU` | clé upsert produit / parent |
| *(à créer)* | `Slug` | `product.slug` |
| `Description courte` | `Short description` | `product.shortDescription` |
| `Description` | `Description` | `product.description` |
| 1re URL de `Images` | `Images` | `product.imageUrl` |
| `Catégories` / manuel | `Strapi category` | relation `category` |
| `Étiquettes` | `Tags` (`\|` séparés) | relation `tags` |
| `Publié` (`1`) | `Status=published` | `publishedAt` |
| `Nom` + attr (variation) | `Name` | `variant.name` |
| *(à créer)* | `SKU` variation | `variant.sku` |
| `Parent` `id:XXX` | `Parent` = SKU parent | relation `variant.product` |
| `Tarif régulier` | `Regular price` | `variant.price` (+ min → `product.price`) |
| `Stock` | `Stock` | `variant.stock` |
| Attr. 1 (Type) | `Attribute 1 value(s)` | `variant.format` |
| Attr. 2 (couleur) | `Attribute 2 value(s)` | `variant.colorName` |
| Attr. 3 (taille) | `Attribute 3 value(s)` | `variant.size` |

Prix produit Strapi = **minimum** des prix des variations.

---

## 4. Checklist de préparation du CSV

1. Exporter WooCommerce Fulani → CSV.
2. Pour chaque parent :
   - inventer `SKU` + `Slug` (minuscules, tirets, uniques) — préfixe `mode-` recommandé ;
   - nettoyer HTML si besoin ;
   - fixer `Strapi category` = `MODE` ;
   - prendre la **première** URL image.
3. Pour chaque variation :
   - `Parent` = SKU parent (plus `id:1875`) ;
   - `SKU` unique ;
   - `Regular price` en entier XOF (ex. `25250`) ;
   - `Attribute 1 value(s)` = valeur vendable (Top, Ensemble…) ;
   - renseigner couleur / taille si présentes.
4. Enregistrer en UTF-8 : `produits_mode_enrichi.csv`.
5. (Optionnel) Convertir automatiquement avec `scripts/convert-wc-to-enrichi.mjs`.

---

## 5. Insertion dans Strapi (dashboard Admin)

### Via l’admin (recommandé)

1. Démarre Strapi : `npm run develop`
2. Ouvre l’admin → menu **Import Produits CSV**
3. Choisis `produits_mode_enrichi.csv`
4. Options :
   - **Test à blanc** : simule sans écrire
   - **Media Library** : upload aussi les images (sinon URLs externes dans `imageUrl`)
   - **Remplacer la catégorie** : efface Mode puis réimporte
5. Clique **Lancer l’import** → rapport (créés / mis à jour / erreurs)

L’import crée automatiquement : catégorie, tags, produits, variantes (format Top/Ensemble, prix, stock, `imageUrl`).

### Via script CLI (alternative)

```powershell
$env:STRAPI_IMPORT_TOKEN="ton_token"
npm run import:mode
# ou dry-run :
npm run import:mode:dry
```

---

## 6. Créer les données à la main (sans Woo)

Tu peux créer le CSV enrichi dans Excel / Google Sheets :

1. Ligne 1 = en-têtes (§2).
2. Une ligne `variable` par produit.
3. Une ligne `variation` par type / couleur / taille vendable.
4. Exporter **CSV UTF-8**.
5. Lancer l’import.

Champs minimum d’un parent :

- `Name`, `SKU`, `Type=variable`, `Slug`, `Description` (ou short), `Images`, `Strapi category`, `Status`
- `Attribute 1 name` + `Attribute 1 value(s)` (liste) + `Attribute 1 default`

Champs minimum d’une variation :

- `Name`, `SKU`, `Type=variation`, `Parent`, `Regular price`, `Attribute 1 value(s)`, `Stock`, `Status`

---

## 7. Vérification après import

Dans Strapi Admin ou API :

```http
GET /api/products?filters[slug][$eq]=roshi&populate=variants,category,tags
```

Contrôler :

- produit publié + `imageUrl` HTTPS
- variantes avec `sku`, `price`, `stock`, `format` (et `colorName` / `size` si renseignés)
- `product.price` = plus bas prix variante
- catégorie `MODE`

---

## Fichiers de référence

| Fichier | Rôle |
|---|---|
| `wc-product-export-*.csv` | Export Woo brut (Fulani) |
| `produits_mode_enrichi.csv` | CSV enrichi mode |
| `scripts/convert-wc-to-enrichi.mjs` | Convertisseur Woo → enrichi |
| `scripts/import-mode.mjs` | Import CLI (alternative) |
| `src/utils/import-mode.ts` | Logique d’import (Admin + CLI) |
| `src/admin/pages/ImportMode.tsx` | Page Admin « Import Produits CSV » |
| `src/api/product/.../schema.json` | Schéma Product |
| `src/api/variant/.../schema.json` | Schéma Variant |
| `src/api/category/.../schema.json` | Schéma Category |
| `src/api/tag/.../schema.json` | Schéma Tag |

---

## Résumé ultra-court

1. Export Woo ≠ import Strapi.  
2. Convertir en CSV enrichi (SKU, Slug, Parent=SKU, prix sur variations).  
3. Admin → **Import Produits CSV** → déposer `produits_mode_enrichi.csv`.  
4. Images = URLs externes dans `imageUrl` (option Media Library si besoin).
