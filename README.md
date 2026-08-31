# Casa do Agasalho — MVP de Atendimento Automatizado

MVP desenvolvido para a disciplina **Projeto Integrador II**, simulando um 
sistema de atendimento automatizado via WhatsApp para uma ONG de doação 
de roupas de inverno.

O projeto é composto por três frentes:

- **Landing page institucional** — apresenta a ONG, sua causa, formas de 
  ajudar e pontos de coleta.
- **Chat do doador** — simula o atendimento via WhatsApp, onde um chatbot 
  coleta os dados da doação e permite agendar a retirada em domicílio ou 
  a entrega na sede.
- **Painel da ONG** — permite à equipe acompanhar as conversas em tempo 
  real, assumir o atendimento manualmente quando o bot não resolve, e 
  visualizar as doações registradas.

## Arquivos
- `casa-do-agasalho.html` — site institucional (landing page)
- `atendimento.html` — simulação do WhatsApp, lado do doador (público)
- `painel-ong.html` — painel interno: fila de atendimento, chat do atendente, planilha de doações, dashboard
- `shared.js` — lógica compartilhada (estado, storage, regras do bot)

## Como rodar
Basta abrir os arquivos com um servidor local (ex: `python3 -m http.server`) e acessar `atendimento.html` e `painel-ong.html` no navegador. Não usar `file://` direto, pois o `localStorage` de sincronização entre abas pode se comportar de forma inconsistente.

## Como demonstrar

**Cenário A — 100% automático:** inicie a conversa em `atendimento.html`, preencha os dados e escolha "Vou levar até a ONG" na etapa de entrega. O bot conduz tudo sozinho até confirmar e registrar a doação.

**Cenário B — atendimento humano (principal):** na etapa de entrega, escolha "Preciso solicitar retirada". A conversa é transferida e aparece na fila de `painel-ong.html`. Abra o painel em outra aba, clique em "Assumir atendimento", converse, e depois em "Finalizar atendimento". O bot retoma automaticamente do lado do doador, confirma os dados e registra a doação na planilha.

## Persistência
Os dados ficam no `localStorage` do navegador (não há backend). Use "Reiniciar conversa" (doador) ou "Limpar todos os dados" (painel) para recomeçar a demonstração.
