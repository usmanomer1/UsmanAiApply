/*
  # Create automation_configs table

  1. New Tables
    - `automation_configs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, unique, references auth.users)
      - `config` (jsonb, stores automation configuration)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `automation_configs` table
    - Add policy for authenticated users to manage their own configs

  3. Triggers
    - Add trigger to automatically update `updated_at` timestamp
*/

-- Create the automation_configs table
CREATE TABLE IF NOT EXISTS automation_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE automation_configs ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own automation configs
CREATE POLICY "Users can manage their own automation configs"
  ON automation_configs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_automation_configs_updated_at
  BEFORE UPDATE ON automation_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_automation_configs_user_id ON automation_configs(user_id);