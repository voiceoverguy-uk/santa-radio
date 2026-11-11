BEGIN;
CREATE TABLE IF NOT EXISTS santa_message_accounts (
 purchase_id text PRIMARY KEY, user_id text NOT NULL, linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS santa_message_accounts_user ON santa_message_accounts(user_id);
CREATE TABLE IF NOT EXISTS santa_saved_messages (
 id uuid PRIMARY KEY, purchase_id text NOT NULL REFERENCES santa_message_accounts(purchase_id),
 operation_id uuid NOT NULL UNIQUE, child_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, assets jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS santa_saved_messages_expiry ON santa_saved_messages(expires_at);
COMMIT;
