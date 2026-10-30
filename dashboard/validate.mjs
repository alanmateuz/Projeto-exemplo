// Valida dashboard/data/metrics.json contra o bloco "Contrato: dados do dashboard".
import { readFileSync } from "node:fs";

const path = new URL("./data/metrics.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const erros = [];
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isNum = (n) => typeof n === "number" && Number.isFinite(n);

if (!isDate(data.atualizado_em)) erros.push("atualizado_em deve ser AAAA-MM-DD");

if (!Array.isArray(data.kpis) || data.kpis.length === 0) erros.push("kpis vazio");
else data.kpis.forEach((k, i) => {
  for (const c of ["id", "rotulo", "unidade"]) if (typeof k[c] !== "string") erros.push(`kpis[${i}].${c} deve ser texto`);
  for (const c of ["valor", "variacao_pct"]) if (!isNum(k[c])) erros.push(`kpis[${i}].${c} deve ser número`);
});

const serie = data.serie_diaria;
if (!Array.isArray(serie) || serie.length !== 14) erros.push("serie_diaria deve ter 14 dias");
else serie.forEach((p, i) => {
  if (!isDate(p.dia)) erros.push(`serie_diaria[${i}].dia inválido`);
  if (i > 0 && p.dia <= serie[i - 1].dia) erros.push(`serie_diaria[${i}] fora de ordem`);
  for (const c of ["acessos", "vendas"]) if (!isNum(p[c]) || p[c] < 0) erros.push(`serie_diaria[${i}].${c} deve ser >= 0`);
});

if (!Array.isArray(data.por_categoria) || data.por_categoria.length === 0) erros.push("por_categoria vazio");
else data.por_categoria.forEach((c, i) => {
  if (typeof c.categoria !== "string") erros.push(`por_categoria[${i}].categoria deve ser texto`);
  if (!isNum(c.total) || c.total < 0) erros.push(`por_categoria[${i}].total deve ser >= 0`);
});

if (erros.length) {
  console.error(`metrics.json inválido (${erros.length}):\n- ` + erros.join("\n- "));
  process.exit(1);
}
console.log(`metrics.json ok: ${data.kpis.length} KPIs, ${serie.length} dias, ${data.por_categoria.length} categorias`);
