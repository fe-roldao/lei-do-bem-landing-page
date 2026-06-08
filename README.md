# Landing Page Lei do Bem - XRR Law/JRR 360

Landing page estática para captação de leads via calculadora preliminar da Lei do Bem.

## Arquivos

- `index.html`: estrutura da página, SEO, schemas, configuração de integração e conteúdo.
- `styles.css`: identidade visual, responsividade e estados da calculadora.
- `script.js`: calculadora, gate de lead, payload, eventos de conversão e envio para webhook/CRM.
- `assets/`: logos e imagens da marca.

## Configurar Webhook/CRM

No final do `index.html`, antes do `script.js`, preencha `webhookUrl`:

```js
window.LEI_DO_BEM_CONFIG = {
  webhookUrl: "",
  webhookMethod: "POST",
  webhookHeaders: {
    "Content-Type": "application/json"
  }
};
```

Exemplo:

```js
window.LEI_DO_BEM_CONFIG = {
  webhookUrl: "https://seu-endpoint-ou-webhook",
  webhookMethod: "POST",
  webhookHeaders: {
    "Content-Type": "application/json"
  }
};
```

Enquanto `webhookUrl` estiver vazio, o envio fica em modo de simulação e o payload é salvo no navegador como `leiDoBemLeadPayload`.

O payload enviado contém:

- `lead`, `company`, `taxProfile`, `innovationSpend`, `teamData`, `eligibilityScore`, `estimatedSavingsRange`
- `crmFields`, com campos achatados e prontos para planilha/CRM
- `utmParams`, `page`, `submittedAt` e `createdAt`

## Eventos de Conversão

A página dispara eventos para `dataLayer`, `gtag` e `fbq`, quando disponíveis:

- `lei_do_bem_calculadora_aberta`
- `lei_do_bem_estimativa_gerada`
- `lei_do_bem_lead_enviado`
- `lei_do_bem_lead_envio_falhou`
- `lei_do_bem_whatsapp_click`

No Google Tag Manager, crie gatilhos de Evento Personalizado usando esses nomes.

## Publicação

Como a entrega é HTML/CSS/JS puro, basta hospedar a pasta inteira em uma hospedagem estática. Mantenha `index.html`, `styles.css`, `script.js` e `assets/` no mesmo nível.

Para campanhas, você pode usar a URL normal da landing page ou adicionar `#calculadora` no final para abrir a calculadora automaticamente.

## Observação Jurídica

A calculadora apresenta uma estimativa preliminar. O resultado depende de validação documental, fiscal e técnica individualizada.
