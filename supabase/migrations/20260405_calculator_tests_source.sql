-- Add source column to calculator_tests to track whether result came from DB cache or Apify
alter table calculator_tests
  add column if not exists source text; -- 'db' | 'apify'
