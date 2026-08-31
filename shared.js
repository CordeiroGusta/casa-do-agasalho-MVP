/* ============================================================
   Casa do Agasalho — Núcleo compartilhado do MVP de atendimento
   Usado por atendimento.html (doador) e painel-ong.html (ONG)
   Persistência: localStorage. Sincronização entre abas: 'storage' event.
   ============================================================ */

const CA = (function () {
  "use strict";

  /* ---------- Chaves de storage ---------- */
  const KEYS = {
    CONVERSATIONS: "ca_conversations_v1",
    DONATIONS: "ca_donations_v1",
    SEQ: "ca_seq_v1",
  };

  /* ---------- Estados do atendimento ---------- */
  const STATUS = {
    BOT_ACTIVE: "BOT_ACTIVE",
    HUMAN_REQUESTED: "HUMAN_REQUESTED",
    HUMAN_ACTIVE: "HUMAN_ACTIVE",
    BOT_RESUMING: "BOT_RESUMING",
    WAITING_CONFIRMATION: "WAITING_CONFIRMATION",
    COMPLETED: "COMPLETED",
  };

  /* ---------- Passos de coleta do bot ---------- */
  const STEP = {
    GREETING: "GREETING",
    ASK_NAME: "ASK_NAME",
    ASK_TYPE: "ASK_TYPE",
    ASK_QTY: "ASK_QTY",
    ASK_DELIVERY: "ASK_DELIVERY",
    ASK_ADDRESS_NOTE: "ASK_ADDRESS_NOTE",
    ASK_DATE: "ASK_DATE",
    ASK_TIME: "ASK_TIME",
    DONE_COLLECTING: "DONE_COLLECTING",
  };

  /* ---------- Utilidades básicas ---------- */
  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateBR(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  }

  /* ---------- Storage genérico ---------- */
  function readAll(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Erro lendo storage", key, e);
      return [];
    }
  }

  function writeAll(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // Dispara evento manual na mesma aba (o evento nativo 'storage' só
      // dispara em OUTRAS abas, então emitimos um customEvent local também)
      window.dispatchEvent(new CustomEvent("ca:change", { detail: { key } }));
    } catch (e) {
      console.error("Erro gravando storage", key, e);
    }
  }

  function nextSeq() {
    let seq = parseInt(localStorage.getItem(KEYS.SEQ) || "0", 10);
    seq += 1;
    localStorage.setItem(KEYS.SEQ, String(seq));
    return seq;
  }

  /* ---------- Conversas ---------- */
  function getConversations() {
    return readAll(KEYS.CONVERSATIONS);
  }

  function getConversation(id) {
    return getConversations().find((c) => c.id === id) || null;
  }

  function saveConversation(conv) {
    const list = getConversations();
    const idx = list.findIndex((c) => c.id === conv.id);
    conv.updatedAt = nowISO();
    if (idx >= 0) list[idx] = conv;
    else list.push(conv);
    writeAll(KEYS.CONVERSATIONS, list);
    return conv;
  }

  function createConversation() {
    const conv = {
      id: uid("conv"),
      status: STATUS.BOT_ACTIVE,
      step: STEP.GREETING,
      messages: [],
      data: {
        nome: null,
        tipo: null,
        quantidade: null,
        entrega: null, // "levar" | "retirada"
        endereco: null,
        data: null,
        horario: null,
        observacoes: null,
      },
      transferReason: null,
      attendantName: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    saveConversation(conv);
    return conv;
  }

  function addMessage(conv, sender, text, opts) {
    opts = opts || {};
    const msg = {
      id: uid("msg"),
      sender, // 'bot' | 'doador' | 'atendente' | 'sistema'
      text,
      time: nowISO(),
      buttons: opts.buttons || null,
    };
    conv.messages.push(msg);
    saveConversation(conv);
    return msg;
  }

  /* ---------- Doações (planilha) ---------- */
  function getDonations() {
    return readAll(KEYS.DONATIONS);
  }

  function addDonation(conv) {
    const list = getDonations();
    const id = String(nextSeq()).padStart(3, "0");
    const record = {
      id,
      conversationId: conv.id,
      doador: conv.data.nome || "Não informado",
      tipo: conv.data.tipo || "Não informado",
      quantidade: conv.data.quantidade || "Não informado",
      data: conv.data.data || "A combinar",
      horario: conv.data.horario || "—",
      retirada: conv.data.entrega === "retirada" ? "Sim" : "Não",
      observacoes: conv.data.observacoes || "",
      status: conv.data.entrega === "retirada" ? "Agendada" : "Aguardando entrega",
      registradoEm: nowISO(),
      viaAtendenteHumano: !!conv.attendantName,
    };
    list.push(record);
    writeAll(KEYS.DONATIONS, list);
    return record;
  }

  function clearAll() {
    localStorage.removeItem(KEYS.CONVERSATIONS);
    localStorage.removeItem(KEYS.DONATIONS);
    localStorage.removeItem(KEYS.SEQ);
    window.dispatchEvent(new CustomEvent("ca:change", { detail: { key: "all" } }));
  }

  /* ---------- Reconhecimento de intenção (simulado) ---------- */
  function normalize(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  const HUMAN_TRIGGERS = [
    "busque", "buscar", "busquem", "venham buscar", "venha buscar",
    "retirar", "retirada", "retire", "coleta em casa", "pegar em casa",
    "falar com alguem", "falar com atendente", "atendente humano",
    "quero falar com uma pessoa", "isso nao resolve", "quero um humano",
    "atendente", "pessoa da equipe", "humano",
  ];

  const COMPLAINT_TRIGGERS = [
    "pessimo", "horrivel", "ruim", "insatisfeito", "reclamacao",
    "demora", "nao funciona", "problema serio", "absurdo",
  ];

  const OUT_OF_SCOPE_TRIGGERS = [
    "trabalho voluntario", "ser voluntario", "quero ser parceiro",
    "investir", "parceria", "imprensa", "entrevista", "cnpj",
  ];

  function detectsHumanNeed(text) {
    const t = normalize(text);
    return HUMAN_TRIGGERS.some((k) => t.includes(k)) ||
           COMPLAINT_TRIGGERS.some((k) => t.includes(k)) ||
           OUT_OF_SCOPE_TRIGGERS.some((k) => t.includes(k));
  }

  function detectDeliveryIntent(text) {
    const t = normalize(text);
    if (t.includes("retirada") || t.includes("busque") || t.includes("busquem") ||
        t.includes("retirar") || t.includes("pegar em casa") || t.includes("venham buscar")) {
      return "retirada";
    }
    if (t.includes("levar") || t.includes("eu levo") || t.includes("vou ate") || t.includes("entrego")) {
      return "levar";
    }
    return null;
  }

  function guessDonationType(text) {
    const t = normalize(text);
    const types = [
      ["cobertor", "Cobertores"],
      ["agasalho", "Agasalhos"],
      ["casaco", "Casacos e agasalhos"],
      ["calcado", "Calçados"],
      ["sapato", "Calçados"],
      ["tenis", "Calçados"],
      ["roupa", "Roupas de inverno"],
    ];
    for (const [k, label] of types) {
      if (t.includes(k)) return label;
    }
    return null;
  }

  return {
    KEYS, STATUS, STEP,
    uid, nowISO, formatTime, formatDateBR,
    getConversations, getConversation, saveConversation, createConversation, addMessage,
    getDonations, addDonation, clearAll,
    normalize, detectsHumanNeed, detectDeliveryIntent, guessDonationType,
  };
})();
