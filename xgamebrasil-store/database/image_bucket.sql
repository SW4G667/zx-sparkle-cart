insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('xg-product-images','xg-product-images',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
