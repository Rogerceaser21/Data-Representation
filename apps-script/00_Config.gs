/**
 * AIS Lesson Observation Web App · Config
 *
 * The target spreadsheet where submissions land. Hard-coded so the
 * deployed Web App needs no per-request setup. If the sheet ID ever
 * changes, redeploy.
 */
const SHEET_ID = '1KKgHe42JnRe5iA8iODRrh3UZHD93szZSDatQylivoAc';
const SHEET_NAME = 'Submissions';

/**
 * Column layout for the Submissions sheet.
 * Wide-and-flat: every criterion gets its own S/U cell + its own comment cell.
 * Easy to filter, easy to query, easy to chart.
 */
function getColumns() {
  const base = ['record_id', 'submitted_at', 'observation_date',
                'teacher', 'subject', 'class',
                'observer', 'position'];

  const sections = [
    ['cm', 7],   // Classroom Management
    ['ir', 7],   // Interpersonal Relationships
    ['cd', 11],  // Curriculum Development
    ['tl', 11]   // Teaching & Learning
  ];

  const criteria = [];
  sections.forEach(function(s) {
    const prefix = s[0], count = s[1];
    for (var i = 1; i <= count; i++) {
      criteria.push(prefix + '-' + i);          // S or U or empty
      criteria.push(prefix + '-' + i + '-c');   // free-text comment
    }
  });

  const tail = ['overall', 'feedback_date',
                'sig_teacher', 'sig_observer', 'sig_date'];

  return base.concat(criteria, tail);
}
