import { readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";

const FASECOLDA_INDEX = "https://www.fasecolda.com/sala-de-prensa/fasecolda-en-linea/";
const TERMS = ["sismo", "terremoto", "San José del Palmar", "reclamaciones"];

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const reports = await readJson("data/fasecolda_reports.json");
const news = await readJson("data/market_news.json");
const runLog = await readJson("data/run_log.json");

const processed = new Set(runLog.processed_urls || []);
const today = new Date().toISOString().slice(0, 10);
const materialChanges = [];

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 seguimiento-terremoto-fasecolda" } });
  if (!response.ok) throw new Error(`No se pudo consultar ${url}: ${response.status}`);
  return response.text();
}

function cleanHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(path) {
  if (path.startsWith("http")) return path;
  return new URL(path, "https://www.fasecolda.com").toString();
}

function extractCandidateUrls(indexHtml) {
  const urls = new Set();
  for (const match of indexHtml.matchAll(/href=["']([^"']+)["'][^>]*>([^<]*(?:sismo|terremoto|Allianz)[^<]*)/gi)) {
    urls.add(absoluteUrl(match[1]));
  }
  for (const match of indexHtml.matchAll(/href=["']([^"']*(?:sismo|terremoto|allianz)[^"']*)["']/gi)) {
    urls.add(absoluteUrl(match[1]));
  }
  return [...urls].filter((url) => url.includes("fasecolda.com"));
}

function parseFasecoldaReport(url, text) {
  const lower = text.toLowerCase();
  if (!TERMS.some((term) => lower.includes(term.toLowerCase()))) return null;
  const claimsMatch = text.match(/([\d.]+)\s+reclamaciones/i);
  const paidMatch = text.match(/pagos?\s+por\s+\$([\d.]+)\s+millones/i);
  const estimatedMatch = text.match(/(?:cerca de|aproximadamente|estimado[^.]{0,80})\s*\$([\d.,]+)\s*(billones|millones)/i);
  if (!claimsMatch || !estimatedMatch) return null;
  const claims = Number(claimsMatch[1].replace(/\./g, ""));
  const amount = Number(estimatedMatch[1].replace(/\./g, "").replace(",", "."));
  const multiplier = estimatedMatch[2].toLowerCase().startsWith("billon") ? 1_000_000_000_000 : 1_000_000;
  const id = `fasecolda-${crypto.createHash("sha1").update(url).digest("hex").slice(0, 10)}`;
  return {
    id,
    title: text.match(/^([^.!?]{20,120})/)?.[1]?.trim() || "Publicación Fasecolda sobre el sismo",
    publication_date: today,
    cutoff_date: today,
    claims,
    estimated_value_cop: Math.round(amount * multiplier),
    estimated_value_is_rounded: /cerca de|aproximadamente/i.test(text),
    paid_value_cop: paidMatch ? Number(paidMatch[1].replace(/\./g, "")) * 1_000_000 : null,
    paid_claims: null,
    inspections: null,
    main_branch: null,
    source_type: "Fasecolda",
    source_url: url,
    pdf_url: null,
    source_note: "Registro detectado automáticamente. Revisar antes de usar si la fecha de corte no fue interpretada explícitamente.",
    branches: [],
    departments: [],
    cities: [],
    insurers: []
  };
}

try {
  const indexHtml = await fetchText(FASECOLDA_INDEX);
  const candidates = extractCandidateUrls(indexHtml);
  for (const url of candidates) {
    if (processed.has(url)) continue;
    const pageHtml = await fetchText(url);
    const text = cleanHtml(pageHtml);
    const parsed = parseFasecoldaReport(url, text);
    if (parsed && !reports.some((report) => report.source_url === url || report.id === parsed.id)) {
      reports.push(parsed);
      materialChanges.push(`Nuevo posible corte Fasecolda: ${url}`);
    } else if (/allianz/i.test(text) && /sismo|terremoto/i.test(text) && !news.some((item) => item.source_url === url)) {
      news.push({
        id: `market-${crypto.createHash("sha1").update(url).digest("hex").slice(0, 10)}`,
        date: today,
        title: text.match(/Allianz[^.]{10,120}/i)?.[0] || "Noticia de mercado sobre Allianz y el sismo",
        source: "Fasecolda",
        source_category: "Noticia de mercado",
        source_url: url,
        summary: "Noticia detectada automáticamente. No se mezcla con cifras oficiales de Fasecolda.",
        data_status: "Pendiente de revisión"
      });
      materialChanges.push(`Nueva noticia de mercado: ${url}`);
    }
    processed.add(url);
  }
} catch (error) {
  runLog.today_change = `No se pudo completar la consulta automática: ${error.message}`;
}

runLog.last_updated = today;
runLog.processed_urls = [...new Set([...processed, ...reports.map((r) => r.source_url), ...news.map((n) => n.source_url)])];
if (materialChanges.length) {
  runLog.last_material_change = today;
  runLog.today_change = materialChanges.join(" ");
} else if (!runLog.today_change?.startsWith("No se pudo")) {
  runLog.today_change = "No se identificaron novedades materiales respecto al último seguimiento.";
}

await writeFile("data/fasecolda_reports.json", `${JSON.stringify(reports, null, 2)}\n`);
await writeFile("data/market_news.json", `${JSON.stringify(news, null, 2)}\n`);
await writeFile("data/run_log.json", `${JSON.stringify(runLog, null, 2)}\n`);
