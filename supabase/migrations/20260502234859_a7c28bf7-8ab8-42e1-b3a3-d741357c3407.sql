-- Add missing foreign key for imovel_id
ALTER TABLE public.ganhos_extras 
ADD CONSTRAINT ganhos_extras_imovel_id_fkey 
FOREIGN KEY (imovel_id) 
REFERENCES public.imoveis(id) 
ON DELETE CASCADE;

-- Ensure RLS is correctly set up for the new relationship if needed
-- (Assuming it's already enabled on the table)
