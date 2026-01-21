-- Create waiting_room table to track participants waiting before GD starts
CREATE TABLE public.waiting_room (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, participant_id)
);

-- Create gd_sessions table to track when waiting starts for each room
CREATE TABLE public.gd_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed'))
);

-- Enable RLS
ALTER TABLE public.waiting_room ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for waiting_room
CREATE POLICY "Anyone can join waiting room" ON public.waiting_room FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view waiting room" ON public.waiting_room FOR SELECT USING (true);
CREATE POLICY "Anyone can leave waiting room" ON public.waiting_room FOR DELETE USING (true);

-- RLS policies for gd_sessions
CREATE POLICY "Anyone can create gd session" ON public.gd_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view gd session" ON public.gd_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can update gd session" ON public.gd_sessions FOR UPDATE USING (true);

-- Enable REPLICA IDENTITY FULL for realtime DELETE events
ALTER TABLE public.waiting_room REPLICA IDENTITY FULL;

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiting_room;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gd_sessions;