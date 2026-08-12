ALTER TABLE "Category"
ADD COLUMN "nameAr" TEXT;

UPDATE "Category"
SET "nameAr" = CASE "slug"
  WHEN 'restorative' THEN 'مواد الترميم'
  WHEN 'endodontics' THEN 'علاج الجذور'
  WHEN 'prosthodontics' THEN 'التركيبات السنية'
  WHEN 'perio-surgery' THEN 'اللثة والجراحة'
  WHEN 'orthodontics' THEN 'تقويم الأسنان'
  WHEN 'consumables' THEN 'المستهلكات'
  WHEN 'instruments' THEN 'أدوات الأسنان'
  WHEN 'equipments' THEN 'الأجهزة'
  WHEN 'implant' THEN 'زراعة الأسنان'
  WHEN 'dental-lab' THEN 'مختبر الأسنان'
  WHEN 'bleaching' THEN 'تبييض الأسنان'
  WHEN 'burs-stones' THEN 'المبارد والأحجار'
  WHEN 'pedodontics' THEN 'طب أسنان الأطفال'
  WHEN 'oral-care-system' THEN 'العناية بالفم والأسنان'
  WHEN 'anesthesia' THEN 'التخدير'
END
WHERE "slug" IN (
  'restorative',
  'endodontics',
  'prosthodontics',
  'perio-surgery',
  'orthodontics',
  'consumables',
  'instruments',
  'equipments',
  'implant',
  'dental-lab',
  'bleaching',
  'burs-stones',
  'pedodontics',
  'oral-care-system',
  'anesthesia'
)
AND (
  "nameAr" IS NULL
  OR BTRIM("nameAr") = ''
  OR BTRIM("nameAr") = BTRIM("name")
);
