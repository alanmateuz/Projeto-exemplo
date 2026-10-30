// Carrega data/metrics.json (formato no bloco "Contrato: dados do dashboard") e desenha o painel.
const SVG = "http://www.w3.org/2000/svg";
const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const fmtData = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
// Vendas ficam ~20x abaixo dos acessos; multiplicar põe as duas linhas na mesma escala.
const ESCALA_VENDAS = 20;

function el(tag, attrs = {}, texto) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (texto !== undefined) n.textContent = texto;
  return n;
}

function formatarValor(k) {
  if (k.unidade === "R$") return "R$ " + fmt.format(k.valor);
  return fmt.format(k.valor) + (k.unidade || "");
}

function renderKpis(kpis) {
  const area = document.getElementById("kpis");
  area.replaceChildren(...kpis.map((k) => {
    const card = document.createElement("article");
    card.className = "card kpi";
    const sobe = k.variacao_pct >= 0;
    card.innerHTML = `
      <div class="rotulo"></div>
      <div class="valor"></div>
      <div class="variacao ${sobe ? "sobe" : "desce"}"></div>`;
    card.querySelector(".rotulo").textContent = k.rotulo;
    card.querySelector(".valor").textContent = formatarValor(k);
    card.querySelector(".variacao").textContent =
      (sobe ? "▲ " : "▼ ") + fmt.format(Math.abs(k.variacao_pct)) + "% vs. período anterior";
    return card;
  }));
}

function renderLinha(serie) {
  const area = document.getElementById("grafico-linha");
  // Desenha na largura real do container para os rótulos não encolherem no celular.
  const W = Math.max(280, area.clientWidth), H = W < 480 ? 220 : 260, m = { t: 10, r: 10, b: 28, l: 44 };
  const passoData = W < 480 ? 4 : 2;
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = Math.max(...serie.flatMap((p) => [p.acessos, p.vendas * ESCALA_VENDAS])) * 1.1;
  const x = (i) => m.l + (i / (serie.length - 1)) * iw;
  const y = (v) => m.t + ih - (v / max) * ih;

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    svg.append(el("line", { class: "grade", x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
    svg.append(el("text", { x: m.l - 6, y: y(v) + 4, "text-anchor": "end" }, fmt.format(Math.round(v))));
  }
  serie.forEach((p, i) => {
    if (i % passoData === 0) svg.append(el("text", { x: x(i), y: H - 8, "text-anchor": "middle" }, fmtData(p.dia)));
  });

  const linha = (campo, cor, mult) => {
    const d = serie.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[campo] * mult)}`).join("");
    svg.append(el("path", { d, fill: "none", stroke: `var(${cor})`, "stroke-width": 2.5, "stroke-linejoin": "round" }));
    serie.forEach((p, i) => {
      const c = el("circle", { cx: x(i), cy: y(p[campo] * mult), r: 3, fill: `var(${cor})` });
      c.append(el("title", {}, `${fmtData(p.dia)}: ${fmt.format(p[campo])} ${campo}`));
      svg.append(c);
    });
  };
  linha("acessos", "--cor-1", 1);
  linha("vendas", "--cor-2", ESCALA_VENDAS);

  area.replaceChildren(svg);
}

function renderBarras(categorias) {
  const ordenadas = [...categorias].sort((a, b) => b.total - a.total);
  const W = 320, linhaH = 36, m = { l: 90, r: 40 };
  const H = ordenadas.length * linhaH;
  const max = Math.max(...ordenadas.map((c) => c.total));
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });

  ordenadas.forEach((c, i) => {
    const yTopo = i * linhaH + 6;
    const largura = (c.total / max) * (W - m.l - m.r);
    svg.append(el("text", { x: m.l - 8, y: yTopo + 17, "text-anchor": "end" }, c.categoria));
    const barra = el("rect", { x: m.l, y: yTopo, width: largura, height: 24, rx: 4, fill: "var(--cor-1)" });
    barra.append(el("title", {}, `${c.categoria}: ${fmt.format(c.total)}`));
    svg.append(barra);
    svg.append(el("text", { x: m.l + largura + 6, y: yTopo + 17 }, fmt.format(c.total)));
  });

  document.getElementById("grafico-barras").replaceChildren(svg);
}

async function iniciar() {
  try {
    const resp = await fetch("data/metrics.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const dados = await resp.json();
    const [a, mes, d] = dados.atualizado_em.split("-");
    document.getElementById("atualizado-em").textContent = `${d}/${mes}/${a}`;
    renderKpis(dados.kpis);
    renderLinha(dados.serie_diaria);
    renderBarras(dados.por_categoria);
    let largura = innerWidth;
    addEventListener("resize", () => {
      if (innerWidth === largura) return;
      largura = innerWidth;
      renderLinha(dados.serie_diaria);
    });
  } catch (e) {
    const erro = document.getElementById("erro");
    erro.textContent = "Não foi possível carregar data/metrics.json (" + e.message + "). Abra o painel por um servidor local.";
    erro.hidden = false;
  }
}

iniciar();
