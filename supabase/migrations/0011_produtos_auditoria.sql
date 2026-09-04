alter table public.produtos
  add column if not exists updated_by uuid references public.profiles(id);

create or replace function public.set_produtos_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();

  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists produtos_set_auditoria
on public.produtos;

create trigger produtos_set_auditoria
before update on public.produtos
for each row
execute function public.set_produtos_auditoria();
