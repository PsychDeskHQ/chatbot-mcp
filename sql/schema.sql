-- Minimal schema for local testing of the therapy assistant.
-- Mirrors the access-scope tables the bot reads/writes, plus light
-- organizations/therapists tables so the foreign keys resolve.
-- gen_random_uuid() is built into Postgres 13+ (no extension needed).

CREATE TABLE IF NOT EXISTS organizations (
    id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL
);

CREATE TABLE IF NOT EXISTS therapists (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id),
    name            text NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations(id),
    therapist_id      uuid REFERENCES therapists(id),
    client_id         text,            -- human-readable id
    name              text NOT NULL,
    email             varchar(255),
    dob               date,
    gender            text,
    pronouns          text,
    occupation        text,
    address           text,
    contact           text,
    country_code      varchar(8),
    emergency_contact text,
    is_active         boolean DEFAULT true,
    is_assessed       boolean DEFAULT false,
    referred_by       uuid REFERENCES therapists(id),
    metadata          jsonb
);

CREATE TABLE IF NOT EXISTS client_note_folders (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       uuid NOT NULL REFERENCES clients(id),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    name            text NOT NULL,
    description     text,
    is_favorite     boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS client_notes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       uuid NOT NULL REFERENCES clients(id),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    folder_id       uuid REFERENCES client_note_folders(id),
    title           text,
    content         text,
    created_by      uuid REFERENCES therapists(id),
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customized_worksheet_templates (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id         uuid REFERENCES therapists(id),
    original_template_id uuid,          -- FK omitted for the test DB
    title                text,
    subtitle             text,
    types                text,          -- JSON array as text, e.g. ["CBT","Anxiety"]
    introduction         text,
    details              text,
    html_content         text,
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_worksheets (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id    uuid NOT NULL REFERENCES clients(id),
    therapist_id uuid REFERENCES therapists(id),
    worksheet_id uuid NOT NULL REFERENCES customized_worksheet_templates(id),
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);
