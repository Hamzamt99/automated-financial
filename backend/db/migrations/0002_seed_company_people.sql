-- Initial company roster. INSERT OR IGNORE keeps this migration safe if a name
-- was entered manually before the migration is applied.

INSERT OR IGNORE INTO workers (id, name) VALUES
  ('7a46d5e7-1dc2-4127-99af-c0b7ebe05270', 'عمر الحوامدة'),
  ('9c063718-d892-4dd3-b547-9cf38b66d580', 'عيد شحادة'),
  ('f9bdd30c-fc7f-411c-8ace-3e8f343c0720', 'محمود العريني'),
  ('f2b06ea6-4f24-4fa1-9545-33d32a995ecf', 'ياسين كمال'),
  ('95716d22-9513-4bed-8829-81fe96bed216', 'انس مسامح'),
  ('1920c056-9f4f-49c3-8077-1b250b6e7c22', 'محمد هلال'),
  ('8b44ab9f-bceb-426f-b2b4-d2a4cfed98db', 'ابراهيم ناجي'),
  ('de53f894-9dac-4a6f-b792-64f2f3cf7ad1', 'معاذ سعيد');

INSERT OR IGNORE INTO operators (id, name) VALUES
  ('c9146731-ca7b-4026-9258-a5b79af96254', 'انس البداوي'),
  ('581c04a0-833c-44ed-b955-9b39dfa4936b', 'عيد نسيم'),
  ('06a22e11-57de-4c1c-a2bf-38abd82f1098', 'خميس الحوامدة'),
  ('145bbc8e-a381-4f15-9b05-562305c01ce5', 'محمود عفانة'),
  ('f2e8bac5-68ab-46d5-9799-e66530a672b3', 'مروان قطيشات'),
  ('60c5a910-6715-4056-ba89-7618355cf256', 'محمد الحناوي');
