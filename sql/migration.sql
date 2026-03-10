-- ============================================================
-- StableScheduler — Supabase Database Migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. PROFILES (auto-created on signup)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  barn_name TEXT DEFAULT 'My Barn',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. LESSONS
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student TEXT NOT NULL,
  horse TEXT NOT NULL,
  instructor TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('private', 'semi-private', 'group')),
  duration INTEGER NOT NULL DEFAULT 60,
  day INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),
  time TEXT NOT NULL,
  recurring BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  week_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lessons_user_week ON lessons(user_id, week_key);

-- 3. SHIFTS
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  day INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),
  role TEXT NOT NULL CHECK (role IN ('feeding', 'mucking', 'turnout', 'lessons', 'maintenance', 'office')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  week_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_shifts_user_week ON shifts(user_id, week_key);

-- 4. TASKS
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_key TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TEXT DEFAULT NULL,
  custom BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_user_date ON tasks(user_id, date_key);

-- 5. INSTRUCTORS (managed list)
CREATE TABLE instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_instructors_user ON instructors(user_id);

-- 6. HORSES (managed list)
CREATE TABLE horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_horses_user ON horses(user_id);

-- 7. STAFF MEMBERS (managed list)
CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_role TEXT DEFAULT 'general',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_staff_members_user ON staff_members(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE horses ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Lessons
CREATE POLICY "Users can view own lessons" ON lessons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lessons" ON lessons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lessons" ON lessons FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lessons" ON lessons FOR DELETE USING (auth.uid() = user_id);

-- Shifts
CREATE POLICY "Users can view own shifts" ON shifts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shifts" ON shifts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shifts" ON shifts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shifts" ON shifts FOR DELETE USING (auth.uid() = user_id);

-- Tasks
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- Instructors
CREATE POLICY "Users can view own instructors" ON instructors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own instructors" ON instructors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own instructors" ON instructors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own instructors" ON instructors FOR DELETE USING (auth.uid() = user_id);

-- Horses
CREATE POLICY "Users can view own horses" ON horses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own horses" ON horses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own horses" ON horses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own horses" ON horses FOR DELETE USING (auth.uid() = user_id);

-- Staff Members
CREATE POLICY "Users can view own staff" ON staff_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own staff" ON staff_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own staff" ON staff_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own staff" ON staff_members FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
