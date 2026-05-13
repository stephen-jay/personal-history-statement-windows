/**
 * Education field conditional validation
 * Makes the "Year Graduated" field optional if the location is "N/A"
 */

const EDUCATION_LEVELS = [
  { location: 'elemLocation', attendance: 'elemAttendance', graduated: 'elemGraduated' },
  { location: 'hsLocation', attendance: 'hsAttendance', graduated: 'hsGraduated' },
  { location: 'collegeLocation', attendance: 'collegeAttendance', graduated: 'collegeGraduated' },
  { location: 'pgLocation', attendance: 'pgCourseAttendance', graduated: 'pgGraduated' }
];

/**
 * Update required status of year field based on location
 * @param {string} locationFieldId - ID of the location field
 * @param {string} graduatedFieldId - ID of the year graduated field
 * @param {string} attendanceFieldId - ID of the attendance field
 */
function updateYearFieldRequirement(locationFieldId, graduatedFieldId, attendanceFieldId) {
  const locationEl = document.getElementById(locationFieldId);
  const graduatedEl = document.getElementById(graduatedFieldId);
  const attendanceEl = document.getElementById(attendanceFieldId);
  
  if (!locationEl || !graduatedEl) return;
  
  const locationValue = String(locationEl.value).trim().toUpperCase();
  const isNA = locationValue === 'N/A';
  
  // If location is "N/A", make year optional; otherwise make it required
  if (isNA) {
    graduatedEl.removeAttribute('required');
    if (attendanceEl) attendanceEl.removeAttribute('required');
  } else if (locationValue) {
    // Only set required if location has a value
    graduatedEl.setAttribute('required', '');
    if (attendanceEl) attendanceEl.setAttribute('required', '');
  }
}

/**
 * Initialize education field validation
 * Sets up event listeners on all location fields
 */
export function initEducationValidation() {
  EDUCATION_LEVELS.forEach(level => {
    const locationEl = document.getElementById(level.location);
    if (!locationEl) return;
    
    // Update on initial load
    updateYearFieldRequirement(level.location, level.graduated, level.attendance);
    
    // Update on change
    locationEl.addEventListener('change', function () {
      updateYearFieldRequirement(level.location, level.graduated, level.attendance);
    });
    
    // Also listen for input to provide real-time feedback
    locationEl.addEventListener('input', function () {
      updateYearFieldRequirement(level.location, level.graduated, level.attendance);
    });
  });
}
