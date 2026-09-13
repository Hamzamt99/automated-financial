-- Correct employee names by their existing roster order. Attendance rows are
-- linked by employee_code, so their dates and times remain unchanged.

UPDATE attendance_employees SET name = 'محمود زهدي كامل العريني', is_active = 1 WHERE employee_code = '7065';
UPDATE attendance_employees SET name = 'محمد مصطفى ابراهيم الحناوي', is_active = 1 WHERE employee_code = '7066';
UPDATE attendance_employees SET name = 'محمد هلال خضر ابو نصير', is_active = 1 WHERE employee_code = '7067';
UPDATE attendance_employees SET name = 'عبدالله امجد يحيى محمد', is_active = 1 WHERE employee_code = '7070';
UPDATE attendance_employees SET name = 'خميس عوده عمار الحوامدة', is_active = 1 WHERE employee_code = '7088';
UPDATE attendance_employees SET name = 'منجد محمد موسى بشناق', is_active = 1 WHERE employee_code = '7105';
UPDATE attendance_employees SET name = 'ياسين كمال سليمان ابو صبيح', is_active = 1 WHERE employee_code = '7125';
UPDATE attendance_employees SET name = 'عمر حمد حمدان الحوامده', is_active = 1 WHERE employee_code = '7130';
UPDATE attendance_employees SET name = 'انس سلامه عبد الحافظ البداوي', is_active = 1 WHERE employee_code = '7137';
UPDATE attendance_employees SET name = 'معاذ سعيد حسين حامد', is_active = 1 WHERE employee_code = '7142';
UPDATE attendance_employees SET name = 'ابراهيم احمد ناجي الحاج', is_active = 1 WHERE employee_code = '7157';
UPDATE attendance_employees SET name = 'مروان سمير فتحي قطيشات', is_active = 1 WHERE employee_code = '7171';
UPDATE attendance_employees SET name = 'محمود محمد ابراهيم عفانه', is_active = 1 WHERE employee_code = '7192';
UPDATE attendance_employees SET name = 'عيد شحاته مسعد اسكندر', is_active = 1 WHERE employee_code = '7195';
UPDATE attendance_employees SET name = 'عيد نسيم قداس بدروس', is_active = 1 WHERE employee_code = '7200';
UPDATE attendance_employees SET name = 'انس خميس علي المسامح', is_active = 1 WHERE employee_code = '1000093';

-- The corrected roster contains 16 employees. Keep the unused old row archived
-- instead of deleting it so any future historical reference remains safe.
UPDATE attendance_employees SET is_active = 0 WHERE employee_code = '1000094';
