-- 在 Supabase 儀表板中的 SQL Editor 執行以下語法來建立資料表與權限

-- 1. Create messages table
CREATE TABLE messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
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
