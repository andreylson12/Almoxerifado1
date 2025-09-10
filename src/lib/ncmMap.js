// Utilitário: infere o "tipo" do defensivo a partir do NCM e/ou da descrição.
// Regras principais (NCM):
// 3808.91 → Inseticida
// 3808.92 → Fungicida
// 3808.93 → Herbicida
// 3808.94 → Desinfetante
// 3808.99 → Pesticida (outros) → refina por palavras-chave
// 3402.xx → Adjuvante / Tensoativo
// 3105.xx → Fertilizante
// 2915.xx → Adjuvante (se descrição indicar; senão "Outro")

const byPrefix = [
  { prefix: "380891", tipo: "Inseticida" },
  { prefix: "380892", tipo: "Fungicida" },
  { prefix: "380893", tipo: "Herbicida" },
  { prefix: "380894", tipo: "Desinfetante" },
  { prefix: "3402",   tipo: "Adjuvante" },
  { prefix: "3105",   tipo: "Fertilizante" },
];

const keywordTipos = [
  { re: /(adjuv|espalhante|oleo|óleo|surfact|assist|li\s*700)/i, tipo: "Adjuvante" },
  { re: /herbicid/i,  tipo: "Herbicida" },
  { re: /fungicid/i,  tipo: "Fungicida" },
  { re: /inseticid/i, tipo: "Inseticida" },
  { re: /acaricid|abamectin|abamectina/i, tipo: "Acaricida" },
  { re: /nematicid/i, tipo: "Nematicida" },
  { re: /fertiliz|npk|05-.*-.*|06-.*-.*|08-.*-.*|10-.*-.*|20-.*-.*|40-.*-.*|fg\s*\d+-\d+-\d+/i, tipo: "Fertilizante" },
];

function cleanNcm(ncm) {
  if (!ncm) return "";
  return String(ncm).replace(/\D/g, "");
}

export function inferTipoFromNcm(ncmRaw = "", descricao = "") {
  const ncm = cleanNcm(ncmRaw);
  const desc = descricao || "";

  // 1) match direto por prefixo
  for (const rule of byPrefix) {
    if (ncm.startsWith(rule.prefix)) {
      return { tipo: rule.tipo, fonte: "ncm" };
    }
  }

  // 2) 3808.99 → tentar refinar por palavras
  if (ncm.startsWith("380899")) {
    for (const k of keywordTipos) {
      if (k.re.test(desc)) {
        return { tipo: k.tipo, fonte: "descricao" };
      }
    }
    // fallback comum para 380899
    return { tipo: "Inseticida", fonte: "fallback-380899" };
  }

  // 3) 2915 → pode ser adjuvante dependendo do texto (ex.: LI 700)
  if (ncm.startsWith("2915")) {
    const adjuv = keywordTipos[0];
    if (adjuv.re.test(desc)) return { tipo: "Adjuvante", fonte: "descricao" };
  }

  // 4) sem NCM claro → tenta por descrição
  for (const k of keywordTipos) {
    if (k.re.test(desc)) {
      return { tipo: k.tipo, fonte: "descricao" };
    }
  }

  return { tipo: "Outro", fonte: "nenhuma" };
}
