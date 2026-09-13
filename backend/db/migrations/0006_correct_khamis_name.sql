-- Correct the employee name while preserving all attendance linked to code 7088.
UPDATE attendance_employees
SET name = 'خميس عوده غمار الحوامدة'
WHERE employee_code = '7088';
