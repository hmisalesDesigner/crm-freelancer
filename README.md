# CRM Freelancer

Ferramenta pessoal, em português, para calcular preços de serviços freelance de
design e vídeo, e gerenciar o relacionamento com clientes do primeiro contato
até a entrega.

## Funcionalidades

- **Calculadora de preço**: valor/hora, por projeto e por peça, com base na fórmula
  `(salário desejado + custos fixos) ÷ horas pagas por mês`.
- **Alerta de limite MEI**: acompanha o faturamento anual frente ao limite de R$ 81.000,00.
- **Lembrete de investimento (B3)**: todo orçamento inclui um lembrete pessoal para
  separar um % do valor recebido e comprar uma ação específica.
- **CRM de clientes**: cadastro com histórico financeiro e consulta automática de
  CNPJ (razão social, capital social) via [BrasilAPI](https://brasilapi.com.br).
- **Funil de vendas (kanban)**: Prospecção → Contato → Briefing → Orçamento enviado
  → Fechado → Ativos → Inativos.
- **Orçamentos**: geração de texto pronto para WhatsApp.
- **Prospecção**: organizador de leads (clientes diretos, gráficas, freelancers parceiros),
  com busca inicial focada em Maringá-PR.
- **Tema claro/escuro.**

## Dados

Os dados são salvos no navegador (`localStorage`). Para manter uma cópia de segurança
no Google Drive, use **Configurações → Exportar backup (.json)** e salve o arquivo
dentro da pasta sincronizada do Drive no seu computador. Para restaurar, use
**Importar backup (.json)**.

## Publicação (GitHub Pages)

1. Vá em **Settings → Pages** neste repositório.
2. Em "Source", selecione a branch `main` e a pasta `/ (root)`.
3. Salve. O site ficará disponível em `https://hmisalesdesigner.github.io/crm-freelancer/`.

> Como o repositório é privado, o GitHub Pages também ficará privado/restrito
> dependendo do seu plano do GitHub.
