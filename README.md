# Seguimiento terremoto Colombia - Fasecolda

Sitio estático automatizable para publicar un seguimiento ejecutivo del impacto asegurador del terremoto ocurrido en Colombia el 10 de agosto de 2026.

## Uso

```bash
npm run daily
```

El comando consulta novedades, actualiza los JSON en `data/` y regenera `docs/index.html`.

## Publicación diaria

El workflow `.github/workflows/daily-update.yml` corre todos los días a las 8:00 a. m. hora Colombia, que corresponde a 13:00 UTC, y publica `docs/` en GitHub Pages.

## Estructura de datos

- `data/fasecolda_reports.json`: cortes oficiales de Fasecolda.
- `data/market_news.json`: noticias de mercado separadas de las cifras oficiales.
- `data/run_log.json`: bitácora de ejecución, novedades del día y temas a vigilar.

Las cifras de compañías, incluida Allianz, solo deben incorporarse al bloque oficial cuando Fasecolda publique datos comparables por aseguradora.
