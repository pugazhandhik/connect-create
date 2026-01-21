-- Enable REPLICA IDENTITY FULL on participants table so DELETE events include the old row data
ALTER TABLE public.participants REPLICA IDENTITY FULL;