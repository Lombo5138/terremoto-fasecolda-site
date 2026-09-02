import { mkdir, readFile, writeFile } from "node:fs/promises";

const reports = JSON.parse(await readFile("data/fasecolda_reports.json", "utf8"));
const marketNews = JSON.parse(await readFile("data/market_news.json", "utf8"));
const runLog = JSON.parse(await readFile("data/run_log.json", "utf8"));

reports.sort((a, b) => a.cutoff_date.localeCompare(b.cutoff_date));
const latest = reports.at(-1);
const previous = reports.at(-2);

const cop = (value) => {
  if (value === null || value === undefined) return "No publicado";
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toLocaleString("es-CO", { maximumFractionDigits: 2 })} billones`;
  if (value >= 1_000_000_000) return `$${Math.round(value / 1_000_000_000).toLocaleString("es-CO")} mil MM`;
  return `$${Math.round(value / 1_000_000).toLocaleString("es-CO")} MM`;
};

const num = (value) => value === null || value === undefined ? "No publicado" : value.toLocaleString("es-CO");
const pct = (value) => `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
const date = (value) => new Date(`${value}T12:00:00-05:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
const delta = previous ? {
  claims: latest.claims - previous.claims,
  claimsPct: ((latest.claims - previous.claims) / previous.claims) * 100,
  value: latest.estimated_value_cop - previous.estimated_value_cop,
  valuePct: ((latest.estimated_value_cop - previous.estimated_value_cop) / previous.estimated_value_cop) * 100
} : null;

const maxClaims = Math.max(...latest.cities.map((city) => city.claims), 1);
const mainBranch = latest.branches.toSorted((a, b) => (b.claims || 0) - (a.claims || 0))[0];
const avgClaim = latest.claims && latest.estimated_value_cop ? latest.estimated_value_cop / latest.claims : null;

const rows = (items, mapper) => items.map(mapper).join("\n");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Terremoto Colombia 10-Ago-2026 | Seguimiento asegurador</title>
<meta name="description" content="Seguimiento actualizado del impacto asegurador del terremoto ocurrido en Colombia el 10 de agosto de 2026, con prioridad en Fasecolda.">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main class="wrap">
  <section class="hero">
    <div class="eyebrow">Seguimiento post-evento · Sector asegurador colombiano</div>
    <h1>Terremoto Colombia — 10 de agosto de 2026</h1>
    <p>Hoja informativa ejecutiva con histórico de cortes oficiales de Fasecolda, novedades separadas del mercado y trazabilidad de fuentes.</p>
    <div class="badges">
      <span>Fuente principal: Fasecolda</span>
      <span>Último corte: ${date(latest.cutoff_date)}</span>
      <span>Actualizado: ${date(runLog.last_updated)}</span>
    </div>
  </section>

  <section class="kpis" aria-label="Indicadores principales">
    <article><span>Reclamaciones</span><strong>${num(latest.claims)}</strong><small>${delta ? `+${num(delta.claims)} (${pct(delta.claimsPct)}) vs. corte anterior` : "Sin comparación"}</small></article>
    <article><span>Valor estimado</span><strong>${latest.estimated_value_is_rounded ? "≈ " : ""}${cop(latest.estimated_value_cop)}</strong><small>${delta ? `+${cop(delta.value)} (${pct(delta.valuePct)})` : "Sin comparación"}</small></article>
    <article><span>Pagos</span><strong>${cop(latest.paid_value_cop)}</strong><small>${latest.paid_value_cop ? `${pct((latest.paid_value_cop / latest.estimated_value_cop) * 100)} del valor estimado` : "Dato no publicado"}</small></article>
    <article><span>Principal ramo</span><strong>${mainBranch?.name || "No publicado"}</strong><small>${mainBranch?.claims ? `${num(mainBranch.claims)} reclamaciones` : "Sin apertura"}</small></article>
  </section>

  <section class="two">
    ${latest.departments.length || latest.cities.length ? "" : `<p class="notice"><b>Desglose pendiente:</b> el comunicado web del tercer corte (28 de agosto) publica los totales nacionales, pero aún no publica apertura por ramo, departamento o ciudad. El PDF oficial enlazado por Fasecolda corresponde al Reporte No. 2 (corte del 21 de agosto).</p>`}
    <article class="panel">
      <h2>Evolución Fasecolda</h2>
      <table>
        <thead><tr><th>Corte</th><th>Reclamaciones</th><th>Valor estimado</th><th>Pagos</th></tr></thead>
        <tbody>${rows(reports, (r) => `<tr><td>${date(r.cutoff_date)}</td><td>${num(r.claims)}</td><td>${r.estimated_value_is_rounded ? "≈ " : ""}${cop(r.estimated_value_cop)}</td><td>${cop(r.paid_value_cop)}</td></tr>`)}</tbody>
      </table>
      <p class="muted">${delta ? `Cambio frente al corte anterior: +${num(delta.claims)} reclamaciones y ${latest.estimated_value_is_rounded ? "aproximadamente " : ""}+${cop(delta.value)} en valor estimado.` : "No hay cortes previos para comparar."}</p>
    </article>
    <article class="panel">
      <h2>Lectura ejecutiva</h2>
      <div class="callout">El seguimiento oficial más reciente mantiene a Fasecolda como fuente principal. Las noticias externas se muestran aparte y no se mezclan con cifras oficiales.</div>
      <p class="muted">Monto promedio implícito reportado: ${avgClaim ? cop(avgClaim) : "No publicado"} por reclamación. Es un indicador descriptivo, no una severidad definitiva.</p>
    </article>
  </section>

  <section class="panel">
    <h2>Composición por ramo</h2>
    <table>
      <thead><tr><th>Ramo</th><th>Reclamaciones</th><th>Valor estimado</th><th>% reclamos</th></tr></thead>
      <tbody>${rows(latest.branches, (b) => `<tr><td>${b.name}</td><td>${num(b.claims)}</td><td>${cop(b.estimated_value_cop)}</td><td>${b.claims ? pct((b.claims / latest.claims) * 100) : "No publicado"}</td></tr>`)}</tbody>
    </table>
  </section>

  <section class="two">
    <article class="panel">
      <h2>Geografía</h2>
      <table>
        <thead><tr><th>Departamento</th><th>Reclamaciones</th><th>Valor</th></tr></thead>
        <tbody>${rows(latest.departments, (d) => `<tr><td>${d.name}</td><td>${num(d.claims)}</td><td>${cop(d.estimated_value_cop)}</td></tr>`) || `<tr><td colspan="3">No publicado</td></tr>`}</tbody>
      </table>
    </article>
    <article class="panel">
      <h2>Ciudades</h2>
      ${rows(latest.cities, (c) => `<div class="city"><span>${c.name}</span><div class="bar"><i style="width:${Math.max((c.claims / maxClaims) * 100, 1)}%"></i></div><b>${num(c.claims)}</b></div>`) || `<p class="muted">No publicado.</p>`}
    </article>
  </section>

  <section class="two">
    <article class="panel placeholder">
      <h2>Información por aseguradora</h2>
      <strong>${latest.insurers?.length ? "Datos publicados por Fasecolda" : "No publicado"}</strong>
      <p class="muted">Esta sección solo se activa con información desagregada por aseguradora publicada directamente por Fasecolda y comparable por fecha y definición.</p>
    </article>
    <article class="panel placeholder">
      <h2>Allianz</h2>
      <strong>Sin cifra oficial comparable</strong>
      <p class="muted">La nota de Allianz se conserva como noticia de mercado cuando proviene de Fasecolda, pero no se usa para construir cifras oficiales de reclamaciones, pagos o participación.</p>
    </article>
  </section>

  <section class="panel">
    <h2>Noticias de otras compañías y mercado</h2>
    ${rows(marketNews, (n) => `<article class="news"><time>${date(n.date)}</time><h3>${n.title}</h3><p>${n.summary}</p><small>${n.source_category}</small><a href="${n.source_url}" target="_blank" rel="noopener">Ver fuente</a></article>`) || `<p class="muted">No se identificaron novedades materiales de mercado.</p>`}
  </section>

  <section class="two">
    <article class="panel">
      <h2>Qué cambió hoy</h2>
      <p>${runLog.today_change || "No se identificaron novedades materiales respecto al último seguimiento."}</p>
    </article>
    <article class="panel">
      <h2>Qué vigilar</h2>
      <ul>${runLog.watch_items.map((item) => `<li>${item}</li>`).join("")}</ul>
    </article>
  </section>

  <section class="panel sources">
    <h2>Fuentes</h2>
    ${rows(reports, (r) => `<p><b>${r.title}</b><br><span>${r.source_note}</span><br><a href="${r.pdf_url || r.source_url}" target="_blank" rel="noopener">${r.pdf_url ? "PDF oficial" : "Publicación oficial"}</a></p>`)}
  </section>

  <footer>Seguimiento automatizable · Datos separados por fuente · Sin cifras simuladas.</footer>
</main>
</body>
</html>`;

await mkdir("docs", { recursive: true });
await writeFile("docs/index.html", html);
