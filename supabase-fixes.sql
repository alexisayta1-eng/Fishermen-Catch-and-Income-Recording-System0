-- Disable Row Level Security (RLS) on all tables to allow public registration and access
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE catches DISABLE ROW LEVEL SECURITY;
ALTER TABLE operational_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- Grant public access usage
GRANT ALL ON TABLE users TO anon;
GRANT ALL ON TABLE catches TO anon;
GRANT ALL ON TABLE operational_expenses TO anon;
GRANT ALL ON TABLE settings TO anon;
