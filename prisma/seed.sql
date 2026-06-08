INSERT INTO "SubscriptionPlan"
  ("id", "name", "slug", "description", "price", "currency", "billingInterval", "monthlySolveLimit", "featuresJson", "active", "recommended", "createdAt", "updatedAt")
VALUES
  ('plan_free', 'Free', 'free', 'Zakladny plan pre vyskusanie manualneho zadania.', 0, 'EUR', 'month', 3, '["manual-input","history"]', true, false, now(), now()),
  ('plan_family', 'Rodinny', 'family', 'Rodinny plan pre bezne riesenie a asistovane kontroly.', 699, 'EUR', 'month', 100, '["manual-input","photo-scan","voice-assistant","mistake-check","history"]', true, true, now(), now()),
  ('plan_premium', 'Premium', 'premium', 'Plny plan pre pokrocile funkcie po ich dokonceni.', 999, 'EUR', 'month', NULL, '["manual-input","photo-scan","video-analysis","voice-assistant","mistake-check","history"]', true, false, now(), now())
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "price" = EXCLUDED."price",
  "monthlySolveLimit" = EXCLUDED."monthlySolveLimit",
  "featuresJson" = EXCLUDED."featuresJson",
  "active" = EXCLUDED."active",
  "recommended" = EXCLUDED."recommended",
  "updatedAt" = now();
