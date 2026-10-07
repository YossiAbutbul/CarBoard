-- Car avatar: body type and paint colour, both optional.
alter table cars add column if not exists body text check (body in ('small', 'family', 'suv', 'van', 'pickup', 'sport'));
alter table cars add column if not exists paint text;
