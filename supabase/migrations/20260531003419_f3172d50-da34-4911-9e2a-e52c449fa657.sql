ALTER TABLE public.reservas 
ADD COLUMN IF NOT EXISTS codigo_reserva TEXT,
ADD COLUMN IF NOT EXISTS reserva_url TEXT,
ADD COLUMN IF NOT EXISTS status_reserva TEXT;

-- Adicionar colunas de horário caso não existam (já existem override, mas estas seriam para os dados brutos do iCal se quisermos separar)
-- No momento usaremos as colunas existentes de override ou observações para não quebrar a lógica atual de check-in/out do sistema.
