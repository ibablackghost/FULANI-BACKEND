# Photos par format (Top / Ensemble) — API & front

Comme les couleurs : chaque produit peut avoir une photo pour **Top** et **Ensemble**.

---

## Admin Strapi

Sur un **Product** :

1. `availableFormats` = `["Top","Ensemble"]`
2. Section **Photo par format** (`formatImages`) — ajoute 2 entrées :
   - `formatName` = `Top` ou `Ensemble` (exactement comme dans la liste)
   - `imageUrl` = URL HTTPS (ou upload `image`)

Priorité API : **upload** si présent, sinon **`imageUrl`**.

---

## API

Champs ajoutés sur le produit public :

```ts
formatImages: Array<{
  formatName: string;   // "Top" | "Ensemble"
  imageUrl: string | null;
  imageAlt: string | null;
  image: { url, alternativeText, width, height, formats } | null;
}>;

imagesByFormat: Record<string, string>;
// Ex. { "Top": "https://…/top.jpg", "Ensemble": "https://…/ensemble.jpg" }
```

---

## Front

Quand l’utilisateur choisit Top / Ensemble :

```ts
const url =
  product.imagesByFormat?.[selectedFormat]
  ?? product.formatImages?.find((f) => f.formatName === selectedFormat)?.imageUrl
  ?? product.imageUrl;
```

Combiné avec la couleur (exemple) :

```ts
const url =
  product.imagesByColor?.[selectedColor]
  ?? product.imagesByFormat?.[selectedFormat]
  ?? product.imageUrl;
```

(Adapte la priorité selon ton UX.)
