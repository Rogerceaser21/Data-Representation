/**
 * AIS R3 Evidence Form Web App · Config
 *
 * SHEET_ID is stored in PropertiesService (not hardcoded) so the
 * bootstrap() function in 03_helpers.gs can create the Sheet and
 * register the ID without requiring a code change + redeploy.
 *
 * To set up a fresh deployment: open this script in the editor,
 * run bootstrap() once. It creates the Sheet, seeds the reference
 * tabs, and writes the SHEET_ID into script properties.
 */

const SHEET_NAME_SUBMISSIONS = 'Submissions';
const SHEET_NAME_TEACHERS    = 'Teachers';
const SHEET_NAME_INSPECTORS  = 'Inspectors';
const SHEET_NAME_CURRICULUM  = 'Curriculum';
const SHEET_NAME_SUBJECTS    = 'Subjects';

const SEED_INSPECTORS = ['Dave Richards', 'Hayden Ryan', 'Brooke Pickett'];
const SEED_CURRICULUM = ['Australian', 'Ministry'];
const SEED_SUBJECTS   = ['Maths', 'English', 'Science', 'Arabic', 'Islamic'];

/**
 * The 6 AIS staff Google Workspace Groups that contain potential R3 observees.
 * Lifted from TRS IRL Project / Google Script Email Trigger / 00_Config.gs.
 */
const TEACHER_GROUPS = [
  'secondary@ais.ae',
  'lsas@ais.ae',
  'jsc@ais.ae',
  'jsm@ais.ae',
  'kindy@ais.ae',
  'ecc@ais.ae'
];

/**
 * Reads the SHEET_ID from PropertiesService. Throws a clear error if not set
 * so doPost / doGet / buildTeacherSheet fail loudly instead of silently
 * writing to the wrong place.
 */
function getSheetId() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) {
    throw new Error('SHEET_ID is not set. Open this script in the editor and run bootstrap() first.');
  }
  return id;
}

/**
 * Column layout for the Submissions tab. Wide-and-flat: every judgement gets
 * a rating column (1-6) AND a comment column.
 *
 * Order is load-bearing once the header row is written. To add columns,
 * append at the end. Never reorder or insert in the middle.
 */
function getR3Columns() {
  const header = [
    'record_id', 'submitted_at',
    'teacher', 'curriculum', 'inspector', 'observation_date',
    'duration', 'room_number', 'grade_class',
    'time_in', 'time_out', 'subject', 'ability_group',
    'gender', 'present', 'support_teachers_cas',
    'num_sen', 'num_gt', 'num_on_roll', 'num_male', 'num_female',
    'evidence_type', 'focus_context'
  ];

  const judgementCategories = [
    'attainment', 'progress', 'learning_skills', 'psd_innovation',
    'teaching', 'assessment', 'curriculum_judgement', 'pcgs',
    'leadership_management', 'other'
  ];

  const judgementCols = [];
  judgementCategories.forEach(function(cat) {
    judgementCols.push('j_' + cat);
    judgementCols.push('j_' + cat + '_c');
  });

  const tail = ['summary_strengths', 'summary_weakness', 'observer_notes', 'school'];

  return header.concat(judgementCols, tail);
}
