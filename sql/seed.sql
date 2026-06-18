-- Sample data for local testing. Uses fixed UUIDs so you can paste them
-- straight into /chat requests. Idempotent (ON CONFLICT DO NOTHING).
--
-- Scope to use in requests:
--   organization_id = 11111111-1111-1111-1111-111111111111
--   therapist_id    = 22222222-2222-2222-2222-222222222222
--   client_id       = 33333333-3333-3333-3333-333333333333   (clients.id)

INSERT INTO organizations (id, name) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Pawan Therapy Clinic')
ON CONFLICT (id) DO NOTHING;

INSERT INTO therapists (id, organization_id, name) VALUES
    ('22222222-2222-2222-2222-222222222222',
     '11111111-1111-1111-1111-111111111111', 'Dr. Asha Mehta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO clients (
    id, organization_id, therapist_id, client_id, name, email, dob, gender,
    pronouns, occupation, contact, country_code, is_active, is_assessed, metadata
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'CL-1001', 'Riya Sharma', 'riya@example.com', '1996-03-14', 'Female',
    'she/her', 'Graphic Designer', '+91 98765 43210', '+91', true, true,
    '{"tags": ["anxiety", "new-intake"]}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO client_note_folders (id, client_id, organization_id, name, description, is_favorite) VALUES
    ('44444444-4444-4444-4444-444444444444',
     '33333333-3333-3333-3333-333333333333',
     '11111111-1111-1111-1111-111111111111',
     'Session Notes', 'Notes from weekly sessions', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO client_notes (
    id, client_id, organization_id, folder_id, title, content, created_by,
    created_at, updated_at
) VALUES
    ('55555555-5555-5555-5555-555555555555',
     '33333333-3333-3333-3333-333333333333',
     '11111111-1111-1111-1111-111111111111',
     '44444444-4444-4444-4444-444444444444',
     'Intake Session',
     'Client reports work-related stress and difficulty sleeping. Open to CBT. Agreed on weekly sessions.',
     '22222222-2222-2222-2222-222222222222',
     now() - interval '14 days', now() - interval '14 days'),
    ('66666666-6666-6666-6666-666666666666',
     '33333333-3333-3333-3333-333333333333',
     '11111111-1111-1111-1111-111111111111',
     '44444444-4444-4444-4444-444444444444',
     'Session 2',
     'Practiced breathing exercises. Sleep slightly improved. Assigned a thought-record worksheet.',
     '22222222-2222-2222-2222-222222222222',
     now() - interval '7 days', now() - interval '7 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customized_worksheet_templates (
    id, therapist_id, title, subtitle, types, introduction, details, html_content,
    created_at, updated_at
) VALUES (
    '77777777-7777-7777-7777-777777777777',
    '22222222-2222-2222-2222-222222222222',
    'Thought Record', 'Catch and reframe automatic thoughts',
    '["CBT","Anxiety"]',
    'Use this when you notice a strong negative emotion.',
    'Columns: Situation, Automatic Thought, Evidence For, Evidence Against, Balanced Thought.',
    '<h1>Thought Record</h1><p>Fill in each column when a strong emotion arises.</p>',
    now() - interval '30 days', now() - interval '30 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO client_worksheets (id, client_id, therapist_id, worksheet_id, created_at, updated_at) VALUES
    ('88888888-8888-8888-8888-888888888888',
     '33333333-3333-3333-3333-333333333333',
     '22222222-2222-2222-2222-222222222222',
     '77777777-7777-7777-7777-777777777777',
     now() - interval '7 days', now() - interval '7 days')
ON CONFLICT (id) DO NOTHING;
