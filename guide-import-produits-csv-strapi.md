# Importer des produits CSV dans Strapi (Nyra)

Guide pour transformer un export WooCommerce (comme `wc-product-export-*.csv`) en CSV compatible Strapi, puis l’insérer via le script d’import — comme pour les tisanes / cafés / thés.

## Principe

Strapi n’importe **pas** le CSV WooCommerce brut. On passe par 2 fichiers :

| Fichier | Rôle |
|---|---|
| Export Woo (`wc-product-export-….csv`) | Source brute (FR, métas WP, IDs Woo) |
| CSV enrichi (`produits_*_enrichi.csv`) | Format cible lu par `nyra-cms/scripts/import-tisanes.mjs` |

Le script crée / met à jour :

- **Category** (ex. `tisanes`, `mode`)
- **Product** (ligne `Type=variable`)
- **Variant** (lignes `Type=variation`)
- **Tag** (optionnel)

L’image est stockée en URL externe dans `product.imageUrl` (pas d’upload disque Railway).

---

## 1. Structure WooCommerce (ton export)

Exemple : `wc-product-export-29-7-2026-1785333248464.csv`  
→ **20** produits parents (`variable`) + **36** variations.

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
| `Description` | HTML | `description` (+ `ingredients` si pas d’ingrédients) |
| `Images` | URL(s) séparées par `, ` | Première URL → `imageUrl` |
| `Tarif régulier` | `25250` | Prix variante (XOF entier) |
| `Parent` | `id:1875` | Relie variation → parent (à remplacer par SKU) |
| `Nom de l’attribut 1` | `type` | Attribut principal (format / type) |
| `Valeur(s) de l’attribut 1 ` | `Top` / `Top, Ensemble` | Valeur variante |
| `Nom de l’attribut 2` | `couleur` | → `variant.colorName` (si tu l’utilises) |
| `Nom de l’attribut 3` | `taille` | → `variant.size` |
| `Catégories` | `Non classé` | À remplacer (ex. `MODE`) |
| `En stock ?` / `Stock` | `1` / vide | `variant.stock` |

---

## 2. Format CSV cible (enrichi) — celui que Strapi attend

Référence : `produits_tisanes_enrichi.csv`.

### En-têtes obligatoires / recommandés

```csv
Name,SKU,Type,Categories,Regular price,Short description,Description,Images,Link,Parent,Attribute 1 name,Attribute 1 value(s),Attribute 1 visible,Attribute 1 global,Attribute 1 default,Strapi category,Stock,Slug,Meta title,Meta description,Status,Compare at price,Tags,Dosage,Temps infusion,Température,Origine,Nom botanique,Image alt text,Gallery images
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
9. `Strapi category` = nom de catégorie catalogue (ex. `MODE`, `TISANES`).

### Exemple tisane (déjà en prod)

**Parent**

```csv
Fenouil Bio En Vrac,tisane-001,variable,TISANES,,"…short…","…desc…",https://….jpg,,,"Poids","250g, 50g",1,0,250g,TISANES,,fenouil-bio-en-vrac,"Meta…","Meta desc…",published,,Tisane|Bio,,,,,,,
```

**Variations**

```csv
Fenouil Bio En Vrac - 250g,tisane-001-250g,variation,TISANES,8900,,,,"",tisane-001,Poids,250g,1,0,,TISANES,25,,,,,published,,,,,,,
Fenouil Bio En Vrac - 50g,tisane-001-50g,variation,TISANES,2500,,,,"",tisane-001,Poids,50g,1,0,,TISANES,40,,,,,published,,,,,,,
```

### Exemple mode (à partir de ton export Fulani)

À partir de `ROSHI` (parent Woo `333`) + variations Top `25250` / Ensemble `45500` :

**Parent**

```csv
ROSHI,mode-roshi,variable,MODE,,"Cras in blandit…","<p>Le <strong>Roshi</strong>…</p>",https://fulaniofficial.com/wp-content/uploads/2024/10/A7-scaled.jpeg,,,"Type","Top, Ensemble",1,0,Top,MODE,,roshi,"ROSHI | Fulani","Habit traditionnel revisitée…",published,,Mode|Fulani,,,,,,,
```

**Variations**

```csv
ROSHI - Top,mode-roshi-top,variation,MODE,25250,,,,"",mode-roshi,Type,Top,1,0,,MODE,10,,,,,published,,,,,,,
ROSHI - Ensemble,mode-roshi-ensemble,variation,MODE,45500,,,,"",mode-roshi,Type,Ensemble,1,0,,MODE,10,,,,,published,,,,,,,
```

> Couleur / taille : le script tisanes actuel mappe surtout **Attribute 1** → `format` / `size` / poids.  
> Pour mode, soit tu mets `Type` (Top/Ensemble) en Attribute 1 (prix différent), soit tu étends le script pour `colorName` + `size`.

---

## 3. Mapping Woo → CSV enrichi → Strapi

| Woo (FR) | CSV enrichi | Champ Strapi |
|---|---|---|
| `Nom` (variable) | `Name` | `product.name` |
| *(à créer)* | `SKU` | clé upsert produit / parent |
| *(à créer)* | `Slug` | `product.slug` |
| `Description courte` | `Short description` | `product.shortDescription` |
| `Description` | `Description` | `product.description` (+ `ingredients`) |
| 1re URL de `Images` | `Images` | `product.imageUrl` |
| `Catégories` / manuel | `Strapi category` | relation `category` |
| `Étiquettes` | `Tags` (`\|` séparés) | relation `tags` |
| `Publié` (`1`) | `Status=published` | `publishedAt` |
| `Nom` + attr (variation) | `Name` | `variant.name` |
| *(à créer)* | `SKU` variation | `variant.sku` |
| `Parent` `id:XXX` | `Parent` = SKU parent | relation `variant.product` |
| `Tarif régulier` | `Regular price` | `variant.price` (+ min → `product.price`) |
| `Stock` | `Stock` | `variant.stock` |
| `Valeur(s) attribut 1` | `Attribute 1 value(s)` | `variant.format` / `label` / `size` |

Prix produit Strapi = **minimum** des prix des variations.

---

## 4. Checklist de préparation du CSV

1. Exporter Woo → CSV.
2. Ne garder que les colonnes utiles (ou tout garder, mais remplir le format enrichi).
3. Pour chaque parent :
   - inventer `SKU` + `Slug` (minuscules, tirets, uniques) ;
   - nettoyer HTML si besoin ;
   - fixer `Strapi category` ;
   - prendre la **première** URL image.
4. Pour chaque variation :
   - `Parent` = SKU parent (plus `id:1875`) ;
   - `SKU` unique ;
   - `Regular price` en entier XOF (ex. `25250`) ;
   - `Attribute 1 value(s)` = valeur vendable (Top, 250g…).
5. Enregistrer en UTF-8 : `produits_mode_enrichi.csv` (à la racine du monorepo, comme les autres).
6. Adapter le script si la catégorie n’est pas `tisanes` (voir §5).

---

## 5. Insertion dans Strapi

### Prérequis

- Strapi démarré (`STRAPI_URL`, défaut `http://localhost:1337`)
- Token API avec droits create/update sur `products`, `variants`, `categories`, `tags` :
  - variable d’env `STRAPI_IMPORT_TOKEN`

### Script existant

Fichier : `nyra-cms/scripts/import-tisanes.mjs`

Il lit un CSV au format enrichi, crée la catégorie `tisanes`, puis upsert produits + variantes.

```bash
cd nyra-cms

# Dry-run (aucune écriture)
$env:DRY_RUN="true"
$env:TISANES_CSV_PATH="../produits_tisanes_enrichi.csv"
node scripts/import-tisanes.mjs

# Import réel
$env:DRY_RUN="false"
$env:STRAPI_URL="http://localhost:1337"
$env:STRAPI_IMPORT_TOKEN="ton_token"
$env:TISANES_CSV_PATH="../produits_tisanes_enrichi.csv"
node scripts/import-tisanes.mjs
```

Via npm (dry-run) :

```bash
npm run import:tisanes:dry
```

### Pour un autre catalogue (ex. mode)

1. Copier le script → `import-mode.mjs` (ou passer la catégorie en env).
2. Changer :
   - chemin CSV → `../produits_mode_enrichi.csv`
   - slug catégorie → `mode` / name `Mode`
3. Lancer le même flux `DRY_RUN` puis import réel.

Le mapping image reste : `Images` CSV → `product.imageUrl`.

### Backfill images seulement

Si les produits existent déjà sans `imageUrl` :

```bash
cd nyra-cms
node scripts/backfill-product-image-url.mjs --from-csv --dry-run
node scripts/backfill-product-image-url.mjs --from-csv
```

(ajoute ton nouveau CSV dans la liste `CSV_FILES` du script si besoin)

---

## 6. Créer les données à la main (sans Woo)

Tu peux créer le CSV enrichi dans Excel / Google Sheets :

1. Ligne 1 = en-têtes (§2).
2. Une ligne `variable` par produit.
3. Une ligne `variation` par taille / format / type vendable.
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
GET /api/products?filters[slug][$eq]=roshi&populate=variants,category
```

Contrôler :

- produit publié + `imageUrl` HTTPS
- variantes avec `sku`, `price`, `stock`
- `product.price` = plus bas prix variante
- catégorie correcte

---

## Fichiers de référence dans le repo

| Fichier | Rôle |
|---|---|
| `wc-product-export-29-7-2026-1785333248464.csv` | Export Woo brut (mode) |
| `produits_mode_enrichi.csv` | CSV enrichi mode (généré) |
| `scripts/convert-wc-to-enrichi.mjs` | Convertisseur Woo → enrichi |
| `produits_tisanes_enrichi.csv` | Modèle CSV cible |
| `produits_cafes_enrichi.csv` / `the_bio` / `herboristerie` / `accessoires` | Autres catalogues |
| `nyra-cms/scripts/import-tisanes.mjs` | Import API Strapi |
| `nyra-cms/scripts/backfill-product-image-url.mjs` | Sync `imageUrl` depuis CSV |
| `nyra-cms/src/api/product/.../schema.json` | Schéma Product |
| `nyra-cms/src/api/variant/.../schema.json` | Schéma Variant |

---

## Résumé ultra-court

1. Export Woo ≠ import Strapi.  
2. Convertir en CSV enrichi (SKU, Slug, Parent=SKU, prix sur variations).  
3. `STRAPI_IMPORT_TOKEN` + `node scripts/import-tisanes.mjs` (ou copie mode).  
4. Images = URLs externes dans `imageUrl`.
