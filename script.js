const DEFAULT_INTEGRATION_CONFIG = {
  webhookUrl: "",
  webhookMethod: "POST",
  webhookHeaders: {
    "Content-Type": "application/json"
  },
  simulationStorageKey: "leiDoBemLeadPayload",
  fallbackStorageKey: "leiDoBemLeadPayloadFallback"
};

const integrationConfig = {
  ...DEFAULT_INTEGRATION_CONFIG,
  ...(window.LEI_DO_BEM_CONFIG || {})
};

const calculator = document.querySelector("#tax-calculator");
const leadForm = document.querySelector("#lead-form");
const prevButton = document.querySelector("#prev-step");
const nextButton = document.querySelector("#next-step");
const calculateButton = document.querySelector("#calculate-button");
const steps = Array.from(document.querySelectorAll(".calc-step"));
const progressSteps = Array.from(document.querySelectorAll(".progress-step"));
const emptyResult = document.querySelector("#empty-result");
const resultSummary = document.querySelector("#result-summary");
const resultStatus = document.querySelector("#result-status");
const resultTitle = document.querySelector("#result-title");
const resultDescription = document.querySelector("#result-description");
const savingRange = document.querySelector("#saving-range");
const savingNote = document.querySelector("#saving-note");
const resultFlags = document.querySelector("#result-flags");
const leadMessage = document.querySelector("#lead-message");
const fullReport = document.querySelector("#full-report");
const reportContent = document.querySelector("#report-content");
const calculatorModal = document.querySelector("#calculator-modal");
const openCalculatorButtons = Array.from(document.querySelectorAll("[data-open-calculator]"));
const closeCalculatorButtons = Array.from(document.querySelectorAll("[data-close-calculator]"));
const floatingCta = document.querySelector(".floating-cta");

let currentStep = 0;
let latestSimulation = null;

function trackConversion(eventName, params = {}) {
  const payload = {
    event: eventName,
    page_path: window.location.pathname,
    page_url: window.location.href,
    ...params
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }

  if (typeof window.fbq === "function") {
    window.fbq("trackCustom", eventName, params);
  }
}

function getTrackingLabel(element) {
  if (!element) return "automatico";
  return element.dataset.trackLabel || element.textContent.trim() || "sem_rotulo";
}

function syncFloatingCta() {
  if (!floatingCta) return;
  document.body.classList.toggle("has-scrolled", window.scrollY > 180);
}

function openCalculatorModal(event) {
  if (!calculatorModal) return;
  calculatorModal.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
  trackConversion("lei_do_bem_calculadora_aberta", {
    trigger_label: getTrackingLabel(event?.currentTarget),
    source: event?.currentTarget ? "click" : "hash_ou_automatico"
  });
  setTimeout(() => {
    const firstField = calculatorModal.querySelector("select, input, button");
    if (firstField) firstField.focus();
  }, 0);
}

function closeCalculatorModal() {
  if (!calculatorModal) return;
  calculatorModal.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
}

function openCalculatorFromHash() {
  if (window.location.hash === "#calculadora") {
    openCalculatorModal();
  }
}

function normalizeNumber(value) {
  if (!value) return 0;
  const sanitized = String(value)
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(Math.max(0, Math.round(value || 0)));
}

function formatPercent(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value);
}

function formatNumberInput(field) {
  const digits = field.value.replace(/\D/g, "");
  if (!digits) {
    field.value = "";
    return;
  }
  field.value = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0
  }).format(Number(digits));
}

function formatPhoneInput(field) {
  const digits = field.value.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);

  if (digits.length <= 2) {
    field.value = digits;
    return;
  }

  const splitAt = number.length > 8 ? 5 : 4;
  if (number.length <= splitAt) {
    field.value = `${ddd} ${number}`;
    return;
  }

  field.value = `${ddd} ${number.slice(0, splitAt)}-${number.slice(splitAt)}`;
}

function formatCnpjInput(field) {
  const digits = field.value.replace(/\D/g, "").slice(0, 14);
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 12);
  const part5 = digits.slice(12, 14);

  if (digits.length <= 2) {
    field.value = part1;
  } else if (digits.length <= 5) {
    field.value = `${part1}.${part2}`;
  } else if (digits.length <= 8) {
    field.value = `${part1}.${part2}.${part3}`;
  } else if (digits.length <= 12) {
    field.value = `${part1}.${part2}.${part3}/${part4}`;
  } else {
    field.value = `${part1}.${part2}.${part3}/${part4}-${part5}`;
  }
}

function getFormData(form) {
  const data = new FormData(form);
  const projects = data.getAll("projects");

  return {
    taxRegime: data.get("taxRegime") || "",
    fiscalProfit: data.get("fiscalProfit") || "",
    taxRegularity: data.get("taxRegularity") || "",
    sector: data.get("sector") || "",
    annualRevenue: normalizeNumber(data.get("annualRevenue")),
    fiscalProfitAmount: normalizeNumber(data.get("fiscalProfitAmount")),
    taxPaid: normalizeNumber(data.get("taxPaid")),
    innovationSpend: normalizeNumber(data.get("innovationSpend")),
    currentResearchers: normalizeNumber(data.get("currentResearchers")),
    previousResearchers: normalizeNumber(data.get("previousResearchers")),
    contractorSpend: normalizeNumber(data.get("contractorSpend")),
    hasPatent: data.get("hasPatent") || "nao",
    projects
  };
}

function getLeadData() {
  const data = new FormData(leadForm);
  return {
    name: String(data.get("name") || "").trim(),
    role: String(data.get("role") || "").trim(),
    company: String(data.get("company") || "").trim(),
    email: String(data.get("email") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    cnpj: String(data.get("cnpj") || "").trim(),
    consent: data.get("consent") === "on"
  };
}

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"];
  return keys.reduce((acc, key) => {
    if (params.has(key)) acc[key] = params.get(key);
    return acc;
  }, {});
}

function getSubmissionData(lead) {
  const submittedAt = new Date();
  return {
    submittedAt: submittedAt.toISOString(),
    submittedAtBr: submittedAt.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short"
    }),
    leadName: lead.name,
    leadRole: lead.role
  };
}

function calculateResearcherGrowth(current, previous) {
  if (!current || current <= 0) return 0;
  if (!previous || previous <= 0) return current > 0 ? 1 : 0;
  return (current - previous) / previous;
}

function calculateEligibility(input) {
  const flags = [];
  let score = 0;
  let status = "eligible";

  if (input.taxRegime === "lucro-real") {
    score += 30;
    flags.push("Regime Lucro Real informado, requisito central para aplicação direta.");
  } else {
    status = "not-eligible";
    flags.push("A aplicação direta exige Lucro Real. No regime atual, trate como potencial futuro.");
  }

  if (input.fiscalProfit === "sim") {
    score += 20;
    flags.push("Lucro fiscal informado, permitindo estimar absorção da exclusão.");
  } else if (input.fiscalProfit === "nao") {
    status = status === "not-eligible" ? status : "attention";
    flags.push("Sem lucro fiscal, a economia pode não ser aproveitada no ano analisado.");
  } else {
    status = status === "not-eligible" ? status : "attention";
    flags.push("Lucro fiscal precisa ser confirmado com contabilidade.");
  }

  if (input.taxRegularity === "regular") {
    score += 15;
    flags.push("Regularidade fiscal informada, ponto importante para uso seguro do incentivo.");
  } else {
    status = status === "not-eligible" ? status : "attention";
    flags.push("Regularidade fiscal deve ser validada antes da aplicação.");
  }

  if (input.innovationSpend > 0 && input.projects.length > 0) {
    score += 25;
    flags.push("Há dispêndios e projetos de inovação para triagem técnica.");
  } else {
    status = status === "not-eligible" ? status : "attention";
    flags.push("É necessário mapear dispêndios e projetos elegíveis com documentação.");
  }

  if (input.currentResearchers > 0) {
    score += 10;
    flags.push("Equipe técnica CLT informada, dado relevante para percentual de exclusão.");
  } else {
    flags.push("Equipe CLT dedicada deve ser revisada; PJs/terceiros exigem análise específica.");
  }

  return {
    score: Math.min(score, 100),
    status,
    flags
  };
}

function calculateSavings(input, status) {
  const growth = calculateResearcherGrowth(input.currentResearchers, input.previousResearchers);
  let exclusionRate = 0.6;
  let rateReason = "Faixa-base de 60% de exclusão adicional.";

  if (growth > 0.05) {
    exclusionRate = 0.8;
    rateReason = "Aumento de pesquisadores acima de 5% indica faixa de até 80%.";
  } else if (growth > 0) {
    exclusionRate = 0.7;
    rateReason = "Aumento de pesquisadores até 5% indica faixa de até 70%.";
  }

  if (input.hasPatent === "sim") {
    exclusionRate = Math.min(1, exclusionRate + 0.2);
    rateReason += " Registro/patente informado pode elevar a faixa em análise específica.";
  }

  const baseTaxRate = 0.34;
  const lowRate = 0.6 * baseTaxRate;
  const highRate = exclusionRate * baseTaxRate;
  const eligibleSpend = input.innovationSpend;

  let low = eligibleSpend * lowRate;
  let high = eligibleSpend * highRate;
  const caps = [];

  if (input.fiscalProfitAmount > 0) {
    const profitCap = input.fiscalProfitAmount * baseTaxRate;
    low = Math.min(low, profitCap);
    high = Math.min(high, profitCap);
    caps.push("estimativa limitada pelo lucro fiscal informado");
  }

  if (input.taxPaid > 0) {
    low = Math.min(low, input.taxPaid);
    high = Math.min(high, input.taxPaid);
    caps.push("estimativa limitada por IRPJ + CSLL pagos");
  }

  if (status === "not-eligible" || eligibleSpend <= 0) {
    low = 0;
    high = 0;
  }

  return {
    eligibleSpend,
    low,
    high: Math.max(high, low),
    lowRate,
    highRate,
    exclusionRate,
    growth,
    rateReason,
    caps
  };
}

function simulate(input) {
  const eligibility = calculateEligibility(input);
  const savings = calculateSavings(input, eligibility.status);
  return {
    input,
    eligibility,
    savings,
    createdAt: new Date().toISOString()
  };
}

function updateStep() {
  steps.forEach((step, index) => step.classList.toggle("is-active", index === currentStep));
  progressSteps.forEach((step, index) => step.classList.toggle("is-active", index <= currentStep));
  prevButton.disabled = currentStep === 0;
  nextButton.classList.toggle("is-hidden", currentStep === steps.length - 1);
  calculateButton.classList.toggle("is-hidden", currentStep !== steps.length - 1);
}

function validateStep(stepIndex) {
  const projectInputs = Array.from(steps[stepIndex].querySelectorAll("input[name='projects']"));
  projectInputs.forEach((input) => input.setCustomValidity(""));

  const fields = Array.from(steps[stepIndex].querySelectorAll("input, select"));
  for (const field of fields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }

  if (stepIndex === steps.length - 1) {
    const selectedProject = steps[stepIndex].querySelector("input[name='projects']:checked");
    const firstProject = steps[stepIndex].querySelector("input[name='projects']");
    if (!selectedProject && firstProject) {
      firstProject.setCustomValidity("Selecione pelo menos um tipo de projeto.");
      firstProject.reportValidity();
      return false;
    }
  }

  return true;
}

function validateCurrentStep() {
  return validateStep(currentStep);
}

function validateAllSteps() {
  for (let index = 0; index < steps.length; index += 1) {
    currentStep = index;
    updateStep();
    if (!validateStep(index)) return false;
  }
  currentStep = steps.length - 1;
  updateStep();
  return true;
}

function showSimulation(simulation) {
  const { eligibility, savings, input } = simulation;
  const isNotEligible = eligibility.status === "not-eligible";
  const isAttention = eligibility.status === "attention";

  emptyResult.classList.add("is-hidden");
  resultSummary.classList.remove("is-hidden");
  leadForm.classList.remove("is-hidden");
  fullReport.classList.add("is-hidden");
  reportContent.innerHTML = "";
  leadMessage.textContent = "";

  resultStatus.classList.remove("is-warning", "is-danger");
  if (isNotEligible) {
    resultStatus.classList.add("is-danger");
    resultStatus.textContent = "Fora do perfil para aplicação direta";
    resultTitle.textContent = "Prévia calculada";
    resultDescription.textContent =
      "Para entender o cenário e próximos passos, libere o diagnóstico completo por e-mail.";
  } else if (isAttention) {
    resultStatus.classList.add("is-warning");
    resultStatus.textContent = "Potencial com pontos de atenção";
    resultTitle.textContent = "Prévia calculada";
    resultDescription.textContent =
      "Há indícios para análise, mas o diagnóstico completo depende da validação dos dados.";
  } else {
    resultStatus.textContent = "Potencial identificado";
    resultTitle.textContent = "Prévia calculada";
    resultDescription.textContent =
      "Para receber a leitura completa da simulação, preencha os dados abaixo.";
  }

  savingRange.textContent = savings.high > 0
    ? `${formatCurrency(savings.low)} a ${formatCurrency(savings.high)}`
    : "Sem estimativa aplicável no regime atual";

  const rateText = savings.high > 0
    ? `Faixa usada: ${formatPercent(savings.lowRate)} a ${formatPercent(savings.highRate)} sobre dispêndios elegíveis.`
    : "A estimativa numérica fica bloqueada até o enquadramento mínimo ser confirmado.";

  savingNote.textContent = savings.caps.length
    ? `${rateText} Trava aplicada: ${savings.caps.join(" e ")}.`
    : `${rateText} ${savings.rateReason}`;

  resultFlags.innerHTML = "";
  resultFlags.classList.add("is-hidden");
}

function getCrmFields(input, lead, eligibility, savings, submission) {
  return {
    "Data de envio": submission.submittedAtBr,
    "Nome": lead.name,
    "Cargo": lead.role,
    "Empresa": lead.company,
    "E-mail": lead.email,
    "Telefone / WhatsApp": lead.phone,
    "CNPJ": lead.cnpj,
    "Setor": input.sector,
    "Regime tributário": input.taxRegime,
    "Apurou lucro fiscal?": input.fiscalProfit,
    "Situação fiscal": input.taxRegularity,
    "Faturamento anual": input.annualRevenue,
    "Lucro fiscal anual": input.fiscalProfitAmount,
    "IRPJ + CSLL pagos no ano": input.taxPaid,
    "Dispêndios elegíveis em inovação": input.innovationSpend,
    "Gastos com PJs/terceiros tech": input.contractorSpend,
    "Pesquisadores/tech CLT no ano atual": input.currentResearchers,
    "Pesquisadores/tech CLT no ano anterior": input.previousResearchers,
    "Crescimento de equipe técnica": savings.growth,
    "Patente/registro concedido?": input.hasPatent,
    "Projetos selecionados": input.projects.join(", "),
    "Score de elegibilidade": eligibility.score,
    "Status da triagem": eligibility.status,
    "Economia mínima estimada": Math.round(savings.low),
    "Economia máxima estimada": Math.round(savings.high),
    "Faixa percentual usada": `${formatPercent(savings.lowRate)} a ${formatPercent(savings.highRate)}`,
    "Travas aplicadas": savings.caps.join(" e "),
    "UTM Source": getUtmParams().utm_source || "",
    "UTM Medium": getUtmParams().utm_medium || "",
    "UTM Campaign": getUtmParams().utm_campaign || "",
    "UTM Content": getUtmParams().utm_content || "",
    "UTM Term": getUtmParams().utm_term || "",
    "GCLID": getUtmParams().gclid || "",
    "FBCLID": getUtmParams().fbclid || "",
    "Consentimento LGPD": lead.consent ? "Sim" : "Não",
    "URL da página": window.location.href,
    "Observações comerciais": "",
    "Status do atendimento": "Novo",
    "Responsável comercial": "",
    "Data do primeiro contato": "",
    "Resultado do contato": "Sem contato",
    "Próxima ação": "Validar simulação e entrar em contato"
  };
}

function getPayload(simulation, lead) {
  const { input, eligibility, savings, createdAt } = simulation;
  const submission = getSubmissionData(lead);
  const utmParams = getUtmParams();
  return {
    submission,
    lead,
    company: {
      name: lead.company,
      cnpj: lead.cnpj,
      sector: input.sector
    },
    taxProfile: {
      taxRegime: input.taxRegime,
      fiscalProfit: input.fiscalProfit,
      fiscalProfitAmount: input.fiscalProfitAmount,
      taxRegularity: input.taxRegularity,
      annualRevenue: input.annualRevenue,
      taxPaid: input.taxPaid
    },
    innovationSpend: {
      eligibleSpend: input.innovationSpend,
      contractorSpend: input.contractorSpend,
      projects: input.projects,
      hasPatent: input.hasPatent
    },
    teamData: {
      currentResearchers: input.currentResearchers,
      previousResearchers: input.previousResearchers,
      researcherGrowth: savings.growth,
      exclusionRate: savings.exclusionRate
    },
    eligibilityScore: {
      score: eligibility.score,
      status: eligibility.status,
      flags: eligibility.flags
    },
    estimatedSavingsRange: {
      low: Math.round(savings.low),
      high: Math.round(savings.high),
      lowRate: savings.lowRate,
      highRate: savings.highRate,
      caps: savings.caps
    },
    crmFields: getCrmFields(input, lead, eligibility, savings, submission),
    page: {
      title: document.title,
      url: window.location.href,
      path: window.location.pathname
    },
    utmParams,
    submittedAt: submission.submittedAt,
    createdAt
  };
}

async function sendPayload(payload) {
  if (!integrationConfig.webhookUrl) {
    localStorage.setItem(integrationConfig.simulationStorageKey, JSON.stringify(payload, null, 2));
    return {
      mode: "simulation",
      message: "Modo simulação: payload salvo no navegador em leiDoBemLeadPayload."
    };
  }

  const response = await fetch(integrationConfig.webhookUrl, {
    method: integrationConfig.webhookMethod,
    headers: integrationConfig.webhookHeaders,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook respondeu com status ${response.status}`);
  }

  return {
    mode: "webhook",
    message: "Dados enviados ao CRM com sucesso."
  };
}

function buildReport(simulation, lead) {
  reportContent.innerHTML = "";

  const firstName = lead?.name ? lead.name.split(" ")[0] : "Recebemos";
  const savings = simulation?.savings;
  const estimatedRange = savings?.high > 0
    ? `${formatCurrency(savings.low)} a ${formatCurrency(savings.high)}`
    : "a confirmar após validação documental";

  const rows = [
    {
      title: `${firstName}, sua simulação foi recebida.`,
      text: "Os dados foram registrados para uma triagem preliminar de Lei do Bem. A estimativa abaixo ainda depende da conferência fiscal, contábil e documental."
    },
    {
      title: "Potencial indicado pela calculadora",
      text: `Faixa preliminar: ${estimatedRange}. Para confirmar se esse valor pode ser aproveitado com segurança, é preciso validar regime tributário, lucro fiscal, regularidade fiscal e projetos de inovação.`
    },
    {
      title: "Próxima etapa recomendada",
      text: "Agende uma conversa rápida pelo WhatsApp para entendermos o cenário da empresa e indicar os próximos passos da análise."
    }
  ];

  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "report-row";
    item.innerHTML = `
      <strong>${row.title}</strong>
      <span>${row.text}</span>
    `;
    reportContent.appendChild(item);
  });

  fullReport.classList.remove("is-hidden");
}

prevButton.addEventListener("click", () => {
  currentStep = Math.max(0, currentStep - 1);
  updateStep();
});

nextButton.addEventListener("click", () => {
  if (!validateCurrentStep()) return;
  currentStep = Math.min(steps.length - 1, currentStep + 1);
  updateStep();
});

calculator.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateAllSteps()) return;
  latestSimulation = simulate(getFormData(calculator));
  showSimulation(latestSimulation);
  trackConversion("lei_do_bem_estimativa_gerada", {
    eligibility_status: latestSimulation.eligibility.status,
    eligibility_score: latestSimulation.eligibility.score,
    estimated_savings_low: Math.round(latestSimulation.savings.low),
    estimated_savings_high: Math.round(latestSimulation.savings.high),
    tax_regime: latestSimulation.input.taxRegime
  });
});

calculator.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (!event.target.matches("input, select")) return;

  event.preventDefault();
  if (currentStep < steps.length - 1) {
    if (!validateCurrentStep()) return;
    currentStep += 1;
    updateStep();
    return;
  }

  calculator.requestSubmit(calculateButton);
});

leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!latestSimulation) return;
  if (!leadForm.reportValidity()) return;

  const lead = getLeadData();
  const payload = getPayload(latestSimulation, lead);
  const submitButton = leadForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  leadMessage.textContent = "Enviando dados da simulação...";

  try {
    const sendResult = await sendPayload(payload);
    trackConversion("lei_do_bem_lead_enviado", {
      send_mode: sendResult.mode,
      eligibility_status: payload.eligibilityScore.status,
      eligibility_score: payload.eligibilityScore.score,
      estimated_savings_low: payload.estimatedSavingsRange.low,
      estimated_savings_high: payload.estimatedSavingsRange.high,
      tax_regime: payload.taxProfile.taxRegime
    });
    leadMessage.textContent = sendResult.mode === "simulation"
      ? "Solicitação recebida. O envio automático fica ativo quando o webhook for configurado."
      : "Solicitação recebida. Seus dados foram enviados com sucesso.";
    buildReport(latestSimulation, lead, sendResult);
  } catch (error) {
    trackConversion("lei_do_bem_lead_envio_falhou", {
      error_message: error.message,
      eligibility_status: payload.eligibilityScore.status
    });
    leadMessage.textContent =
      "Não foi possível enviar ao webhook agora. A solicitação foi registrada localmente.";
    localStorage.setItem(integrationConfig.fallbackStorageKey, JSON.stringify(payload, null, 2));
    buildReport(latestSimulation, lead, {
      mode: "fallback",
      message: `Falha no webhook: ${error.message}`
    });
  } finally {
    submitButton.disabled = false;
  }
});

calculator.querySelectorAll("input[inputmode='decimal'], input[inputmode='numeric']").forEach((field) => {
  field.addEventListener("input", () => formatNumberInput(field));
  field.addEventListener("blur", () => formatNumberInput(field));
});

const phoneField = leadForm.querySelector("input[name='phone']");
const cnpjField = leadForm.querySelector("input[name='cnpj']");

if (phoneField) {
  phoneField.addEventListener("input", () => formatPhoneInput(phoneField));
  phoneField.addEventListener("blur", () => formatPhoneInput(phoneField));
}

if (cnpjField) {
  cnpjField.addEventListener("input", () => formatCnpjInput(cnpjField));
  cnpjField.addEventListener("blur", () => formatCnpjInput(cnpjField));
}

openCalculatorButtons.forEach((button) => {
  button.addEventListener("click", openCalculatorModal);
});

document.querySelectorAll('a[href*="wa.me"]').forEach((link) => {
  link.addEventListener("click", () => {
    trackConversion("lei_do_bem_whatsapp_click", {
      link_text: link.textContent.trim(),
      link_url: link.href
    });
  });
});

closeCalculatorButtons.forEach((button) => {
  button.addEventListener("click", closeCalculatorModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && calculatorModal && !calculatorModal.classList.contains("is-hidden")) {
    closeCalculatorModal();
  }
});

syncFloatingCta();
window.addEventListener("scroll", syncFloatingCta, { passive: true });
openCalculatorFromHash();
window.addEventListener("hashchange", openCalculatorFromHash);

updateStep();
