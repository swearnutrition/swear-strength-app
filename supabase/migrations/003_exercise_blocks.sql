-- Exercise Blocks: Reusable templates of exercises
-- Can be a single exercise or a group (superset/circuit)

CREATE TABLE exercise_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_shared BOOLEAN DEFAULT false, -- If true, visible to all coaches in org
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Block items: The exercises within a block
CREATE TABLE exercise_block_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES exercise_blocks(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  label TEXT, -- For supersets: A1, A2, B1, etc.
  sets TEXT,
  reps TEXT,
  weight TEXT,
  weight_unit TEXT CHECK (weight_unit IN ('lbs', 'kg')),
  rest_seconds INTEGER,
  rpe NUMERIC(3,1),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_exercise_blocks_created_by ON exercise_blocks(created_by);
CREATE INDEX idx_exercise_block_items_block_id ON exercise_block_items(block_id);

-- RLS Policies
ALTER TABLE exercise_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_block_items ENABLE ROW LEVEL SECURITY;

-- Coaches can see their own blocks and shared blocks
CREATE POLICY "Users can view own blocks" ON exercise_blocks
  FOR SELECT USING (auth.uid() = created_by OR is_shared = true);

CREATE POLICY "Users can insert own blocks" ON exercise_blocks
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own blocks" ON exercise_blocks
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own blocks" ON exercise_blocks
  FOR DELETE USING (auth.uid() = created_by);

-- Block items follow parent block permissions
CREATE POLICY "Users can view block items" ON exercise_block_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exercise_blocks
      WHERE id = exercise_block_items.block_id
      AND (created_by = auth.uid() OR is_shared = true)
    )
  );

CREATE POLICY "Users can insert block items" ON exercise_block_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM exercise_blocks
      WHERE id = exercise_block_items.block_id
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update block items" ON exercise_block_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM exercise_blocks
      WHERE id = exercise_block_items.block_id
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete block items" ON exercise_block_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM exercise_blocks
      WHERE id = exercise_block_items.block_id
      AND created_by = auth.uid()
    )
  );
