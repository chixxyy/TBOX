-- 在 Supabase 儀表板中的 SQL Editor 執行以下語法來建立資料表與權限

-- 0. Drop existing table if it exists (for clean reset)
DROP TABLE IF EXISTS messages;

-- 1. Create messages table
CREATE TABLE messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  user_name text NOT NULL,
  avatar text NOT NULL,
  text text NOT NULL,
  news_share jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies
-- Allow anyone to read messages
CREATE POLICY "Anyone can read messages" ON messages
  FOR SELECT USING (true);

-- Allow authenticated users to insert messages
CREATE POLICY "Authenticated users can insert messages" ON messages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users and admins to delete messages
CREATE POLICY "Users and admins can delete messages" ON messages
  FOR DELETE USING (
    auth.uid() = user_id 
    OR 
    auth.jwt() ->> 'email' = 'a27976566@gmail.com'
  );

-- 5. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  avatar_url text,
  bio text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 6. Create price_alerts table
CREATE TABLE IF NOT EXISTS price_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  symbol text NOT NULL,
  target_price numeric NOT NULL,
  condition text NOT NULL,
  triggered boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Enable RLS for price_alerts
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- 8. Policies for price_alerts
CREATE POLICY "Users can manage their own alerts" ON price_alerts
  FOR ALL USING (auth.uid() = user_id);

-- 9. Enable Realtime for price_alerts and profiles
ALTER PUBLICATION supabase_realtime ADD TABLE price_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

