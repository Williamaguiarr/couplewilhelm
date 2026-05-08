# Guia de Vendas - Sistema Couple Wilhelm (Gestão de Aluguéis)

Este documento contém todas as informações necessárias para promover e vender o sistema de gestão de aluguéis por temporada.

## 1. O que é o sistema?
O **Couple Wilhelm** é um SaaS (Software as a Service) premium focado em administradores de imóveis de temporada e proprietários. Ele resolve o problema da falta de transparência financeira e da complexidade na gestão de múltiplas reservas vindas de plataformas como Airbnb e Booking.com.

## 2. Como o sistema funciona?
O sistema atua como uma ponte entre a operação (reservas) e o resultado financeiro (prestação de contas).

1.  **Sincronização**: O admin cadastra as reservas (podendo ser integrado via iCal ou API no futuro).
2.  **Gestão de Custos**: O admin lança taxas fixas, comissões e despesas variáveis.
3.  **Portal do Proprietário**: Cada proprietário tem acesso a um dashboard exclusivo onde vê apenas os dados de seus imóveis.
4.  **Prestação de Contas**: Relatórios em PDF profissionais são gerados automaticamente para fechamentos mensais ou anuais.

## 3. Principais Funcionalidades (Diferenciais)

### 📈 Dashboard Inteligente
Visualização de ganhos brutos, líquidos, taxas e performance de ocupação. Gráficos comparativos entre anos ajudam a entender o crescimento do negócio.

### 🗓️ Filtros Acumulados
Único sistema que permite visualizar dados "Acumulados" (ex: Jan-Jul) em um único clique, facilitando a análise de performance anual sem precisar somar meses manualmente.

### 🎨 White-Label (Branding Personalizável)
O administrador pode subir sua própria logo. Quando o proprietário acessa o sistema, ele vê a marca da administradora, fortalecendo a confiança e o profissionalismo.

### 💸 Gestão Financeira Completa
*   Cálculo automático de comissão administrativa.
*   Lançamento de "Ganhos Extras" (Taxas de limpeza, pet, etc).
*   Controle de despesas por imóvel.

### 📱 PWA & Mobile First
O sistema funciona como um aplicativo no celular, permitindo que proprietários consultem seus rendimentos de qualquer lugar.

---

## 4. Argumentos de Venda por Público

### Para o Administrador (Seu Cliente)
*   **Ganhe Tempo**: Reduza em 90% o tempo gasto criando planilhas de fechamento para proprietários.
*   **Retenção de Clientes**: Proprietários que têm transparência total dificilmente trocam de administradora.
*   **Profissionalismo**: Entregue relatórios em PDF com sua logo que parecem feitos por grandes empresas de tecnologia.

### Para o Proprietário (O Cliente do seu Cliente)
*   **Paz de Espírito**: Saiba exatamente quanto está ganhando e onde o dinheiro está sendo gasto.
*   **Acesso 24/7**: Não precisa pedir extratos ao admin; os dados estão sempre lá.
*   **Histórico Completo**: Tenha todos os seus rendimentos organizados para declaração de IR ou análise de investimento.

---

## 5. Capturas de Tela (Sugestões para Slides)
1.  **Login Screen**: Design limpo e moderno.
2.  **Admin Dashboard**: Visão geral de toda a operação.
3.  **Owner Dashboard**: Foco no lucro líquido e extrato detalhado.
4.  **Relatório PDF**: Exemplo do documento profissional gerado.
5.  **Tela de Configurações**: Mostrando a personalização de logo e cores.

---

## 6. Dados Técnicos para Integração
*   **Stack**: React, TypeScript, Tailwind CSS, Supabase (Backend as a Service).
*   **Segurança**: Autenticação robusta e Row Level Security (RLS) para garantir que proprietários nunca vejam dados de outros imóveis.
*   **Velocidade**: Processamento de dados otimizado para grandes volumes de reservas.
