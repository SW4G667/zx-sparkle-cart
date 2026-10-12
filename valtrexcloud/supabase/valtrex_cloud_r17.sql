-- O login único do portal usa a aplicação OAuth2 da plataforma, sem escolher
-- um tenant. As verificações de lojas continuam obrigatoriamente por tenant.
alter table public.valtrex_oauth_states alter column tenant_id drop not null;
alter table public.valtrex_portal_sessions alter column login_tenant_id drop not null;
alter table public.valtrex_oauth_states add constraint valtrex_oauth_portal_global_scope
  check ((flow = 'portal_global' and tenant_id is null and gift_id is null)
    or (flow <> 'portal_global' and tenant_id is not null));
