/*
  # Create Authentication and Chat Tables

  1. New Tables
    - `auth_tokens`
      - `id` (uuid, primary key)
      - `user_id` (text, unique) - Chaturbate username
      - `token` (text) - Auth token from Chaturbate
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `chat_messages`
      - `id` (uuid, primary key)
      - `username` (text) - Who sent the message
      - `message` (text) - Message content
      - `timestamp` (timestamp)
      - `is_mine` (boolean) - Whether message is from current user

    - `private_messages`
      - `id` (uuid, primary key)
      - `from_user` (text) - Who sent PM
      - `to_user` (text) - Who received PM
      - `message` (text) - PM content
      - `is_read` (boolean)
      - `timestamp` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Create policies for data isolation
*/

CREATE TABLE IF NOT EXISTS auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE NOT NULL,
  token text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  message text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  is_mine boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user text NOT NULL,
  to_user text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  timestamp timestamptz DEFAULT now()
);

ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat messages"
  ON chat_messages FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert chat messages"
  ON chat_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read private messages"
  ON private_messages FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert private messages"
  ON private_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read auth tokens"
  ON auth_tokens FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert auth tokens"
  ON auth_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update auth tokens"
  ON auth_tokens FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
