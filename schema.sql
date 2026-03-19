-- College Lost & Found System Schema

CREATE TABLE public.items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('lost', 'found')),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    item_date DATE NOT NULL,
    contact_name TEXT,
    contact_email TEXT NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved'))
);

-- Set Row Level Security (RLS) policies
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access for listings
CREATE POLICY "Allow public read access" ON public.items FOR SELECT USING (true);

-- Allow anonymous inserts for the form submission
CREATE POLICY "Allow public insert access" ON public.items FOR INSERT WITH CHECK (true);
