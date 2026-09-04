-- Troca os caminhos relativos de foto (que hoje só existem no disco local)
-- pela URL pública do bucket R2 onde as fotos foram migradas.

update public.produtos
set
  foto_local = 'https://pub-411da6e726ea4d22a006395f63a1261a.r2.dev/' || foto_local
where foto_local is not null and foto_local not like 'http%';

update public.produtos
set
  foto_local_gde = 'https://pub-411da6e726ea4d22a006395f63a1261a.r2.dev/' || foto_local_gde
where foto_local_gde is not null and foto_local_gde not like 'http%';

update public.produtos
set galeria = (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'peq', case when elem->>'peq' like 'http%' then elem->>'peq'
                  else 'https://pub-411da6e726ea4d22a006395f63a1261a.r2.dev/' || (elem->>'peq') end,
      'gde', case when elem->>'gde' like 'http%' then elem->>'gde'
                  else 'https://pub-411da6e726ea4d22a006395f63a1261a.r2.dev/' || (elem->>'gde') end
    )
  ), '[]'::jsonb)
  from jsonb_array_elements(galeria) elem
)
where jsonb_array_length(galeria) > 0;
