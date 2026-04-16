# Relatório Técnico: Lógica de Agrupamento RotasPro

Este relatório detalha como o sistema processa e agrupa os pacotes para garantir que entregas no mesmo endereço sejam consolidadas em uma única parada.

## 1. Funcionamento da Chave de Agrupamento (`getGroupingKey`)

A chave de agrupamento é o "DNA" que o sistema usa para decidir se dois pacotes pertencem à mesma parada. Ela é gerada seguindo estas etapas:

### A. Correção e Expansão
Antes de qualquer comparação, o sistema "limpa" o endereço:
- **Correções Manuais**: Se o endereço for "Nereu Guizone, 890", ele é automaticamente convertido para "Servidão Osnildo Leôncio Duarte, 890" internamente para bater com outros pacotes do mesmo local.
- **Abreviações**: "R.", "Av.", "Srv." são expandidos para "Rua", "Avenida", "Servidao". Isso evita que "R. Teste" e "Rua Teste" sejam tratados como locais diferentes.
- **Normalização**: Removemos acentos e convertemos tudo para minúsculas.

### B. Extração de Rua e Número (Prioridade Máxima)
O sistema foi programado para encontrar o **Logradouro** e o **Número** de forma inteligente:
1. Ele substitui vírgulas, traços e pontos por espaços.
2. Usa uma expressão regular (`Regex`) para separar o nome da rua do primeiro número encontrado.
3. Exemplo: `"Rua das Flores, 100 - Bairro Centro"` resulta em:
   - Rua: `ruadasflores`
   - Número: `100`

### C. Confluência por Coordenadas (Segurança)
Como você pediu, as coordenadas servem como **confluência**. Adicionamos a Latitude e Longitude (arredondadas para uma precisão de ~11km) no final da chave.
- **Por que isso?** Se houver uma "Rua São Pedro, 10" em Florianópolis e outra em São José na mesma planilha, elas terão a mesma "Rua e Número", mas coordenadas diferentes. A confluência garante que elas **não** sejam agrupadas erroneamente em cidades/regiões distantes.

---

## 2. Integração de Pedidos Manuais vs. Planilha

O sistema trata pedidos importados (com sequência) e manuais (sem sequência) da mesma forma no agrupamento:

1. **Passo 1**: O sistema lê todos os pacotes da planilha que já têm ordem definida e cria grupos baseados na chave (Rua_Numero_Regiao).
2. **Passo 2**: Ele percorre os pacotes manuais (adicionados por você ou sem ordem).
3. **Passo 3 (O pulo do gato)**: Para cada pacote manual, ele gera a mesma chave.
   - Se a chave bater com uma parada que já existe na rota, o pacote manual é **inserido dentro** dessa parada.
   - Se a chave não bater com nada, ele cria uma nova parada temporária no final da lista.

---

## 3. Resultado Final na Planilha

Na planilha gerada, você verá:
- **Coluna "Destination Address"**: O endereço corrigido e formatado.
- **Coluna "Pacotes na Parada"**: Uma lista separada por vírgulas de todos os pacotes (ex: `1, 1 (+1), 2`). 
  - O `(+1)` indica um pacote manual que foi "encaixado" naquela parada.

---

## 4. Exemplos Práticos de Agrupamento

| Entrada A (Planilha) | Entrada B (Manual) | Resultado | Motivo |
| :--- | :--- | :--- | :--- |
| `R. Teste, 10` | `Rua Teste 10` | **Agrupado** | Expansão de "R." e extração de "10" gera chave idêntica. |
| `Nereu Guizone, 890` | `Srv. Osnildo, 890` | **Agrupado** | A correção manual unifica os nomes antes de agrupar. |
| `Rua X, 100 (Floripa)` | `Rua X, 100 (Lages)` | **Separado** | As coordenadas (confluência) detectam a distância entre cidades. |

> [!IMPORTANT]
> **Conclusão da Análise**: A lógica está seguindo rigorosamente o seu pedido de priorizar Logradouro+Número e usar coordenadas apenas para evitar erros de cidades/regiões diferentes.

**O deploy está pausado como solicitado. Aguardando sua revisão deste relatório para prosseguir.**
