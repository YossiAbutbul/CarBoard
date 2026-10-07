-- Car picture: toy body type and paint colour, both optional.
alter table cars add column if not exists body text check (body in ('car', 'suv', 'pickup', 'van', 'small', 'family', 'sport'));
alter table cars add column if not exists paint text;
