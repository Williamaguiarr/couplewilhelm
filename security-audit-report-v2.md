# Relatório de Auditoria e Correção de RLS

## 1. Tabela: profiles
- **Policy Anterior:** "Usuarios podem ver proprio perfil" (Permitia Admin ver todos).
- **Risco:** Admin visualizava perfis fora de sua operação.
- **Correção:** Nova política "Profiles - Admin vê perfis vinculados". Restringe Admin a ver apenas a si mesmo e proprietários de seus imóveis.

## 2. Tabela: user_roles
- **Policy Anterior:** "Master e admin e proprio usuario podem ver roles".
- **Risco:** Vazamento da estrutura de roles de todo o sistema para qualquer Admin.
- **Correção:** Nova política "User Roles - Admin vê roles vinculadas". Admin agora só consulta roles de usuários sob sua gestão.

## 3. Tabela: despesas_extras / ganhos_extras
- **Policy Anterior:** Políticas genéricas de visualização e permissão de INSERT/UPDATE para proprietários.
- **Risco:** Proprietários podiam alterar dados financeiros.
- **Correção:** Restrição total de INSERT/UPDATE para Proprietários. Acesso restrito a Master e Admin vinculado. Proprietário tem apenas SELECT.

## 4. Tabela: reservas
- **Policy Anterior:** Admin gerenciava reservas, mas sem trava explícita contra acesso cruzado de outros Admins.
- **Risco:** Um Admin poderia teoricamente acessar reservas de outro se o frontend permitisse.
- **Correção:** Política reforçada com `EXISTS` validando explicitamente a relação `imovel -> admin_id`.

## 5. Auditoria de Inserções (INSERT)
- **Ação:** Eliminadas todas as políticas que não validavam a role do usuário. Inserções em `imoveis`, `admin_configs` e tabelas financeiras agora exigem verificação `is_active_admin` ou `has_role(..., 'master')`.

## 6. Funções SECURITY DEFINER
- **Risco:** Funções como `has_role` e `is_active_admin` estavam acessíveis à role `anon`.
- **Correção:** Revogado `EXECUTE` de `PUBLIC` e concedido apenas a `authenticated` e `service_role`.

## Conclusão
O isolamento entre operações (Admins diferentes) e a proteção de dados financeiros contra edição por proprietários foi implementada com sucesso através de Row Level Security direto no banco de dados.
