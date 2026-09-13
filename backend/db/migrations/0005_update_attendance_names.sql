-- Reuse the existing roster positions and employee codes as requested. All
-- attendance dates and times remain unchanged.
UPDATE attendance_employees
SET name = 'احمد هاشم', is_active = 1
WHERE employee_code = '7105';

UPDATE attendance_employees
SET name = 'عيد شحادة مسعد اسكندر', is_active = 1
WHERE employee_code = '7195';
