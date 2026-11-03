-- Gift list storage. The one tool on the site that keeps anything on a server:
-- a list is shared between people, so it has to live somewhere they can all
-- reach. See CLAUDE.md before giving any other tool a table.
--
-- Apply with: psql "$DATABASE_URL" -f db/gift-list.sql
-- Safe to run twice.

create extension if not exists pgcrypto;

create table if not exists gift_lists (
  id            uuid primary key default gen_random_uuid(),
  -- The public half of the share link, e.g. cameron-k7f2qx9m.
  slug          text not null unique,
  -- SHA-256 of the edit key. The key itself only ever exists in the link.
  edit_key_hash text not null,
  owner_name    text not null check (char_length(owner_name) between 1 and 60),
  title         text not null check (char_length(title) between 1 and 80),
  note          text not null default '' check (char_length(note) <= 400),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists gift_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references gift_lists (id) on delete cascade,
  -- Rank: 0 is wanted most.
  position    integer not null,
  title       text not null check (char_length(title) between 1 and 200),
  url         text check (char_length(url) <= 2000),
  image_url   text check (char_length(image_url) <= 2000),
  price_cents integer check (price_cents between 0 and 100000000),
  store       text check (char_length(store) <= 60),
  note        text check (char_length(note) <= 300),
  -- How many the owner wants. Null means no limit, for gift cards and the like.
  quantity    integer check (quantity between 1 and 99),
  created_at  timestamptz not null default now()
);

create index if not exists gift_items_list_position on gift_items (list_id, position);

create table if not exists gift_claims (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references gift_items (id) on delete cascade,
  name        text check (char_length(name) <= 40),
  -- SHA-256 of the undo token kept in the claimer's browser.
  token_hash  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists gift_claims_item on gift_claims (item_id);

-- Only the site's server talks to these tables. On Supabase that means row
-- level security on with no policies, and nothing granted to the public API
-- roles, so the anon key cannot read a list or a claim directly.
alter table gift_lists enable row level security;
alter table gift_items enable row level security;
alter table gift_claims enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on gift_lists, gift_items, gift_claims from anon, authenticated;
  end if;
end
$$;
