# 🇮🇹 Mamma Mia - Controle de Consumo de Água

Sistema web de alta fidelidade visual projetado especificamente para monitorar e controlar o consumo de água do restaurante Mamma Mia.

O sistema foi estruturado para ser leve, rápido e funcionar de forma local e independente em qualquer computador Windows sem a necessidade de instalar dependências.

---

## 🚀 Como Executar

Para garantir o carregamento correto do sistema e dos gráficos interativos sem problemas de políticas de segurança do navegador (CORS), fornecemos um servidor local em lote de um clique:

1. Dê um duplo clique no arquivo **`run.bat`** localizado na pasta raiz do projeto.
2. Isso iniciará um servidor HTTP local seguro via PowerShell e abrirá automaticamente o painel no seu navegador padrão (geralmente em `http://localhost:3000`).
3. Mantenha a janela preta aberta enquanto estiver utilizando o sistema. Para encerrar, basta fechá-la ou pressionar `Ctrl+C` no console.

*Caso possua o Node.js instalado no futuro, você também pode rodar `npm install` e depois `npm run dev` para usar o Vite.*

---

## 📊 Regras de Faturamento e Metas

- **Hidrômetros Cadastrados**:
  - `Y21T156506` - Cozinha Principal & Massas
  - `A25LM0975882` - Salão & Banheiros
  - `A25LM0975883` - Produção & Fornos
  - `A25LM0975884` - Jardim, Calçada & Limpeza
- **Meta Individual**: 20 m³ por hidrômetro em cada ciclo.
- **Meta Global**: 80 m³ combinados.
- **Ciclo de Consumo**: Inicia-se sempre no **dia 07** e encerra-se no **dia 06 do mês seguinte** (ex: 07/Jun a 06/Jul).

---

## ⚙️ Funcionalidades Disponíveis

- **Dashboard Executivo**: Resumo do ciclo atual, percentual de uso do limite, projeções de consumo e número de hidrômetros em alerta.
- **Comparativo de Ciclos**: Indica economia ou aumento de consumo em metros cúbicos em relação ao ciclo anterior.
- **Gráfico de Tendência (Linha)**: Exibe a curva de consumo diário acumulado no ciclo atual para cada hidrômetro, comparando diretamente com a linha de meta de 20 m³.
- **Lançamento Manual**: Permite adicionar novas leituras acumuladas dos hidrômetros diretamente no painel. O sistema valida se os dados são cronologicamente coerentes (não permitindo leituras menores que as anteriores).
- **Importação de CSV (Google Sheets)**: Possibilidade de carregar planilhas de leituras de forma massiva.
- **Exportação de Dados**: Gera um backup completo em arquivo `.json` das leituras para prevenção de perda de dados.
- **Limpeza de Dados**: Botão de redefinição para reverter aos dados de demonstração (ou limpar tudo).

---

## 📊 Formato de Importação CSV (Google Sheets)

Para importar planilhas de leituras, o arquivo `.csv` deve conter pelo menos três colunas com os cabeçalhos abaixo (separados por vírgula `,` ou ponto e vírgula `;`):

| Data | Hidrômetro | Leitura Acumulada |
| :--- | :--- | :--- |
| 11/06/2026 14:00 | Y21T156506 | 1285.500 |
| 11/06/2026 14:15 | A25LM0975882 | 864.250 |

*Dica: O sistema ignora diferenças de maiúsculas/minúsculas e acentos nos cabeçalhos.*
