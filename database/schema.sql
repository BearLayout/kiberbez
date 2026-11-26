-- ============================================================
-- KIBERBEZ: схема базы данных Supabase
-- Запускать в SQL Editor целиком. Повторный запуск безопасен.
-- ============================================================

-- 1. АДМИНЫ ---------------------------------------------------
create table if not exists admins (
  email text primary key,
  added_at timestamptz default now()
);
insert into admins (email) values ('kasper@kiberbez.ru')
on conflict (email) do nothing;

-- 2. СТАТЬИ БЛОГА ---------------------------------------------
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  image_url text,
  tags text,
  created_at timestamptz default now()
);

-- 3. РЕКОРДЫ ИГРЫ ---------------------------------------------
create table if not exists game_leaderboard (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  created_at timestamptz default now()
);

-- 4. RLS ВЕЗДЕ ------------------------------------------------
alter table articles         enable row level security;
alter table game_leaderboard enable row level security;
alter table admins           enable row level security;

-- 5. СТАТЬИ: чтение всем, запись админам ----------------------
drop policy if exists "public read articles" on articles;
create policy "public read articles"
  on articles for select using (true);

drop policy if exists "admin all articles" on articles;
create policy "admin all articles"
  on articles for all
  using      (auth.email() in (select email from admins))
  with check (auth.email() in (select email from admins));

-- 6. РЕКОРДЫ: чтение всем, вставка всем с проверками ----------
drop policy if exists "public read leaderboard" on game_leaderboard;
create policy "public read leaderboard"
  on game_leaderboard for select using (true);

drop policy if exists "public insert leaderboard" on game_leaderboard;
create policy "public insert leaderboard"
  on game_leaderboard for insert
  with check (
    score between 0 and 10000
    and char_length(player_name) between 3 and 16
    and player_name ~ '[^\s]'
  );

drop policy if exists "public update leaderboard" on game_leaderboard;
drop policy if exists "public delete leaderboard" on game_leaderboard;

-- 7. CONSTRAINTS (идемпотентно) -------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint
    where conname = 'lb_score_range' and conrelid = 'game_leaderboard'::regclass) then
    alter table game_leaderboard
      add constraint lb_score_range check (score between 0 and 10000);
  end if;
  if not exists (select 1 from pg_constraint
    where conname = 'lb_name_len' and conrelid = 'game_leaderboard'::regclass) then
    alter table game_leaderboard
      add constraint lb_name_len check (char_length(player_name) between 3 and 16);
  end if;
end $$;

-- 8. ИНДЕКСЫ --------------------------------------------------
create index if not exists idx_lb_score on game_leaderboard (score desc);
create index if not exists idx_articles_created on articles (created_at desc);

-- 9. RPC submit_score: не чаще 1 рекорда в минуту на имя ------
create table if not exists score_throttle (
  key text primary key,
  last_at timestamptz
);

create or replace function submit_score(p_name text, p_score int)
returns void
language plpgsql
security definer
as $$
declare
  name_clean text := left(btrim(p_name), 16);
begin
  if char_length(name_clean) < 3 or p_score < 0 or p_score > 10000 then
    raise exception 'Некорректные данные';
  end if;

  if exists (
    select 1 from score_throttle
    where key = name_clean and last_at > now() - interval '60 seconds'
  ) then
    raise exception 'Слишком часто, подождите минуту';
  end if;

  insert into game_leaderboard (player_name, score)
  values (name_clean, p_score);

  insert into score_throttle (key, last_at)
  values (name_clean, now())
  on conflict (key) do update set last_at = now();
end $$;
