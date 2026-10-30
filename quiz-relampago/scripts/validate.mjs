#!/usr/bin/env node
// Valida um banco de perguntas contra o Contrato de dados v1.
// Uso: node scripts/validate.mjs data/questions.json [--sample]
import { readFileSync } from "node:fs";

const CATEGORIES = ["ciencia", "historia", "geografia", "tecnologia", "cultura"];
const MIN_TOTAL = 30;
const MIN_PER_CATEGORY = 5;

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const isSample = args.includes("--sample") || /sample\.json$/.test(file ?? "");

if (!file) {
  console.error("Uso: node scripts/validate.mjs <arquivo.json> [--sample]");
  process.exit(1);
}

const errors = [];
let data;
try {
  data = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`Erro ao ler ${file}: ${e.message}`);
  process.exit(1);
}

if (typeof data !== "object" || data === null || Array.isArray(data)) errors.push("raiz deve ser um objeto");
if (data?.version !== 1) errors.push("version deve ser 1");
const questions = Array.isArray(data?.questions) ? data.questions : (errors.push("questions deve ser um array"), []);

const ids = new Set();
const perCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));

questions.forEach((q, i) => {
  const at = `questions[${i}]${q?.id ? ` (${q.id})` : ""}`;
  if (typeof q !== "object" || q === null) return errors.push(`${at}: deve ser um objeto`);

  if (typeof q.id !== "string" || !/^q\d{3}$/.test(q.id)) errors.push(`${at}: id deve ser "q" + 3 dígitos`);
  else if (ids.has(q.id)) errors.push(`${at}: id repetido`);
  else ids.add(q.id);

  if (!CATEGORIES.includes(q.category)) errors.push(`${at}: category inválida "${q.category}"`);
  else perCategory[q.category]++;

  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 3) errors.push(`${at}: difficulty deve ser inteiro 1 a 3`);
  if (typeof q.prompt !== "string" || !q.prompt.trim()) errors.push(`${at}: prompt deve ser texto não vazio`);

  if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every((o) => typeof o === "string" && o.trim()))
    errors.push(`${at}: options deve ter exatamente 4 textos`);
  else if (new Set(q.options).size !== 4) errors.push(`${at}: options tem repetição`);

  if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) errors.push(`${at}: answerIndex deve ser inteiro 0 a 3`);
  if (typeof q.explanation !== "string" || q.explanation.length > 160) errors.push(`${at}: explanation deve ser texto de até 160 caracteres`);
});

if (!isSample) {
  if (questions.length < MIN_TOTAL) errors.push(`mínimo de ${MIN_TOTAL} perguntas (tem ${questions.length})`);
  for (const [c, n] of Object.entries(perCategory))
    if (n < MIN_PER_CATEGORY) errors.push(`categoria ${c}: mínimo de ${MIN_PER_CATEGORY} (tem ${n})`);
}

if (errors.length) {
  console.error(`${file}: ${errors.length} erro(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`${file}: OK (${questions.length} perguntas)`);
